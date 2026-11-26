// P1 (owner-approved 2026-11-26): a Fusion carries two chains but must never trigger a Story row between its own two halves; Story from OTHER units still applies.
import { describe, it, expect } from 'vitest';
import { createGame, refreshAuras, type CardDef, type Game, type StoryLink } from '../src/engine/game';

const ch = (id: string, chain: string, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level: 15, chain, hp: 80, atk: 20, def: 2, element: 'neutral', ...o });
const filler = Array.from({ length: 30 }, (_, i) => ch('F' + i, 'f' + i));
const game = (story: StoryLink[]) => createGame([[...filler], [...filler]], 1, 0, { storyLinks: story, interactive: true });
const put = (g: Game, side: 0 | 1, slot: number, c: CardDef, fused: CardDef[] = []) => { const u = { uid: ++g.uid, card: c, fused, hp: c.hp!, maxHp: c.hp!, atk: c.atk!, def: c.def, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0, poison: 0 } as any; g.players[side].field[slot] = u; return u; };
// the BACKJI/NONG style pair: two directional rows between the same two chains
const PAIR: StoryLink[] = [{ a: 'a', b: 'b', mods: [{ stat: 'def', amount: 5 }] }, { a: 'b', b: 'a', mods: [{ stat: 'atk', amount: 5 }] }];

describe('P1: Fusion does not trigger Story on itself', () => {
  it('a Fusion of a+b alone gets nothing (both rows used to fire on itself)', () => {
    const g = game(PAIR), f = put(g, 0, 0, ch('A', 'a'), [ch('B', 'b')]); refreshAuras(g);
    expect([f.auraAtk, f.auraDef]).toEqual([0, 0]); expect(f.storyNames).toBeUndefined();
  });
  it('a Fusion still gets Story from ANOTHER unit on the field (both directions, per row)', () => {
    const g = game(PAIR), f = put(g, 0, 0, ch('A', 'a'), [ch('X', 'x')]), p = put(g, 0, 1, ch('B', 'b')); refreshAuras(g);
    expect([f.auraDef, f.auraAtk]).toEqual([5, 0]); expect([p.auraDef, p.auraAtk]).toEqual([0, 5]);   // partner unit also reacts to the fused a-half
  });
  it('a Fusion a+b next to a separate b unit: the fused a-half gets row a<-b from the loose b, and the loose b gets row b<-a from the fused a-half', () => {
    const g = game(PAIR), f = put(g, 0, 0, ch('A', 'a'), [ch('B', 'b')]), p = put(g, 0, 1, ch('B2', 'b')); refreshAuras(g);
    expect([f.auraDef, f.auraAtk]).toEqual([5, 0]);          // DEF from the loose b; no ATK (row b<-a would need ANOTHER unit carrying 'a')
    expect(p.auraAtk).toBe(5);                                // the loose b reacts to the fused unit carrying chain a
  });
  it('plain units behave exactly as before (regression)', () => {
    const g = game(PAIR), ua = put(g, 0, 0, ch('A', 'a')), ub = put(g, 0, 1, ch('B', 'b')); refreshAuras(g);
    expect([ua.auraDef, ua.auraAtk, ub.auraDef, ub.auraAtk]).toEqual([5, 0, 0, 5]);
    for (let i = 0; i < 4; i++) refreshAuras(g); expect(ua.auraDef).toBe(5);
  });
  it('HP rows do not self-heal a Fusion on arrival', () => {
    const g = game([{ a: 'a', b: 'b', mods: [{ stat: 'hp', amount: 20 }] }]), f = put(g, 0, 0, ch('A', 'a', { hp: 80 }), [ch('B', 'b')]); refreshAuras(g);
    expect([f.maxHp, f.hp]).toEqual([80, 80]);
  });
});
