import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';

describe('card frames', () => {
  it('sets, lists, replaces, deletes; validates scope and permission', async () => {
    const db = new PGlite(); await migrateUp(db);
    const svc = new CardService(db); svc.put = async () => {};
    await svc.createUser('a@local', 'admin12345', 'super_admin');
    await svc.createUser('v@local', 'viewer1234', 'viewer');
    const u = (await svc.login('a@local', 'admin12345')).user, v = (await svc.login('v@local', 'viewer1234')).user;
    const m1 = await svc.uploadMedia(u, 'f.png', 'image/png', Buffer.from('x'));
    const m2 = await svc.uploadMedia(u, 'g.png', 'image/png', Buffer.from('y'));
    await svc.setFrame(u, 'type:spell', m1.id);
    await svc.setFrame(u, 'card:BIO-001', m1.id);
    await svc.setFrame(u, 'type:spell', m2.id);
    const l = await svc.listFrames(v);
    expect(l.length).toBe(2);
    expect(l.find((f: any) => f.scope === 'type:spell').path).toBe(m2.storage_path);
    await expect(svc.setFrame(u, 'type:bogus', m1.id)).rejects.toThrow();
    await expect(svc.setFrame(v, 'type:trap', m1.id)).rejects.toThrow();
    await svc.deleteFrame(u, 'type:spell');
    expect((await svc.listFrames(u)).length).toBe(1);
  });
});
