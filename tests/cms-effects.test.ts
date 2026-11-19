import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp, migrateDown } from '../db/migrate';
import { CardService, type User } from '../src/server/service';
import { toLegacy, type SystemConfig } from '../src/engine/effect-registry';
import { parseEffect } from '../src/engine/effects';

let svc: CardService, db: PGlite, ed: User;
const card = (o: any = {}) => ({ character_id: 'T-15', name: 'T', card_type: 'character', level: 15, chain_key: 'tc', hp: 10, atk: 2, ...o });
const sys = (o: Partial<SystemConfig> = {}): SystemConfig => ({ trigger: 'on_summon', target: 'self', action: 'atk_up', amount: 2, perm: true, max: 4, duration: 'permanent', use_limit: 'none', ...o });
const fx = (o: Partial<SystemConfig> = {}, extra: any = {}) => ({ description: 'เมื่อถูกเรียก ATK +2 ถาวร (รวมไม่เกิน +4)', config: { system: sys(o), content: { effect_name: 'พลังเติบโต' }, ack: [] }, ...extra });

beforeEach(async () => {
  db = new PGlite(); await migrateUp(db);
  svc = new CardService(db, '/tmp/vcz-test-storage');
  await svc.createUser('ed@x.com', 'password123', 'super_admin');
  ed = (await svc.login('ed@x.com', 'password123')).user as User;
});

describe('server validation (C3)', () => {
  it('structured effect is saved; legacy columns are derived from the Registry and the engine parses them', async () => {
    const c = await svc.saveCard(ed, card({ effects: [fx()] }));
    const e = c.effects[0];
    expect(e.action_text).toBe('ATK +2 ถาวร (สูงสุด +4)');
    expect(e.target_text).toBe('ตัวเอง');
    expect(e.config.system.action).toBe('atk_up');
    expect(e.config.content.effect_name).toBe('พลังเติบโต');
    expect(parseEffect(e)).not.toBeNull();
  });
  it('ignores legacy text sent together with a structured payload (server derives it)', async () => {
    const c = await svc.saveCard(ed, card({ effects: [fx({}, { action_text: 'ทำอะไรก็ได้', target_text: 'อะไรก็ได้' })] }));
    expect(c.effects[0].action_text).toBe('ATK +2 ถาวร (สูงสุด +4)');
  });
  it('rejects values outside the Registry or clashing combinations with a Thai reason', async () => {
    await expect(svc.saveCard(ed, card({ effects: [fx({ trigger: 'combo' })] }))).rejects.toThrow(/ยังไม่รองรับ/);
    await expect(svc.saveCard(ed, card({ effects: [fx({ action: 'draw', trigger: 'passive', perm: false, max: null, duration: 'instant' })] }))).rejects.toThrow(/ต่อเนื่อง/);
    await expect(svc.saveCard(ed, card({ effects: [fx({ amount: 0 })] }))).rejects.toThrow(/จำนวนเต็ม/);
    await expect(svc.saveCard(ed, card({ effects: [fx({ target: 'moon' })] }))).rejects.toThrow(/ไม่อยู่ใน Registry/);
  });
  it('character limits: effect name 30, description 180, special condition 120, flavor 200, rules 240', async () => {
    const long = (n: number) => 'ก'.repeat(n);
    await svc.saveCard(ed, card({ flavor_text: long(200), rules_text: long(240), effects: [fx({}, { description: long(180), config: { system: sys(), content: { effect_name: long(30), special_condition_text: long(120) } } })] }));
    const bad = async (o: any, re: RegExp) => { await expect(svc.saveCard(ed, card({ character_id: 'T-16', level: 40, ...o }))).rejects.toThrow(re); };
    await bad({ flavor_text: long(201) }, /Flavor/);
    await bad({ rules_text: long(241) }, /ข้อความกติกา/);
    await bad({ effects: [fx({}, { description: long(181) })] }, /คำอธิบาย/);
    await bad({ effects: [fx({}, { config: { system: sys(), content: { effect_name: long(31) } } })] }, /ชื่อ Effect/);
    await bad({ effects: [fx({}, { config: { system: sys(), content: { special_condition_text: long(121) } } })] }, /เงื่อนไขพิเศษ/);
  });
  it('counts emoji as one character and normalizes text before saving', async () => {
    const c = await svc.saveCard(ed, card({ flavor_text: '😀'.repeat(200) + '​' }));
    expect(c.flavor_text).toBe('😀'.repeat(200));
  });
  it('acknowledged warnings are stored with who and when', async () => {
    const c = await svc.saveCard(ed, card({ effects: [fx({}, { config: { system: sys(), content: {}, ack: ['amount_mismatch'] } })] }));
    expect(c.effects[0].config.ack[0]).toMatchObject({ code: 'amount_mismatch', by: 'ed@x.com' });
    expect(c.effects[0].config.ack[0].at).toBeTruthy();
  });
  it('legacy-style payload (old clients) still saves', async () => {
    const c = await svc.saveCard(ed, card({ effects: [{ trigger: 'on_summon', target_text: 'ตัวเอง', action_text: 'ATK +2', duration: 'until_end_of_turn', use_limit: 'none', description: 'เมื่อถูกเรียก ATK +2 จนจบเทิร์น' }] }));
    expect(c.effects[0].config).toBeNull();
  });
});

describe('publish gate (C3)', () => {
  const legacy = (o: any = {}) => ({ trigger: 'combo', description: 'พลังแฝงที่ยังไม่มีในเอนจิน', duration: 'instant', use_limit: 'none', ...o });
  it('blocks a character with an ability the engine does not run; Draft still saves', async () => {
    const c = await svc.saveCard(ed, card({ effects: [legacy()] }));
    expect(c.status).toBe('draft');
    await expect(svc.transition(ed, c.id, 'in_review')).rejects.toThrow(/ยังไม่ทำงานในเอนจิน/);
  });
  it('lets a character with running abilities advance', async () => {
    const c = await svc.saveCard(ed, card({ effects: [fx()] }));
    const r = await svc.transition(ed, c.id, 'in_review');
    expect(r.status).toBe('in_review');
  });
  it('does not block spells (they run by card ID, not through Effect rows)', async () => {
    const c = await svc.saveCard(ed, { character_id: 'SPL-X', name: 'S', card_type: 'spell', effects: [legacy({ trigger: 'on_cast' })] });
    expect((await svc.transition(ed, c.id, 'in_review')).status).toBe('in_review');
  });
});

describe('migration 019', () => {
  it('adds a nullable config column and rolls back cleanly', async () => {
    const col = async () => (await db.query<any>(`SELECT is_nullable FROM information_schema.columns WHERE table_name='card_effects' AND column_name='config'`)).rows[0];
    expect(await col()).toMatchObject({ is_nullable: 'YES' });
    await migrateDown(db);
    await migrateUp(db);
    expect(await col()).toBeTruthy();
  });
  it('toLegacy output is what the engine reads', () => {
    expect(toLegacy(sys()).action_text).toBe('ATK +2 ถาวร (สูงสุด +4)');
  });
});
