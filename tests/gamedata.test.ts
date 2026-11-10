import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp, migrateDown } from '../db/migrate';
import { CardService, type User } from '../src/server/service';
import { GameData } from '../src/server/gamedata';

let svc: CardService, g: GameData, ed: User, adm: User, viewer: User;
const mk = async (email: string, role: any) => { await svc.createUser(email, 'password123', role); return (await svc.login(email, 'password123')).user as User; };
const ch = (id: string, chain: string, o: any = {}) => ({ character_id: id, name: o.name ?? id, card_type: 'character', level: 15, chain_key: chain, hp: 10, atk: 2, class: o.cls ?? 'Detective', element: o.el ?? 'water', ...o });

beforeEach(async () => {
  const db = new PGlite(); await migrateUp(db);
  svc = new CardService(db, '/tmp/vcz-test-storage'); g = new GameData(svc);
  adm = await mk('a@x.com', 'super_admin'); ed = await mk('e@x.com', 'card_editor'); viewer = await mk('v@x.com', 'viewer');
  const r = await svc.importCards(adm, [ch('GUIDE-015', 'guide'), ch('PING-015', 'ping'), ch('BOB-015', 'bob', { cls: 'Mage', el: 'fire' }),
    ch('PING-040', 'ping', { level: 40, evolves_from: 'PING-015', hp: 20, atk: 5 })]);
  expect(r.ok).toBe(true);
});

describe('game rules', () => {
  it('seeds confirmed + proposed rules; only super_admin edits', async () => {
    const rs = await g.rules(viewer);
    expect(rs.find((x: any) => x.key === 'battlefield_slots')).toMatchObject({ value: 7, status: 'confirmed' });
    expect(rs.find((x: any) => x.key === 'starting_lp').status).toBe('proposed');
    await expect(g.setRule(ed, 'starting_lp', 4000)).rejects.toThrow(/สิทธิ์/);
    await g.setRule(adm, 'starting_lp', 4000, 'confirmed');
    expect(await g.ruleValue('starting_lp')).toBe(4000);
  });
});

describe('affiliation / gender / synergy', () => {
  it('assigns gender + affiliations, rejects unknown, locks non-draft', async () => {
    await g.upsertAffiliation(ed, { key: 'detective-gang', name: 'แก๊งนักสืบ' });
    await g.setCardMeta(ed, 'GUIDE-015', { gender: 'male', affiliations: [{ key: 'detective-gang', reason: 'เล่น Among ด้วยกัน' }] });
    await g.setCardMeta(ed, 'PING-015', { gender: 'female', affiliations: ['detective-gang'] });
    expect(await g.cardMeta(viewer, 'GUIDE-015')).toMatchObject({ gender: 'male', affiliations: [{ key: 'detective-gang' }] });
    await expect(g.setCardMeta(ed, 'GUIDE-015', { affiliations: ['nope'] })).rejects.toThrow(/ไม่พบเกม/);
    await expect(g.setCardMeta(ed, 'GUIDE-015', { gender: 'xx' })).rejects.toThrow(/เพศ/);
    await expect(g.setCardMeta(viewer, 'GUIDE-015', { gender: 'male' })).rejects.toThrow(/สิทธิ์/);
  });
  it('synergy depends on member count and caps stacking', async () => {
    await g.upsertAffiliation(ed, { key: 'gang' });
    for (const c of ['GUIDE-015', 'PING-015', 'BOB-015']) await g.setCardMeta(ed, c, { affiliations: ['gang'] });
    await g.upsertSynergy(ed, { affiliation: 'gang', min_members: 2, stat: 'atk', amount: 5, max_stacks: 1 });
    await g.upsertSynergy(ed, { affiliation: 'gang', min_members: 3, stat: 'atk', amount: 10, max_stacks: 1 });
    expect(await g.synergyBonus(['GUIDE-015'])).toEqual([]);                       // 1 member: nothing
    expect(await g.synergyBonus(['GUIDE-015', 'PING-015'])).toEqual([{ affiliation: 'gang', stat: 'atk', amount: 5 }]);
    expect(await g.synergyBonus(['GUIDE-015', 'PING-015', 'BOB-015'])).toEqual([{ affiliation: 'gang', stat: 'atk', amount: 10 }]); // highest tier only
    await expect(g.upsertSynergy(ed, { affiliation: 'gang', min_members: 1, stat: 'atk', amount: 5 })).rejects.toThrow();
  });
});

