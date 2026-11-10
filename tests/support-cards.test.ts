import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';

const cards: any[] = JSON.parse(readFileSync('db/seed/support-cards.json', 'utf8'));
describe('Evolution Cards + Fusion Spells draft set', () => {
  it('has 10+10 unique cards with art and imports as Draft', async () => {
    expect(cards.filter(c => c.card_type === 'evolution').length).toBe(10);
    expect(cards.filter(c => c.card_type === 'fusion').length).toBe(10);
    expect(new Set(cards.map(c => c.character_id)).size).toBe(20);
    cards.forEach(c => expect(existsSync(c.image_path), c.image_path).toBe(true));
    const db = new PGlite(); await migrateUp(db);
    const svc = new CardService(db);
    await svc.createUser('a@local', 'admin12345', 'super_admin');
    const u = (await svc.login('a@local', 'admin12345')).user;
    const r = await svc.importCards(u, cards);
    expect(r.errors).toEqual([]); expect(r.created).toBe(20);
  });
});

describe('deleteCard', () => {
  it('deletes drafts, blocks parents and non-drafts', async () => {
    const db = new PGlite(); await migrateUp(db);
    const svc = new CardService(db);
    await svc.createUser('a@local', 'admin12345', 'super_admin');
    await svc.createUser('v@local', 'viewer1234', 'viewer');
    const u = (await svc.login('a@local', 'admin12345')).user;
    const v = (await svc.login('v@local', 'viewer1234')).user;
    const a = await svc.saveCard(u, { character_id: 'T-015', name: 'A', card_type: 'character', level: 15, hp: 10, atk: 5, chain_key: 't' });
    const b = await svc.saveCard(u, { character_id: 'T-040', name: 'B', card_type: 'character', level: 40, hp: 20, atk: 9, chain_key: 't', evolves_from: 'T-015' });
    await expect(svc.deleteCard(v, b.id)).rejects.toThrow('ไม่มีสิทธิ์');
    await expect(svc.deleteCard(u, a.id)).rejects.toThrow('วิวัฒนาการมาจากใบนี้');
    expect(await svc.deleteCard(u, b.id)).toEqual({ ok: true });
    expect(await svc.deleteCard(u, a.id)).toEqual({ ok: true });
    await expect(svc.deleteCard(u, a.id)).rejects.toThrow('ไม่พบการ์ด');
  });
});

describe('Trap set', () => {
  it('10 distinct traps import as Draft', async () => {
    const t: any[] = JSON.parse(readFileSync('db/seed/trap-cards.json', 'utf8'));
    expect(t.length).toBe(10);
    expect(new Set(t.map(c => c.effects[0].description)).size).toBe(10);
    expect(new Set(t.map(c => c.name)).size).toBe(10);
    t.forEach(c => expect(existsSync(c.image_path)).toBe(true));
    const db = new PGlite(); await migrateUp(db);
    const svc = new CardService(db);
    await svc.createUser('a@local', 'admin12345', 'super_admin');
    const u = (await svc.login('a@local', 'admin12345')).user;
    const r = await svc.importCards(u, t);
    expect(r.errors).toEqual([]); expect(r.created).toBe(10);
  });
});

describe('Spell set', () => {
  it('10 distinct spells (on_cast) import as Draft', async () => {
    const t: any[] = JSON.parse(readFileSync('db/seed/spell-cards.json', 'utf8'));
    expect(t.length).toBe(10);
    expect(new Set(t.map(c => c.effects[0].description)).size).toBe(10);
    t.forEach(c => expect(existsSync(c.image_path)).toBe(true));
    const db = new PGlite(); await migrateUp(db);
    const svc = new CardService(db);
    await svc.createUser('a@local', 'admin12345', 'super_admin');
    const u = (await svc.login('a@local', 'admin12345')).user;
    const r = await svc.importCards(u, t);
    expect(r.errors).toEqual([]); expect(r.created).toBe(10);
  });
});
