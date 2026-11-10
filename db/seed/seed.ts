import type { PGlite } from '@electric-sql/pglite';

// Sample data from owner's card images. Lv.99 missing -> chain.require_all_forms=false.
export async function seedSample(db: PGlite) {
  await db.exec(`
    INSERT INTO taxonomies(key,name) VALUES ('element','Element'),('race','Race'),('class','Class');
    INSERT INTO evolution_chains(key,name,require_all_forms) VALUES ('follow-you','FOLLOW YOU',false);
  `);
  const chain = (await db.query<{ id: string }>(`SELECT id FROM evolution_chains WHERE key='follow-you'`)).rows[0].id;
  const forms = [
    ['FY-SUMMONER-015', 'Demon Summoner', 15, 90, 20, 'assets/cards/demon-summoner.jpg', '{"sacrifice":0,"evolution_card":0}'],
    ['FY-SUMMONER-040', 'Master Summoner', 40, 150, 50, 'assets/cards/master-summoner.jpg', '{"sacrifice":1,"evolution_card":1}'],
    ['FY-SUMMONER-070', 'Grand Summoner', 70, 300, 100, 'assets/cards/grand-summoner.jpg', '{"sacrifice":2,"evolution_card":1}'],
  ] as const;
  let prev: string | null = null;
  for (const [code, name, lv, hp, atk, path, cost] of forms) {
    const m = await db.query<{ id: string }>(
      `INSERT INTO media_assets(storage_path,mime,width,height,render_mode) VALUES ($1,'image/jpeg',NULL,NULL,'art_only') RETURNING id`, [path]);
    const c = await db.query<{ id: string }>(
      `INSERT INTO cards(character_id,name,card_type,level,chain_id,evolves_from,hp,atk,def,summon_cost,media_id,status)
       VALUES ($1,$2,'character',$3,$4,$5,$6,$7,0,$8::jsonb,$9,'draft') RETURNING id`,
      [code, name, lv, chain, prev, hp, atk, cost, m.rows[0].id]);
    prev = c.rows[0].id;
  }
}