describe('story', () => {
  it('validates kinds and applies once per story (no duplicate-copy stacking)', async () => {
    await g.upsertStory(ed, { key: 'old-friends', name: 'Old Friends', kind: 'positive', stat: 'atk', amount: 5, members: ['guide', 'ping'] });
    await expect(g.upsertStory(ed, { key: 'bad', name: 'x', kind: 'positive', stat: 'atk', amount: -5, members: ['guide', 'ping'] })).rejects.toThrow(/บวก/);
    await expect(g.upsertStory(ed, { key: 'bad', name: 'x', kind: 'negative', stat: 'hp', amount: 5, members: ['guide', 'ping'] })).rejects.toThrow(/ลบ/);
    await expect(g.upsertStory(ed, { key: 'bad', name: 'x', kind: 'conditional', members: ['guide', 'ping'] })).rejects.toThrow(/เงื่อนไข/);
    await expect(g.upsertStory(ed, { key: 'bad', name: 'x', kind: 'positive', stat: 'atk', amount: 5, members: ['guide'] })).rejects.toThrow(/อย่างน้อย 2/);
    await expect(g.upsertStory(ed, { key: 'bad', name: 'x', kind: 'positive', stat: 'atk', amount: 5, members: ['guide', 'ghost'] })).rejects.toThrow(/ghost/);
    expect(await g.storyBonus(['GUIDE-015'])).toEqual([]);
    const b = await g.storyBonus(['GUIDE-015', 'PING-015', 'PING-040']);          // two Ping forms must not double it
    expect(b).toHaveLength(1); expect(b[0]).toMatchObject({ story: 'old-friends', amount: 5 });
  });
});

describe('fusion', () => {
  beforeEach(async () => {
    await svc.importCards(adm, [{ character_id: 'TWIN-001', name: 'Twin Soul', card_type: 'fusion', hp: 50, atk: 20 }]);
    await g.upsertAffiliation(ed, { key: 'gang' });
  });
  it('requires a rule (not every pair fuses) and checks class/affiliation', async () => {
    await expect(g.upsertRecipe(ed, { key: 'rr', name: 'R', result: 'TWIN-001' })).rejects.toThrow(/เงื่อนไข/);
    await g.upsertRecipe(ed, { key: 'twin', name: 'Twin', result: 'TWIN-001', must_match: ['class', 'affiliation'] });
    for (const c of ['GUIDE-015', 'PING-015']) await g.setCardMeta(ed, c, { affiliations: ['gang'] });
    expect(await g.validateFusion('twin', ['GUIDE-015', 'PING-015'])).toMatchObject({ ok: true, result: 'TWIN-001' });
    const r = await g.validateFusion('twin', ['GUIDE-015', 'BOB-015']);
    expect(r.ok).toBe(false); expect(r.errors.join()).toMatch(/อาชีพ/);
    expect((await g.validateFusion('twin', ['GUIDE-015'])).errors.join()).toMatch(/อย่างน้อย 2/);
  });
  it('fusion is a valid card type, evolution unaffected', async () => {
    expect((await svc.listCards(adm, { q: 'TWIN' }))[0].card_type).toBe('fusion');
  });
});

describe('deck', () => {
  it('checks size, copies per chain, evolved forms need base', async () => {
    const r = await g.validateDeck(['PING-040']);
    expect(r.ok).toBe(false);
    expect(r.errors.join('|')).toMatch(/40 ใบพอดี/); expect(r.errors.join('|')).toMatch(/ร่างเริ่มต้น/);
    await g.setRule(adm, 'deck_size', 5);
    expect((await g.validateDeck(['PING-015', 'PING-040', 'GUIDE-015', 'BOB-015', 'BOB-015'])).ok).toBe(true);
    const many = await g.validateDeck(['PING-015', 'PING-015', 'PING-015', 'PING-040', 'GUIDE-015']);
    expect(many.errors.join()).toMatch(/เกินสูงสุด 3/);
    expect((await g.validateDeck(['PING-015', 'PING-015', 'PING-015', 'PING-015', 'X'])).errors.join()).toMatch(/ไม่พบการ์ด X/);
  });
});

