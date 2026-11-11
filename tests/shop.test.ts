import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Rooms } from '../src/server/rooms';
import { Economy, ECONOMY } from '../src/server/economy';
import { botPick } from '../src/engine/bot';
import { createGame, act, legalActions, type CardDef } from '../src/engine/game';
import { validateEvoDeck, validateDeck, buildSet, viewFor, isForm } from '../src/engine/deck-view';

const load = (f: string) => JSON.parse(readFileSync(`db/seed/${f}`, 'utf8'));
async function world() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage');
  await svc.createUser('a@x.com', 'password123', 'super_admin');
  const admin = (await svc.login('a@x.com', 'password123')).user;
  for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) await svc.importCards(admin, load(f));
  const forms = (await db.query<any>(`SELECT character_id id, level, chain_id FROM cards WHERE status<>'archived' AND card_type='character' AND level>15 ORDER BY level, character_id`)).rows;
  const lv15 = (await db.query<any>(`SELECT character_id id FROM cards WHERE status<>'archived' AND card_type='character' AND level=15 ORDER BY character_id`)).rows.map(r => r.id as string);
  const others = (await db.query<any>(`SELECT character_id id FROM cards WHERE status<>'archived' AND card_type<>'character' ORDER BY character_id`)).rows.map(r => r.id as string);
  return { db, svc, eco: new Economy(svc), rooms: new Rooms(svc), f40: forms.filter(f => f.level === 40).map(f => f.id as string), f70: forms.filter(f => f.level === 70).map(f => f.id as string), lv15, others };
}
const mainDeck = (lv15: string[], others: string[]) => { const o: string[] = []; for (const id of [...lv15, ...others]) for (let k = 0; k < 3 && o.length < 40; k++) o.push(id); return o; };
const setPlayer = (db: any, id: string, points: number, vrcoin: number) => db.query(`UPDATE players SET points=$2, vrcoin=$3 WHERE id=$1`, [id, points, vrcoin]);
async function playOut(w: any, a: any, b: any, code: string) {
  for (let i = 0; i < 3000; i++) {
    for (const t of [a, b]) {
      const v: any = await w.rooms.view(code, t.token); if (v.status === 'finished') return v;
      const g = v.game, mine = g.pending ? g.pending.responder === 0 : g.active === 0; if (!mine) continue;
      await w.rooms.act(code, t.token, botPick(g));
    }
  }
  throw new Error('game did not finish');
}

