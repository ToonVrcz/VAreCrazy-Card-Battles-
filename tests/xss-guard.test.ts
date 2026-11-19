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
