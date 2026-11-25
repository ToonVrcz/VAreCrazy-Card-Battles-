// Owner rule (2026-11-25): Lv40 needs 1 sacrificed Lv15; Lv70 needs 2 Lv40; Lv99 needs 3 Lv70 — sacrificed cards share the evolving card's level.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { createGame, act, legalActions, RULES, type CardDef } from '../src/engine/game';

const ch = (id: string, level: number, chain = 'x'): CardDef => ({ id, name: id, type: 'character', level, chain, hp: 50, atk: 10, def: 0, element: 'neutral' });
const evo: CardDef = { id: 'EVO-001', name: 'EVO', type: 'evolution', level: null, chain: null, hp: null, atk: null, def: 0, element: null };
const filler = Array.from({ length: 30 }, (_, i) => ch('F' + i, 15, 'f' + i));
function setup(field: CardDef[], extra: CardDef) {
  let g = createGame([[...field, evo, ...filler], [...filler]], 1, 0, { extras: [[extra], []] });
  g.players[0].hand = [evo]; g.players[0].field = Array(7).fill(null);
  field.forEach((c, i) => { g.players[0].field[i] = { card: c, hp: c.hp!, maxHp: c.hp!, atkBonus: 0 } as any; });
  const u = g.players[0].field[0] as any; Object.assign(u, structuredClone(g.players[0].field[0]));
  return g;
}
const mkUnit = (g: any, i: number, c: CardDef) => { const base = g.players[0].field[0]; g.players[0].field[i] = { ...structuredClone(base), card: c, hp: c.hp, maxHp: c.hp }; };
const evolve = (g: any, sacrifice: number[]) => act(structuredClone(g), { t: 'evolve', slot: 0, evo: 0, form: 0, sacrifice } as any);

describe('evolution sacrifice must match the evolving card level', () => {
  it('rule constants', () => { expect(RULES.sacrifice).toEqual({ 40: 1, 70: 2, 99: 3 }); expect(RULES.sacrificeSameLevel).toBe(true); });
  it('Lv15 -> Lv40: a Lv40 on the field cannot be the sacrifice, a Lv15 can', () => {
    const g = setup([ch('A15', 15)], ch('A40', 40)); mkUnit(g, 1, ch('B40', 40, 'y')); mkUnit(g, 2, ch('C15', 15, 'z'));
    expect(() => evolve(g, [1])).toThrow(/เลเวล 15/);
    expect(evolve(g, [2]).players[0].field[0]!.card.id).toBe('A40');
    expect(legalActions(g).filter(a => a.t === 'evolve').every(a => (a as any).sacrifice.every((s: number) => g.players[0].field[s]!.card.level === 15))).toBe(true);
  });
  it('Lv40 -> Lv70 needs exactly 2 Lv40 sacrifices (Lv15 ones are refused)', () => {
    const g = setup([ch('A40', 40)], ch('A70', 70)); mkUnit(g, 1, ch('B40', 40, 'y')); mkUnit(g, 2, ch('C40', 40, 'z')); mkUnit(g, 3, ch('D15', 15, 'w'));
    expect(() => evolve(g, [1, 3])).toThrow(); expect(() => evolve(g, [1])).toThrow();
    expect(evolve(g, [1, 2]).players[0].field[0]!.card.id).toBe('A70');
  });
});

describe('migration 027 (game_rules sync)', () => {
  it('aligns only rows still holding the old value and adds the same-level rule', async () => {
    const db = new PGlite(); await migrateUp(db);
    const up = readFileSync('db/migrations/027_game_rules_sync.up.sql', 'utf8'), down = readFileSync('db/migrations/027_game_rules_sync.down.sql', 'utf8');
    await db.query(`UPDATE game_rules SET value='50'::jsonb WHERE key='starting_lp'`);          // edited in Admin: must stay
    await db.exec(up);
    const v = async (k: string) => (await db.query<any>(`SELECT value FROM game_rules WHERE key=$1`, [k])).rows[0]?.value;
    expect(await v('evolution_sacrifice')).toEqual({ '40': 1, '70': 2, '99': 3 }); expect(await v('starting_lp')).toBe(50);
    expect(await v('evolution_in_main_deck')).toBe(false); expect(await v('evolution_sacrifice_same_level')).toBe(true);
    await db.exec(down); expect(await v('evolution_sacrifice')).toEqual({ '15': 1, '40': 2, '70': 3 }); expect(await v('evolution_sacrifice_same_level')).toBeUndefined();
  }, 60000);
});
