import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, existsSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';

const cards: any[] = JSON.parse(readFileSync('db/seed/toon-cards.json', 'utf8'));

describe('Toon card data file', () => {
  it('has unique IDs, existing images, sane stats and increasing evolution levels', () => {
    const by = new Map(cards.map(c => [c.character_id, c]));
    expect(by.size).toBe(cards.length);
    for (const c of cards) {
      expect(existsSync(c.image_path), c.image_path).toBe(true);
      expect(c.hp).toBeGreaterThan(0); expect(c.atk).toBeGreaterThan(0);
      expect(c.effects.length, c.character_id).toBeGreaterThan(0);
      expect(c.flavor_text, c.character_id).toBeTruthy();
      if (c.evolves_from) {
        const p = by.get(c.evolves_from);
        expect(p, `${c.character_id} parent`).toBeTruthy();
        expect(p.level).toBeLessThan(c.level);
        expect(p.chain_key).toBe(c.chain_key);
      }
    }
  });
  it('imports into the CMS as Drafts with no errors', async () => {
    const db = new PGlite(); await migrateUp(db);
    const svc = new CardService(db, '/tmp/vcz-test-storage');
    await svc.createUser('a@x.com', 'password123', 'super_admin');
    const u = (await svc.login('a@x.com', 'password123')).user;
    const r = await svc.importCards(u, cards);
    expect(r.errors).toEqual([]);
    expect(r.created).toBe(cards.length);
    const list = await svc.listCards(u);
    expect(list.every((c: any) => c.status === 'draft')).toBe(true);
    const f = list.find((c: any) => c.character_id === 'LALAPING-070');
    expect((await svc.getCard(u, f.id)).effects).toHaveLength(2);
    expect(f).toMatchObject({ name: 'Saint Bishop', hp: 310, atk: 80, evolves_from: 'LALAPING-040', chain_name: 'LALAPING' });
  });
});
