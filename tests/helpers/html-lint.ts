// XSS allowlist lint. Parses the inline scripts of an HTML page (or a .js file) and reports every value that is interpolated into
// an HTML string without being provably safe. "Provably safe" means one of:
//   - wrapped in esc(...)                                   - number / boolean arithmetic, comparisons, literals
//   - a property that only holds numbers or validated codes  - a lookup in a constant table of literals
//   - a local helper whose every return value is itself safe  - a .map(...).join() whose callback returns safe values
//   - a parameter bound to an element of a constant literal array
// Anything else must be escaped in the page or be listed (with a reason) in the allowlist of the test that calls this.
import { parseSync } from 'rolldown/utils';

/** Properties that only ever hold numbers, booleans or server-validated codes (room code = 5 chars [A-Z0-9]). */
export const NUM_PROPS = new Set(['hp', 'maxHp', 'atk', 'def', 'level', 'length', 'price', 'amount', 'qty', 'owned', 'min_members', 'min', 'max', 'points', 'vrcoin', 'matches',
  'pvp_matches', 'turn', 'lp', 'size', 'count', 'version', 'version_no', 'seat', 'uid', 'bonusAtk', 'bonusDef', 'auraAtk', 'auraDef', 'turnSec', 'spectators', 'spectatorMax',
  'total', 'wins', 'losses', 'turns', 'evoMax', 'slots', 'matchesToVrcoin', 'max_stacks', 'min_materials', 'len', 'code', 'slot', 'matchPoints', 'vrcoinEvery', 'vrcoinBatch', 'i']);
/** Local variable names that are loop counters / numbers. */
const NUM_NAMES = new Set(['i', 'k', 'j', 'n', 'l', 'ix']);

export interface Finding { file: string; line: number; code: string }
export interface Allow { file: string; code: string; why: string }

function scripts(file: string, text: string) {
  if (!file.endsWith('.html')) return [{ src: text, off: 0 }];
  const out: { src: string; off: number }[] = []; const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ src: m[1], off: m.index + m[0].indexOf(m[1]) });
  return out;
}

