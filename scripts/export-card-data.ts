// READ-ONLY card data export. Does not touch production, engine, CMS or seed files.
// Usage: npx tsx scripts/export-card-data.ts   (writes card-data-export/)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';

const OUT = 'card-data-export';
const SEEDS = ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json', 'fusion-pairs.json', 'elements.json'];
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const w = (f: string, v: unknown) => writeFileSync(`${OUT}/${f}`, JSON.stringify(v, null, 2) + '\n');
const seed = (f: string) => JSON.parse(readFileSync(`db/seed/${f}`, 'utf8'));

mkdirSync(`${OUT}/source-seed-verbatim`, { recursive: true });
const checksums: Record<string, string> = {};
for (const f of SEEDS) { copyFileSync(`db/seed/${f}`, `${OUT}/source-seed-verbatim/${f}`); checksums[f] = md5(readFileSync(`db/seed/${f}`, 'utf8')); }

(async () => {
  // 1) Rebuild DB-shaped data in memory (same path the app uses: migrations + importCards). Nothing is written outside card-data-export/.
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-export-storage');
  await svc.createUser('export@x.com', 'password123', 'super_admin');
  const admin = (await svc.login('export@x.com', 'password123')).user;
  const importErrors: Record<string, unknown> = {};
  for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) importErrors[f] = await svc.importCards(admin, seed(f));
  const q = async (sql: string) => (await db.query<any>(sql)).rows;

  // 2) Cards: verbatim seed records (full original shape), tagged with source file. Nothing dropped.
  const cards: any[] = [];
  for (const [file, kind] of [['toon-cards.json', 'character'], ['support-cards.json', 'support'], ['spell-cards.json', 'spell'], ['trap-cards.json', 'trap']] as const)
    for (const r of seed(file)) cards.push({ _source_file: `db/seed/${file}`, _group: kind, ...r });
  w('cards.json', cards);

  // 3) DB-shaped (joined) view of the same cards as the app stores them after import.
  const dbCards = await q(`SELECT c.character_id, c.name, c.card_type, c.level, ch.key AS chain, pf.character_id AS evolves_from, c.hp, c.atk, c.def, c.atk_icon, c.has_combo,
      c.summon_cost, c.rules_text, c.flavor_text, el.key AS element, ra.key AS race, cl.key AS class, ge.key AS gender, m.storage_path AS image_path, c.status, c.version_no,
      c.shop_price_points, c.shop_price_vrcoin FROM cards c LEFT JOIN evolution_chains ch ON ch.id=c.chain_id LEFT JOIN cards pf ON pf.id=c.evolves_from
      LEFT JOIN taxonomy_values el ON el.id=c.element_id LEFT JOIN taxonomy_values ra ON ra.id=c.race_id LEFT JOIN taxonomy_values cl ON cl.id=c.class_id
      LEFT JOIN taxonomy_values ge ON ge.id=c.gender_id LEFT JOIN media_assets m ON m.id=c.media_id ORDER BY c.card_type, c.character_id`);
  w('cards-db-shape.json', dbCards);

  // 4) Effects (DB-shaped, per card, in sort order)
  const effects = await q(`SELECT c.character_id, e.sort_order, e."trigger", e.condition_text, e.cost_text, e.target_text, e.action_text, e.duration, e.duration_turns, e.use_limit, e.description
      FROM card_effects e JOIN cards c ON c.id=e.card_id ORDER BY c.character_id, e.sort_order`);
  w('card-effects.json', effects);

  // 5) Config: effect config column (migration 019) is NOT in this branch -> report column presence honestly
  const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='card_effects'`);
  const hasConfig = cols.some((c: any) => c.column_name === 'config');
  w('card-configs.json', { note: hasConfig ? 'card_effects.config present' : 'card_effects.config column does not exist on this branch (migration 019_effect_config lives on feature/cms-effects-c, unapplied to production). No per-card config data exists to export.', per_card_config: hasConfig ? await q(`SELECT c.character_id, e.sort_order, e.config FROM card_effects e JOIN cards c ON c.id=e.card_id WHERE e.config IS NOT NULL`) : [],
    shop_prices: await q(`SELECT * FROM shop_prices ORDER BY 1`), card_frames: await q(`SELECT * FROM card_frames ORDER BY 1`) });

  // 6) Rules + taxonomy + affiliations
  w('card-rules.json', { game_rules: await q(`SELECT * FROM game_rules ORDER BY 1,2`), taxonomy_values: await q(`SELECT * FROM taxonomy_values ORDER BY 1,2`), affiliation_synergies: await q(`SELECT * FROM affiliation_synergies ORDER BY 1,2`), elements_seed: seed('elements.json') });

  // 7) Relations
  w('card-relations.json', {
    evolution_chains: await q(`SELECT * FROM evolution_chains ORDER BY key`),
    evolution_links: dbCards.filter((c: any) => c.evolves_from).map((c: any) => ({ from: c.evolves_from, to: c.character_id, level: c.level })),
    fusion_pairs_seed: seed('fusion-pairs.json'),
    card_fusion_partners: await q(`SELECT a.character_id AS card, b.character_id AS partner, p.* FROM card_fusion_partners p JOIN cards a ON a.id=p.card_id JOIN cards b ON b.id=p.partner_id ORDER BY 1,2`).catch(async () => await q(`SELECT * FROM card_fusion_partners`)),
    fusion_recipes: await q(`SELECT * FROM fusion_recipes`), card_story_links: await q(`SELECT * FROM card_story_links`), stories: await q(`SELECT * FROM stories`), story_members: await q(`SELECT * FROM story_members`),
    card_affiliations: await q(`SELECT * FROM card_affiliations`), card_attribute_values: await q(`SELECT * FROM card_attribute_values`) });

  // 8) Image manifest (paths from data vs files in repo)
  const files = new Set(existsSync('assets/cards') ? readdirSync('assets/cards').map(f => `assets/cards/${f}`) : []);
  const manifest = cards.map(c => ({ character_id: c.character_id, image_path: c.image_path ?? null, exists_in_repo: c.image_path ? files.has(c.image_path) : false }));
  const referenced = new Set(manifest.map(m => m.image_path));
  w('card-images-manifest.json', { cards: manifest, files_in_repo_not_referenced: [...files].filter(f => !referenced.has(f)), repo_dir: 'assets/cards', note: 'Image binaries are NOT copied (kept in repo assets/cards/ and production Supabase storage).' });

  // 9) Schema
  w('card-schema.json', { tables: await q(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN
      ('cards','card_effects','game_rules','evolution_chains','fusion_recipes','card_fusion_partners','card_story_links','card_affiliations','affiliation_synergies','stories','story_members','media_assets','card_frames','shop_prices','taxonomy_values','card_attribute_values') ORDER BY table_name, ordinal_position`) });

  // 10) Integrity + fingerprints for production drift check
  const ids = cards.map(c => c.character_id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  const byType: Record<string, number> = {}, byLevel: Record<string, number> = {};
  for (const c of cards) { byType[c.card_type] = (byType[c.card_type] ?? 0) + 1; const l = String(c.level ?? 'n/a'); byLevel[l] = (byLevel[l] ?? 0) + 1; }
  const effByCard = new Map<string, number>(); for (const c of cards) effByCard.set(c.character_id, (c.effects ?? []).length);
  const fp = cards.map(c => ({ id: c.character_id, level: c.level ?? null, hp: c.hp ?? null, atk: c.atk ?? null, def: c.def ?? 0, name: c.name,
    txt: md5(`${c.rules_text ?? ''}|${c.flavor_text ?? ''}`) }));
  w('_seed-fingerprints.json', fp);
  const evoBroken = dbCards.filter((c: any) => c.level && c.level > 15 && !c.evolves_from).map((c: any) => c.character_id);
  w('_integrity.json', { total: cards.length, by_type: byType, by_level: byLevel, duplicate_ids: dup, import_errors: importErrors, seed_checksums_md5: checksums,
    cards_without_effects: ids.filter(i => !effByCard.get(i)), db_card_count: dbCards.length, db_effect_rows: effects.length, evolution_forms_without_parent: evoBroken,
    missing_image_path: cards.filter(c => !c.image_path).map(c => c.character_id), image_file_missing: manifest.filter(m => m.image_path && !m.exists_in_repo).map(m => m.character_id),
    effects_without_trigger: effects.filter((e: any) => !e.trigger).map((e: any) => `${e.character_id}#${e.sort_order}`) });
  console.log('ok', cards.length, effects.length);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
