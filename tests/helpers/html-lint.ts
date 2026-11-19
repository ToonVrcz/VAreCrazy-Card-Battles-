// XSS allowlist lint. Parses the inline scripts of an HTML page (or a .js file) and reports every value that is interpolated into
// an HTML string without being provably safe. "Provably safe" means one of:
//   - wrapped in esc(...)                                   - number / boolean arithmetic, comparisons, literals
//   - a property that only holds numbers or validated codes  - a lookup in a constant table of literals
//   - a local helper whose every return value is itself safe  - a .map(...).join() whose callback returns safe values
//   - a parameter bound to an element of a constant literal array
// Anything else must be escaped in the page or be listed (with a reason) in the allowlist of the test that calls this.
// Principle: what cannot be PROVEN safe is unsafe. Nested templates, helper arguments, string-method arguments, reassigned variables,
// destructuring, for-of targets, shadowing parameters and every known HTML/script sink are all analysed; unknown shapes are reported.
import { parseSync } from 'rolldown/utils';

/** Properties that only ever hold numbers, booleans or server-validated codes (room code = 5 chars [A-Z0-9]). */
export const NUM_PROPS = new Set(['hp', 'maxHp', 'atk', 'def', 'level', 'length', 'price', 'amount', 'qty', 'owned', 'min_members', 'min', 'max', 'points', 'vrcoin', 'matches',
  'pvp_matches', 'turn', 'lp', 'size', 'count', 'version', 'version_no', 'seat', 'uid', 'bonusAtk', 'bonusDef', 'auraAtk', 'auraDef', 'turnSec', 'spectators', 'spectatorMax',
  'total', 'wins', 'losses', 'turns', 'evoMax', 'slots', 'matchesToVrcoin', 'max_stacks', 'min_materials', 'len', 'code', 'slot', 'matchPoints', 'vrcoinEvery', 'vrcoinBatch', 'i']);
