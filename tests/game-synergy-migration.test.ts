// Migration 033 (Game Synergy live): HP/DEF rows replace the proposal ATK rows, cap rule, Lv40+ inherit the chain's groups; down restores.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { loadPlayConfig } from '../src/server/play-config';
const UP = readFileSync('db/migrations/033_game_synergy.up.sql', 'utf8'), DOWN = readFileSync('db/migrations/033_game_synergy.down.sql', 'utf8');
describe('migration 033 Game Synergy', () => {
  let db: PGlite;
  const syn = async () => (await db.query<any>(`SELECT v.key, s.min_members, s.stat, s.amount FROM affiliation_synergies s JOIN taxonomy_values v ON v.id=s.affiliation_id ORDER BY v.key,s.stat,s.min_members`)).rows;
  const aff = async (cid: string) => (await db.query<any>(`SELECT v.key FROM card_affiliations ca JOIN cards c ON c.id=ca.card_id JOIN taxonomy_values v ON v.id=ca.value_id WHERE c.character_id=$1 ORDER BY v.key`, [cid])).rows.map(r => r.key);
  beforeAll(async () => {
    db = new PGlite(); await migrateUp(db);
    await db.query(`INSERT INTO evolution_chains(key,name) VALUES ('zz','ZZ'),('yy','YY') ON CONFLICT DO NOTHING`);
    const ch = async (k: string) => (await db.query<any>(`SELECT id FROM evolution_chains WHERE key=$1`, [k])).rows[0].id;
    for (const [id, lv, c] of [['ZZ-015', 15, 'zz'], ['ZZ-040', 40, 'zz'], ['ZZ-070', 70, 'zz'], ['YY-015', 15, 'yy'], ['YY-040', 40, 'yy']] as const)
      await db.query(`INSERT INTO cards(character_id,name,card_type,level,hp,atk,def,chain_id) VALUES($1,$1,'character',$2,50,10,1,$3)`, [id, lv, await ch(c)]);
    const give = async (cid: string, keys: string[]) => { for (const k of keys) await db.query(`INSERT INTO card_affiliations(card_id,value_id) SELECT c.id,v.id FROM cards c, taxonomy_values v WHERE c.character_id=$1 AND v.taxonomy_key='affiliation' AND v.key=$2`, [cid, k]); };
    await give('ZZ-015', ['among-us', 'roblox']); await give('YY-015', ['rov']); await give('YY-040', ['goose-goose-duck']);   // YY-040 has its own group -> not overwritten
    await db.exec(UP);
  }, 60000);
  it('every group has HP +3 and DEF 1-2 at 2 units; no ATK rows remain; Among Us is the weakest', async () => {
    const r = await syn(); expect(r.some(x => x.stat === 'atk')).toBe(false);
    const by = (k: string, st: string) => r.filter(x => x.key === k && x.stat === st);
    for (const k of ['among-us', 'goose-goose-duck', 'rov', 'warz', 'ghost-story', 'fivem', 'ragnarok', 'roblox', 'board-game']) { expect(by(k, 'hp').length, k).toBe(1); expect(by(k, 'def').length, k).toBe(1); expect(by(k, 'hp')[0].min_members).toBe(2); }
    expect(by('among-us', 'hp')[0].amount).toBeLessThan(by('roblox', 'hp')[0].amount + 1); expect(by('among-us', 'def')[0].amount).toBeLessThanOrEqual(by('roblox', 'def')[0].amount);
  });
  it('cap rule exists; Lv40/70 inherit the chain Lv15 groups; an own group is kept; Lv15 untouched', async () => {
    expect((await db.query<any>(`SELECT value FROM game_rules WHERE key='synergy_cap'`)).rows[0].value).toEqual({ hp: 10, def: 4 });
    expect(await aff('ZZ-040')).toEqual(['among-us', 'roblox']); expect(await aff('ZZ-070')).toEqual(['among-us', 'roblox']);
    expect(await aff('YY-040')).toEqual(['goose-goose-duck']); expect(await aff('ZZ-015')).toEqual(['among-us', 'roblox']);
  });
  it('playConfig snapshot carries the table and the members (including the inheriting Lv40)', async () => {
    const c = (await loadPlayConfig(db)).synergy;
    expect(c.cap).toEqual({ hp: 10, def: 4 }); expect(c.groups['roblox'].map(t => t.stat).sort()).toEqual(['def', 'hp']);
    expect(c.members['ZZ-040'].sort()).toEqual(['among-us', 'roblox']); expect(c.members['YY-040']).toEqual(['goose-goose-duck']);
  });
  it('up is idempotent; an admin-edited group is not overwritten; down restores the proposal rows', async () => {
    await db.query(`UPDATE affiliation_synergies SET amount=7 WHERE stat='hp' AND affiliation_id=(SELECT id FROM taxonomy_values WHERE key='rov')`);
    await db.exec(UP); const r = await syn(); expect(r.filter(x => x.key === 'rov' && x.stat === 'hp')[0].amount).toBe(7); expect(r.filter(x => x.key === 'rov').length).toBe(2);
    await db.exec(DOWN);
    expect((await db.query<any>(`SELECT count(*)::int n FROM game_rules WHERE key='synergy_cap'`)).rows[0].n).toBe(0);
    expect(await aff('ZZ-040')).toEqual([]); expect(await aff('YY-040')).toEqual(['goose-goose-duck']);
    const r2 = await syn(); expect(r2.filter(x => x.stat === 'atk').length).toBeGreaterThan(0);
  });
});
