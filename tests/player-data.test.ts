import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Economy } from '../src/server/economy';
import { dispatch } from '../src/server/api';

async function setup() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage'), eco = new Economy(svc);
  return { db, svc, eco };
}
const call = (svc: CardService, method: string, path: string, key?: string, body?: unknown) =>
  dispatch(svc, { method, path, query: new URLSearchParams(), headers: key ? { 'x-player-key': key } : {}, body: async () => Buffer.from(JSON.stringify(body ?? {})) });

describe('player data (Phase 2): rename, ledger, matches', () => {
  it('renames only the caller, trims/limits, refuses empty, never touches wallet', async () => {
    const { db, eco } = await setup(), a = await eco.createProfile(), b = await eco.createProfile('คนอื่น');
    expect((await eco.rename(a.key, '  ตูน   ผู้กล้า  ')).name).toBe('ตูน ผู้กล้า');
    expect((await eco.me(a.key)).name).toBe('ตูน ผู้กล้า'); expect((await eco.me(b.key)).name).toBe('คนอื่น');
    expect((await eco.rename(a.key, 'x'.repeat(60))).name).toHaveLength(24);
    await expect(eco.rename(a.key, '   ')).rejects.toThrow('ชื่อห้ามว่าง');
    await expect(eco.rename(undefined, 'x')).rejects.toThrow();
    await expect(eco.rename('wrong-key', 'x')).rejects.toThrow();
    const w = (await db.query<any>(`SELECT points, vrcoin FROM players WHERE id=$1`, [(await eco.me(a.key)).id])).rows[0];
    expect(w.points).toBe(500); expect(w.vrcoin).toBe(0);
  });

  it('ledger: own rows only, newest first, buy rows carry the card name, limit is capped', async () => {
    const { db, eco } = await setup(), a = await eco.createProfile(), b = await eco.createProfile();
    const ida = (await eco.me(a.key)).id, idb = (await eco.me(b.key)).id;
    await db.query(`INSERT INTO cards(character_id,name,card_type,level,hp,atk) VALUES ('X-040','Warlord','character',40,1,1)`);
    await db.query(`INSERT INTO economy_ledger(player_id,kind,points,vrcoin,ref) VALUES ($1,'buy',-500,0,'X-040'),($1,'match',200,10,'ROOM1'),($2,'match',200,0,'ROOM2')`, [ida, idb]);
    const r = await eco.ledger(a.key);
    expect(r.items.map(i => i.kind)).toEqual(['match', 'buy', 'starter']);   // newest first, no row of player b
    expect(r.items[1]).toMatchObject({ points: -500, card: expect.any(String) });
    expect(r.items[0]).toMatchObject({ points: 200, vrcoin: 10, card: null });
    expect((await eco.ledger(a.key, 1)).items).toHaveLength(1);
    expect((await eco.ledger(a.key, 99999)).items.length).toBeLessThanOrEqual(100);
    await expect(eco.ledger(undefined)).rejects.toThrow();
  });

  it('matches: own matches only, totals, forfeit flag from the caller point of view', async () => {
    const { db, eco } = await setup(), a = await eco.createProfile(), b = await eco.createProfile();
    const ida = (await eco.me(a.key)).id, idb = (await eco.me(b.key)).id;
    const mk = async (id: string, turns: number, winner: number, reason: string, forfeit: number | null) => {
      await db.query(`INSERT INTO pvp_matches(id,room_code,player0_id,player1_id,seat0_profile,seat1_profile,winner_seat,end_reason,forfeit_seat,turns) VALUES ($1::uuid,'ABCDE',$2,$3,true,true,$4,$5,$6,$7)`, [id, ida, idb, winner, reason, forfeit, turns]);
      for (const s of [0, 1]) await db.query(`INSERT INTO pvp_match_players(match_id,seat,player_id,has_profile,is_winner,reward_points,reward_vrcoin) VALUES ($1::uuid,$2,$3,true,$4,$5,0)`, [id, s, s === 0 ? ida : idb, winner === s, winner === s ? 200 : 200]);
    };
    await mk('11111111-1111-1111-1111-111111111111', 12, 0, 'normal', null);
    await mk('22222222-2222-2222-2222-222222222222', 8, 1, 'surrender', 0);
    const ra = await eco.matches(a.key), rb = await eco.matches(b.key);
    expect(ra).toMatchObject({ total: 2, wins: 1, losses: 1 }); expect(rb).toMatchObject({ total: 2, wins: 1, losses: 1 });
    const surrender = ra.items.find(i => i.reason === 'surrender')!;
    expect(surrender).toMatchObject({ win: false, youForfeited: true, turns: 8 });
    expect(rb.items.find(i => i.reason === 'surrender')).toMatchObject({ win: true, youForfeited: false });
    expect(ra.items.find(i => i.reason === 'normal')!.youForfeited).toBeNull();
    const nobody = await eco.createProfile(); expect(await eco.matches(nobody.key)).toMatchObject({ total: 0, items: [] });
  });

  it('HTTP routes: PUT /profile, GET /ledger, GET /matches need a valid key', async () => {
    const { svc, eco } = await setup(), a = await eco.createProfile();
    expect((await call(svc, 'PUT', '/api/play/profile', a.key, { name: 'ใหม่' })).data).toMatchObject({ ok: true, name: 'ใหม่' });
    expect((await call(svc, 'GET', '/api/play/ledger', a.key)).status).toBe(200);
    expect((await call(svc, 'GET', '/api/play/matches', a.key)).status).toBe(200);
    expect((await call(svc, 'GET', '/api/play/ledger')).status).toBe(401);
    expect((await call(svc, 'GET', '/api/play/matches', 'bad')).status).toBe(401);
    expect((await call(svc, 'PUT', '/api/play/profile', undefined, { name: 'x' })).status).toBe(401);
  });
});
