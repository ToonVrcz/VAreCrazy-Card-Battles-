// Balance round 1 (migration 024): guarded DEF/effect updates. Data only; HP and ATK are never touched.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';

const UP = readFileSync('db/migrations/024_balance_round1.up.sql', 'utf8'), DOWN = readFileSync('db/migrations/024_balance_round1.down.sql', 'utf8');
let db: PGlite;
const card = (id: string, def: number, hp = 90, atk = 20) => db.query(`INSERT INTO cards(character_id,name,card_type,level,hp,atk,def) VALUES($1,$1,'character',15,$2,$3,$4)`, [id, hp, atk, def]);
const eff = (id: string, trig: string, desc: string, extra = `'self','x'`) => db.query(`INSERT INTO card_effects(card_id,sort_order,trigger,target_text,action_text,description) SELECT id,0,$2,${extra},$3 FROM cards WHERE character_id=$1`, [id, trig, desc]);

beforeAll(async () => {
  db = new PGlite(); await migrateUp(db);
  await card('BABY-015', 0, 70, 10); await eff('BABY-015', 'on_summon', 'เมื่อถูกเรียก ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ');
  await card('LORDNAM-015', 7);                                   // edited in Admin since the seed: must not be overwritten (guard def = 0)
  await card('FOLLOW-YOU-040', 0, 150, 50); await db.query(`UPDATE cards SET has_combo=true WHERE character_id='FOLLOW-YOU-040'`);
  await eff('FOLLOW-YOU-040', 'combo', 'พลังแฝง: เมื่อใช้ร่วมกับการ์ดที่มี Combo ใบอื่น ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)');
  await db.query(`INSERT INTO cards(character_id,name,card_type,rules_text) VALUES('SPL-003','s','spell',$1)`, ['ใช้ในเฟสหลัก\nเลือกตัวละครของคุณ 1 ตัว: DEF +15 อยู่จนกว่าตัวนั้นจะออกจากสนาม']);
}, 60000);

describe('migration 024', () => {
  it('applies guarded updates, never touches HP/ATK, and leaves Admin-edited values alone', async () => {
    await db.exec(UP);
    const g = async (id: string) => (await db.query<any>(`SELECT hp,atk,def,has_combo,rules_text FROM cards WHERE character_id=$1`, [id])).rows[0];
    expect(await g('BABY-015')).toMatchObject({ hp: 70, atk: 10, def: 5 });
    expect((await db.query<any>(`SELECT description FROM card_effects WHERE card_id=(SELECT id FROM cards WHERE character_id='BABY-015')`)).rows[0].description).toContain('ฟื้น HP 30');
    expect((await g('LORDNAM-015')).def).toBe(7);
    expect(await g('FOLLOW-YOU-040')).toMatchObject({ hp: 150, atk: 50, def: 2, has_combo: false });
    expect((await db.query<any>(`SELECT count(*)::int n FROM card_effects WHERE card_id=(SELECT id FROM cards WHERE character_id='FOLLOW-YOU-040')`)).rows[0].n).toBe(0);
    expect((await g('SPL-003')).rules_text).toContain('จนจบเทิร์น');
  });
  it('down restores the previous values', async () => {
    await db.exec(DOWN);
    const g = async (id: string) => (await db.query<any>(`SELECT def,has_combo,rules_text FROM cards WHERE character_id=$1`, [id])).rows[0];
    expect((await g('BABY-015')).def).toBe(0);
    expect((await g('FOLLOW-YOU-040')).has_combo).toBe(true);
    expect((await g('SPL-003')).rules_text).toContain('อยู่จนกว่าตัวนั้นจะออกจากสนาม');
    expect((await db.query<any>(`SELECT description FROM card_effects WHERE card_id=(SELECT id FROM cards WHERE character_id='BABY-015')`)).rows[0].description).toContain('ฟื้น HP 20');
  });
});
