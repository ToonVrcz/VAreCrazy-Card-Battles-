import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lintSource, type Allow } from './helpers/html-lint';

// The canonical escaper (same behaviour as the one in the pages). The lint verifies an escaper by RUNNING it, so fixtures that use esc must define it.
const ESC = `const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));\n`;
const read = (f: string) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// Allowlist: exactly these findings, each tied to its kind and code. Every entry is an assignment of a form/number value into a plain data
// object (a counter map, or the card / effect / price model being edited), keyed by a counter id or a data-* attribute that the page
// itself renders from constant field names. None of them targets a DOM node, so none can reach innerHTML / outerHTML / srcdoc.
// The lint flags any computed-key assignment it cannot prove harmless, because `el[k] = html` with k === 'innerHTML' would be a sink.
const KIND = 'computed-property assignment: ';
const why = (w: string) => w;
const ALLOW: Allow[] = ([
  ['public/play.html', '[u.hp,u.atk+u.bonusAtk+(u.auraAtk||0),u.def+u.bonusDef]', why('snapshot map m[uid] = [numbers] used for damage floats')],
  ['public/play.html', 'v', why('deck-builder count map C[cardId] = number (v is a bounded integer computed from the previous count)')],
  ['public/admin.html', "e.type==='checkbox'?e.checked:e.value", why('card form field -> card model object, keyed by data-k rendered from constant field names')],
  ['public/admin.html', 'el.value', why('effect / frame form field -> model object keyed by data-i / data-f / data-fp rendered by the page (two sites)')],
  ['public/admin.html', "el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:+el.value):(el.value||null)", why('effect config field -> config object')],
  ['public/admin.html', 'e.value', why('card form field -> card model object')],
  ['public/admin.html', "el.type==='number'?(el.value===''?null:+el.value):el.value", why('shop price form field -> price model object')],
  ['public/admin.html', "el.type==='number'?+el.value:el.value", why('frame form field -> frame model object')],
] as [string, string, string][]).map(([file, code, w]) => ({ file, code: KIND + code, why: w }));

