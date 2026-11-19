import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// F-01 regression: player-controlled text (room / player / deck names) must pass through esc() before innerHTML.
const html = readFileSync(new URL('../public/play.html', import.meta.url), 'utf8');
const esc = new Function(`${html.match(/function esc\(v\)\{[^\n]*\}\n/)![0]}; return esc;`)() as (v: unknown) => string;

describe('play.html escaping (F-01)', () => {
  it('esc() neutralises markup and quotes, tolerates null', () => {
    expect(esc('<img src=x onerror=alert(1)>"\'&')).toBe('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
    expect(esc(null)).toBe('');
  });
  it.each([
    ['player list name', '${esc(x.name)}'],
    ['room title', '${esc(R.name)}'],
    ['public room list', "${esc(x.name||'ห้องของ '+(x.host||'ผู้เล่น'))}"],
    ['profile name', "${ME.ok?esc(ME.name||'ผู้เล่น')"],
    ['active deck name (lobby create)', '${activeDeck()?esc(activeDeck().name)'],
    ['active deck name (dashboard)', '${ad?esc(ad.name)'],
  ])('%s is escaped', (_l, snippet) => { expect(html).toContain(snippet); });
  it('no raw player/room name interpolation remains', () => {
    expect(html).not.toMatch(/\$\{x\.name\}<\/b>|\$\{R\.name\}|\$\{ME\.name\|\|'ผู้เล่น'\}/);
  });
});

// Phase 1: card names/texts and server messages reach players too (a card_editor could otherwise inject script into every player's browser).
// No bare interpolation of those values may remain in play.html: everything must go through esc().
describe('play.html: no unescaped text interpolation (Phase 1)', () => {
  const bare = [
    /\$\{(msg|why|link|e\.message)\}/g,
    /\$\{I\.(source|text)\}/g,
    /\$\{(?:[A-Za-z_]+\.)?(?:c|d|i|x|a)\??\.(?:card\.)?(?:name|text)(?:\|\|[^}]*)?\}/g,
    /\$\{x\.c\.name\}/g,
    /\$\{BY\[[^\]]+\]\??\.name(?:\|\|id)?\}/g,
    /\$\{RS\[i\.reason\]\|\|i\.reason\}/g,
    /\$\{u\.fused\.map\(x=>x\.name\)\.join\([^)]*\)\}/g,
    /\$\{\(ME\.name\|\|''\)\.replace/g,
  ];
  it.each(bare.map((r, i) => [i, r] as const))('pattern %i finds nothing', (_i, re) => {
    const hits = [...html.matchAll(re)].map(m => m[0]);
    expect(hits).toEqual([]);
  });
  it('escaping stays neutral for every real card name and rules text in the exported data', () => {
    const data = JSON.parse(readFileSync(new URL('../card-data-export/cards-db-shape.json', import.meta.url), 'utf8'));
    const rows: any[] = Array.isArray(data) ? data : (data.cards ?? data.rows ?? Object.values(data)[0]);
    for (const c of rows) for (const k of ['name', 'rules_text']) if (c[k]) expect(esc(c[k])).toBe(c[k]);
  });
});