/** Array methods whose callback receives (element, index): the 2nd parameter is always a number. */
const IDX_METHODS = new Set(['map', 'forEach', 'filter', 'some', 'every', 'find', 'findIndex', 'flatMap']);

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

    // ---- scopes: every identifier is resolved to the nearest declaration (function-level scopes; block scoping is merged, which is conservative) ----
    interface Scope { parent: Scope | null; vars: Map<string, any[]>; params: Set<string> }
    const newScope = (parent: Scope | null): Scope => ({ parent, vars: new Map(), params: new Set() });
    const root = newScope(null), scopeOf = new WeakMap<object, Scope>();
    const isFn = (n: any) => !!n && (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration');
    const declare = (sc: Scope, name: string, init: any) => { if (!sc.vars.has(name)) sc.vars.set(name, []); sc.vars.get(name)!.push(init); };
    const patNames = (n: any, out: string[] = []): string[] => {
      if (!n) return out;
      if (n.type === 'Identifier') out.push(n.name);
      else if (n.type === 'ArrayPattern') n.elements.forEach((e: any) => patNames(e, out));
      else if (n.type === 'ObjectPattern') n.properties.forEach((p: any) => patNames(p.type === 'RestElement' ? p.argument : p.value, out));
      else if (n.type === 'AssignmentPattern') patNames(n.left, out);
      else if (n.type === 'RestElement') patNames(n.argument, out);
      return out;
    };
    /** Nearest declaration of `name` seen from `from`: a parameter (value unknown) or a variable with all the values ever given to it. */
    const resolve = (name: string, from: Scope | undefined): { param: true } | { param: false; sc: Scope; list: any[] } | null => {
      for (let sc = from ?? root; sc; sc = sc.parent!) { if (sc.params.has(name)) return { param: true }; const l = sc.vars.get(name); if (l) return { param: false, sc, list: l }; }
      return null;
    };
    (function build(n: any, sc: Scope) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(c => build(c, sc)); return; }
      if (n.type === 'Identifier') { scopeOf.set(n, sc); return; }
      if (isFn(n)) {
        if (n.type === 'FunctionDeclaration' && n.id) declare(sc, n.id.name, n);
        const inner = newScope(sc);
        if (n.type === 'FunctionExpression' && n.id) declare(inner, n.id.name, n);
        for (const prm of n.params) { patNames(prm).forEach(x => inner.params.add(x)); build(prm, inner); }
        build(n.body, inner); return;
      }
      if (n.type === 'CatchClause') { const inner = newScope(sc); if (n.param) patNames(n.param).forEach(x => inner.params.add(x)); build(n.body, inner); return; }
      if (n.type === 'VariableDeclarator') {
        if (n.id.type === 'Identifier') declare(sc, n.id.name, n.init); else patNames(n.id).forEach(x => declare(sc, x, null));   // destructuring: value unknown
      }
      for (const k of Object.keys(n)) if (k !== 'start' && k !== 'end' && k !== 'type') build(n[k], sc);
    })(r.program, root);
    // every later assignment to a variable is another possible value of it (second pass: assignments may precede the declaration textually)
    (function assigns(n: any) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(assigns); return; }
      const give = (id: any, v: any) => { const rs = resolve(id.name, scopeOf.get(id)); if (rs && !rs.param) rs.list.push(v); else if (!rs) declare(root, id.name, v); };
      if (n.type === 'AssignmentExpression') {
        const ids = n.left.type === 'Identifier' ? [n.left] : (function f(x: any, o: any[] = []) { if (!x) return o; if (x.type === 'Identifier') o.push(x); else if (x.type === 'ArrayPattern') x.elements.forEach((e: any) => f(e, o)); else if (x.type === 'ObjectPattern') x.properties.forEach((p: any) => f(p.type === 'RestElement' ? p.argument : p.value, o)); else if (x.type === 'AssignmentPattern') f(x.left, o); else if (x.type === 'RestElement') f(x.argument, o); return o; })(n.left);
        for (const id of ids) {
          if (n.left.type === 'Identifier' && (n.operator === '=' || n.operator === '+=')) give(id, n.right);
          else if (!['-=', '*=', '/=', '%=', '**='].includes(n.operator)) give(id, null);
        }
      }
      if ((n.type === 'ForOfStatement' || n.type === 'ForInStatement') && n.left.type !== 'VariableDeclaration') for (const x of patNames(n.left)) { const id = { name: x } as any; const f = (function find(y: any): any { if (!y) return null; if (y.type === 'Identifier' && y.name === x) return y; return null; })(n.left); give(f ?? id, null); }
      for (const k of Object.keys(n)) if (k !== 'start' && k !== 'end' && k !== 'type') assigns(n[k]);
    })(r.program);
    /** Functions an identifier may refer to (null if any of its values is not a function). */
    const fnsOf = (id: any): any[] | null => { const rs = resolve(id.name, scopeOf.get(id)); return rs && !rs.param && rs.list.length && rs.list.every(isFn) ? rs.list : null; };

    /** Constant data made only of literals (no expressions). */
    const lit = (n: any, d = 0): boolean => {
      if (!n || d > 6) return false;
      switch (n.type) {
        case 'Literal': return true;
        case 'Identifier': return !!fnsOf(n);   // a function reference placed in a table (menu handlers)
        case 'TemplateLiteral': return n.expressions.length === 0;
        case 'ParenthesizedExpression': return lit(n.expression, d + 1);
        case 'ArrayExpression': return n.elements.every((e: any) => e && (e.type === 'SpreadElement' ? litRef(e.argument) : lit(e, d + 1)));
        case 'ObjectExpression': return n.properties.every((p: any) => p.type === 'Property' && lit(p.value, d + 1));
        default: return false;
      }
    };
    const litRef = (n: any): boolean => {
      if (n.type === 'Identifier') { const rs = resolve(n.name, scopeOf.get(n)); return !!rs && !rs.param && rs.list.every((i: any) => lit(i)); }
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Object' && n.callee.property.name === 'keys') return litRef(n.arguments[0]);
      return lit(n);
    };

    const bound = new Set<string>();   // parameters bound to values that are provably safe (elements of constant literal arrays, callback indexes)
    const busy = new Set<any>();
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
    const paramNames = (fn: any) => fn.params.flatMap((p: any) => patNames(p));
    const withBound = <T>(names: string[], f: () => T): T => { const added = names.filter(x => !bound.has(x)); added.forEach(x => bound.add(x)); try { return f(); } finally { added.forEach(x => bound.delete(x)); } };
    const fnSafe = (fn: any) => returns(fn).every(a => safe(a));
    const callMethod = (c: any) => (c?.type === 'CallExpression' && c.callee.type === 'MemberExpression' && !c.callee.computed ? c.callee.property.name : null);
    const mapOverLiteral = (call: any) => ['map', 'forEach', 'filter'].includes(callMethod(call) as string) && litRef(call.callee.object);
    /** Names to treat as safe inside a callback: every parameter when iterating a constant literal array, otherwise only the numeric index. */
    const cbBound = (call: any, cb: any): string[] => {
      if (!isFn(cb)) return [];
      if (mapOverLiteral(call)) return paramNames(cb);
      return IDX_METHODS.has(callMethod(call) as string) && cb.params[1]?.type === 'Identifier' ? [cb.params[1].name] : [];
    };
    const STR_METHODS = ['replace', 'replaceAll', 'slice', 'substring', 'substr', 'toUpperCase', 'toLowerCase', 'trim', 'trimStart', 'trimEnd', 'repeat', 'padStart', 'padEnd', 'concat', 'normalize'];

    function safe(n: any): boolean {
      if (!n) return true;
      switch (n.type) {
        case 'Literal': return true;
        case 'TemplateLiteral': return n.expressions.every((e: any) => safe(e));       // nested templates are checked, with or without markup
        case 'ParenthesizedExpression': case 'ChainExpression': return safe(n.expression);
        case 'Identifier': {
          if (bound.has(n.name)) return true;
          const rs = resolve(n.name, scopeOf.get(n)); if (!rs || rs.param || busy.has(n)) return false;   // a parameter, or undeclared: value unknown
          busy.add(n); const ok = rs.list.every((i: any) => i && !isFn(i) && safe(i)); busy.delete(n); return ok;
        }
        case 'MemberExpression': {
          const p = prop(n); if (p && NUM_PROPS.has(p)) return true;
          if (n.computed && (litRef(n.object) || (n.object.type === 'ParenthesizedExpression' && lit(n.object.expression)))) return true;   // lookup in a constant table
          if (n.computed && n.object.type === 'Identifier' && bound.has(n.object.name)) return true;
          if (n.object.type === 'Identifier' && (n.computed || p)) {   // lookup in a named object literal whose every value is itself safe (e.g. a table of SVG snippets)
            const rs = resolve(n.object.name, scopeOf.get(n.object));
            if (rs && !rs.param && !busy.has(n.object)) {
              busy.add(n.object);
              const ok = rs.list.every((i: any) => i?.type === 'ObjectExpression' && i.properties.every((x: any) => x.type === 'Property' && !x.computed && safe(x.value)));
              busy.delete(n.object);
              if (ok) return true;
            }
          }
          if (n.computed && n.object.type === 'ObjectExpression' && n.object.properties.every((x: any) => x.type === 'Property' && safe(x.value))) return true;   // ({a:'..',b:'..'})[key]
          if (n.computed && n.object.type === 'ParenthesizedExpression' && n.object.expression.type === 'ObjectExpression') return safe({ ...n, object: n.object.expression });
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
            const f = fnsOf(c);
            if (f && !busy.has(c)) { busy.add(c); const ok = f.every(fnSafe); busy.delete(c); return ok; }   // every function this name may hold
            return false;
          }
          if (c.type === 'ParenthesizedExpression') return safe({ ...n, callee: c.expression });
          if (isFn(c)) return fnSafe(c);
          if (c.type === 'MemberExpression' && !c.computed) {
            const p = c.property.name;
            if (STR_METHODS.includes(p)) {                                           // string shaping: the object AND every argument (e.g. a replacement string or callback) must be safe
              return safe(c.object) && n.arguments.every((a: any) => (isFn(a) ? fnSafe(a) : safe(a)));
            }
            if (p === 'join') {
              const o = c.object;
              if (callMethod(o) === 'map') {
                const cb = o.arguments[0];
                if (cb?.type === 'Identifier' && cb.name === 'esc') return true;          // x.map(esc).join(...)
                const run = () => {
                  if (isFn(cb)) return fnSafe(cb);
                  if (cb?.type === 'Identifier') { const f = fnsOf(cb); return !!f && f.every(fnSafe); }
                  return false;
                };
                return withBound(cbBound(o, cb), run);
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

    const report = (e: any, why = '') => { const code = txt(e).slice(0, 110), full = why ? `${why}: ${code}` : code; if (!allowed.has(full)) findings.push({ file, line: line(e.start), code: full }); };   // allowlist entries match the full finding text (kind + code)
    const isHtmlTpl = (n: any) => n.quasis.some((q: any) => q.value.raw.includes('<'));
    const flatten = (n: any): any[] => (n.type === 'BinaryExpression' && n.operator === '+' ? [...flatten(n.left), ...flatten(n.right)] : [n]);
    const SINKS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);
    const sinkName = (n: any): string | null => {
      if (n?.type !== 'MemberExpression') return null;
      const k = n.computed ? (n.property.type === 'Literal' ? String(n.property.value) : '*') : n.property.name;
      return k === '*' ? '*' : SINKS.has(k) ? k : null;
    };

    (function walk(n: any, parent?: any) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(c => walk(c, parent)); return; }
      if (n.type === 'TemplateLiteral' && isHtmlTpl(n)) for (const e of n.expressions) if (!safe(e)) report(e);
      if (n.type === 'BinaryExpression' && n.operator === '+' && !(parent?.type === 'BinaryExpression' && parent.operator === '+')) {
        const parts = flatten(n);
        if (parts.some(p => p.type === 'Literal' && typeof p.value === 'string' && p.value.includes('<'))) for (const p of parts) if (!safe(p)) report(p, 'concat');
      }
      // HTML / script sinks: the whole assigned value must be provably safe (templates without markup and `+=` included)
      if (n.type === 'AssignmentExpression' && (n.operator === '=' || n.operator === '+=')) {
        const sk = sinkName(n.left);
        if (sk === '*') { if (!safe(n.right)) report(n.right, 'computed-property assignment'); }
        else if (sk && !safe(n.right)) report(n.right, sk);
      }
      if (n.type === 'Property' && !n.computed && n.key && SINKS.has(n.key.name ?? n.key.value) && !safe(n.value)) report(n.value, 'object-literal ' + (n.key.name ?? n.key.value));
      if (n.type === 'CallExpression') {
        const m = callMethod(n), a0 = n.arguments[0], a1 = n.arguments[1];
        if (m === 'insertAdjacentHTML' && !safe(a1)) report(n, 'insertAdjacentHTML');
        if ((m === 'write' || m === 'writeln') && n.callee.object?.name === 'document' && !safe(a0)) report(n, 'document.write');
        if (m === 'createContextualFragment' && !safe(a0)) report(n, 'createContextualFragment');
        if (m === 'parseFromString' && !safe(a0)) report(n, 'parseFromString');
        if (m === 'setAttribute' && a0?.type === 'Literal' && /^(on|srcdoc$)/i.test(String(a0.value))) report(n, 'setAttribute');
        if (m === 'setAttribute' && a0?.type !== 'Literal') report(n, 'setAttribute(dynamic name)');
        if (n.callee.type === 'Identifier' && ['eval', 'Function'].includes(n.callee.name) && a0?.type !== 'Literal') report(n, n.callee.name);
        if (n.callee.type === 'Identifier' && ['setTimeout', 'setInterval'].includes(n.callee.name) && a0 && !isFn(a0) && a0.type !== 'Identifier') report(n, n.callee.name + '(string)');
      }
      if (n.type === 'NewExpression' && n.callee.type === 'Identifier' && n.callee.name === 'Function') report(n, 'new Function');
      if (n.type === 'CallExpression' && n.arguments.some(isFn) && (mapOverLiteral(n) || IDX_METHODS.has(callMethod(n) as string))) {
        walk(n.callee, n);
        for (const a of n.arguments) { if (isFn(a)) withBound(cbBound(n, a), () => walk(a, n)); else walk(a, n); }
        return;
      }
      for (const k of Object.keys(n)) if (k !== 'start' && k !== 'end' && k !== 'type') walk(n[k], n);
    })(r.program);
  }
  return findings;
}
