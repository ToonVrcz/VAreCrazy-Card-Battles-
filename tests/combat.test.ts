import { describe, it, expect } from 'vitest';
import { damage, attackUnit, attackPlayer, canAttack, evolveHp, elementMultiplier } from '../src/engine/combat';
const u = (o: any = {}) => ({ hp: 100, atk: 50, def: 0, element: 'neutral' as const, ...o });

describe('combat v0', () => {
  it('damage = (ATK-DEF) x element, never negative', () => {
    expect(damage(u({ atk: 50 }), u({ def: 20 }))).toBe(30);
    expect(damage(u({ atk: 10 }), u({ def: 20 }))).toBe(0);
    expect(damage(u({ atk: 40, element: 'water' }), u({ element: 'fire' }))).toBe(60);   // strong x1.5
    expect(damage(u({ atk: 40, element: 'fire' }), u({ element: 'water' }))).toBe(30);   // weak x0.75
    expect(elementMultiplier('dark', 'holy')).toBe(1.5); expect(elementMultiplier('holy', 'dark')).toBe(1.5);
    expect(elementMultiplier('physical', 'fire')).toBe(1);
  });
  it('attack unit destroys at 0 and leaves LP alone', () => {
    expect(attackUnit(u({ atk: 150 }), u({ hp: 100 }))).toEqual({ dmg: 150, hp: 0, destroyed: true });
    expect(attackUnit(u({ atk: 30 }), u({ hp: 100 }))).toMatchObject({ hp: 70, destroyed: false });
  });
  it('direct attack only on an empty field; LP 0 wins', () => {
    expect(attackPlayer(u(), 1, 8000).ok).toBe(false);
    expect(attackPlayer(u({ atk: 300 }), 0, 8000)).toMatchObject({ ok: true, lp: 7700, won: false });
    expect(attackPlayer(u({ atk: 300 }), 0, 200)).toMatchObject({ lp: 0, won: true });
  });
  it('first player cannot attack on turn 1; evolution keeps damage', () => {
    expect(canAttack(1, true)).toBe(false); expect(canAttack(1, false)).toBe(true); expect(canAttack(3, true)).toBe(true);
    expect(evolveHp(90, 40, 150)).toBe(100);      // took 50 damage -> 150-50
    expect(evolveHp(90, 1, 100)).toBe(11); expect(evolveHp(10, 0, 5)).toBe(1);
  });
});
