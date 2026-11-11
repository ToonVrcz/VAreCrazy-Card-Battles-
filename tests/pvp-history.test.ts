// Anti-farming phase 1: persistent match history recorded inside the settlement transaction (DATA COLLECTION ONLY).
// Rewards must behave exactly as before; nothing here enforces a pair limit or a quality threshold.
import { describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp, migrateDown } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Rooms } from '../src/server/rooms';
import { Economy, ECONOMY } from '../src/server/economy';
import { botPick } from '../src/engine/bot';
import { TIMING } from '../src/engine/turn-timer';

const load = (f: string) => JSON.parse(readFileSync(`db/seed/${f}`, 'utf8'));
async function world() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage');
  await svc.createUser('a@x.com', 'password123', 'super_admin');
  const admin = (await svc.login('a@x.com', 'password123')).user;
  for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) await svc.importCards(admin, load(f));
  const lv15 = (await db.query<any>(`SELECT character_id id FROM cards WHERE status<>'archived' AND card_type='character' AND level=15 ORDER BY character_id`)).rows.map(r => r.id as string);
  const others = (await db.query<any>(`SELECT character_id id FROM cards WHERE status<>'archived' AND card_type<>'character' ORDER BY character_id`)).rows.map(r => r.id as string);
  return { db, svc, eco: new Economy(svc), rooms: new Rooms(svc), lv15, others };
}
type W = Awaited<ReturnType<typeof world>>;
const mainDeck = (lv15: string[], others: string[]) => { const o: string[] = []; for (const id of [...lv15, ...others]) for (let k = 0; k < 3 && o.length < 40; k++) o.push(id); return o; };
async function playOut(w: W, a: any, b: any, code: string) {
  for (let i = 0; i < 3000; i++) for (const t of [a, b]) {
    const v: any = await w.rooms.view(code, t.token); if (v.status === 'finished') return v;
    const g = v.game, mine = g.pending ? g.pending.responder === 0 : g.active === 0; if (!mine) continue;
    await w.rooms.act(code, t.token, botPick(g));
  }
  throw new Error('game did not finish');
}
const room = async (db: any, code: string) => (await db.query(`SELECT meta, state, status, profiles FROM play_rooms WHERE code=$1`, [code])).rows[0];
const setMeta = async (db: any, code: string, f: (m: any) => void) => { const m = (await room(db, code)).meta; f(m); await db.query(`UPDATE play_rooms SET meta=$2::jsonb WHERE code=$1`, [code, JSON.stringify(m)]); };
const matches = async (db: any) => (await db.query(`SELECT * FROM pvp_matches ORDER BY ended_at, id`)).rows as any[];
const seatsOf = async (db: any, id: string) => (await db.query(`SELECT * FROM pvp_match_players WHERE match_id=$1 ORDER BY seat`, [id])).rows as any[];
const pts = async (w: W, key: string) => (await w.eco.me(key)) as any;
const start = async (w: W, k0?: string, k1?: string, deck?: string[]) => { const a = await w.rooms.create(deck, undefined, k0), b = await w.rooms.join(a.code, deck, undefined, k1); return { a, b, code: a.code as string }; };
/** Ends turns with plain 'next' until the game has reached `turn` (both seats just pass their turns). */
async function idleTo(w: W, a: any, b: any, code: string, turn: number) {
  for (let i = 0; i < 40; i++) {
    const g = (await room(w.db, code)).state; if (g.turn >= turn) return g;
    const t = g.active === 0 ? a : b; await w.rooms.act(code, t.token, { t: 'next' });
  }
  throw new Error('turn not reached');
}

