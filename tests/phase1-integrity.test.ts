import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { buildSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService, type User } from '../src/server/service';
import { Economy, ECONOMY } from '../src/server/economy';
import { dispatch } from '../src/server/api';

// Phase 1 (security & data integrity). Nothing here changes a game rule, a card value or the economy.
let svc: CardService, db: PGlite;
const asUser = async (email: string, role: any) => { await svc.createUser(email, 'password123', role); return (await svc.login(email, 'password123')).user as User; };
const card = (o: any = {}) => ({ character_id: 'R-15', name: 'R', card_type: 'character', level: 15, chain_key: 'rc', hp: 10, atk: 2, ...o });
beforeEach(async () => { db = new PGlite(); await migrateUp(db); svc = new CardService(db, '/tmp/vcz-test-storage-p1'); });

describe('card numeric range validation (saveCard)', () => {
  it('still accepts every value range that exists in the real card data (Lv 15..99, HP up to 310, ATK up to 100, DEF 0)', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    await svc.saveCard(e, card({ character_id: 'OK-1', level: 99, hp: 310, atk: 100, def: 0 }));
    await svc.saveCard(e, card({ character_id: 'OK-2', level: '70', hp: '280', atk: '90', def: '' }));      // CSV import gives strings; blank DEF = 0
    await svc.saveCard(e, { character_id: 'SPL-X', name: 'S', card_type: 'spell' });                        // spells have no numbers
    expect((await db.query<any>(`SELECT def FROM cards WHERE character_id='OK-2'`)).rows[0].def).toBe(0);
  });
  it.each([
    ['negative hp', { hp: -1 }], ['negative atk', { atk: -5 }], ['negative def', { def: -1 }],
    ['fractional hp', { hp: 10.5 }], ['text hp', { hp: 'abc' }], ['NaN atk', { atk: NaN }], ['Infinity hp', { hp: Infinity }],
    ['level 0', { level: 0 }], ['level 100', { level: 100 }], ['fractional level', { level: 15.5 }],
    ['absurd hp', { hp: 1e9 }], ['absurd atk', { atk: 100000 }], ['negative shop price', { shop_price_points: -10 }], ['fractional vrcoin price', { shop_price_vrcoin: 1.5 }],
  ])('rejects %s with HTTP 400 (not a 500 from the database)', async (_l, over) => {
    const e = await asUser('e@x.com', 'card_editor');
    await expect(svc.saveCard(e, card(over as any))).rejects.toMatchObject({ code: 400 });
    expect((await db.query<any>(`SELECT count(*)::int n FROM cards WHERE character_id='R-15'`)).rows[0].n).toBe(0);
  });
  it('the same check protects updates', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    const c = await svc.saveCard(e, card());
    await expect(svc.saveCard(e, card({ hp: -3 }), (c as any).id)).rejects.toMatchObject({ code: 400 });
  });
});

describe('upload magic-byte validation', () => {
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0]);
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
  it('accepts real JPEG / PNG / WEBP bytes', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    await svc.uploadMedia(e, 'a.jpg', 'image/jpeg', JPEG);
    await svc.uploadMedia(e, 'a.png', 'image/png', PNG);
    await svc.uploadMedia(e, 'a.webp', 'image/webp', WEBP);
  });
  it('rejects bytes that are not an image even when the declared type is allowed (HTML, script, empty)', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    for (const [mime, data] of [['image/png', Buffer.from('<html><script>alert(1)</script>')], ['image/jpeg', Buffer.from('x')], ['image/webp', Buffer.from('RIFFxxxxNOPE')], ['image/jpeg', Buffer.alloc(0)]] as const)
      await expect(svc.uploadMedia(e, 'a', mime, data)).rejects.toMatchObject({ code: 400 });
    expect((await db.query<any>(`SELECT count(*)::int n FROM media_assets`)).rows[0].n).toBe(0);
  });
  it('a real image with a wrong declared type is stored under its REAL type (no legit upload is refused)', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    const m = await svc.uploadMedia(e, 'a.jpg', 'image/jpeg', PNG);
    expect(m.storage_path).toMatch(/\.png$/);
    expect((await db.query<any>(`SELECT mime FROM media_assets WHERE id=$1`, [m.id])).rows[0].mime).toBe('image/png');
  });
  it('the declared-type allow list and the size cap are unchanged', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    await expect(svc.uploadMedia(e, 'a.gif', 'image/gif', JPEG)).rejects.toThrow(/JPG/);
    await expect(svc.uploadMedia(e, 'a.jpg', 'image/jpeg', Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]))).rejects.toMatchObject({ code: 413 });
  });
});

