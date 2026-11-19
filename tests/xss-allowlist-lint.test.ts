import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lintSource, type Allow } from './helpers/html-lint';

const read = (f: string) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// The renderer's low-level SVG helpers receive only numbers, constants, or text already passed through esc() by their callers.
const ALLOW: Allow[] = ['d', 'c', 'x', 'y', 'sz', 'fill', 'stroke', 'sw', 'ls', 's', 't'].map(code => ({
  file: 'public/card-renderer.js', code,
  why: 'parameter of an internal SVG helper (p/glyph/pt): callers pass numbers, constant colours/paths, or esc()-wrapped text (name, class, level)',
})).concat([{ file: 'public/card-renderer.js', code: 'GLYPH[k] || GLYPH.fire', why: 'constant SVG path table; key falls back to a constant' }]);

describe('XSS allowlist lint (replaces the old deny-list regexes)', () => {
  it.each(['public/play.html', 'public/admin.html', 'public/card-renderer.js'])('%s has no unescaped interpolation', f => {
    expect(lintSource(f, read(f), ALLOW)).toEqual([]);
  });

  describe('negative fixtures: the lint must catch unsafe code', () => {
    const bad = (code: string) => lintSource('x.js', code).length;
    it.each([
      ['plain template', 'el.innerHTML = `<b>${d.flavor}</b>`;'],
      ['attribute value', 'el.innerHTML = `<img src="${c.img}">`;'],
      ['string concat', "el.innerHTML = '<b>' + ON.deckName + '</b>';"],
      ['unknown helper', 'const h=(v)=>v; el.innerHTML = `<i>${h(x.name)}</i>`;'],
      ['insertAdjacentHTML', "el.insertAdjacentHTML('beforeend', msg);"],
      ['innerHTML = variable', 'el.innerHTML = userText;'],
      ['href attribute', 'x = `<a href="${link}">go</a>`;'],
    ])('flags %s', (_n, code) => { expect(bad(code)).toBeGreaterThan(0); });
    it.each([
      ['esc wrapped', 'el.innerHTML = `<b>${esc(d.flavor)}</b>`;'],
      ['numeric property', 'el.innerHTML = `<b>${u.hp}</b>`;'],
      ['arithmetic', 'el.innerHTML = `<b>${a*2-b}</b>`;'],
      ['esc in concat', "el.innerHTML = '<b>' + esc(n) + '</b>';"],
    ])('accepts %s', (_n, code) => { expect(bad(code)).toBe(0); });
  });
});
