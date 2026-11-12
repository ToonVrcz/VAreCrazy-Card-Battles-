import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Rooms, ROOM } from '../src/server/rooms';
import { TIMING } from '../src/engine/turn-timer';
import { joinStart } from './room-helpers';

const load = (f: string) => JSON.parse(readFileSync(`db/seed/${f}`, 'utf8'));
async function world() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage');
  await svc.createUser('a@x.com', 'password123', 'super_admin');
  const u = (await svc.login('a@x.com', 'password123')).user;
  for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) await svc.importCards(u, load(f));
  return { db, rooms: new Rooms(svc) };
}
const age = (db: any, code: string, who: 0 | 1, ms: number) => db.query(`UPDATE play_rooms SET meta = jsonb_set(meta, '{seen,${who}}', to_jsonb((extract(epoch from now())*1000)::bigint - $2::bigint)) WHERE code=$1`, [code, ms]);

describe('room lobby (Phase 3)', () => {
  it('create options: name, public, turn length (validated)', async () => {
    const { db, rooms } = await world();
    const a = await rooms.create(undefined, undefined, undefined, { name: '  ห้อง   ทดสอบ ', public: true, turnSec: 45 });
    const r = (await db.query<any>(`SELECT name, is_public, turn_ms, status FROM play_rooms WHERE code=$1`, [a.code])).rows[0];
    expect(r).toMatchObject({ name: 'ห้อง ทดสอบ', is_public: true, turn_ms: 45000, status: 'waiting' });
    const d = await rooms.create(); expect((await db.query<any>(`SELECT is_public, turn_ms FROM play_rooms WHERE code=$1`, [d.code])).rows[0]).toMatchObject({ is_public: false, turn_ms: null });
    await expect(rooms.create(undefined, undefined, undefined, { turnSec: 5 })).rejects.toThrow(/วินาที/);
    await expect(rooms.create(undefined, undefined, undefined, { turnSec: 99999 })).rejects.toThrow(/วินาที/);
    expect((await db.query<any>(`SELECT turn_ms FROM play_rooms WHERE code=$1`, [(await rooms.create(undefined, undefined, undefined, { turnSec: 90 })).code])).rows[0].turn_ms).toBeNull();
  });

  it('join only seats the guest (lobby); Host Start needs Ready, host token and a connected guest', async () => {
    const { db, rooms } = await world(), a = await rooms.create(), b = await rooms.join(a.code);
    expect((await db.query<any>(`SELECT status, state FROM play_rooms WHERE code=$1`, [a.code])).rows[0]).toMatchObject({ status: 'lobby', state: null });
    const v: any = await rooms.view(a.code, a.token); expect(v.status).toBe('lobby'); expect(v.room.players[1]).toMatchObject({ here: true }); expect(v.room.ready).toEqual([false, false]);
    await expect(rooms.join(a.code)).rejects.toThrow(/ครบแล้ว/);
    await expect(rooms.start(a.code, a.token)).rejects.toThrow(/ยังไม่กด Ready/);
    await expect(rooms.ready(a.code, a.token, true)).rejects.toThrow(/เจ้าของห้อง/);
    await rooms.ready(a.code, b.token, true);
    await expect(rooms.start(a.code, b.token)).rejects.toThrow(/เฉพาะเจ้าของห้อง/);
    expect(((await rooms.view(a.code, b.token)) as any).room.ready).toEqual([false, true]);
    await rooms.ready(a.code, b.token, false); await expect(rooms.start(a.code, a.token)).rejects.toThrow(/ยังไม่กด Ready/);
    await rooms.ready(a.code, b.token, true);
    await age(db, a.code, 1, ROOM.lobbyPresenceMs + 5000);
    await expect(rooms.start(a.code, a.token)).rejects.toThrow(/หลุดการเชื่อมต่อ/);
    await rooms.view(a.code, b.token);                                  // guest polls again: presence restored
    await age(db, a.code, 1, 0);
    expect(await rooms.start(a.code, a.token)).toEqual({ ok: true });
    expect((await rooms.view(a.code, a.token) as any).status).toBe('playing'); expect(((await rooms.view(a.code, b.token)) as any).game.players[0].hand).toHaveLength(5);
    await expect(rooms.start(a.code, a.token)).rejects.toThrow(/เริ่มเล่นไปแล้ว/);
    await expect(rooms.join(a.code)).rejects.toThrow(/เริ่มเล่นแล้ว/);
  });

  it('start refused while waiting for the second player', async () => {
    const { rooms } = await world(), a = await rooms.create();
    await expect(rooms.start(a.code, a.token)).rejects.toThrow(/รอผู้เล่นอีกคน/);
  });

  it('turn length is per room: custom vs default', async () => {
    const { db, rooms } = await world();
    for (const [sec, ms] of [[40, 40000], [undefined, TIMING.turnMs]] as const) {
      const a = await rooms.create(undefined, undefined, undefined, { turnSec: sec }); await joinStart(rooms, a);
      const m = (await db.query<any>(`SELECT meta FROM play_rooms WHERE code=$1`, [a.code])).rows[0].meta;
      expect(m.deadline - m.startedAt).toBe(ms);
    }
  });

  it('kick: host removes the guest in the lobby (room back to waiting, kicked token told so); not mid-game; guest cannot kick', async () => {
    const { rooms } = await world(), a = await rooms.create(), b = await rooms.join(a.code);
    await expect(rooms.kick(a.code, b.token, 'guest')).rejects.toThrow(/เจ้าของห้อง/);
    await rooms.kick(a.code, a.token, 'guest');
    expect(((await rooms.view(a.code, b.token)) as any).status).toBe('kicked');
    expect(((await rooms.view(a.code, a.token)) as any)).toMatchObject({ status: 'waiting' });
    const c = await rooms.join(a.code); expect(c.seat).toBe(1);        // a new guest can take the seat
    await rooms.ready(a.code, c.token, true); await rooms.start(a.code, a.token);
    await expect(rooms.kick(a.code, a.token, 'guest')).rejects.toThrow(/ยอมแพ้/);
  });

  it('leave: guest steps out of the lobby (room waits again), host closes the room', async () => {
    const { db, rooms } = await world(), a = await rooms.create(), b = await rooms.join(a.code);
    await rooms.leave(a.code, b.token);
    expect(((await rooms.view(a.code, a.token)) as any).status).toBe('waiting');
    const c = await rooms.join(a.code); expect(c.seat).toBe(1);
    await rooms.leave(a.code, a.token);
    expect((await db.query(`SELECT 1 FROM play_rooms WHERE code=$1`, [a.code])).rows).toHaveLength(0);
  });

  it('presence: a guest who vanished from the lobby is sent out when the host polls', async () => {
    const { db, rooms } = await world(), a = await rooms.create(), b = await rooms.join(a.code);
    await age(db, a.code, 1, TIMING.absentMs + 5000); await age(db, a.code, 0, 20000);
    const v: any = await rooms.view(a.code, a.token);
    expect(v.status).toBe('waiting'); expect(((await rooms.view(a.code, b.token)) as any).status).toBe('kicked');
  });

  it('spectators: public rooms only, capped, read-only, hands and face-down traps hidden, host can remove them', async () => {
    const { rooms } = await world();
    const priv = await rooms.create(); await expect(rooms.spectate(priv.code)).rejects.toThrow(/ห้องส่วนตัว/);
    const a = await rooms.create(undefined, undefined, undefined, { public: true }), s = await rooms.spectate(a.code);
    expect(s.seat).toBe('spectator'); expect(((await rooms.view(a.code, s.token)) as any)).toMatchObject({ status: 'waiting', spectator: true });
    const b = await joinStart(rooms, a);
    const v: any = await rooms.view(a.code, s.token);
    expect(v).toMatchObject({ status: 'playing', spectator: true });
    for (const p of v.game.players) { expect(p.hand.every((c: any) => c.type === 'hidden')).toBe(true); expect(p.deck.every((c: any) => c.type === 'hidden')).toBe(true); }
    expect(v.game.pending ?? null).toBeNull();
    await expect(rooms.act(a.code, s.token, { t: 'next' } as any)).rejects.toThrow(/โทเค็น/);
    await expect(rooms.leave(a.code, 'nope')).rejects.toThrow();
    const s2 = await rooms.spectate(a.code); await rooms.leave(a.code, s2.token); expect(((await rooms.view(a.code, s2.token).catch((e: any) => ({ status: e.message }))) as any).status).toMatch(/โทเค็น/);
    for (let i = 0; i < ROOM.spectatorMax - 1; i++) await rooms.spectate(a.code);
    await expect(rooms.spectate(a.code)).rejects.toThrow(/ครบ/);
    await expect(rooms.kick(a.code, b.token, { spectator: 0 })).rejects.toThrow(/เจ้าของห้อง/);
    await rooms.kick(a.code, a.token, { spectator: 0 });
    expect(((await rooms.view(a.code, s.token)) as any).status).toBe('kicked');
    await rooms.spectate(a.code);                                        // a seat freed up
  });

  it('public list: shows public waiting/playing rooms only, with name, host, timer and watch/join flags', async () => {
    const { db, rooms } = await world();
    await rooms.create(); const pub = await rooms.create(undefined, undefined, undefined, { public: true, name: 'ห้องเปิด', turnSec: 60 });
    const l = (await rooms.listPublic()).rooms; expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ code: pub.code, name: 'ห้องเปิด', status: 'waiting', turnSec: 60, canJoin: true, canWatch: true, spectators: 0 });
    await joinStart(rooms, pub); expect((await rooms.listPublic()).rooms[0]).toMatchObject({ status: 'playing', canJoin: false });
    await db.query(`UPDATE play_rooms SET status='waiting', updated_at = now() - interval '11 minutes' WHERE code=$1`, [pub.code]);
    expect((await rooms.listPublic()).rooms).toHaveLength(0);          // abandoned waiting rooms drop off the list
  });
});
