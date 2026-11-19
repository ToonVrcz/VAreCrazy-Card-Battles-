// F-04: migration 020 publishes every Draft/In-Review card by explicit ID list; down restores the previous state.
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';

const load = (f: string) => JSON.parse(readFileSync(`db/seed/${f}`, 'utf8'));
const sql = (n: string) => readFileSync(`db/migrations/020_publish_all_cards.${n}.sql`, 'utf8');

async function world() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage');
  await svc.createUser('a@x.com', 'password123', 'super_admin');
  const admin = (await svc.login('a@x.com', 'password123')).user;
  for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) await svc.importCards(admin, load(f));
  return db;
}
const snap = async (db: PGlite) => (await db.query<any>(`SELECT character_id,status,version_no,hp,atk,def,level,name FROM cards ORDER BY character_id`)).rows;

describe('migration 020 publish all cards', () => {
  it('publishes all 70 cards, keeps stats untouched, writes version snapshots; down restores', async () => {
    const db = await world();
    await db.query(`UPDATE cards SET status='in_review' WHERE character_id='NONG-TAENGMO-015'`);
    // mirror production: 11 already published
    for (const id of ['1GOKU-015', '1GOKU-040', 'BABY-015', 'BACKJI-015', 'BADGUY-015', 'BADGUY-040', 'BAM-015', 'BAMMIE-015', 'BOBO-015', 'CHAEM-015', 'CUTIE-015'])
      await db.query(`UPDATE cards SET status='published' WHERE character_id=$1`, [id]);
    const before = await snap(db);
    expect(before.filter(c => c.status === 'draft').length).toBe(58);

    await db.exec(sql('up'));
    const after = await snap(db);
    expect(after.every(c => c.status === 'published')).toBe(true);
    for (const [i, c] of after.entries()) expect([c.hp, c.atk, c.def, c.level, c.name]).toEqual([before[i].hp, before[i].atk, before[i].def, before[i].level, before[i].name]);
    expect(after.filter(c => c.character_id !== 'NONG-TAENGMO-015' && before.find(b => b.character_id === c.character_id)!.status === 'draft').every(c => c.version_no === 1)).toBe(true);
    expect((await db.query<any>(`SELECT count(*)::int n FROM card_versions`)).rows[0].n).toBe(70);
    await db.exec(sql('up'));                                                  // idempotent: nothing left to publish
    expect(await snap(db)).toEqual(after);

    await db.exec(sql('down'));
    expect(await snap(db)).toEqual(before);
    expect((await db.query<any>(`SELECT count(*)::int n FROM card_versions`)).rows[0].n).toBe(11);
  });

  it('only the explicit ID list is touched: a card outside the list stays Draft', async () => {
    const db = await world();
    await db.query(`UPDATE cards SET character_id='ZZ-TEST-015' WHERE character_id='TAN-015'`);
    await db.exec(sql('up'));
    expect((await db.query<any>(`SELECT status FROM cards WHERE character_id='ZZ-TEST-015'`)).rows[0].status).toBe('draft');
    expect((await db.query<any>(`SELECT count(*)::int n FROM cards WHERE status='published'`)).rows[0].n).toBe(58);   // 59 listed minus the renamed one (no pre-published mirror in this test)
  });
});