describe('guest profile flood protection (starter points and every economy number unchanged)', () => {
  const eco = () => new Economy(svc);
  it('does NOT change the starter gift or any reward constant', () => {
    expect(ECONOMY.starterPoints).toBe(500); expect(ECONOMY.matchPoints).toBe(200); expect(ECONOMY.vrcoinEvery).toBe(10); expect(ECONOMY.vrcoinBatch).toBe(10);
  });
  it('without an IP (local/tests) creation works exactly as before and every profile gets 500 points', async () => {
    for (let i = 0; i < 15; i++) expect((await eco().createProfile('p' + i)).points).toBe(500);
  });
  it('one IP may create a limited number of profiles per hour; the next is refused with 429; another IP is unaffected', async () => {
    for (let i = 0; i < 10; i++) await eco().createProfile('a' + i, '203.0.113.7');
    await expect(eco().createProfile('x', '203.0.113.7')).rejects.toMatchObject({ code: 429 });
    expect((await eco().createProfile('y', '203.0.113.8')).points).toBe(500);
    expect((await db.query<any>(`SELECT count(*)::int n FROM players`)).rows[0].n).toBe(11);   // the refused attempt created nothing
  });
  it('the window slides: attempts older than an hour no longer count', async () => {
    for (let i = 0; i < 10; i++) await eco().createProfile('a' + i, '203.0.113.7');
    await db.query(`UPDATE profile_create_log SET at = now() - interval '61 minutes'`);
    expect((await eco().createProfile('later', '203.0.113.7')).points).toBe(500);
  });
  it('the raw IP is never stored', async () => {
    await eco().createProfile('a', '203.0.113.7');
    const rows = (await db.query<any>(`SELECT * FROM profile_create_log`)).rows;
    expect(JSON.stringify(rows)).not.toContain('203.0.113.7');
  });
  it('global ceiling stops a bulk script that rotates IPs, but never touches ordinary traffic', async () => {
    await db.query(`INSERT INTO players(key_hash,name,points) SELECT 'k'||g,'bot',500 FROM generate_series(1,300) g`);
    await expect(eco().createProfile('late', '198.51.100.1')).rejects.toMatchObject({ code: 429 });
    await db.query(`UPDATE players SET created_at = now() - interval '11 minutes'`);
    expect((await eco().createProfile('ok', '198.51.100.1')).points).toBe(500);
  });
  it('if migration 021 is not applied yet, profile creation still works (protection inactive, like the login throttle)', async () => {
    await db.exec(`DROP TABLE profile_create_log`);
    expect((await eco().createProfile('a', '203.0.113.7')).points).toBe(500);
  });
});

describe('generated bundles match their source (drift guard)', () => {
  const build = (entry: string, name: string) => buildSync({ entryPoints: [entry], bundle: true, format: 'iife', globalName: name, minify: true, charset: 'utf8', write: false, logLevel: 'silent' }).outputFiles[0].text;
  it('public/engine.js is exactly what src/play-entry.ts builds to (run the esbuild command in CLAUDE.md after engine changes)', () => {
    expect(build('src/play-entry.ts', 'VCZE') === readFileSync('public/engine.js', 'utf8')).toBe(true);
  });
  it('public/admin-tools.js is exactly what src/admin-entry.ts builds to', () => {
    expect(build('src/admin-entry.ts', 'VCZX') === readFileSync('public/admin-tools.js', 'utf8')).toBe(true);
  });
  it('the edge bundle still builds from src/edge/index.ts and contains the shipped guards', () => {
    const out = buildSync({ entryPoints: ['src/edge/index.ts'], bundle: true, format: 'esm', platform: 'node', external: ['@electric-sql/pglite', 'postgres'], minify: true, charset: 'utf8', write: false, logLevel: 'silent' }).outputFiles[0].text;
    expect(out.length).toBeGreaterThan(50_000);
    for (const marker of ['admin_login_failures', 'pvp-pair:', 'profile_create_log']) expect(out).toContain(marker);
  });
});

describe('IP guard no longer trusts proxy headers (Phase 1 Remediation)', () => {
  const create = (headers: Record<string, string>) => dispatch(svc, { method: 'POST', path: '/api/play/profile', query: new URLSearchParams(), headers, body: async () => Buffer.from('{"name":"x"}') });
  it('a spoofed or rotating x-forwarded-for / x-real-ip neither blocks nor bypasses anything, and writes no per-IP rows', async () => {
    for (let i = 0; i < 15; i++) {
      const r = await create({ 'x-forwarded-for': `203.0.113.${i}, 10.0.0.1`, 'x-real-ip': `198.51.100.${i}` });
      expect(r.status).toBe(201); expect((r.data as any).points).toBe(500);
    }
    expect((await create({ 'x-forwarded-for': '1.1.1.1' })).status).toBe(201);                 // the same value many times is not throttled by header
    for (let i = 0; i < 12; i++) await create({ 'x-forwarded-for': '9.9.9.9' });
    expect((await create({ 'x-forwarded-for': '9.9.9.9' })).status).toBe(201);
    expect((await db.query<any>(`SELECT count(*)::int n FROM profile_create_log`)).rows[0].n).toBe(0);
  });
  it('the global ceiling still stops a flood (headers irrelevant) and the starter gift stays 500', async () => {
    await db.query(`INSERT INTO players(key_hash,name,points) SELECT 'k'||g,'bot',500 FROM generate_series(1,300) g`);
    const r = await create({ 'x-forwarded-for': '203.0.113.7' });
    expect(r.status).toBe(429);
    expect(ECONOMY.starterPoints).toBe(500);
  });
  it('the per-IP capability stays available for a future trusted source', async () => {
    for (let i = 0; i < 10; i++) await new Economy(svc).createProfile('p', 'trusted-ip');
    await expect(new Economy(svc).createProfile('p', 'trusted-ip')).rejects.toMatchObject({ code: 429 });
  });
});
