import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Rooms } from '../src/server/rooms';
import { TIMING } from '../src/engine/turn-timer';

const load = (f: string) => JSON.parse(readFileSync(`db/seed/${f}`, 'utf8'));
async function world() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage');
  await svc.createUser('a@x.com', 'password123', 'super_admin');
  const u = (await svc.login('a@x.com', 'password123')).user;
  for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) await svc.importCards(u, load(f));
  const ids = (await db.query<any>(`SELECT character_id id FROM cards WHERE status<>'archived' ORDER BY character_id`)).rows.map(r => r.id as string);
  const lv15 = (await db.query<any>(`SELECT character_id id FROM cards WHERE status<>'archived' AND card_type='character' AND level=15 ORDER BY character_id`)).rows.map(r => r.id as string);
  return { db, rooms: new Rooms(svc), ids, lv15 };
}
/** 40 cards, max 3 each, starting with Lv15 characters. */
function goodDeck(ids: string[], lv15: string[]) { const out: string[] = []; for (const id of [...lv15, ...ids.filter(i => !lv15.includes(i))]) for (let k = 0; k < 3 && out.length < 40; k++) out.push(id); return out; }
const meta = async (db: any, code: string) => (await db.query(`SELECT meta, state, status, version FROM play_rooms WHERE code=$1`, [code])).rows[0];
const setMeta = (db: any, code: string, f: (m: any) => void) => meta(db, code).then((r: any) => { const m = r.meta; f(m); return db.query(`UPDATE play_rooms SET meta=$2::jsonb WHERE code=$1`, [code, JSON.stringify(m)]); });
async function started(w: any, d0?: string[], d1?: string[]) { const a = await w.rooms.create(d0), b = await w.rooms.join(a.code, d1); return { a, b, code: a.code as string }; }

describe('custom decks', () => {
  it('uses the chosen decks for both seats (creator + joiner)', async () => {
    const w = await world(), d0 = goodDeck(w.ids, w.lv15), d1 = goodDeck([...w.ids].reverse(), w.lv15);
    const { code } = await started(w, d0, d1);
    const g = (await meta(w.db, code)).state, all = (p: any) => [...p.hand, ...p.deck].map((c: any) => c.id).sort();
    expect(all(g.players[0])).toEqual([...d0].sort()); expect(all(g.players[1])).toEqual([...d1].sort());
  });
  it('no deck = random 40 cards; mixed works (one custom, one random)', async () => {
    const w = await world(), d0 = goodDeck(w.ids, w.lv15), { code } = await started(w, d0);
    const g = (await meta(w.db, code)).state; expect(g.players[1].hand.length + g.players[1].deck.length).toBe(40);
  });
  it('rejects bad decks with a clear message', async () => {
    const w = await world(), good = goodDeck(w.ids, w.lv15);
    await expect(w.rooms.create(good.slice(0, 39))).rejects.toThrow(/40 ใบ/);
    await expect(w.rooms.create([...good.slice(0, 39), 'NOPE-1'])).rejects.toThrow(/ไม่พบการ์ด/);
    await expect(w.rooms.create(Array(40).fill(w.lv15[0]))).rejects.toThrow(/ไม่เกิน 3/);
    await expect(w.rooms.create(goodDeck(w.ids.filter(i => !w.lv15.includes(i)), []))).rejects.toThrow(/Lv\.15/);
    await expect(w.rooms.create('x' as any)).rejects.toThrow(/รูปแบบ/);
    const a = await w.rooms.create(); await expect(w.rooms.join(a.code, good.slice(1))).rejects.toThrow(/40 ใบ/);
  });
});