describe('profiles + shop', () => {
  it('creates a guest profile with a starter gift; the key resolves; bad key is refused', async () => {
    const w = await world(), p = await w.eco.createProfile('ตูน');
    expect(p.points).toBe(ECONOMY.starterPoints); expect(p.vrcoin).toBe(0); expect(p.key).toHaveLength(48);
    const me: any = await w.eco.me(p.key); expect(me.name).toBe('ตูน'); expect(me.inventory).toEqual({});
    await expect(w.eco.me('nope')).rejects.toThrow(/ไม่พบโปรไฟล์/); await expect(w.eco.me(undefined)).rejects.toThrow(/โปรไฟล์/);
  });
  it('shop lists Lv.40 (points) and Lv.70 (Vrcoin) with admin prices; owned counts follow the player', async () => {
    const w = await world(), p = await w.eco.createProfile(), s: any = await w.eco.shop(p.key);
    const by = (id: string) => s.items.find((i: any) => i.id === id);
    expect(by(w.f40[0]).price).toEqual({ currency: 'points', amount: 500 }); expect(by(w.f70[0]).price).toEqual({ currency: 'vrcoin', amount: 100 });
    expect(s.items.every((i: any) => i.level > 15)).toBe(true); expect(by(w.f40[0]).owned).toBe(0);
  });
  it('buy: spends the right currency, caps copies, refuses when poor, writes a ledger', async () => {
    const w = await world(), p = await w.eco.createProfile(), id = w.f40[0];
    expect(await w.eco.buy(p.key, id)).toMatchObject({ ok: true, owned: 1, spent: { currency: 'points', amount: 500 } });
    await expect(w.eco.buy(p.key, id)).rejects.toThrow(/แต้มไม่พอ/);
    await setPlayer(w.db, p.id, 5000, 0);
    await w.eco.buy(p.key, id); await w.eco.buy(p.key, id);
    await expect(w.eco.buy(p.key, id)).rejects.toThrow(/ครบ 3 ใบ/);
    await expect(w.eco.buy(p.key, w.f70[0])).rejects.toThrow(/Vrcoin ไม่พอ/);
    await setPlayer(w.db, p.id, 0, 150); expect(await w.eco.buy(p.key, w.f70[0])).toMatchObject({ spent: { currency: 'vrcoin', amount: 100 } });
    const me: any = await w.eco.me(p.key); expect(me.vrcoin).toBe(50); expect(me.inventory[id]).toBe(3);
    expect((await w.db.query(`SELECT count(*)::int n FROM economy_ledger WHERE player_id=$1 AND kind='buy'`, [p.id])).rows[0].n).toBe(4);
    await expect(w.eco.buy(p.key, 'NOPE')).rejects.toThrow(/ไม่พบการ์ด/); await expect(w.eco.buy(p.key, w.lv15[0])).rejects.toThrow(/ไม่พบการ์ด/);
  });
  it('a level without a price is not for sale; admin can set/remove prices and grant currency', async () => {
    const w = await world(), p = await w.eco.createProfile();
    await w.eco.adminRemovePrice(40); await expect(w.eco.buy(p.key, w.f40[0])).rejects.toThrow(/ยังไม่เปิดขาย/);
    await w.eco.adminSetPrice(40, 'vrcoin', 5); await expect(w.eco.buy(p.key, w.f40[0])).rejects.toThrow(/Vrcoin ไม่พอ/);
    await w.eco.adminGrant(p.id, 0, 7, 'test'); expect(await w.eco.buy(p.key, w.f40[0])).toMatchObject({ spent: { currency: 'vrcoin', amount: 5 } });
    await expect(w.eco.adminGrant(p.id, -999999, 0, '')).rejects.toThrow(/ติดลบ/); await expect(w.eco.adminSetPrice(15, 'points', 1)).rejects.toThrow(/ไม่ถูกต้อง/);
  });
  it('buying is atomic under concurrency (no overspend)', async () => {
    const w = await world(), p = await w.eco.createProfile();   // 500 points = exactly one Lv.40
    const r = await Promise.allSettled([w.eco.buy(p.key, w.f40[0]), w.eco.buy(p.key, w.f40[1]), w.eco.buy(p.key, w.f40[2])]);
    expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(((await w.eco.me(p.key)) as any).points).toBe(0);
  });
});

describe('evolution deck rules', () => {
  const byId = new Map<string, CardDef>([['A', { id: 'A', name: 'A', type: 'character', level: 15, chain: 'x', hp: 1, atk: 1, def: 0, element: null }], ['B', { id: 'B', name: 'B', type: 'character', level: 40, chain: 'x', hp: 1, atk: 1, def: 0, element: null }]]);
  it('only owned forms, at most 3 copies, at most 15 cards', () => {
    const own = new Map([['B', 2]]);
    expect(validateEvoDeck(['B', 'B'], byId, own)).toBeNull(); expect(validateEvoDeck([], byId, own)).toBeNull();
    expect(validateEvoDeck(['B', 'B', 'B'], byId, own)).toMatch(/ไม่พอ/); expect(validateEvoDeck(['A'], byId, own)).toMatch(/ใส่ในเด็คอีโวไม่ได้/);
    expect(validateEvoDeck(Array(16).fill('B'), byId, new Map([['B', 3]]))).toMatch(/ไม่เกิน 15/); expect(validateEvoDeck('x', byId, own)).toMatch(/รูปแบบ/);
  });
  it('main deck refuses Lv.40/70 forms', () => { expect(validateDeck(Array(40).fill('B'), byId)).toMatch(/ต้องใส่ในเด็คอีโว/); });
  it('random main deck never contains forms and is a legal 40', async () => {
    const w = await world(), pool = (await w.db.query<any>(`SELECT character_id id, name, card_type type, level, 'c'||chain_id chain, hp, atk, def FROM cards WHERE status<>'archived'`)).rows as CardDef[];
    for (let i = 0; i < 20; i++) { const s = buildSet(pool, [], Math.random, cs => pool.filter(c => isForm(c) && c.chain && cs.includes(c.chain))); expect(s.main).toHaveLength(40); expect(s.main.some(isForm)).toBe(false);
      const n = new Map<string, number>(); s.main.forEach(c => n.set(c.id, (n.get(c.id) ?? 0) + 1)); expect(Math.max(...n.values())).toBeLessThanOrEqual(3); expect(s.extra.length).toBeLessThanOrEqual(15); }
  });
});