export function lintSource(file: string, text: string, allow: Allow[] = []): Finding[] {
  const findings: Finding[] = [];
  const allowed = new Set(allow.filter(a => a.file === file).map(a => a.code));
  for (const sc of scripts(file, text)) {
    const r = parseSync('x.js', sc.src) as any;
    if (r.errors.length) { findings.push({ file, line: 0, code: 'PARSE ERROR ' + r.errors[0].message }); continue; }
    const line = (pos: number) => text.slice(0, sc.off + pos).split('\n').length;
    const txt = (n: any) => sc.src.slice(n.start, n.end).replace(/\s+/g, ' ');
    const prop = (n: any) => (n.type === 'MemberExpression' && !n.computed ? n.property.name : null);

    const decls = new Map<string, any[]>(), fns = new Map<string, any>();
    (function collect(n: any) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(collect); return; }
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') {
        if (!decls.has(n.id.name)) decls.set(n.id.name, []); decls.get(n.id.name)!.push(n.init);
        if (n.init && (n.init.type === 'ArrowFunctionExpression' || n.init.type === 'FunctionExpression')) fns.set(n.id.name, n.init);
      }
      if (n.type === 'FunctionDeclaration' && n.id) fns.set(n.id.name, n);
      for (const k of Object.keys(n)) if (k !== 'start' && k !== 'end' && k !== 'type') collect(n[k]);
    })(r.program);

    /** Constant data made only of literals (no expressions). */
    const lit = (n: any, d = 0): boolean => {
      if (!n || d > 6) return false;
      switch (n.type) {
        case 'Literal': return true;
        case 'Identifier': return fns.has(n.name);   // a function reference placed in a table (menu handlers)
        case 'TemplateLiteral': return n.expressions.length === 0;
        case 'ParenthesizedExpression': return lit(n.expression, d + 1);
        case 'ArrayExpression': return n.elements.every((e: any) => e && (e.type === 'SpreadElement' ? litRef(e.argument) : lit(e, d + 1)));
        case 'ObjectExpression': return n.properties.every((p: any) => p.type === 'Property' && lit(p.value, d + 1));
        default: return false;
      }
    };
    const litRef = (n: any): boolean => {
      if (n.type === 'Identifier') { const d = decls.get(n.name); return !!d && d.every((i: any) => lit(i)); }
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Object' && n.callee.property.name === 'keys') return litRef(n.arguments[0]);
      return lit(n);
    };

    const bound = new Set<string>();   // parameters bound to elements of constant literal arrays
    const busy = new Set<string>();
    const returns = (fn: any): any[] => {
      if (fn.body.type !== 'BlockStatement') return [fn.body];
      const out: any[] = [];
      (function w(n: any) {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(w); return; }
        if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') return;
        if (n.type === 'ReturnStatement') { out.push(n.argument); return; }
        for (const k of Object.keys(n)) if (k !== 'start' && k !== 'end' && k !== 'type') w(n[k]);
      })(fn.body);
      return out;
    };
    const paramNames = (fn: any) => fn.params.map((p: any) => (p.type === 'Identifier' ? p.name : p.type === 'AssignmentPattern' && p.left.type === 'Identifier' ? p.left.name : null)).filter(Boolean) as string[];
    const withBound = <T>(names: string[], f: () => T): T => { const added = names.filter(x => !bound.has(x)); added.forEach(x => bound.add(x)); try { return f(); } finally { added.forEach(x => bound.delete(x)); } };
    const fnSafe = (fn: any) => returns(fn).every(a => safe(a));
    const mapOverLiteral = (call: any) => call.type === 'CallExpression' && call.callee.type === 'MemberExpression' && ['map', 'forEach', 'filter'].includes(call.callee.property?.name) && litRef(call.callee.object);

    function safe(n: any): boolean {
      if (!n) return true;
      switch (n.type) {
        case 'Literal': case 'TemplateLiteral': return true;
        case 'ParenthesizedExpression': case 'ChainExpression': return safe(n.expression);
        case 'Identifier': {
          if (NUM_NAMES.has(n.name) || bound.has(n.name)) return true;
          const d = decls.get(n.name); if (!d || busy.has(n.name)) return false;
          busy.add(n.name); const ok = d.every((i: any) => i && i.type !== 'ArrowFunctionExpression' && i.type !== 'FunctionExpression' && safe(i)); busy.delete(n.name); return ok;
        }
        case 'MemberExpression': {
          const p = prop(n); if (p && NUM_PROPS.has(p)) return true;
          if (n.computed && (litRef(n.object) || (n.object.type === 'ParenthesizedExpression' && lit(n.object.expression)))) return true;   // lookup in a constant table
          if (n.computed && bound.has(n.object.name)) return true;
          if (n.computed && n.object.type === 'ObjectExpression' && n.object.properties.every((x: any) => x.type === 'Property' && safe(x.value))) return true;   // ({a:'..',b:'..'})[key]
          if (n.computed && n.object.type === 'ParenthesizedExpression' && n.object.expression.type === 'ObjectExpression') return safe({ ...n, object: n.object.expression });
          if (n.computed && n.object.type === 'Identifier' && safe(n.object)) return true;   // a row taken from a constant table
          return false;
        }
        case 'ConditionalExpression': return safe(n.consequent) && safe(n.alternate);
        case 'LogicalExpression': return n.operator === '&&' ? safe(n.right) : safe(n.left) && safe(n.right);   // `a && b` yields b or a falsy value
        case 'UnaryExpression': return true;
        case 'BinaryExpression':
          return ['-', '*', '/', '%', '**', '==', '===', '!=', '!==', '<', '>', '<=', '>=', 'in', 'instanceof'].includes(n.operator) || (n.operator === '+' && safe(n.left) && safe(n.right));
        case 'CallExpression': {
          const c = n.callee;
          if (c.type === 'Identifier') {
            if (c.name === 'esc' || ['Number', 'parseInt', 'parseFloat', 'Boolean'].includes(c.name)) return true;
            if (c.name === 'String') return n.arguments.every((a: any) => safe(a));
            if (fns.has(c.name) && !busy.has('fn:' + c.name)) { busy.add('fn:' + c.name); const ok = fnSafe(fns.get(c.name)); busy.delete('fn:' + c.name); return ok; }
            return false;
          }
          if (c.type === 'ParenthesizedExpression') return safe({ ...n, callee: c.expression });
          if (c.type === 'ArrowFunctionExpression' || c.type === 'FunctionExpression') return fnSafe(c);
          if (c.type === 'MemberExpression' && !c.computed) {
            const p = c.property.name;
            if (['replace', 'slice', 'toUpperCase', 'toLowerCase', 'trim', 'repeat', 'padStart', 'padEnd'].includes(p) && safe(c.object)) return true;   // string/array shaping of an already-safe value
            if (p === 'join') {
              const o = c.object;
              if (o.type === 'CallExpression' && o.callee.type === 'MemberExpression' && o.callee.property.name === 'map') {
                const cb = o.arguments[0];
                if (cb?.type === 'Identifier' && cb.name === 'esc') return true;          // x.map(esc).join(...)
                const run = () => {
                  if (cb && (cb.type === 'ArrowFunctionExpression' || cb.type === 'FunctionExpression')) return fnSafe(cb);
                  if (cb?.type === 'Identifier' && fns.has(cb.name)) return fnSafe(fns.get(cb.name));
                  return false;
                };
                return mapOverLiteral(o) && cb?.params ? withBound(paramNames(cb), run) : run();
              }
              return false;
            }
            if (['toFixed', 'toLocaleString'].includes(p)) return true;
            if (c.object.type === 'Identifier' && c.object.name === 'Math') return true;
            if (c.object.type === 'Identifier' && c.object.name === 'VCZ' && p === 'svg') return true;   // card-renderer.js, linted separately
          }
          return false;
        }
        default: return false;
      }
    }

    const report = (e: any, why = '') => { const code = txt(e).slice(0, 110); if (!allowed.has(code)) findings.push({ file, line: line(e.start), code: why ? `${why}: ${code}` : code }); };
    const isHtmlTpl = (n: any) => n.quasis.some((q: any) => q.value.raw.includes('<'));
    const flatten = (n: any): any[] => (n.type === 'BinaryExpression' && n.operator === '+' ? [...flatten(n.left), ...flatten(n.right)] : [n]);
    const isInnerHtmlTarget = (n: any) => n?.type === 'MemberExpression' && ['innerHTML', 'outerHTML'].includes(n.property?.name);

    (function walk(n: any, parent?: any) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(c => walk(c, parent)); return; }
      if (n.type === 'TemplateLiteral' && isHtmlTpl(n)) for (const e of n.expressions) if (!safe(e)) report(e);
      if (n.type === 'BinaryExpression' && n.operator === '+' && !(parent?.type === 'BinaryExpression' && parent.operator === '+')) {
        const parts = flatten(n);
        if (parts.some(p => p.type === 'Literal' && typeof p.value === 'string' && p.value.includes('<'))) for (const p of parts) if (!safe(p)) report(p, 'concat');
      }
      if (n.type === 'AssignmentExpression' && isInnerHtmlTarget(n.left) && n.right.type !== 'TemplateLiteral' && n.right.type !== 'BinaryExpression' && !safe(n.right)) report(n.right, 'innerHTML');
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && ['insertAdjacentHTML'].includes(n.callee.property?.name)) report(n, 'insertAdjacentHTML');
      if (mapOverLiteral(n)) {
        const cb = n.arguments[0];
        for (const k of ['callee', 'arguments']) {
          if (k === 'arguments' && cb?.params) { withBound(paramNames(cb), () => walk(cb, n)); continue; }
          walk(n[k], n);
        }
        return;
      }
      for (const k of Object.keys(n)) if (k !== 'start' && k !== 'end' && k !== 'type') walk(n[k], n);
    })(r.program);
  }
  return findings;
}