describe('turn timer + disconnects', () => {
  it('a playing room reports deadline + server time; fresh poll changes nothing', async () => {
    const w = await world(), { a, code } = await started(w), v: any = await w.rooms.view(code, a.token);
    expect(v.deadline).toBeGreaterThan(v.serverNow); expect(v.deadline - v.serverNow).toBeLessThanOrEqual(TIMING.turnMs);
    const v2: any = await w.rooms.view(code, a.token, v.version); expect(v2.unchanged).toBe(true); expect(v2.version).toBe(v.version);
  });
  it('overdue turn is ended automatically; 3 misses in a row forfeit with a reason', async () => {
    const w = await world(), { a, b, code } = await started(w);
    let v: any = await w.rooms.view(code, a.token); const tok = a.token;
    // the same seat idles through its turns: force deadlines into the past and poll
    for (let i = 0; i < 6; i++) {
      await setMeta(w.db, code, m => { m.deadline = Date.now() - 1; });
      v = await w.rooms.view(code, tok); if (v.status === 'finished') break;
    }
    expect(v.status).toBe('finished'); expect(v.endReason).toBe('timeout'); expect(typeof v.forfeitedYou).toBe('boolean');
    const other = await w.rooms.view(code, b.token) as any; expect(other.forfeitedYou).toBe(!v.forfeitedYou);
    expect(v.game.winner === 0).toBe(!v.forfeitedYou);
    await expect(w.rooms.act(code, a.token, { t: 'next' })).rejects.toThrow(/เกมจบแล้ว/);
  });
  it('a successful move resets misses and restarts the clock', async () => {
    const w = await world(), { a, b, code } = await started(w), v: any = await w.rooms.view(code, a.token), me = v.game.active === 0 ? a : b;
    await setMeta(w.db, code, m => { m.misses = [1, 1]; m.deadline = Date.now() + 5000; });
    await w.rooms.act(code, me.token, { t: 'next' });
    const m = (await meta(w.db, code)).meta; expect(m.misses[me.seat]).toBe(0); expect(m.deadline - Date.now()).toBeGreaterThan(TIMING.turnMs - 5000);
  });
  it('a seat that stops polling is forfeited once the other seat notices', async () => {
    const w = await world(), { a, b, code } = await started(w);
    await setMeta(w.db, code, m => { m.seen[1] = Date.now() - TIMING.absentMs - 1000; m.seen[0] = Date.now(); m.deadline = Date.now() + 60000; });
    const va: any = await w.rooms.view(code, a.token);
    expect(va.status).toBe('finished'); expect(va.endReason).toBe('absent'); expect(va.forfeitedYou).toBe(false); expect(va.game.winner).toBe(0);
    const vb: any = await w.rooms.view(code, b.token); expect(vb.forfeitedYou).toBe(true); expect(vb.game.winner).toBe(1);   // seat-relative: b is players[0]
  });
  it('presence is refreshed by polling so active players never time out', async () => {
    const w = await world(), { a, b, code } = await started(w);
    await setMeta(w.db, code, m => { m.seen = [Date.now() - TIMING.absentMs + 5000, Date.now() - TIMING.absentMs + 5000]; m.deadline = Date.now() + 60000; });
    expect(((await w.rooms.view(code, a.token)) as any).status).toBe('playing'); expect(((await w.rooms.view(code, b.token)) as any).status).toBe('playing');
  });
  it('leave: resigning ends the game for the opponent; leaving a waiting room deletes it', async () => {
    const w = await world(), { a, b, code } = await started(w);
    await w.rooms.leave(code, b.token);
    const va: any = await w.rooms.view(code, a.token); expect(va.status).toBe('finished'); expect(va.endReason).toBe('left'); expect(va.game.winner).toBe(0);
    const wr = await w.rooms.create(); await w.rooms.leave(wr.code, wr.token);
    await expect(w.rooms.view(wr.code, wr.token)).rejects.toThrow(/ไม่พบห้อง/);
    await expect(w.rooms.leave(code, 'bad-token')).rejects.toThrow(/โทเค็น/);
  });
  it('a late move after the deadline runs the timeout first (not your turn any more)', async () => {
    const w = await world(), { a, b, code } = await started(w), v: any = await w.rooms.view(code, a.token), me = v.game.active === 0 ? a : b;
    await setMeta(w.db, code, m => { m.deadline = Date.now() - 1; });
    await expect(w.rooms.act(code, me.token, { t: 'next' })).rejects.toThrow(/ยังไม่ถึงตา/);
    const after: any = await w.rooms.view(code, me.token); expect(after.game.active).toBe(1);   // seen from `me`: the turn passed to the opponent
  });
});