describe('per-card story links and fusion partners', () => {
  it('story link applies once per pair when both on field, shared by all forms', async () => {
    await g.setCardMeta(ed, 'GUIDE-015', { story_links: [{ partner: 'ping', name: 'Old Friends', stat: 'atk', amount: 5, description: 'ATK +5' }] });
    expect((await g.cardMeta(viewer, 'GUIDE-015')).story_links[0]).toMatchObject({ partner: 'ping', amount: 5 });
    expect(await g.storyLinkBonus(['GUIDE-015'])).toEqual([]);
    expect(await g.storyLinkBonus(['GUIDE-015', 'BOB-015'])).toEqual([]);
    expect(await g.storyLinkBonus(['GUIDE-015', 'PING-040'])).toHaveLength(1);       // evolved form counts
    await g.setCardMeta(ed, 'PING-015', { story_links: [{ partner: 'guide', name: 'Old Friends', stat: 'atk', amount: 5 }] });
    expect(await g.storyLinkBonus(['GUIDE-015', 'PING-015', 'PING-040'])).toHaveLength(1); // both directions + copies: once
  });
  it('rejects self, unknown, duplicate partners', async () => {
    await expect(g.setCardMeta(ed, 'GUIDE-015', { story_links: [{ partner: 'guide', name: 'x' }] })).rejects.toThrow(/ตัวเอง/);
    await expect(g.setCardMeta(ed, 'GUIDE-015', { fusion_partners: [{ partner: 'ghost' }] })).rejects.toThrow(/ghost/);
    await expect(g.setCardMeta(ed, 'GUIDE-015', { fusion_partners: [{ partner: 'ping' }, { partner: 'ping' }] })).rejects.toThrow(/ซ้ำ/);
    expect((await g.cardMeta(viewer, 'GUIDE-015')).fusion_partners).toEqual([]);      // nothing half-saved
  });
  it('fusion needs spell + both in hand + ticked partner (either side)', async () => {
    await g.setCardMeta(ed, 'GUIDE-015', { fusion_partners: [{ partner: 'ping', hp: 10, atk: 5 }] });
    const ok = await g.fusionPair(true, 'PING-015', 'GUIDE-015', ['PING-015', 'GUIDE-015', 'BOB-015']);
    expect(ok.ok).toBe(true); expect(ok.bonuses[0]).toMatchObject({ owner: 'GUIDE-015', hp: 10, atk: 5 });
    expect(ok.stacked).toMatchObject({ top: 'PING-015', one_slot: true, hp: 10 + 5 + 10, atk: 2 + 1 + 5 });  // top 100% + bottom 50% + pair bonus
    expect((await g.fusionPair(false, 'PING-015', 'GUIDE-015', ['PING-015', 'GUIDE-015'])).errors.join()).toMatch(/เวท Fusion/);
    expect((await g.fusionPair(true, 'PING-015', 'GUIDE-015', ['GUIDE-015'])).errors.join()).toMatch(/ไม่ได้อยู่บนมือ/);
    expect((await g.fusionPair(true, 'BOB-015', 'GUIDE-015', ['BOB-015', 'GUIDE-015'])).ok).toBe(false);
    await expect(g.setCardMeta(viewer, 'GUIDE-015', { fusion_partners: [] })).rejects.toThrow(/สิทธิ์/);
  });
});

describe('seeded games and import meta', () => {
  it('seeds the 9 games with tiered synergy (highest tier only)', async () => {
    const af = await g.affiliations(viewer);
    expect(af.map((x: any) => x.key)).toEqual(expect.arrayContaining(['among-us', 'goose-goose-duck', 'rov', 'warz', 'ragnarok', 'roblox', 'ghost-story', 'fivem', 'board-game']));
    for (const c of ['GUIDE-015', 'PING-015', 'BOB-015']) await g.setCardMeta(ed, c, { affiliations: ['among-us'] });
    expect(await g.synergyBonus(['GUIDE-015', 'PING-015'])).toEqual([{ affiliation: 'among-us', stat: 'atk', amount: 5 }]);
    expect(await g.synergyBonus(['GUIDE-015', 'PING-015', 'BOB-015'])).toEqual([{ affiliation: 'among-us', stat: 'atk', amount: 10 }]);
    expect((await g.rules(viewer)).find((x: any) => x.key === 'gender_pair_bonus').value).toMatchObject({ stat: 'atk', amount: 5 });
  });
  it('import applies meta fields and reports bad rows', async () => {
    const errs = await g.applyImportMeta(adm, [
      { character_id: 'GUIDE-015', gender: 'male', affiliations: ['roblox'], story_links: [{ partner: 'ping', name: 'x', stat: 'atk', amount: 5 }] },
      { character_id: 'PING-015', affiliations: ['nope'] }]);
    expect(errs).toHaveLength(1); expect(errs[0].row).toBe(2);
    expect((await g.cardMeta(viewer, 'GUIDE-015')).affiliations[0].key).toBe('roblox');
  });
});

describe('custom genders', () => {
  it('adds a gender and assigns it; viewer cannot add', async () => {
    await g.upsertGender(ed, { key: 'g-x1', name: 'นอนไบนารี' });
    expect((await g.taxValues(viewer, 'gender')).map((x: any) => x.key)).toContain('g-x1');
    await g.setCardMeta(ed, 'GUIDE-015', { gender: 'g-x1' });
    expect((await g.cardMeta(viewer, 'GUIDE-015')).gender).toBe('g-x1');
    await expect(g.upsertGender(viewer, { key: 'g-x2', name: 'x' })).rejects.toThrow(/สิทธิ์/);
  });
});

describe('migration 006 rollback', () => {
  it('down then up works', async () => {
    const db = svc.db; await migrateDown(db); await migrateUp(db);
    expect((await db.query<any>(`SELECT count(*)::int c FROM game_rules`)).rows[0].c).toBeGreaterThan(10);
  });
});
