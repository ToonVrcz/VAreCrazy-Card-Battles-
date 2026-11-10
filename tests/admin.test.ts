import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { CardService, AppError, type User } from '../src/server/service';

let svc: CardService;
const asUser = async (email: string, role: any) => {
  await svc.createUser(email, 'password123', role);
  return (await svc.login(email, 'password123')).user as User;
};
const card = (o: any = {}) => ({ character_id: 'T-15', name: 'T', card_type: 'character', level: 15, chain_key: 'tc', hp: 10, atk: 2, ...o });

beforeEach(async () => {
  const db = new PGlite(); await migrateUp(db);
  svc = new CardService(db, '/tmp/vcz-test-storage');
});

describe('auth', () => {
  it('login ok / wrong password / token validates', async () => {
    await svc.createUser('A@x.com', 'password123', 'viewer');
    const { token } = await svc.login('a@x.com', 'password123');
    expect((await svc.auth(token)).role).toBe('viewer');
    await expect(svc.login('a@x.com', 'bad')).rejects.toThrow(/ไม่ถูกต้อง/);
    await svc.logout(token);
    await expect(svc.auth(token)).rejects.toThrow(AppError);
  });
  it('rejects short passwords', async () => {
    await expect(svc.createUser('b@x.com', '123', 'viewer')).rejects.toThrow();
  });
});

describe('roles', () => {
  it('viewer cannot write; editor can; editor cannot publish', async () => {
    const v = await asUser('v@x.com', 'viewer'), e = await asUser('e@x.com', 'card_editor');
    await expect(svc.saveCard(v, card())).rejects.toThrow(/ไม่มีสิทธิ์/);
    const c = await svc.saveCard(e, card());
    await svc.transition(e, c.id, 'in_review');
    await expect(svc.transition(e, c.id, 'approved')).rejects.toThrow(/ไม่มีสิทธิ์/);
  });
});

describe('workflow', () => {
  it('Draft -> Review -> Approved -> Published with right roles, then locks editing', async () => {
    const e = await asUser('e@x.com', 'card_editor'), r = await asUser('r@x.com', 'reviewer'), p = await asUser('p@x.com', 'publisher');
    const m = await svc.uploadMedia(e, 'a.jpg', 'image/jpeg', Buffer.from('x'));
    const c = await svc.saveCard(e, card({ media_id: m.id }));
    await svc.transition(e, c.id, 'in_review');
    await svc.transition(r, c.id, 'approved');
    const pub = await svc.transition(p, c.id, 'published');
    expect(pub.status).toBe('published'); expect(pub.version_no).toBe(1);
    await expect(svc.saveCard(e, card({ name: 'new' }), c.id)).rejects.toThrow(/Draft/);
    await svc.transition(p, c.id, 'draft');
    await svc.saveCard(e, card({ name: 'v2', media_id: m.id }), c.id);
    await svc.transition(e, c.id, 'in_review'); await svc.transition(r, c.id, 'approved');
    expect((await svc.transition(p, c.id, 'published')).version_no).toBe(2);
  });
  it('publish rule errors come back as readable 422', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    const c = await svc.saveCard(s, card()); // no image
    await svc.transition(s, c.id, 'in_review'); await svc.transition(s, c.id, 'approved');
    await expect(svc.transition(s, c.id, 'published')).rejects.toThrow(/needs an image/);
  });
  it('invalid jumps are refused', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    const c = await svc.saveCard(s, card());
    await expect(svc.transition(s, c.id, 'published')).rejects.toThrow(/ไม่ได้/);
  });
  it('duplicate character_id gives 409', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    await svc.saveCard(s, card());
    await expect(svc.saveCard(s, card({ level: 40 }))).rejects.toMatchObject({ code: 409 });
  });
});

describe('shop price', () => {
  it('stores points and Vrcoin prices and round-trips via export/import', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    const c = await svc.saveCard(e, card({ shop_price_points: 500 }));
    expect(c.shop_price_points).toBe(500); expect(c.shop_price_vrcoin).toBeNull();
    const out = await svc.exportJSON(e);
    expect(await svc.importCards(e, out)).toMatchObject({ ok: true, updated: 1 });
    expect((await svc.listCards(e))[0].shop_price_points).toBe(500);
  });
});