describe('XSS allowlist lint (replaces the old deny-list regexes)', () => {
  it.each(['public/play.html', 'public/admin.html', 'public/card-renderer.js', 'public/admin-bulk.js'])('%s has no unescaped interpolation', f => {
    expect(lintSource(f, read(f), ALLOW)).toEqual([]);
  });

  it('the allowlist has no stale or extra entries: without it the lint reports exactly these findings, nothing more', () => {
    const raw = ['public/play.html', 'public/admin.html', 'public/card-renderer.js', 'public/admin-bulk.js'].flatMap(f => lintSource(f, read(f)));
    const key = (x: { file: string; code: string }) => x.file + '|' + x.code;
    expect(new Set(raw.map(key))).toEqual(new Set(ALLOW.map(key)));
  });

  describe('negative fixtures: the lint must flag anything it cannot prove safe', () => {
    const bad = (code: string) => lintSource('x.js', code).length;
    const UNSAFE: [string, string][] = [
      ['plain template', 'el.innerHTML = `<b>${d.flavor}</b>`;'],
      ['attribute value', 'el.innerHTML = `<img src="${c.img}">`;'],
      ['string concat', "el.innerHTML = '<b>' + ON.deckName + '</b>';"],
      ['unknown helper', 'const h=(v)=>v; el.innerHTML = `<i>${h(x.name)}</i>`;'],
      ['insertAdjacentHTML', "el.insertAdjacentHTML('beforeend', msg);"],
      ['innerHTML = variable', 'el.innerHTML = userText;'],
      ['href attribute', 'x = `<a href="${link}">go</a>`;'],
      // 1. nested template literals
      ['nested template (inner has no markup)', 'el.innerHTML = `<b>${`${x.name}`}</b>`;'],
      ['nested template inside a conditional', 'el.innerHTML = `<b>${a ? `${x.name}` : ""}</b>`;'],
      ['nested template inside a map callback', 'el.innerHTML = `<ul>${list.map(x => `<li>${x.name}</li>`).join("")}</ul>`;'],
      ['template without markup assigned to innerHTML', 'el.innerHTML = `${x.name}`;'],
      ['template without markup appended with +=', 'el.innerHTML += `${x.name}`;'],
      // 2. string methods that take user input as an argument
      ['replace() with user replacement', "el.innerHTML = `<b>${'a-b'.replace('-', x.name)}</b>`;"],
      ['replace() with user callback result', "el.innerHTML = `<b>${'a-b'.replace(/-/, () => x.name)}</b>`;"],
      ['padStart() with user filler', 'el.innerHTML = `<b>${"1".padStart(5, x.name)}</b>`;'],
      ['repeat() on user input', 'el.innerHTML = `<b>${x.name.repeat(2)}</b>`;'],
      ['slice() on user input', 'el.innerHTML = `<b>${x.name.slice(0, 5)}</b>`;'],
      ['toUpperCase() on user input', 'el.innerHTML = `<b>${x.name.toUpperCase()}</b>`;'],
      ['concat() with user input', 'el.innerHTML = `<b>${"a".concat(x.name)}</b>`;'],
      // 3. helpers that pass user input through
      ['helper returning its parameter', 'const h = (v) => v; el.innerHTML = `<i>${h(x.name)}</i>`;'],
      ['helper whose parameter is named like a counter', 'const h = (n) => n; el.innerHTML = `<i>${h(x.name)}</i>`;'],
      ['helper wrapping its parameter in markup', 'const row = (i) => `<td>${i}</td>`; el.innerHTML = row(x.name);'],
      ['helper that uses its parameter unescaped (even if this caller escapes)', 'const h = (v) => `<td>${v}</td>`; el.innerHTML = h(esc(x.name));'],
      ['helper chain', 'const a = (v) => v; const b = (v) => a(v); el.innerHTML = `<i>${b(x.name)}</i>`;'],
      ['two helpers with the same name (one unsafe)', 'function h(){return 1} function h(v){return v} el.innerHTML = `<i>${h(x.name)}</i>`;'],
      ['parameter that shadows a constant table', 'const T = {a: "x"}; const f = (T) => `<i>${T}</i>`; el.innerHTML = f(x.name);'],
      // 4. complex concatenation
      ['concat in a conditional', "el.innerHTML = '<b>' + (a ? x.name : '') + '</b>';"],
      ['concat of two safe parts and one unsafe', "el.innerHTML = '<b>' + 1 + esc(a) + x.name + '</b>';"],
      ['concat starting with a variable', "const s = x.name; el.innerHTML = s + '<b>ok</b>';"],
      ['+= building a string', "let s = '<b>'; s += x.name; s += '</b>'; el.innerHTML = s;"],
      ['reassignment after a safe initialiser', "let s = 'ok'; s = x.name; el.innerHTML = '<b>' + s + '</b>';"],
      ['destructuring reassignment', "let s = 'ok'; [s] = list; el.innerHTML = '<b>' + s + '</b>';"],
      ['for-of reassignment', "let s = 'ok'; for (s of list) {} el.innerHTML = '<b>' + s + '</b>';"],
      ['array join of pushed user input', "const rows = []; rows.push(x.name); el.innerHTML = rows.join('');"],
      // 5. multi-layer HTML built before the sink
      ['template stored then used as innerHTML', 'const t = `<b>${x.name}</b>`; el.innerHTML = t;'],
      ['template stored, wrapped, then used', 'const t = `<b>${x.name}</b>`; const w = `<div>${t}</div>`; el.innerHTML = w;'],
      ['helper builds markup from user input', 'function card(c) { return `<div>${c.name}</div>`; } el.innerHTML = card(x);'],
      ['outerHTML sink', 'el.outerHTML = `<b>${x.name}</b>`;'],
      ["computed ['innerHTML'] sink", "el['innerHTML'] = userText;"],
      ['innerHTML in an object literal', 'Object.assign(el, { innerHTML: userText });'],
      ['document.write', 'document.write(userText);'],
      ['createContextualFragment', 'range.createContextualFragment(userText);'],
      ['DOMParser', "new DOMParser().parseFromString(userText, 'text/html');"],
      ['srcdoc', 'frame.srcdoc = userText;'],
      ['setAttribute on* handler', "el.setAttribute('onclick', x.name);"],
      ['eval', 'eval(userText);'],
      ['new Function', 'new Function(userText);'],
      // 6. data passed through variables / objects before the sink
      ['variable holding user input', 'const n = x.name; el.innerHTML = `<b>${n}</b>`;'],
      ['variable declared without initialiser', 'let n; n = x.name; el.innerHTML = `<b>${n}</b>`;'],
      ['object property from a variable', 'const o = { v: x.name }; el.innerHTML = `<b>${o.v}</b>`;'],
      ['destructured variable', 'const { name } = x; el.innerHTML = `<b>${name}</b>`;'],
      ['forEach callback parameter', 'list.forEach(it => { el.innerHTML += `<b>${it}</b>`; });'],
      ['map over user data', 'el.innerHTML = list.map(it => `<b>${it.name}</b>`).join("");'],
      ['map over a variable that is not a constant', 'const names = getNames(); el.innerHTML = names.map(n => `<b>${n}</b>`).join("");'],
      ['callback index parameter used as text', 'el.innerHTML = list.map((a, i) => `<b>${a}</b>`).join("");'],
      ['array element', 'el.innerHTML = `<b>${arr[0]}</b>`;'],
      ['lookup in a non-constant table', 'const T = {a: x.name}; el.innerHTML = `<b>${T[k]}</b>`;'],
      ['conditional with an unsafe branch', 'el.innerHTML = `<b>${a ? "ok" : x.name}</b>`;'],
      ['logical or with user input', 'el.innerHTML = `<b>${x.name || "?"}</b>`;'],
      ['nullish with user input', 'el.innerHTML = `<b>${x.name ?? "?"}</b>`;'],
      ['await result', 'async function f(){ el.innerHTML = `<b>${await load()}</b>`; }'],
      ['tagged template', 'el.innerHTML = tag`<b>${x.name}</b>`;'],
      ['comma expression', 'el.innerHTML = `<b>${(0, x.name)}</b>`;'],
      // 7. the escaper is trusted by BEHAVIOUR and BINDING, never by name
      ['esc that is not defined at all', 'el.innerHTML = `<b>${esc(x.name)}</b>`;'],
      ['local esc that returns its input', 'const esc = s => s; el.innerHTML = `<b>${esc(x.name)}</b>`;'],
      ['function declaration esc that returns its input', 'function esc(v) { return v; } el.innerHTML = `<b>${esc(x.name)}</b>`;'],
      ['esc that only escapes <', "const esc = s => String(s).replace(/</g, '&lt;'); el.innerHTML = `<b>${esc(x.name)}</b>`;"],
      ['esc that forgets quotes (attribute breakout)', "const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); el.innerHTML = `<i title=\"${esc(x.name)}\">`;"],
      ['esc that does nothing for null', "const esc = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); el.innerHTML = `<b>${esc(x.name)}</b>`;"],
      ['esc as a parameter', 'const f = (esc) => `<b>${esc(x.name)}</b>`; el.innerHTML = f(v => v);'],
      ['esc shadowed inside a function', ESC.replace(/\n$/, '') + ' function f(esc) { return `<b>${esc(x.name)}</b>`; } el.innerHTML = f(s => s);'],
      ['esc reassigned to a pass-through', ESC.replace('const', 'let') + 'esc = s => s; el.innerHTML = `<b>${esc(x.name)}</b>`;'],
      ['esc that is not a function', 'const esc = x.name; el.innerHTML = `<b>${esc(1)}</b>`;'],
      ['x.map(esc) with a fake esc', 'const esc = s => s; el.innerHTML = list.map(esc).join("");'],
      ['x.map(esc) with esc undefined', 'el.innerHTML = list.map(esc).join("");'],
      // 8. numeric properties are not trusted by name
      ['user.hp may hold HTML', 'el.innerHTML = `<b>${user.hp}</b>`;'],
      ['atk / def / level / price / points / amount / code', 'el.innerHTML = `<b>${u.atk}${u.def}${u.level}${i.price}${p.points}${x.amount}${r.code}</b>`;'],
      ['numeric-looking property in an attribute', 'el.innerHTML = `<i data-n="${x.uid}" data-s="${x.seat}">`;'],
      ['length of an unknown object', 'el.innerHTML = `<b>${x.length}</b>`;'],
      ['length of a parameter-derived value', 'const f = (a) => `<b>${a.length}</b>`; el.innerHTML = f(x);'],
      ['length of a variable holding user data', 'const d = getData(); el.innerHTML = `<b>${d.length}</b>`;'],
      ['numeric property in a conditional', 'el.innerHTML = `<b>${a ? u.hp : 0}</b>`;'],
      ['numeric property through ||', 'el.innerHTML = `<b>${u.hp || 0}</b>`;'],
      // 9. built-ins are trusted only when they really are the globals
      ['local Number', 'const Number = s => s; el.innerHTML = `<b>${Number(x.name)}</b>`;'],
      ['local parseInt', 'function parseInt(v) { return v; } el.innerHTML = `<b>${parseInt(x.name)}</b>`;'],
      ['local parseFloat', 'const parseFloat = v => v; el.innerHTML = `<b>${parseFloat(x.name)}</b>`;'],
      ['local Boolean', 'const Boolean = v => v; el.innerHTML = `<b>${Boolean(x.name)}</b>`;'],
      ['local String', 'const String = v => v; el.innerHTML = `<b>${String(x.name)}</b>`;'],
      ['Number as a parameter', 'const f = (Number) => `<b>${Number(x.name)}</b>`; el.innerHTML = f(v => v);'],
      ['Math as a parameter', 'const f = (Math) => `<b>${Math.max(x.name)}</b>`; el.innerHTML = f({ max: v => v });'],
      ['local Math object', 'const Math = { max: v => v }; el.innerHTML = `<b>${Math.max(x.name)}</b>`;'],
      ['local VCZ', 'const VCZ = { svg: s => s }; el.innerHTML = `<b>${VCZ.svg(x.name)}</b>`;'],
      ['local Object.keys', 'const Object = { keys: () => [] }; el.innerHTML = Object.keys({ a: 1 }).map(k => `<b>${k}</b>`).join("");'],
      ['String() of unsafe input', 'el.innerHTML = `<b>${String(x.name)}</b>`;'],
    ];
    it.each(UNSAFE)('flags %s', (_n, code) => { expect(bad(code), code).toBeGreaterThan(0); });

    const SAFE: [string, string][] = [
      ['esc wrapped', 'el.innerHTML = `<b>${esc(d.flavor)}</b>`;'],
      ['arithmetic', 'el.innerHTML = `<b>${a*2-b}</b>`;'],
      ['esc in concat', "el.innerHTML = '<b>' + esc(n) + '</b>';"],
      ['nested template with escaped value', 'el.innerHTML = `<b>${a ? `${esc(x.name)}` : ""}</b>`;'],
      ['nested map with escaped value', 'el.innerHTML = `<ul>${list.map(x => `<li>${esc(x.name)}</li>`).join("")}</ul>`;'],
      ['helper with escaped parameter', 'const row = (v) => `<td>${esc(v)}</td>`; el.innerHTML = row(x.name);'],
      ['+= of safe parts', "let s = '<b>'; s += esc(x.name); s += '</b>'; el.innerHTML = s;"],
      ['lookup in a constant table', "const T = {a: 'x', b: 'y'}; el.innerHTML = `<b>${T[k]}</b>`;"],
      ['map over a constant array', "el.innerHTML = ['a', 'b'].map(t => `<b>${t}</b>`).join('');"],
      ['index parameter of a map callback', 'el.innerHTML = list.map((a, i) => `<b>${esc(a)}${i}</b>`).join("");'],
      ['unary plus on a numeric property', 'el.innerHTML = `<b>${+u.hp}</b>`;'],
      ['Number() on a property', 'el.innerHTML = `<b>${Number(u.hp)}</b>`;'],
      ['parseInt / parseFloat / Boolean', 'el.innerHTML = `<b>${parseInt(u.hp, 10)}${parseFloat(u.atk)}${Boolean(u.def)}</b>`;'],
      ['esc() on a numeric property', 'el.innerHTML = `<b>${esc(u.hp)}</b>`;'],
      ['arithmetic on properties', 'el.innerHTML = `<b>${u.hp - 1}${u.atk * 2}</b>`;'],
      ['Math on properties', 'el.innerHTML = `<b>${Math.max(u.hp, 0)}${Math.min(1, 2)}</b>`;'],
      ['String() of a safe value', 'el.innerHTML = `<b>${String(esc(x.name))}</b>`;'],
      ['length of an array literal / string literal', "el.innerHTML = `<b>${[1, 2].length}${'abc'.length}</b>`;"],
      ['length of a filtered / mapped array', 'el.innerHTML = `<b>${list.filter(a => a).length}${list.map(a => a).length}</b>`;'],
      ['length of Object.keys()', 'el.innerHTML = `<b>${Object.keys(o).length}</b>`;'],
      ['length of a variable that only holds arrays', 'const rows = list.filter(a => a); el.innerHTML = `<b>${rows.length}</b>`;'],
      ['x.map(esc).join', 'el.innerHTML = list.map(esc).join(",");'],
      ['escaper under another name', "el.innerHTML = `<b>${sanitize(x.name)}</b>`;"],
      ['textContent is not a sink', 'el.textContent = x.name;'],
      ['replace() with constants', "el.innerHTML = `<b>${'a-b'.replace('-', '+')}</b>`;"],
    ];
    it.each(SAFE)('accepts %s', (_n, code) => { expect(lintSource('x.js', (code.includes('sanitize') ? ESC.replace('esc', 'sanitize') : ESC) + code), code).toEqual([]); });
  });
});
