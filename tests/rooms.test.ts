import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Rooms, buildDeck, viewFor } from '../src/server/rooms';
import { botPick } from '../src/engine/bot';

const load = (f: string) => JSON.parse(readFileSync(`db/seed/${f}`, 'utf8'));
async function world() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage');
  await svc.createUser('a@x.com', 'password123', 'super_admin');
  const u = (await svc.login('a@x.com', 'password123')).user;
  for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) { const r = await svc.importCards(u, load(f)); expect(r.errors).toEqual([]); }
  return { db, svc, rooms: new Rooms(svc) };
}
const code5 = /^[A-Z0-9]{5}$/;

describe('online rooms', () => {
  it('create -> join -> redacted seat-relative views', async () => {
    const { rooms } = await world();
    const a = await rooms.create(); expect(a.code).toMatch(code5); expect(a.seat).toBe(0);
    expect(await rooms.view(a.code, a.token)).toMatchObject({ status: 'waiting' });
    const b = await rooms.join(a.code); expect(b.seat).toBe(1);
    await expect(rooms.join(a.code)).rejects.toThrow(/เริ่มเล่นแล้ว/);
    const va: any = await rooms.view(a.code, a.token), vb: any = await rooms.view(a.code, b.token);
    expect(va.status).toBe('playing'); expect(va.game.players[0].hand).toHaveLength(5); expect(va.game.players[0].hand[0].name).not.toBe('?');
    expect(va.game.players[1].hand.every((c: any) => c.id === '?')).toBe(true);         // opponent hand hidden
    expect(vb.game.players[1].hand.every((c: any) => c.id === '?')).toBe(true);
    expect(va.game.active === 0).toBe(vb.game.active === 1);                          // same turn owner, seen from each side
    expect(va.game.players[0].deck.every((c: any) => c.id === '?') && va.game.players[1].deck.every((c: any) => c.id === '?')).toBe(true);   // decks hidden
    expect(va.game.seed).toBe(0); expect(va.game.pending).toBeUndefined();
    expect(await rooms.view(a.code, a.token, va.version)).toMatchObject({ unchanged: true });
    await expect(rooms.view(a.code, 'nope')).rejects.toThrow(/โทเค็น/);
  });
  it('only the player whose turn it is can act; illegal actions come back as errors', async () => {
    const { rooms } = await world();
    const a = await rooms.create(), b = await rooms.join(a.code);
    const v: any = await rooms.view(a.code, a.token), mineFirst = v.game.active === 0;
    const [me, other] = mineFirst ? [a, b] : [b, a];
    await expect(rooms.act(a.code, other.token, { t: 'next' })).rejects.toThrow(/ยังไม่ถึงตา/);
    await expect(rooms.act(a.code, me.token, { t: 'attack', from: 0, to: 'player' })).rejects.toThrow();   // battle phase only
    await expect(rooms.act(a.code, me.token, { t: 'next' })).resolves.toMatchObject({ ok: true });
    await expect(rooms.act(a.code, 'bad', { t: 'next' })).rejects.toThrow(/โทเค็น/);
  });
  it('two bots can play a whole room through the API (incl. trap response windows)', async () => {
    const { rooms, db } = await world();
    const a = await rooms.create(), b = await rooms.join(a.code), toks = [a.token, b.token];
    let steps = 0;
    while (steps++ < 3000) {
      const row: any = (await db.query<any>(`SELECT state, status FROM play_rooms WHERE code=$1`, [a.code])).rows[0];
      if (row.status === 'finished') break;
      const g = row.state, seat = g.pending ? g.pending.responder : g.active;
      await rooms.act(a.code, toks[seat], botPick(g));
    }
    const fin: any = (await db.query<any>(`SELECT status FROM play_rooms WHERE code=$1`, [a.code])).rows[0];
    expect(fin.status).toBe('finished');
    const v: any = await rooms.view(a.code, a.token); expect(v.game.winner === 0 || v.game.winner === 1).toBe(true);
    await expect(rooms.act(a.code, a.token, { t: 'next' })).rejects.toThrow(/เกมจบแล้ว/);
  }, 120000);
  it('buildDeck makes 40 cards with fusion cards only when pairs exist', () => {
    const c = (id: string, type: any, level: number | null, chain: string | null) => ({ id, name: id, type, level, chain, hp: 10, atk: 5, def: 0, element: null });
    const pool = [c('A-15', 'character', 15, 'a'), c('A-40', 'character', 40, 'a'), c('B-15', 'character', 15, 'b'), c('EVO-001', 'evolution', null, null), c('FUS-001', 'fusion', null, null), c('SPL-001', 'spell', null, null), c('TRP-001', 'trap', null, null)];
    expect(buildDeck(pool as any, [])).toHaveLength(40);
    expect(buildDeck(pool as any, []).some(x => x.id === 'FUS-001')).toBe(false);
    expect(buildDeck(pool as any, [{ a: 'a', b: 'b', hp: 1, atk: 1, def: 0 }]).filter(x => x.id === 'FUS-001')).toHaveLength(2);
  });
});
