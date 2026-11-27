// Game Synergy (B7): shared game groups give max-HP / DEF while >= 2 distinct units of the group are on the field. No ATK, no instant heal, per-unit cap, recomputed every time.
import { describe, it, expect } from 'vitest';
import { createGame, refreshAuras, act, type CardDef, type Game } from '../src/engine/game';
import { resolveConfig, DEFAULT_CONFIG, validateRuleValue } from '../src/engine/config';

const ch = (id: string, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level: 15, chain: id.toLowerCase(), hp: 80, atk: 20, def: 2, element: 'neutral', ...o });
const filler = Array.from({ length: 30 }, (_, i) => ch('F' + i));
const SYN = { synergies: [
  { aff: 'g1', min: 2, stat: 'hp', amount: 3, stacks: 1 }, { aff: 'g1', min: 2, stat: 'def', amount: 2, stacks: 1 },
  { aff: 'g2', min: 2, stat: 'hp', amount: 3, stacks: 1 }, { aff: 'g2', min: 2, stat: 'def', amount: 1, stacks: 1 },
  { aff: 'g3', min: 2, stat: 'hp', amount: 6, stacks: 1 }, { aff: 'g3', min: 2, stat: 'def', amount: 5, stacks: 1 },
  { aff: 'g1', min: 2, stat: 'atk', amount: 5, stacks: 1 },            // ATK rows are ignored
], members: [
  { card: 'A', aff: 'g1' }, { card: 'B', aff: 'g1' }, { card: 'B', aff: 'g2' }, { card: 'C', aff: 'g2' }, { card: 'C', aff: 'g1' },
  { card: 'D', aff: 'g3' }, { card: 'E', aff: 'g3' }, { card: 'D', aff: 'g1' }, { card: 'E', aff: 'g1' }, { card: 'E', aff: 'g2' }, { card: 'D', aff: 'g2' },
] };
const cfg = () => resolveConfig([], SYN);
const game = (c = cfg()) => createGame([[...filler], [...filler]], 1, 0, { interactive: true, cfg: c });
const put = (g: Game, side: 0 | 1, slot: number, c: CardDef, fused: CardDef[] = []) => { const u: any = { uid: ++g.uid, card: c, fused, hp: c.hp!, maxHp: c.hp!, atk: c.atk!, def: c.def, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0, poison: 0 }; g.players[side].field[slot] = u; return u; };

describe('Game Synergy runtime', () => {
  it('is off without data (default config) and ignores ATK rows', () => {
    expect(resolveConfig([])).toEqual(DEFAULT_CONFIG);
    const g = game(DEFAULT_CONFIG), a = put(g, 0, 0, ch('A')), b = put(g, 0, 1, ch('B')); refreshAuras(g);
    expect([a.maxHp, a.auraDef, b.maxHp]).toEqual([80, 0, 80]);
    expect(cfg().synergy.groups.g1.every(t => t.stat !== ('atk' as any))).toBe(true);
    const a2 = put(game(), 0, 0, ch('A')); expect(a2.atk + a2.bonusAtk).toBe(20);
  });
  it('one unit alone gets nothing; the second distinct unit gives both max HP +3 and DEF +2 (HP raises the MAX only, current HP unchanged)', () => {
    const g = game(), a = put(g, 0, 0, ch('A')); refreshAuras(g);
    expect([a.maxHp, a.hp, a.auraDef, a.synGroups]).toEqual([80, 80, 0, undefined]);
    const b = put(g, 0, 1, ch('A2', { id: 'B' })); refreshAuras(g);
    expect([a.maxHp, a.hp, a.auraAtk, a.auraDef]).toEqual([83, 80, 0, 2]); expect([b.maxHp, b.hp, b.auraDef]).toEqual([83, 80, 2]);
    refreshAuras(g); refreshAuras(g); expect([a.maxHp, a.auraDef]).toEqual([83, 2]);            // never accumulates
  });
  it('the bonus disappears the moment a partner leaves and current HP is clamped to the lower max', () => {
    const g = game(), a = put(g, 0, 0, ch('A')); put(g, 0, 1, ch('B')); refreshAuras(g); a.hp = 83;   // healed to the raised max
    g.players[0].field[1] = null; refreshAuras(g);
    expect([a.maxHp, a.hp, a.auraDef]).toEqual([80, 80, 0]);
  });
  it('only your own side counts; the opponent\'s units do not feed your group', () => {
    const g = game(), a = put(g, 0, 0, ch('A')); put(g, 1, 0, ch('B')); refreshAuras(g);
    expect([a.maxHp, a.auraDef]).toEqual([80, 0]);
  });
  it('two groups add up but the per-unit cap (HP+10 / DEF+4) holds', () => {
    const g = game(), b = put(g, 0, 0, ch('B')), c = put(g, 0, 1, ch('C')); refreshAuras(g);   // B and C share g1 AND g2: HP 6, DEF 3
    expect([b.maxHp, b.auraDef, c.maxHp, c.auraDef]).toEqual([86, 3, 86, 3]);
    const d = put(g, 0, 2, ch('D')), e = put(g, 0, 3, ch('E')); refreshAuras(g);                // D, E share g1+g2+g3: HP 12 -> 10, DEF 8 -> 4
    expect([d.maxHp, d.auraDef, e.maxHp, e.auraDef]).toEqual([90, 4, 90, 4]);
  });
  it('a Fusion alone does not trigger on itself, but carries the groups of both halves for other units', () => {
    const g = game(), f = put(g, 0, 0, ch('A'), [ch('X', { id: 'C' })]); refreshAuras(g);
    expect([f.maxHp, f.auraDef]).toEqual([80, 0]);
    const p = put(g, 0, 1, ch('P', { id: 'B' })); refreshAuras(g);                               // B shares g1 with A and g1+g2 with C -> the fused unit counts for both groups
    expect([f.maxHp, f.auraDef, p.maxHp, p.auraDef]).toEqual([86, 3, 86, 3]);
  });
  it('Story DEF and Synergy DEF add up; the log splits them', () => {
    const g = createGame([[...filler], [...filler]], 1, 0, { interactive: true, cfg: cfg(), storyLinks: [{ a: 'a', b: 'b', mods: [{ stat: 'def', amount: 5 }] }] });
    const a = put(g, 0, 0, ch('A')); put(g, 0, 1, ch('B')); refreshAuras(g);
    expect([a.auraDef, a.synDef]).toEqual([7, 2]);
  });
  it('validate synergy_cap', () => {
    expect(validateRuleValue('synergy_cap', { hp: 10, def: 4 })).toBeNull();
    for (const v of [{ hp: -1, def: 4 }, { hp: 10 }, 'x', { hp: 1000, def: 4 }]) expect(validateRuleValue('synergy_cap', v)).toBeTruthy();
    expect(resolveConfig([{ key: 'synergy_cap', value: { hp: 5, def: 1 } }]).synergy.cap).toEqual({ hp: 5, def: 1 });
  });
  it('a whole real action keeps working with synergy on (summon through act)', () => {
    const g = game(); g.players[0].hand = [ch('A'), ch('B')]; g.players[0].field = Array(7).fill(null);
    let x = act(g, { t: 'summon', hand: 0, slot: 0 }) as Game; x.players[0].summoned = false; x = act(x, { t: 'summon', hand: 0, slot: 1 }) as Game;   // Lv.15 summon is 1 per turn
    expect([x.players[0].field[0]?.maxHp, x.players[0].field[1]?.maxHp, x.players[0].field[0]?.hp]).toEqual([83, 83, 80]);
  });
});
