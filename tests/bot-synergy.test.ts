// The bot values Game Synergy when choosing which character to summon (sim-tested B7 table).
import { describe, it, expect } from 'vitest';
import { createGame, type CardDef, type Game } from '../src/engine/game';
import { resolveConfig } from '../src/engine/config';
import { botPick, synergyGain } from '../src/engine/bot';
const ch = (id: string, atk: number): CardDef => ({ id, name: id, type: 'character', level: 15, chain: id.toLowerCase(), hp: 80, atk, def: 2, element: 'neutral' });
const cfg = resolveConfig([], { synergies: [{ aff: 'g', min: 2, stat: 'hp', amount: 3, stacks: 1 }, { aff: 'g', min: 2, stat: 'def', amount: 2, stacks: 1 }], members: [{ card: 'ON', aff: 'g' }, { card: 'MATE', aff: 'g' }] });
const base = (c = cfg): Game => { const g = createGame([Array.from({ length: 30 }, (_, i) => ch('F' + i, 10)), Array.from({ length: 30 }, (_, i) => ch('E' + i, 10))], 1, 0, { interactive: true, cfg: c }); return g; };
describe('bot + Game Synergy', () => {
  it('gain is 0 without data or without a partner, positive with one', () => {
    const g = base(), me = g.players[0]; me.field = Array(7).fill(null);
    expect(synergyGain(g, me.field, ch('MATE', 20))).toBe(0);
    me.field[0] = { uid: 1, card: ch('ON', 20), hp: 80, maxHp: 80, atk: 20, def: 2, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0 } as any;
    expect(synergyGain(g, me.field, ch('MATE', 20))).toBeGreaterThan(5);
    expect(synergyGain(base(resolveConfig([])), me.field, ch('MATE', 20))).toBe(0);
  });
  it('prefers the slightly weaker card that completes a group, but not a much weaker one', () => {
    for (const [mateAtk, expected] of [[30, 'MATE'], [10, 'STRONG']] as const) {
      const g = base(), me = g.players[g.active]; me.field = Array(7).fill(null); me.summoned = false;
      me.field[0] = { uid: 1, card: ch('ON', 20), hp: 80, maxHp: 80, atk: 20, def: 2, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0 } as any;
      me.hand = [ch('STRONG', 36), ch('MATE', mateAtk)];
      const a = botPick(g) as any; expect(a.t).toBe('summon'); expect(me.hand[a.hand].id).toBe(expected);
    }
  });
});
