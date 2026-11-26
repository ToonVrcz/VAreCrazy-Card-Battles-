// Migration 031 (Lv15 DEF rebalance, NOT applied to production): guarded DEF-only update + exact revert.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
const OLD: Record<string, [number, number]> = {"1GOKU-015":[20,3],"BABY-015":[10,5],"BACKJI-015":[24,2],"BADGUY-015":[15,2],"BAM-015":[25,1],"BAMMIE-015":[25,1],"BOBO-015":[30,1],"CHAEM-015":[24,2],"CUTIE-015":[35,0],"DNMAN-015":[40,1],"FOLLOW-YOU-015":[20,2],"GOD-WA-015":[30,1],"I-M-GRAPE-015":[21,2],"JAOJAY-015":[40,0],"LALAPING-015":[20,4],"LEON-S-KENNEDY-015":[25,3],"LINLADA-015":[35,1],"LORDNAM-015":[25,2],"LUCKY-015":[24,3],"MELON-015":[35,1],"MIKI-015":[24,2],"MON-015":[40,0],"NONG-TAENGMO-015":[30,1],"NORMAN-015":[18,4],"OUFILLING-015":[20,4],"PIKACHU-015":[40,0],"PK-015":[25,2],"PKXCY-015":[24,2],"SATOSHI-015":[20,5],"SKYMOON-015":[18,3],"SMILE-015":[35,1],"SOMYES-015":[25,2],"TAN-015":[20,3],"TEE-015":[18,4],"THAI26-015":[24,2],"THAI32-015":[18,4],"THOMAS-015":[25,2],"WENDYWENDIE-015":[10,4],"ZEESKY-015":[23,3]};
const NEW: Record<string, number> = {"1GOKU-015":15,"BABY-015":18,"BACKJI-015":12,"BADGUY-015":14,"BAM-015":11,"BAMMIE-015":11,"BOBO-015":11,"CHAEM-015":15,"CUTIE-015":2,"DNMAN-015":3,"FOLLOW-YOU-015":14,"GOD-WA-015":11,"I-M-GRAPE-015":12,"JAOJAY-015":0,"LALAPING-015":17,"LEON-S-KENNEDY-015":13,"LINLADA-015":3,"LORDNAM-015":15,"LUCKY-015":16,"MELON-015":3,"MIKI-015":12,"MON-015":2,"NONG-TAENGMO-015":11,"NORMAN-015":17,"OUFILLING-015":17,"PIKACHU-015":2,"PK-015":15,"PKXCY-015":12,"SATOSHI-015":17,"SKYMOON-015":18,"SMILE-015":1,"SOMYES-015":12,"TAN-015":15,"TEE-015":17,"THAI26-015":12,"THAI32-015":17,"THOMAS-015":15,"WENDYWENDIE-015":16,"ZEESKY-015":16};
const UP = readFileSync('db/migrations/031_lv15_def_rebalance.up.sql', 'utf8'), DOWN = readFileSync('db/migrations/031_lv15_def_rebalance.down.sql', 'utf8');
describe('migration 031 Lv15 DEF rebalance', () => {
  let db: PGlite;
  const rows = async () => Object.fromEntries(((await db.query(`SELECT character_id,hp,atk,def FROM cards WHERE character_id LIKE '%-015'`)).rows as any[]).map(r => [r.character_id, r]));
  beforeAll(async () => {
    db = new PGlite(); await migrateUp(db);
    for (const [id, [atk, def]] of Object.entries(OLD)) await db.query(`INSERT INTO cards(character_id,name,card_type,level,hp,atk,def) VALUES($1,$1,'character',15,77,$2,$3) ON CONFLICT (character_id) DO UPDATE SET hp=77,atk=$2,def=$3`, [id, atk, def]);
    await db.query(`UPDATE cards SET def=9 WHERE character_id='LUCKY-015'`);   // edited in Admin since: guard must not overwrite
  }, 60000);
  it('sets the new DEF, never touches HP/ATK, skips an edited card', async () => {
    await db.exec(UP); const r = await rows();
    for (const [id, d] of Object.entries(NEW)) { expect(r[id].hp, id).toBe(77); expect(r[id].atk, id).toBe(OLD[id][0]); expect(r[id].def, id).toBe(id === 'LUCKY-015' ? 9 : d); }
  });
  it('down restores the old DEF (edited card stays)', async () => {
    await db.exec(DOWN); const r = await rows();
    for (const [id, [atk, d]] of Object.entries(OLD)) { expect(r[id].def, id).toBe(id === 'LUCKY-015' ? 9 : d); expect(r[id].atk).toBe(atk); }
  });
  it('no Lv40/70/99, spell or Signature id is mentioned', () => { expect(/-0(40|70|99)|SPL-|TRP-|EVO-|FUS-/.test(UP.replace(/--.*$/gm, ''))).toBe(false); });
});
