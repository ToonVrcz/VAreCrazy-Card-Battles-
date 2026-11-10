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