describe('match history: recording each way a match can end', () => {
  it('normal win: one record with both profiles, stats and winner; rewards unchanged; polling again adds nothing', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const { a, b, code } = await start(w, p1.key, p2.key); const v = await playOut(w, a, b, code);
    const [m, ...rest] = await matches(w.db); expect(rest).toHaveLength(0);
    const r = await room(w.db, code);
    expect(m).toMatchObject({ room_code: code, end_reason: 'normal', forfeit_seat: null, both_profiles: true, seat0_profile: true, seat1_profile: true, player0_id: p1.id, player1_id: p2.id, stats_version: 1, rewards_paid: true, turns: r.state.turn });
    expect(m.winner_seat).toBe(r.state.winner); expect(m.started_at).not.toBeNull(); expect(m.quality_score).toBeNull(); expect(m.quality_passed).toBeNull();
    const seats = await seatsOf(w.db, m.id); expect(seats).toHaveLength(2);
    expect(seats.map(s => s.is_winner)).toEqual([r.state.winner === 0, r.state.winner === 1]);
    expect(seats.every(s => s.stats && typeof s.stats.summon === 'number' && s.reward_points === 200 && s.has_profile)).toBe(true);
    expect(seats[0].stats.activeTurns + seats[1].stats.activeTurns).toBeGreaterThan(0); expect(seats[0].participation_score).toBeNull();
    expect(v.reward).toMatchObject({ points: 200, matches: 1, vrcoin: 0 });
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints + 200); expect((await pts(w, p1.key)).matches).toBe(1); expect((await pts(w, p2.key)).vrcoin).toBe(0);
    for (let i = 0; i < 2; i++) { await w.rooms.view(code, a.token); await w.rooms.view(code, b.token); }
    expect(await matches(w.db)).toHaveLength(1);
    await w.db.query(`DELETE FROM play_rooms`);                                    // rooms are purged after a day; the history must outlive them
    expect(await matches(w.db)).toHaveLength(1);
  }, 120000);

  it('duplicate settlement cannot duplicate the record (same match id recorded again, and the settle gate itself)', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const { a, b, code } = await start(w, p1.key, p2.key); await playOut(w, a, b, code);
    const r = await room(w.db, code), before = (await pts(w, p1.key)).points;
    await w.db.transaction(async (tx: any) => {
      await (w.rooms as any).record(tx, code, r.profiles, r.state, r.meta);   // same meta.matchId -> ON CONFLICT DO NOTHING
      await (w.rooms as any).settle(tx, code, r.profiles, r.state, r.meta);   // meta.rewarded is already true -> no-op
    });
    expect(await matches(w.db)).toHaveLength(1); expect(await seatsOf(w.db, (await matches(w.db))[0].id)).toHaveLength(2);
    expect((await pts(w, p1.key)).points).toBe(before);
  }, 120000);

  it('surrender right away: recorded as surrender with the leaving seat; nobody is paid (existing minimum-turn rule)', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const { b, code } = await start(w, p1.key, p2.key); await w.rooms.leave(code, b.token);
    const [m] = await matches(w.db); expect(await matches(w.db)).toHaveLength(1);
    expect(m).toMatchObject({ end_reason: 'surrender', forfeit_seat: 1, winner_seat: 0, rewards_paid: false, turns: 1, both_profiles: true });
    expect((await seatsOf(w.db, m.id)).map(s => [s.is_winner, s.reward_points, s.reward_vrcoin])).toEqual([[true, 0, 0], [false, 0, 0]]);
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints);
    const c2 = await start(w, p1.key, p2.key); await w.rooms.leave(c2.code, c2.a.token);              // the creator surrenders
    expect((await matches(w.db)).find(x => x.room_code === c2.code)).toMatchObject({ end_reason: 'surrender', forfeit_seat: 0, winner_seat: 1 });
  });

  it('PHASE 1 DOES NOT CHANGE REWARDS: a surrender after the 6th turn is still paid to both profiles, and is recorded as a surrender', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const { a, b, code } = await start(w, p1.key, p2.key); await idleTo(w, a, b, code, ECONOMY.minTurnsForReward);
    await w.rooms.leave(code, b.token);
    const [m] = await matches(w.db); expect(m).toMatchObject({ end_reason: 'surrender', forfeit_seat: 1, rewards_paid: true });
    expect((await seatsOf(w.db, m.id)).map(s => s.reward_points)).toEqual([200, 200]);
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints + 200); expect((await pts(w, p2.key)).points).toBe(ECONOMY.starterPoints + 200);
    expect((await pts(w, p2.key)).matches).toBe(1);
  });

  it('timeout: recorded as timeout with the timed-out seat as forfeit_seat; concurrent polls record it once', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const { a, code } = await start(w, p1.key, p2.key); let v: any;
    for (let i = 0; i < 6; i++) {
      await setMeta(w.db, code, m => { m.deadline = Date.now() - 1; });
      [v] = await Promise.all([w.rooms.view(code, a.token), w.rooms.view(code, a.token), w.rooms.view(code, a.token)]); if (v.status === 'finished') break;
    }
    expect(v.endReason).toBe('timeout');
    const r = await room(w.db, code), [m] = await matches(w.db); expect(await matches(w.db)).toHaveLength(1);
    expect(m).toMatchObject({ end_reason: 'timeout', forfeit_seat: r.meta.forfeit, winner_seat: 1 - r.meta.forfeit, turns: r.state.turn });
    expect(m.rewards_paid).toBe(r.state.turn >= ECONOMY.minTurnsForReward);
  });

  it('disconnect: recorded as disconnect (not as surrender)', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const { a, code } = await start(w, p1.key, p2.key);
    await setMeta(w.db, code, m => { m.seen[1] = Date.now() - TIMING.absentMs - 1000; m.seen[0] = Date.now(); m.deadline = Date.now() + 60000; });
    expect(((await w.rooms.view(code, a.token)) as any).endReason).toBe('absent');
    const [m] = await matches(w.db); expect(await matches(w.db)).toHaveLength(1);
    expect(m).toMatchObject({ end_reason: 'disconnect', forfeit_seat: 1, winner_seat: 0, rewards_paid: false });
  });
});