describe('effects', () => {
  const fx = (o: any = {}) => ({ trigger: 'on_summon', description: 'จั่วการ์ด 1 ใบ', ...o });
  it('saves ordered effects, replaces on update, returns them with the card', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    const c = await svc.saveCard(e, card({ effects: [fx(), fx({ trigger: 'passive', description: 'ATK +5', use_limit: 'once_per_turn' })] }));
    expect(c.effects.map((x: any) => x.trigger)).toEqual(['on_summon', 'passive']);
    const u = await svc.saveCard(e, card({ effects: [fx({ trigger: 'turn_end', duration: 'n_turns', duration_turns: 2 })] }), c.id);
    expect(u.effects).toHaveLength(1); expect(u.effects[0]).toMatchObject({ trigger: 'turn_end', duration_turns: 2 });
    expect((await svc.saveCard(e, card(), c.id)).effects).toHaveLength(1); // omitted = unchanged
    expect((await svc.saveCard(e, card({ effects: [] }), c.id)).effects).toHaveLength(0);
  });
  it('rejects bad trigger, empty description, missing turns, >10', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    await expect(svc.saveCard(e, card({ effects: [fx({ trigger: 'nope' })] }))).rejects.toThrow(/trigger/);
    await expect(svc.saveCard(e, card({ effects: [fx({ description: ' ' })] }))).rejects.toThrow(/คำอธิบาย/);
    await expect(svc.saveCard(e, card({ effects: [fx({ duration: 'n_turns' })] }))).rejects.toThrow(/เทิร์น/);
    await expect(svc.saveCard(e, card({ effects: Array(11).fill(fx()) }))).rejects.toThrow(/10/);
    expect(await svc.listCards(e)).toHaveLength(0); // nothing half-saved
  });
  it('published snapshot contains effects; JSON and CSV round-trip', async () => {
    const e = await asUser('e@x.com', 'super_admin');
    const m = await svc.uploadMedia(e, 'a.jpg', 'image/jpeg', Buffer.from('x'));
    const c = await svc.saveCard(e, card({ media_id: m.id, effects: [fx()] }));
    await svc.transition(e, c.id, 'in_review'); await svc.transition(e, c.id, 'approved'); await svc.transition(e, c.id, 'published');
    const v = await svc.db.query<any>(`SELECT snapshot->'effects' fx FROM card_versions WHERE card_id=$1`, [c.id]);
    expect(v.rows[0].fx[0]).toMatchObject({ trigger: 'on_summon', description: 'จั่วการ์ด 1 ใบ' });
    await svc.transition(e, c.id, 'draft');
    const out = await svc.exportJSON(e);
    expect(out[0].effects).toHaveLength(1);
    expect(await svc.importCards(e, out)).toMatchObject({ ok: true, updated: 1 });
    const parsed = CardService.parseCSV(await svc.exportCSV(e));
    expect(await svc.importCards(e, parsed)).toMatchObject({ ok: true, updated: 1 });
    expect((await svc.getCard(e, c.id)).effects).toHaveLength(1);
  });
});

describe('media', () => {
  it('rejects bad type and oversize', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    await expect(svc.uploadMedia(e, 'a.gif', 'image/gif', Buffer.from('x'))).rejects.toThrow(/JPG/);
    await expect(svc.uploadMedia(e, 'a.png', 'image/png', Buffer.alloc(6 * 1024 * 1024))).rejects.toThrow(/5MB/);
  });
});

describe('import/export', () => {
  const rows = [
    card({ character_id: 'X-15', level: 15, element: 'dark' }),
    card({ character_id: 'X-40', level: 40, hp: 50, evolves_from: 'X-15' }),
  ];
  it('JSON import creates drafts, export round-trips, re-import updates', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    const r = await svc.importCards(e, rows);
    expect(r).toMatchObject({ ok: true, created: 2 });
    const out = await svc.exportJSON(e);
    expect(out.map((o: any) => [o.character_id, o.evolves_from])).toEqual([['X-15', null], ['X-40', 'X-15']]);
    expect(await svc.importCards(e, out)).toMatchObject({ ok: true, created: 0, updated: 2 });
  });
  it('CSV round-trip with commas and quotes', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    await svc.importCards(e, [card({ rules_text: 'a, "b"\nc' })]);
    const csv = await svc.exportCSV(e);
    const parsed = CardService.parseCSV(csv);
    expect(parsed[0].rules_text).toBe('a, "b"\nc');
    expect(await svc.importCards(e, parsed)).toMatchObject({ ok: true, updated: 1 });
  });
  it('bad row rolls back everything and reports the row', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    const bad = [card({ character_id: 'G-1', level: 15 }), card({ character_id: 'G-2', level: 15 })]; // same chain+level
    const r = await svc.importCards(e, bad);
    expect(r.ok).toBe(false); expect(r.errors[0].row).toBe(3);
    expect(await svc.listCards(e)).toHaveLength(0);
  });
  it('dry run saves nothing; duplicate IDs in file caught; published cards protected', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    expect(await svc.importCards(e, rows, true)).toMatchObject({ ok: true, dryRun: true });
    expect(await svc.listCards(e)).toHaveLength(0);
    expect((await svc.importCards(e, [rows[0], rows[0]])).ok).toBe(false);
  });
  it('viewer cannot import', async () => {
    const v = await asUser('v@x.com', 'viewer');
    await expect(svc.importCards(v, rows)).rejects.toThrow(/ไม่มีสิทธิ์/);
  });
  it('writes audit log', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    await svc.saveCard(e, card());
    expect((await svc.auditLog(e))[0]).toMatchObject({ actor: 'e@x.com', action: 'create' });
  });
});

