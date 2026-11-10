import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp, migrateDown } from '../db/migrate';
import { seedSample } from '../db/seed/seed';

let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await migrateUp(db);
});

const tables = async () =>
  (await db.query<{ t: string }>(`SELECT table_name t FROM information_schema.tables WHERE table_schema='public'`)).rows.map(r => r.t);

async function media(path: string) {
  return (await db.query<{ id: string }>(`INSERT INTO media_assets(storage_path,mime) VALUES ($1,'image/png') RETURNING id`, [path])).rows[0].id;
}
async function chain(key: string, all = false) {
  return (await db.query<{ id: string }>(`INSERT INTO evolution_chains(key,name,require_all_forms) VALUES ($1,$1,$2) RETURNING id`, [key, all])).rows[0].id;
}
async function card(code: string, lv: number, chainId: string, from: string | null, mediaId: string | null) {
  return (await db.query<{ id: string }>(
    `INSERT INTO cards(character_id,name,card_type,level,chain_id,evolves_from,hp,atk,media_id)
     VALUES ($1,$1,'character',$2,$3,$4,10,1,$5) RETURNING id`, [code, lv, chainId, from, mediaId])).rows[0].id;
}
const publish = (id: string) => db.query(`UPDATE cards SET status='published' WHERE id=$1`, [id]);

describe('migrations', () => {
  it('up creates tables; down removes them (rollback)', async () => {
    expect(await tables()).toContain('cards');
    await migrateDown(db);
    expect(await tables()).not.toContain('cards');
    await migrateUp(db);
    expect(await tables()).toContain('cards');
  });
});

describe('data rules', () => {
  it('rejects duplicate Character ID', async () => {
    const ch = await chain('a');
    await card('DUP-1', 15, ch, null, null);
    await expect(card('DUP-1', 40, ch, null, null)).rejects.toThrow();
  });

  it('rejects duplicate level in same chain', async () => {
    const ch = await chain('a');
    await card('A-15', 15, ch, null, null);
    await expect(card('A-15b', 15, ch, null, null)).rejects.toThrow();
  });

  it('blocks publish without image', async () => {
    const ch = await chain('a');
    const id = await card('A-15', 15, ch, null, null);
    await expect(publish(id)).rejects.toThrow(/needs an image/);
  });

  it('blocks publish when level order is wrong', async () => {
    const ch = await chain('a');
    const m = await media('a');
    const hi = await card('A-40', 40, ch, null, m);
    const lo = await card('A-15', 15, ch, hi, await media('b')); // evolves from a higher level
    await expect(publish(lo)).rejects.toThrow(/level order/);
  });

  it('blocks publish when chain is missing required forms', async () => {
    const ch = await chain('full', true);
    const id = await card('F-15', 15, ch, null, await media('f'));
    await expect(publish(id)).rejects.toThrow(/missing forms at levels \{40,70,99\}/);
  });

  it('allows publish once all required forms exist', async () => {
    const ch = await chain('full', true);
    let prev: string | null = null;
    const ids: string[] = [];
    for (const lv of [15, 40, 70, 99]) {
      prev = await card(`F-${lv}`, lv, ch, prev, await media(`f${lv}`));
      ids.push(prev);
    }
    await db.query(`UPDATE cards SET status='approved' WHERE id = ANY($1::uuid[])`, [ids.slice(1)]);
    await publish(ids[0]);
    const r = await db.query(`SELECT status FROM cards WHERE id=$1`, [ids[0]]);
    expect((r.rows[0] as any).status).toBe('published');
  });

  it('Draft -> Published creates a version snapshot', async () => {
    const ch = await chain('a');
    const id = await card('A-15', 15, ch, null, await media('a'));
    await publish(id);
    const v = await db.query(`SELECT version_no, snapshot->>'character_id' cid FROM card_versions WHERE card_id=$1`, [id]);
    expect(v.rows).toEqual([{ version_no: 1, cid: 'A-15' }]);
  });
});

describe('sample seed (FOLLOW YOU)', () => {
  it('seeds 3 forms in level order and they can be published', async () => {
    await seedSample(db);
    const r = await db.query<{ level: number; hp: number; atk: number }>(`SELECT level,hp,atk FROM cards ORDER BY level`);
    expect(r.rows.map(x => [x.level, x.hp, x.atk])).toEqual([[15, 90, 20], [40, 150, 50], [70, 300, 100]]);
    await db.query(`UPDATE cards SET status='published'`);
    const n = await db.query(`SELECT count(*)::int c FROM card_versions`);
    expect((n.rows[0] as any).c).toBe(3);
  });
});