describe('match history: guest seats and compatibility', () => {
  it('two guests: recorded with no profiles, no rewards', async () => {
    const w = await world(); const { a, b, code } = await start(w); await playOut(w, a, b, code);
    const [m] = await matches(w.db);
    expect(m).toMatchObject({ seat0_profile: false, seat1_profile: false, both_profiles: false, player0_id: null, player1_id: null, rewards_paid: false });
    expect((await seatsOf(w.db, m.id)).map(s => [s.has_profile, s.player_id, s.reward_points])).toEqual([[false, null, 0], [false, null, 0]]);
  }, 120000);

  it('profile vs guest: the seat flags show which seat was a guest; the existing payout (profile holder paid) is unchanged in phase 1', async () => {
    const w = await world(), p1 = await w.eco.createProfile();
    const { a, b, code } = await start(w, p1.key, undefined); await playOut(w, a, b, code);
    const [m] = await matches(w.db);
    expect(m).toMatchObject({ seat0_profile: true, seat1_profile: false, both_profiles: false, player0_id: p1.id, player1_id: null, rewards_paid: true });
    expect((await seatsOf(w.db, m.id)).map(s => s.reward_points)).toEqual([200, 0]);
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints + 200);
  }, 120000);

  it('a room that started before this update (no stats, no match id, no start time) still plays and settles; the record shows missing stats', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const { a, b, code } = await start(w, p1.key, p2.key);
    await w.db.query(`UPDATE play_rooms SET state = state - 'stats', meta = meta - 'matchId' - 'startedAt' WHERE code=$1`, [code]);
    const g = await idleTo(w, a, b, code, 2); expect('stats' in g).toBe(false);          // moves work on a game without counters
    await w.rooms.leave(code, a.token);
    const [m] = await matches(w.db); expect(await matches(w.db)).toHaveLength(1);
    expect(m).toMatchObject({ stats_version: null, started_at: null, end_reason: 'surrender' }); expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await seatsOf(w.db, m.id)).map(s => s.stats)).toEqual([null, null]);
    expect((await room(w.db, code)).meta.matchId).toBe(m.id);
  });

  it('if the history cannot be written (e.g. migration 014 not applied yet) the game still ends and rewards are still paid', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    await w.db.exec(`DROP TABLE pvp_match_players; DROP TABLE pvp_matches;`);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { a, b, code } = await start(w, p1.key, p2.key); const v = await playOut(w, a, b, code);
    expect(spy).toHaveBeenCalled(); spy.mockRestore();
    expect(v.status).toBe('finished'); expect(v.reward).toMatchObject({ points: 200 });
    expect((await pts(w, p1.key)).points).toBe(ECONOMY.starterPoints + 200); expect((await pts(w, p2.key)).points).toBe(ECONOMY.starterPoints + 200);
  }, 120000);
});

