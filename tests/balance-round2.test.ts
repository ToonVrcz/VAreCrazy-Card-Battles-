// Balance round 2 (migration 026): approved DEF/effect deltas. HP and ATK are never touched.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { parseEffect } from '../src/engine/effects';

const now = JSON.parse(readFileSync('db/seed/toon-cards.json', 'utf8')) as any[];
const DEF: Record<string, number> = { '1GOKU-015': 3, 'BABY-015': 5, 'BACKJI-015': 2, 'BADGUY-015': 2, 'BAM-015': 1, 'BAMMIE-015': 1, 'BOBO-015': 1, 'CHAEM-015': 2, 'CUTIE-015': 0, 'DNMAN-015': 1, 'FOLLOW-YOU-015': 2, 'GOD-WA-015': 1, 'I-M-GRAPE-015': 2, 'JAOJAY-015': 0, 'LALAPING-015': 4, 'LEON-S-KENNEDY-015': 3, 'LINLADA-015': 1, 'LORDNAM-015': 2, 'LUCKY-015': 3, 'MELON-015': 1, 'MIKI-015': 2, 'MON-015': 0, 'NONG-TAENGMO-015': 1, 'NORMAN-015': 4, 'OUFILLING-015': 4, 'PIKACHU-015': 0, 'PK-015': 2, 'PKXCY-015': 2, 'SATOSHI-015': 5, 'SKYMOON-015': 3, 'SMILE-015': 1, 'SOMYES-015': 2, 'TAN-015': 3, 'TEE-015': 4, 'THAI26-015': 2, 'THAI32-015': 4, 'THOMAS-015': 2, 'WENDYWENDIE-015': 4, 'ZEESKY-015': 3,
  '1GOKU-040': 4, 'BADGUY-040': 2, 'FOLLOW-YOU-040': 3, 'LALAPING-040': 6, 'NORMAN-040': 4, 'SATOSHI-040': 5, 'TEE-040': 6, 'FOLLOW-YOU-070': 3, 'LALAPING-070': 6 };
const UP = readFileSync('db/migrations/026_balance_round2.up.sql', 'utf8'), DOWN = readFileSync('db/migrations/026_balance_round2.down.sql', 'utf8');
const act = (id: string, t: string) => now.find(c => c.character_id === id).effects.find((e: any) => e.trigger === t);

describe('balance round 2 seed data', () => {
  it('all 48 characters have the approved DEF', () => { expect(Object.keys(DEF).length).toBe(48); for (const [id, d] of Object.entries(DEF)) expect(now.find(c => c.character_id === id)?.def, id).toBe(d); });
  it('HP and ATK are unchanged versus the pre-balance commit 5b85f89', () => {
    const before = JSON.parse(execSync('git show 5b85f89:db/seed/toon-cards.json', { encoding: 'utf8', maxBuffer: 1 << 26 })) as any[];
    for (const c of now) { const b = before.find(x => x.character_id === c.character_id)!; expect([c.hp, c.atk], c.character_id).toEqual([b.hp, b.atk]); }
  });
  it('the 5 effect changes are in and every effect still parses', () => {
    expect(act('SATOSHI-015', 'turn_end').action_text).toBe('ฟื้น HP 10'); expect(act('SATOSHI-040', 'turn_end').action_text).toBe('ฟื้น HP 10');
    expect(act('SMILE-015', 'turn_end').action_text).toBe('ฟื้น HP 10'); expect(act('LALAPING-040', 'turn_end').action_text).toBe('ฟื้น HP 5');
    expect(act('LALAPING-070', 'on_evolve').action_text).toBe('ฟื้น HP 50');
    for (const c of now) for (const e of c.effects ?? []) expect(parseEffect(e), `${c.character_id}: ${e.description}`).not.toBeNull();
  });
  it('LALAPING-070 heals a fixed 50 (parsed, not full)', () => { const e = parseEffect(act('LALAPING-070', 'on_evolve'))!; expect(e.kind).toBe('heal'); expect(e.amount).toBe(50); expect(e.full).toBeFalsy(); });
});

describe('migration 026', () => {
  let db: PGlite;
  const card = (id: string, def: number, hp = 90, atk = 20) => db.query(`INSERT INTO cards(character_id,name,card_type,level,hp,atk,def) VALUES($1,$1,'character',15,$2,$3,$4)`, [id, hp, atk, def]);
  beforeAll(async () => {
    db = new PGlite(); await migrateUp(db);
    await card('BACKJI-015', 3, 76, 24); await card('LUCKY-015', 9);            // LUCKY edited in Admin since: guard (old = 4) must not overwrite
    await card('SMILE-015', 0, 90, 35);
    await db.query(`INSERT INTO card_effects(card_id,sort_order,trigger,target_text,action_text,duration,use_limit,description) SELECT id,0,'turn_end','ตัวละครฝ่ายเรา 1 ใบ','ฟื้น HP 5','instant','once_per_turn','จบเทิร์น ฟื้น HP 5 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)' FROM cards WHERE character_id='SMILE-015'`);
  }, 60000);
  it('applies guarded updates, never touches HP/ATK', async () => {
    await db.exec(UP);
    const g = async (id: string) => (await db.query<any>(`SELECT hp,atk,def FROM cards WHERE character_id=$1`, [id])).rows[0];
    expect(await g('BACKJI-015')).toMatchObject({ hp: 76, atk: 24, def: 2 }); expect((await g('LUCKY-015')).def).toBe(9); expect(await g('SMILE-015')).toMatchObject({ hp: 90, atk: 35, def: 1 });
    expect((await db.query<any>(`SELECT action_text a, description d FROM card_effects`)).rows[0]).toMatchObject({ a: 'ฟื้น HP 10' });
  });
  it('down restores', async () => {
    await db.exec(DOWN);
    expect((await db.query<any>(`SELECT def FROM cards WHERE character_id='BACKJI-015'`)).rows[0].def).toBe(3);
    expect((await db.query<any>(`SELECT action_text a FROM card_effects`)).rows[0].a).toBe('ฟื้น HP 5');
  });
});