describe('engine: evolving from the separate Evolution deck', () => {
  const ch = (id: string, level: number, chain = 'x', hp = 50): CardDef => ({ id, name: id, type: 'character', level, chain, hp, atk: 10, def: 0, element: null });
  const evo: CardDef = { id: 'EVO-001', name: 'Evo', type: 'evolution', level: null, chain: null, hp: null, atk: null, def: 0, element: null };
  it('uses a form from the extra deck (not the hand), removes it, never draws it', () => {
    const pad = Array.from({ length: 30 }, (_, i) => ch('P' + i, 15, 'p' + (i % 7)));
    const g0 = createGame([[...Array(2).fill(ch('A-15', 15)), evo, ...pad], [...pad]], 3, 0, { extras: [[ch('A-40', 40), ch('Z-40', 40, 'z')], []] });
    expect(g0.players[0].extra!.map(c => c.id)).toEqual(['A-40', 'Z-40']);
    expect([...g0.players[0].hand, ...g0.players[0].deck].some(c => c.level === 40)).toBe(false);
    const g = structuredClone(g0); const me = g.players[0]; me.hand = [evo, ch('A-15', 15)]; g.active = 0; g.turn = 2; g.phase = 'main';
    const a15 = ch('A-15', 15); const mkU = (c: CardDef, uid: number) => ({ uid, card: c, hp: c.hp!, maxHp: c.hp!, atk: 10, def: 0, bonusAtk: 0, bonusDef: 0, summonedTurn: 1, attacked: false, lockedUntil: 0, poison: 0 });
    me.field[0] = mkU(a15, 1) as any; me.field[1] = mkU(ch('B-15', 15, 'b'), 2) as any;
    const ev = legalActions(g).filter(x => x.t === 'evolve'); expect(ev).toHaveLength(1); expect((ev[0] as any).form).toBe(0);
    const g2 = act(g, ev[0]); expect(g2.players[0].field[0]!.card.id).toBe('A-40'); expect(g2.players[0].extra!.map(c => c.id)).toEqual(['Z-40']); expect(g2.players[0].hand.some(c => c.id === 'EVO-001')).toBe(false);
    expect(() => act(g, { t: 'evolve', slot: 0, evo: 0, form: 9, sacrifice: [1] })).toThrow(/เด็คอีโว/);
  });
  it('opponent view hides the extra deck cards but keeps the count; own view shows them', () => {
    const g = createGame([[ch('A', 15)], [ch('B', 15)]], 1, 0, { extras: [[ch('A-40', 40)], [ch('B-40', 40), ch('B-70', 70)]] });
    const v0: any = viewFor(g, 0), v1: any = viewFor(g, 1);
    expect(v0.players[0].extra[0].id).toBe('A-40'); expect(v0.players[1].extra).toHaveLength(2); expect(v0.players[1].extra.every((c: any) => c.id === '?')).toBe(true);
    expect(v1.players[0].extra.map((c: any) => c.id)).toEqual(['B-40', 'B-70']);
  });
});

