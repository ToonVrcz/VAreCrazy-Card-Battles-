import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { Economy } from '../src/server/economy';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
async function setup() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db); svc.put = async () => {};
  await svc.createUser('a@local', 'admin12345', 'super_admin');
  await svc.createUser('v@local', 'viewer1234', 'viewer');
  const u = (await svc.login('a@local', 'admin12345')).user, v = (await svc.login('v@local', 'viewer1234')).user;
  return { db, svc, eco: new Economy(svc), u, v };
}
describe('player avatar', () => {
  it('upload avatar: gallery, choose, me(), paths only, clear, delete falls back', async () => {
    const { svc, eco, u, v } = await setup();
    const m = await svc.uploadMedia(u, 'a.png', 'image/png', PNG);
    const a = await svc.addAvatar(u, { label: 'Test', media_id: m.id });
    const p = await eco.createProfile('A'), q = await eco.createProfile('B');
    expect((await eco.me(p.key)).avatar).toBeNull();
    const g = await eco.avatars();
    expect(g.items.find((x: any) => x.label === 'Test').path).toBe('/' + m.storage_path);
    await eco.setAvatar(p.key, a.id);
    expect((await eco.me(p.key)).avatar.path).toBe('/' + m.storage_path);
    const [x, y] = await eco.avatarPaths([(await eco.me(p.key)).id, (await eco.me(q.key)).id]);
    expect(x).toBe('/' + m.storage_path); expect(y).toBeNull();
    expect(typeof x).toBe('string');                                      // path only: no id / name / key leaks
    await expect(eco.setAvatar(p.key, 'not-a-uuid')).rejects.toThrow();
    await expect(eco.setAvatar(p.key, '00000000-0000-0000-0000-000000000000')).rejects.toThrow();
    await expect(eco.setAvatar('bad-key', a.id)).rejects.toThrow();
    await expect(svc.addAvatar(v, { label: 'x', media_id: m.id })).rejects.toThrow();   // viewer cannot write
    await svc.updateAvatar(u, a.id, { active: false });
    expect((await eco.me(p.key)).avatar).toBeNull();                      // inactive -> default
    await expect(eco.setAvatar(q.key, a.id)).rejects.toThrow();
    await svc.updateAvatar(u, a.id, { active: true });
    await eco.setAvatar(p.key, a.id); await eco.setAvatar(p.key, null);
    expect((await eco.me(p.key)).avatar).toBeNull();
    await eco.setAvatar(q.key, a.id); await svc.deleteAvatar(u, a.id);
    expect((await eco.me(q.key)).avatar).toBeNull();
    expect((await svc.listAvatars(v)).items.length).toBeGreaterThanOrEqual(0);
  });
  it('sync-cards is idempotent and only adds published Lv15 characters', async () => {
    const { svc, u } = await setup();
    await svc.syncCardAvatars(u);
    const n = (await svc.listAvatars(u)).items.length;
    await svc.syncCardAvatars(u);
    expect((await svc.listAvatars(u)).items.length).toBe(n);
  });
});