describe('statistics collected through the room', () => {
  it('failed requests are not counted; a valid summon is; the client never receives any counters', async () => {
    const w = await world(), d = mainDeck(w.lv15, w.others), { a, b, code } = await start(w, undefined, undefined, d);
    const stats = async () => (await room(w.db, code)).state.stats;
    const zero = await stats(); expect(zero).toHaveLength(2);
    const g = (await room(w.db, code)).state, seat = g.active as 0 | 1, tok = seat === 0 ? a : b;
    await expect(w.rooms.act(code, tok.token, { t: 'attack', from: 0, to: 'player' })).rejects.toThrow();     // first turn: cannot attack
    await expect(w.rooms.act(code, tok.token, { t: 'summon', hand: 99, slot: 0 })).rejects.toThrow();
    await expect(w.rooms.act(code, seat === 0 ? b.token : a.token, { t: 'next' })).rejects.toThrow();          // not your turn
    expect(await stats()).toEqual(zero);
    const v: any = await w.rooms.view(code, tok.token), h = v.game.players[0].hand.findIndex((c: any) => c.type === 'character' && c.level === 15);
    expect(h).toBeGreaterThanOrEqual(0);
    await w.rooms.act(code, tok.token, { t: 'summon', hand: h, slot: 0 });
    await w.rooms.act(code, tok.token, { t: 'next' }); await w.rooms.act(code, tok.token, { t: 'next' });     // next / next are not counted
    const after = await stats(); expect(after[seat]).toMatchObject({ summon: 1, activeTurns: 1 }); expect(after[1 - seat]).toEqual(zero[1 - seat]);
    for (const t of [a, b]) {
      const view: any = await w.rooms.view(code, t.token), json = JSON.stringify(view);
      expect('stats' in view.game).toBe(false); expect(json).not.toMatch(/"(stats|activeTurns|lastActiveTurn|dmgUnit|dmgLp|dmgDelayed)"/);
    }
  });
});

describe('migration 014', () => {
  const sql = (n: string) => readFileSync(`db/migrations/014_pvp_match_history.${n}.sql`, 'utf8');
  const tables = async (db: any) => (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'pvp_%' ORDER BY 1`)).rows.map((r: any) => r.table_name);
  it('up creates the tables; down removes only them (players untouched); up/down is repeatable', async () => {
    const db = new PGlite(); await migrateUp(db);
    expect(await tables(db)).toEqual(['pvp_match_players', 'pvp_matches']);
    const pid = (await db.query<any>(`INSERT INTO players(key_hash,name) VALUES ('h','x') RETURNING id`)).rows[0].id;
    for (let round = 0; round < 2; round++) {
      await db.query(`INSERT INTO pvp_matches(id,room_code,player0_id,seat0_profile,seat1_profile,winner_seat,end_reason,turns) VALUES (gen_random_uuid(),'ABCDE',$1,true,false,0,'normal',7)`, [pid]);
      expect((await db.query<any>(`SELECT both_profiles FROM pvp_matches`)).rows[0].both_profiles).toBe(false);
      await db.exec(sql('down')); expect(await tables(db)).toEqual([]);
      expect((await db.query<any>(`SELECT count(*)::int n FROM players`)).rows[0].n).toBe(1);
      await db.exec(sql('up')); expect(await tables(db)).toEqual(['pvp_match_players', 'pvp_matches']);
      expect((await db.query<any>(`SELECT count(*)::int n FROM pvp_matches`)).rows[0].n).toBe(0);
    }
  });
  it('the whole chain still rolls back and re-applies (down to nothing, up again)', async () => {
    const db = new PGlite(); await migrateUp(db); await migrateDown(db);
    expect(await tables(db)).toEqual([]); await migrateUp(db); expect(await tables(db)).toEqual(['pvp_match_players', 'pvp_matches']);
  });
  it('constraints: bad end reason / winner seat rejected, match id is unique, deleting a match removes its seats, deleting a player keeps the history', async () => {
    const db = new PGlite(); await migrateUp(db);
    const ins = (id: string, reason = 'normal', win = 0) => db.query(`INSERT INTO pvp_matches(id,room_code,seat0_profile,seat1_profile,winner_seat,end_reason,turns) VALUES ($1::uuid,'ABCDE',false,false,$2,$3,5)`, [id, win, reason]);
    const id = '11111111-1111-4111-8111-111111111111';
    await expect(ins(id, 'cheating')).rejects.toThrow(); await expect(ins(id, 'normal', 2)).rejects.toThrow();
    await ins(id); await expect(ins(id)).rejects.toThrow();
    const pid = (await db.query<any>(`INSERT INTO players(key_hash,name) VALUES ('k','y') RETURNING id`)).rows[0].id;
    await db.query(`INSERT INTO pvp_match_players(match_id,seat,player_id,has_profile,is_winner) VALUES ($1::uuid,0,$2,true,true)`, [id, pid]);
    await db.query(`DELETE FROM players WHERE id=$1`, [pid]);
    expect((await db.query<any>(`SELECT player_id, has_profile FROM pvp_match_players`)).rows[0]).toEqual({ player_id: null, has_profile: true });
    await db.query(`DELETE FROM pvp_matches WHERE id=$1::uuid`, [id]);
    expect((await db.query<any>(`SELECT count(*)::int n FROM pvp_match_players`)).rows[0].n).toBe(0);
  });
});