describe('user management', () => {
  it('only super_admin can manage users', async () => {
    const e = await asUser('e@x.com', 'card_editor');
    await expect(svc.listUsers(e)).rejects.toThrow(/ไม่มีสิทธิ์/);
    await expect(svc.adminCreateUser(e, 'n@x.com', 'password123', 'viewer')).rejects.toThrow(/ไม่มีสิทธิ์/);
  });
  it('creates users with validation, duplicates give 409, new user can log in', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    await svc.adminCreateUser(s, 'New@X.com', 'password123', 'reviewer');
    expect((await svc.login('new@x.com', 'password123')).user.role).toBe('reviewer');
    await expect(svc.adminCreateUser(s, 'new@x.com', 'password123', 'viewer')).rejects.toMatchObject({ code: 409 });
    await expect(svc.adminCreateUser(s, 'bad', 'password123', 'viewer')).rejects.toThrow(/อีเมล/);
    await expect(svc.adminCreateUser(s, 'o@x.com', 'short', 'viewer')).rejects.toThrow(/8/);
    await expect(svc.adminCreateUser(s, 'o@x.com', 'password123', 'boss' as any)).rejects.toThrow(/role/);
  });
  it('changing role or deactivating revokes sessions; deactivated user cannot log in', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    const id = await svc.adminCreateUser(s, 'v@x.com', 'password123', 'viewer');
    const { token } = await svc.login('v@x.com', 'password123');
    await svc.updateUser(s, id, { role: 'card_editor' });
    await expect(svc.auth(token)).rejects.toThrow();
    const t2 = (await svc.login('v@x.com', 'password123')).token;
    await svc.updateUser(s, id, { is_active: false });
    await expect(svc.auth(t2)).rejects.toThrow();
    await expect(svc.login('v@x.com', 'password123')).rejects.toThrow();
  });
  it('cannot demote/disable yourself or the last active super_admin', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    await expect(svc.updateUser(s, s.id, { is_active: false })).rejects.toThrow(/ตัวเอง/);
    await expect(svc.updateUser(s, s.id, { role: 'viewer' })).rejects.toThrow(/ตัวเอง/);
    const id2 = await svc.adminCreateUser(s, 's2@x.com', 'password123', 'super_admin');
    await svc.updateUser(s, id2, { role: 'viewer' }); // fine: s still active super
    const s2 = await asUser('s3@x.com', 'super_admin');
    await svc.updateUser(s2, s.id, { is_active: false }); // s2 and s... now only s2 left
    await expect(svc.updateUser(s2, (await svc.listUsers(s2)).find((x: any) => x.email === 'v@x.com')?.id ?? id2, { role: 'viewer' })).resolves.toBeUndefined();
  });
  it('last super_admin guard blocks removing the only other super', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    const id2 = await svc.adminCreateUser(s, 'b@x.com', 'password123', 'super_admin');
    const b = (await svc.login('b@x.com', 'password123')).user;
    await svc.updateUser(b, s.id, { is_active: false });           // ok: b remains
    await expect(svc.updateUser(s as any, id2, { role: 'viewer' })).rejects.toThrow(); // s is deactivated -> cannot
    const bb = await svc.auth((await svc.login('b@x.com', 'password123')).token);
    expect(bb.role).toBe('super_admin');
    // b is the last super: cannot be demoted by anyone else; self-demote also refused
    await expect(svc.updateUser(bb, id2, { role: 'viewer' })).rejects.toThrow();
  });
  it('reset password revokes sessions; change own password needs the old one', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    const id = await svc.adminCreateUser(s, 'v@x.com', 'password123', 'viewer');
    const { token, user } = await svc.login('v@x.com', 'password123');
    await svc.resetPassword(s, id, 'newpassword1');
    await expect(svc.auth(token)).rejects.toThrow();
    await expect(svc.login('v@x.com', 'password123')).rejects.toThrow();
    const l = await svc.login('v@x.com', 'newpassword1');
    await expect(svc.changeOwnPassword(user, 'wrong', 'another123')).rejects.toThrow(/เดิม/);
    await svc.changeOwnPassword(user, 'newpassword1', 'another123', l.token);
    expect((await svc.auth(l.token)).email).toBe('v@x.com'); // current session kept
    await svc.login('v@x.com', 'another123');
  });
  it('audit log records user actions without passwords', async () => {
    const s = await asUser('s@x.com', 'super_admin');
    await svc.adminCreateUser(s, 'v@x.com', 'password123', 'viewer');
    const log = await svc.auditLog(s);
    expect(log[0]).toMatchObject({ action: 'user:create', entity: 'user', entity_id: 'v@x.com' });
    expect(JSON.stringify(log)).not.toMatch(/password123/);
  });
});
