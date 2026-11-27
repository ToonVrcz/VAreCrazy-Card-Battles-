// Per-game rules snapshot: game_rules / element_matrix are read at game creation; running games never change.
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService, AppError, type User } from '../src/server/service';
import { GameData } from '../src/server/gamedata';
import { DEFAULT_CONFIG, resolveConfig, validateRuleValue } from '../src/engine/config';
import { createGame, act, RULES, type CardDef, type Game } from '../src/engine/game';
import { elementMultiplier } from '../src/engine/combat';

const el = (id: string, element: string | null, atk = 30, d = 0): CardDef => ({ id, name: id, type: 'character', level: 15, chain: id.toLowerCase(), hp: 100, atk, def: d, element });
const filler = (n: number) => Array.from({ length: n }, (_, i) => el('F' + i, null));
const put = (g: Game, pi: 0 | 1, slot: number, c: CardDef) => { const u = { uid: 900 + slot + pi * 10, card: c, hp: c.hp!, maxHp: c.hp!, atk: c.atk!, def: c.def, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0, poison: 0 } as any; g.players[pi].field[slot] = u; return u; };
function battle(cfg?: any) {   // seat 1 (fire, ATK 30) attacks seat 0 (nature, DEF 0) on turn 2
  const g = createGame([[el('D', 'nature'), ...filler(40)], [el('A', 'fire'), ...filler(40)]], 1, 0, { cfg });
  g.turn = 2; g.active = 1; g.phase = 'battle'; for (const p of g.players) { p.hand = []; p.field = Array(7).fill(null); }
  put(g, 0, 0, el('D', 'nature')); put(g, 1, 0, el('A', 'fire'));
  return act(g, { t: 'attack', from: 0, to: 0 }) as Game;
}

describe('config resolve / validate', () => {
  it('defaults equal the engine constants and elements.json', () => {
    expect(resolveConfig([])).toEqual(DEFAULT_CONFIG);
    expect(DEFAULT_CONFIG.lp).toBe(RULES.lp); expect(DEFAULT_CONFIG.handMax).toBe(RULES.handMax); expect(DEFAULT_CONFIG.sacrifice).toEqual(RULES.sacrifice);
  });
  it('rejects bad values and falls back to defaults instead of breaking games', () => {
    for (const [k, v] of [['starting_lp', 0], ['starting_lp', 'abc'], ['hand_max', 99], ['evolution_sacrifice', { 40: 1 }], ['evolution_sacrifice_same_level', 'yes'],
      ['element_multiplier', { strong: 0.5, weak: 0.75 }], ['element_multiplier', { strong: 1.5, weak: 0 }], ['element_matrix', { fire: ['moon'] }], ['element_matrix', { moon: [] }], ['element_matrix', { fire: ['fire'] }]] as const)
      expect(validateRuleValue(k, v), k + JSON.stringify(v)).toBeTruthy();
    const c = resolveConfig([{ key: 'starting_lp', value: -5 }, { key: 'hand_max', value: '7' }, { key: 'element_matrix', value: { fire: ['moon'] } }]);
    expect(c.lp).toBe(DEFAULT_CONFIG.lp); expect(c.handMax).toBe(7); expect(c.elements).toEqual(DEFAULT_CONFIG.elements);
  });
});

describe('engine applies the snapshot per game', () => {
  it('lp / hand max / element matrix come from g.cfg; globals are restored afterwards', () => {
    const base = battle().players[0].field[0]!.hp, boosted = battle(resolveConfig([{ key: 'element_multiplier', value: { strong: 2, weak: 0.5 } }]));
    expect(base).toBe(100 - 45);                                   // fire beats nature x1.5
    expect(boosted.players[0].field[0]!.hp).toBe(100 - 60);        // x2 from this game's snapshot
    const flip = battle(resolveConfig([{ key: 'element_matrix', value: { fire: [], nature: ['fire'] } }]));
    expect(flip.players[0].field[0]!.hp).toBe(100 - Math.floor(30 * 0.75));
    expect(elementMultiplier('fire', 'nature')).toBe(1.5); expect(RULES.lp).toBe(100); expect(RULES.handMax).toBe(10);
    const g = createGame([[el('D', null), ...filler(40)], [el('A', null), ...filler(40)]], 1, 0, { cfg: resolveConfig([{ key: 'starting_lp', value: 50 }, { key: 'hand_max', value: 6 }]) });
    expect(g.players[0].lp).toBe(50); expect(g.cfg!.handMax).toBe(6);
    expect(createGame([[el('D', null), ...filler(40)], [el('A', null), ...filler(40)]], 1, 0).players[0].lp).toBe(100);
  });
  it('an edit after creation does not change a running game', () => {
    const g = createGame([[el('D', 'nature'), ...filler(40)], [el('A', 'fire'), ...filler(40)]], 1, 0, { cfg: DEFAULT_CONFIG });
    const g2 = structuredClone(g); g2.turn = 2; g2.active = 1; g2.phase = 'battle';
    expect(g2.cfg!.strong).toBe(1.5);       // snapshot travels with the (JSON) state, unaffected by later rule edits
  });
});

describe('server: migration 030, rule validation, playConfig', () => {
  it('element_matrix row matches elements.json; setRule validates; playConfig reflects edits', async () => {
    const db = new PGlite(); await migrateUp(db); const svc = new CardService(db, '/tmp/vcz-test-storage'), gd = new GameData(svc);
    await svc.createUser('a@x.com', 'password123', 'super_admin'); const u = (await svc.login('a@x.com', 'password123')).user as User;
    const row = (await db.query<any>(`SELECT value FROM game_rules WHERE key='element_matrix'`)).rows[0].value;
    expect(row.fire).toEqual(DEFAULT_CONFIG.elements.fire); const pc = await gd.playConfig(); expect({ ...pc, synergy: DEFAULT_CONFIG.synergy }).toEqual(DEFAULT_CONFIG); expect(Object.keys(pc.synergy.groups).length).toBe(9);   // Game Synergy comes from migration 033
    await expect(gd.setRule(u, 'hand_max', 99)).rejects.toThrow(AppError);
    await gd.setRule(u, 'hand_max', 8); expect((await gd.playConfig()).handMax).toBe(8);
    await gd.setRule(u, 'element_matrix', { fire: ['water'] }); expect((await gd.playConfig()).elements).toEqual({ fire: ['water'] });
    await gd.setRule(u, 'deck_size', 40);          // keys the engine does not read stay free-form
    const down = readFileSync('db/migrations/030_element_matrix.down.sql', 'utf8'); await db.exec(down);
    expect((await db.query<any>(`SELECT count(*)::int n FROM game_rules WHERE key='element_matrix'`)).rows[0].n).toBe(0);
  });
});
