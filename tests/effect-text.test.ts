import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LIMITS, normalizeText, cpLen, checkLimit, counterState, consistencyWarnings } from '../src/engine/effect-text';
import { fromLegacy, type SystemConfig } from '../src/engine/effect-registry';

const base: SystemConfig = { trigger: 'on_summon', target: 'self', action: 'atk_up', amount: 2, perm: true, max: 4, duration: 'permanent', use_limit: 'none' };

describe('text limits and counting', () => {
  it('counts Unicode code points, not UTF-16 units', () => {
    expect(cpLen('กำลัง')).toBe(5);
    expect(cpLen('😀😀')).toBe(2);
    expect('😀😀'.length).toBe(4);
  });
  it('normalizes: NFC, control and zero-width characters removed, trimmed, same result every time', () => {
    expect(normalizeText('  ก​า\u0007  ')).toBe('กา');
    expect(normalizeText('a\r\nb')).toBe('a\nb');
    expect(normalizeText('é')).toBe('é');
    expect(normalizeText(null)).toBe('');
  });
  it('flags text over the limit and reports counter state', () => {
    expect(checkLimit('effect_name', 'ก'.repeat(30)).over).toBe(false);
    expect(checkLimit('effect_name', 'ก'.repeat(31)).over).toBe(true);
    expect(LIMITS.description).toBe(180);
    expect(counterState(10, 180)).toBe('ok'); expect(counterState(165, 180)).toBe('near'); expect(counterState(181, 180)).toBe('over');
  });
});

describe('consistency check (warn only)', () => {
  it('matching text gives no warning', () => {
    expect(consistencyWarnings(base, 'เมื่อถูกเรียก ATK +2 ถาวร (รวมไม่เกิน +4)')).toEqual([]);
  });
  it('different number is reported', () => {
    const w = consistencyWarnings(base, 'เมื่อถูกเรียก ATK +3 ถาวร (รวมไม่เกิน +4)');
    expect(w.map(x => x.code)).toEqual(expect.arrayContaining(['amount_missing', 'amount_mismatch']));
  });
  it('duration / limit / target / cost words are checked', () => {
    expect(consistencyWarnings({ ...base, duration: 'until_end_of_turn', perm: false, max: null }, 'เมื่อถูกเรียก ATK +2 ถาวร').map(x => x.code)).toEqual(expect.arrayContaining(['duration_turn', 'duration_extra_permanent']));
    expect(consistencyWarnings({ ...base, trigger: 'on_attack', use_limit: 'once_per_turn' }, 'เมื่อโจมตี ATK +2 ถาวร (สูงสุด +4)').map(x => x.code)).toContain('limit_turn');
    expect(consistencyWarnings({ ...base, target: 'enemy1', action: 'atk_down' }, 'เมื่อถูกเรียก ATK −2 ถาวร (สูงสุด +4)').map(x => x.code)).toContain('target_enemy');
    expect(consistencyWarnings({ ...base, cost: null }, 'เมื่อถูกเรียก ทิ้งการ์ด 1 ใบ แล้ว ATK +2 ถาวร (สูงสุด +4)').map(x => x.code)).toContain('cost_unlisted');
  });
  it('never edits anything and is silent on empty text', () => {
    const copy = JSON.stringify(base);
    consistencyWarnings(base, 'x');
    expect(JSON.stringify(base)).toBe(copy);
    expect(consistencyWarnings(base, '')).toEqual([]);
  });
  it('real seeded abilities produce no warning (no noise on the 55 running rows)', () => {
    const cards: any[] = JSON.parse(readFileSync('db/seed/toon-cards.json', 'utf8'));
    const noisy: string[] = [];
    for (const c of cards) for (const e of c.effects ?? []) { const s = fromLegacy(e); if (s && consistencyWarnings(s, e.description).length) noisy.push(e.description); }
    expect(noisy).toEqual([]);
  });
});