describe('online: owned forms, evo decks and match rewards', () => {
  it('evo deck needs a profile and ownership; the game gets exactly the chosen forms', async () => {
    const w = await world(), p = await w.eco.createProfile(), main = mainDeck(w.lv15, w.others);
    await expect(w.rooms.create(main, [w.f40[0]], undefined)).rejects.toThrow(/โปรไฟล์/);
    await expect(w.rooms.create(main, [w.f40[0]], p.key)).rejects.toThrow(/ไม่พอ/);
    await w.eco.buy(p.key, w.f40[0]);
    const a = await w.rooms.create(main, [w.f40[0]], p.key), b = await w.rooms.join(a.code, undefined, undefined, undefined);
    const st = (await w.db.query<any>(`SELECT state FROM play_rooms WHERE code=$1`, [a.code])).rows[0].state;
    expect(st.players[0].extra.map((c: any) => c.id)).toEqual([w.f40[0]]); expect(st.players[1].extra).toEqual([]);   // guest owns nothing
    const v: any = await w.rooms.view(a.code, b.token); expect(v.game.players[1].extra).toHaveLength(1); expect(v.game.players[1].extra.every((c: any) => c.id === '?')).toBe(true);   // opponent's forms stay hidden
  });
  it('no evo deck chosen: every owned form that fits the main deck is used automatically; unowned forms never appear', async () => {
    const w = await world(), p = await w.eco.createProfile(); await w.eco.buy(p.key, w.f40[0]);
    const a = await w.rooms.create(undefined, undefined, p.key); await w.rooms.join(a.code);
    const ex = (await w.db.query<any>(`SELECT state FROM play_rooms WHERE code=$1`, [a.code])).rows[0].state.players[0].extra.map((c: any) => c.id);
    expect(ex.every((id: string) => id === w.f40[0])).toBe(true); expect(ex.length).toBeLessThanOrEqual(1);
  });
  it('a finished PvP match pays both profiles once (200 points) and shows the reward; 10th match adds 10 Vrcoin', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    for (let m = 1; m <= ECONOMY.vrcoinEvery; m++) {
      const a = await w.rooms.create(undefined, undefined, p1.key), b = await w.rooms.join(a.code, undefined, undefined, p2.key);
      const v = await playOut(w, a, b, a.code);
      expect(v.reward).toMatchObject({ points: 200, matches: m, vrcoin: m === 10 ? 10 : 0 });
      await w.rooms.view(a.code, a.token); await w.rooms.view(a.code, b.token);   // polling again must not pay twice
    }
    const me1: any = await w.eco.me(p1.key), me2: any = await w.eco.me(p2.key);
    expect(me1.points).toBe(ECONOMY.starterPoints + 200 * 10); expect(me1.vrcoin).toBe(10); expect(me1.matches).toBe(10); expect(me2.points).toBe(me1.points);
  }, 120000);
  it('an instant resign earns nothing; guests earn nothing; you cannot join your own room', async () => {
    const w = await world(), p1 = await w.eco.createProfile(), p2 = await w.eco.createProfile();
    const a = await w.rooms.create(undefined, undefined, p1.key); await expect(w.rooms.join(a.code, undefined, undefined, p1.key)).rejects.toThrow(/ของตัวเอง/);
    const b = await w.rooms.join(a.code, undefined, undefined, p2.key); await w.rooms.leave(a.code, b.token);
    const va: any = await w.rooms.view(a.code, a.token); expect(va.status).toBe('finished'); expect(va.reward).toBeNull();
    expect(((await w.eco.me(p1.key)) as any).points).toBe(ECONOMY.starterPoints);
    const g1 = await w.rooms.create(), g2 = await w.rooms.join(g1.code); const v = await playOut(w, g1, g2, g1.code); expect(v.reward).toBeNull();
  }, 120000);
});
