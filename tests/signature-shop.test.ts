// Migration 029 + shop: Signature Spell/Trap cards (draft until published, 300 Point, data-driven support config).
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Rooms } from '../src/server/rooms';
import { Economy } from '../src/server/economy';
import { buildDeck } from '../src/engine/deck-view';

const SEED = readFileSync('db/seed/signature-cards.sql', 'utf8'), DOWN = readFileSync('db/migrations/029_signature_cards.down.sql', 'utf8');
async function world() {
  const db = new PGlite(); await migrateUp(db); await db.exec(SEED);
  const svc = new CardService(db, '/tmp/vcz-test-storage');
  return { db, svc, eco: new Economy(svc), rooms: new Rooms(svc) };
}
describe('CMS shop page: Signature prices', () => {
  it('lists the 39 Signature cards, sets/clears a per-card price and validates', async () => {
    const { db, eco } = await world(); const l = await eco.adminSignatures();
    expect(l.length).toBe(39); expect(l.every((c: any) => c.price === 300)).toBe(true);
    await eco.adminSetSignaturePrice(l[0].id, 450); expect((await eco.adminSignatures())[0].price).toBe(450);
    await eco.adminSetSignaturePrice(l[0].id, null); expect((await eco.adminSignatures())[0].price).toBeNull();
    for (const bad of [-1, 1.5, 1e9]) await expect(eco.adminSetSignaturePrice(l[0].id, bad)).rejects.toThrow(/ราคา/);
    await expect(eco.adminSetSignaturePrice('SPL-001', 10)).rejects.toThrow(/ไม่พบ/);   // base cards are not Signature cards
    await db.query(`UPDATE cards SET status='published' WHERE support IS NOT NULL`);
    const p: any = await eco.createProfile('t'); expect((await eco.shop(p.key ?? p.secret)).items.find((x: any) => x.id === l[0].id)?.price ?? null).toBeNull();   // price cleared = not for sale
  });
});
describe('migration 029 + seed + shop', () => {
  it('adds 39 draft cards at 300 Point with an engine support config; draft cards are not sold', async () => {
    const { db, eco } = await world();
    const n = (await db.query<any>(`SELECT count(*)::int n FROM cards WHERE support IS NOT NULL`)).rows[0].n; expect(n).toBe(39);
    expect((await db.query<any>(`SELECT count(*)::int n FROM cards WHERE support IS NOT NULL AND shop_price_points=300 AND status='draft'`)).rows[0].n).toBe(39);
    const p = await eco.createProfile('t'), key = (p as any).key ?? (p as any).secret;
    expect((await eco.shop(key)).items.filter((i: any) => i.type === 'spell' || i.type === 'trap').length).toBe(0);
  });
  it('published signature cards are sold for 300 Point, max 3 copies', async () => {
    const { db, eco } = await world(); await db.query(`UPDATE cards SET status='published' WHERE support IS NOT NULL`);
    const p: any = await eco.createProfile('t'), key = p.key ?? p.secret;
    const items = (await eco.shop(key)).items.filter((i: any) => i.type === 'spell' || i.type === 'trap'); expect(items.length).toBe(39);
    expect(items.every((i: any) => i.price.currency === 'points' && i.price.amount === 300)).toBe(true);
    const id = items[0].id, before = (await db.query<any>(`SELECT points FROM players`)).rows[0].points;
    const r: any = await eco.buy(key, id); expect(r.spent).toEqual({ currency: 'points', amount: 300 });
    expect((await db.query<any>(`SELECT points FROM players`)).rows[0].points).toBe(before - 300);
  });
  it('the room pool carries support, and auto-built decks never include signature cards', async () => {
    const { db, rooms } = await world(); const { pool, pairs } = await (rooms as any).loadPool();
    const s = pool.filter((c: any) => c.support); expect(s.length).toBe(39); expect(s[0].support.ops.length).toBeGreaterThan(0);
    const d = buildDeck(pool, pairs); expect(d.some((c: any) => c.support)).toBe(false);
  });
  it('down removes the cards and the column', async () => {
    const { db } = await world(); await db.exec(DOWN);
    expect((await db.query<any>(`SELECT count(*)::int n FROM cards WHERE character_id LIKE 'SPL-0_%' AND character_id > 'SPL-010'`)).rows[0].n).toBe(0);
    expect((await db.query<any>(`SELECT column_name FROM information_schema.columns WHERE table_name='cards' AND column_name='support'`)).rows.length).toBe(0);
  });
});

describe('CMS editing of Signature cards', () => {
  it('seed has art + media rows; renaming and swapping the image keeps the engine config', async () => {
    const { db, svc } = await world(); await svc.createUser('b@x.com', 'password123', 'super_admin');
    const admin = (await svc.login('b@x.com', 'password123')).user;
    expect((await db.query<any>(`SELECT count(*)::int n FROM cards WHERE support IS NOT NULL AND media_id IS NOT NULL`)).rows[0].n).toBe(39);
    const row = (await db.query<any>(`SELECT id FROM cards WHERE character_id='SPL-011'`)).rows[0];
    const cur: any = await svc.getCard(admin, row.id);
    const m = (await db.query<any>(`INSERT INTO media_assets(storage_path,mime) VALUES ('media/new.jpg','image/jpeg') RETURNING id`)).rows[0].id;
    await svc.saveCard(admin, { ...cur, name: 'ชื่อใหม่', media_id: m }, row.id);
    const after = (await db.query<any>(`SELECT name, media_id, support, shop_price_points FROM cards WHERE id=$1`, [row.id])).rows[0];
    expect(after.name).toBe('ชื่อใหม่'); expect(after.media_id).toBe(m); expect(after.support.ops.length).toBeGreaterThan(0); expect(after.shop_price_points).toBe(300);
  });
});
