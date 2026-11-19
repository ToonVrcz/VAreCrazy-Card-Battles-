// F-03 regression: PvP reward farming. Rules approved in docs/PVP-ANTI-FARMING.md §9.
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Rooms } from '../src/server/rooms';
import { Economy, ECONOMY } from '../src/server/economy';
import { joinStart } from './room-helpers';

const load = (f: string) => JSON.parse(readFileSync(`db/seed/${f}`, 'utf8'));
async function world() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage');
  await svc.createUser('a@x.com', 'password123', 'super_admin');
  const admin = (await svc.login('a@x.com', 'password123')).user;
  for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) await svc.importCards(admin, load(f));
  return { db, eco: new Economy(svc), rooms: new Rooms(svc) };
}
type W = Awaited<ReturnType<typeof world>>;
const setMeta = async (db: any, code: string, f: (m: any) => void) => { const m = (await db.query(`SELECT meta FROM play_rooms WHERE code=$1`, [code])).rows[0].meta; f(m); await db.query(`UPDATE play_rooms SET meta=$2::jsonb WHERE code=$1`, [code, JSON.stringify(m)]); };
const turnTo = async (w: W, a: any, b: any, code: string, turn: number) => {
  for (let i = 0; i < 40; i++) { const g = (await w.db.query<any>(`SELECT state FROM play_rooms WHERE code=$1`, [code])).rows[0].state; if (g.turn >= turn) return; await w.rooms.act(code, (g.active === 0 ? a : b).token, { t: 'next' }); }
  throw new Error('turn not reached');
};
/** One finished match between two keys: play to the minimum turn, then seat 1 (the joiner) surrenders — the opponent is the confirmed winner. */
async function match(w: W, k0?: string, k1?: string, leaver: 'a' | 'b' = 'b') {
  const a = await w.rooms.create(undefined, undefined, k0), b = await joinStart(w.rooms, a, undefined, undefined, k1);
  await turnTo(w, a, b, a.code, ECONOMY.minTurnsForReward);
  await w.rooms.leave(a.code, leaver === 'a' ? a.token : b.token);
  return a.code;
}
const pts = async (w: W, key: string) => (await w.eco.me(key)) as any;

describe('F-03 reward farming', () => {
  it('the same two profiles earn from at most 3 matches per day; the 4th and later pay neither player', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    // alternate the surrendering seat so each side is paid at least once
    for (let i = 0; i < ECONOMY.maxPairMatchesPerDay; i++) await match(w, p1.key, p2.key, i % 2 ? 'a' : 'b');
    const [x, y] = [await pts(w, p1.key), await pts(w, p2.key)];
    expect(x.points + y.points).toBe(ECONOMY.starterPoints * 2 + 200 * ECONOMY.maxPairMatchesPerDay);   // exactly one winner paid per match
    const before = [x.points, y.points, x.vrcoin, y.vrcoin];
    for (let i = 0; i < 3; i++) await match(w, p1.key, p2.key, 'b');
    const [x2, y2] = [await pts(w, p1.key), await pts(w, p2.key)];
    expect([x2.points, y2.points, x2.vrcoin, y2.vrcoin]).toEqual(before);
    expect((await w.db.query<any>(`SELECT count(*)::int n FROM economy_ledger WHERE kind='match'`)).rows[0].n).toBe(ECONOMY.maxPairMatchesPerDay);
  }, 120000);

  it('the limit is per unordered pair: seat order does not matter and other pairs are unaffected', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile(), p3 = await w.eco.createProfile();
    for (let i = 0; i < ECONOMY.maxPairMatchesPerDay; i++) await match(w, i % 2 ? p2.key : p1.key, i % 2 ? p1.key : p2.key, 'b');
    const frozen = (await pts(w, p1.key)).points + (await pts(w, p2.key)).points;
    await match(w, p2.key, p1.key, 'b');                                                    // reversed seats: still the same pair
    expect((await pts(w, p1.key)).points + (await pts(w, p2.key)).points).toBe(frozen);
    const p3before = (await pts(w, p3.key)).points;
    await match(w, p1.key, p3.key, 'b');                                                    // a different pair is still paid
    expect((await pts(w, p1.key)).points + (await pts(w, p3.key)).points).toBe(frozen - (await pts(w, p2.key)).points + p3before + 200);
  }, 120000);

  it('the counter resets on the next Asia/Bangkok calendar day', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    for (let i = 0; i < ECONOMY.maxPairMatchesPerDay; i++) await match(w, p1.key, p2.key, 'b');
    await w.db.query(`UPDATE pvp_matches SET ended_at = ended_at - interval '1 day'`);   // yesterday (Bangkok) now
    const before = (await pts(w, p1.key)).points;
    await match(w, p1.key, p2.key, 'b');
    expect((await pts(w, p1.key)).points).toBe(before + 200);
  }, 120000);

  it('one profile cannot play both seats of a room (join is refused)', async () => {
    const w = await world(), p1 = await w.eco.createProfile();
    const a = await w.rooms.create(undefined, undefined, p1.key);
    await expect(w.rooms.join(a.code, undefined, undefined, p1.key)).rejects.toThrow();
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints);
  }, 60000);

  it('a surrendering player is never paid, timeouts and disconnects pay only the player who stayed', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const code = await match(w, p1.key, p2.key, 'a');                                       // creator (seat 0) surrenders
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints); expect((await pts(w, p2.key)).points).toBe(ECONOMY.starterPoints + 200);
    expect((await w.db.query<any>(`SELECT meta->'rewards' r FROM play_rooms WHERE code=$1`, [code])).rows[0].r[0]).toBeNull();
    const a = await w.rooms.create(undefined, undefined, p1.key), b = await joinStart(w.rooms, a, undefined, undefined, p2.key);
    await turnTo(w, a, b, a.code, ECONOMY.minTurnsForReward);
    await setMeta(w.db, a.code, m => { m.seen[1] = Date.now() - 10 * 60_000; m.seen[0] = Date.now(); m.deadline = Date.now() + 60000; });
    expect(((await w.rooms.view(a.code, a.token)) as any).endReason).toBe('absent');       // seat 1 vanished
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints + 200); expect((await pts(w, p2.key)).points).toBe(ECONOMY.starterPoints + 200);
  }, 120000);

  it('a guest seat means no rewards for anyone', async () => {
    const w = await world(), p1 = await w.eco.createProfile();
    await match(w, p1.key, undefined, 'b');
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints);
  }, 60000);

  it('the 10th rewarded match still gives the Vrcoin bonus (only rewarded matches count)', async () => {
    const w = await world(), p1 = await w.eco.createProfile();
    await w.db.query(`UPDATE players SET pvp_matches = $2 WHERE id=$1`, [p1.id, ECONOMY.vrcoinEvery - 1]);
    const p2 = await w.eco.createProfile(); await match(w, p2.key, p1.key, 'a');          // p1 stays and wins: 10th rewarded match
    expect((await pts(w, p1.key)).vrcoin).toBe(ECONOMY.vrcoinBatch);
  }, 60000);
});
