// Balance round 1 data guards: HP/ATK unchanged, DEF non-decreasing along chains, every effect parses, element matrix has no dead ends in the real pool.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { parseEffect } from '../src/engine/effects';

const seed = (s: string) => JSON.parse(s) as any[];
const now = seed(readFileSync('db/seed/toon-cards.json', 'utf8'));
const elements = JSON.parse(readFileSync('db/seed/elements.json', 'utf8')).elements as Record<string, { strong: string[] }>;

describe('balance round 1 data', () => {
  it('HP and ATK equal the pre-round values (git 5b85f89)', () => {
    const before = seed(execSync('git show 5b85f89:db/seed/toon-cards.json', { encoding: 'utf8', maxBuffer: 1 << 26 }));
    for (const c of now) { const b = before.find(x => x.character_id === c.character_id)!; expect([c.hp, c.atk], c.character_id).toEqual([b.hp, b.atk]); }
    expect(now.length).toBe(before.length);
  });
  it('every character effect is understood by the engine (no combo rows left)', () => {
    for (const c of now) for (const e of c.effects ?? []) expect(parseEffect(e), `${c.character_id}: ${e.description}`).not.toBeNull();
  });
  it('DEF never decreases along an evolution chain', () => {
    const byChain: Record<string, any[]> = {}; for (const c of now) (byChain[c.chain_key] ??= []).push(c);
    for (const [k, v] of Object.entries(byChain)) { v.sort((a, b) => a.level - b.level); for (let i = 1; i < v.length; i++) expect(v[i].def ?? 0, `${k} Lv${v[i].level}`).toBeGreaterThanOrEqual(v[i - 1].def ?? 0); }
  });
  it('every element that has characters has a matchup and net advantage stays within -3..+3 (Lv15 pool)', () => {
    const n: Record<string, number> = {}; for (const c of now.filter(c => c.level === 15)) n[c.element] = (n[c.element] ?? 0) + 1;
    for (const a of Object.keys(n)) {
      const beats = (elements[a]?.strong ?? []).reduce((s, b) => s + (n[b] ?? 0), 0), beaten = Object.keys(n).filter(b => elements[b]?.strong.includes(a)).reduce((s, b) => s + n[b], 0);
      if (!['neutral', 'physical'].includes(a)) { expect(beats + beaten, a).toBeGreaterThan(0); expect(Math.abs(beats - beaten), a).toBeLessThanOrEqual(3); }
    }
  });
});
