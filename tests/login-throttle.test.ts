// F-05 regression: admin login throttling (migration 018) at the HTTP/API level, plus migration order and compatibility.
import { describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { migrateUp, migrateDown } from '../db/migrate';
import { CardService, LOGIN_MAX_FAILS } from '../src/server/service';
import { dispatch } from '../src/server/api';

async function world() {
  const db = new PGlite(); await migrateUp(db);
  const svc = new CardService(db, '/tmp/vcz-test-storage'); await svc.createUser('boss@x.com', 'password123', 'super_admin');
  const login = (email: string, password: string) => dispatch(svc, { method: 'POST', path: '/api/login', query: new URLSearchParams(), headers: {}, body: async () => Buffer.from(JSON.stringify({ email, password })) });
  return { db, svc, login };
}

describe('F-05 admin login throttle over the API', () => {
  it('success -> 200 with a token; wrong password -> 401; the 6th try -> 429 even with the right password; other emails are unaffected', async () => {
    const { login, svc } = await world(); await svc.createUser('other@x.com', 'password123', 'viewer');
    expect((await login('boss@x.com', 'password123')).status).toBe(200);
    for (let i = 0; i < LOGIN_MAX_FAILS; i++) expect((await login('boss@x.com', 'nope')).status).toBe(401);
    expect((await login('boss@x.com', 'password123')).status).toBe(429);
    expect((await login('BOSS@x.com', 'password123')).status).toBe(429);                  // case-insensitive
    expect(((await login('boss@x.com', 'nope')).data as any).error).toMatch(/รอ/);
    expect((await login('other@x.com', 'password123')).status).toBe(200);
  });
  it('the lock expires after the window and a success clears the counter', async () => {
    const { login, db } = await world();
    for (let i = 0; i < LOGIN_MAX_FAILS; i++) await login('boss@x.com', 'nope');
    await db.query(`UPDATE admin_login_failures SET at = now() - interval '11 minutes'`);
    expect((await login('boss@x.com', 'password123')).status).toBe(200);
    expect((await db.query<any>(`SELECT count(*)::int n FROM admin_login_failures`)).rows[0].n).toBe(0);
  });
  it('old failures are pruned and an existing session keeps working while the login is locked', async () => {
    const { login, svc, db } = await world();
    const { token } = (await login('boss@x.com', 'password123')).data as any;
    await db.query(`INSERT INTO admin_login_failures(email, at) VALUES ('zz@x.com', now() - interval '2 days')`);
    for (let i = 0; i < LOGIN_MAX_FAILS; i++) await login('boss@x.com', 'nope');
    expect((await db.query<any>(`SELECT count(*)::int n FROM admin_login_failures WHERE email='zz@x.com'`)).rows[0].n).toBe(0);
    expect((await svc.auth(token)).email).toBe('boss@x.com');
  });
  it('if migration 018 is not applied yet, login still works (no lock-out) and the problem is logged', async () => {
    const { login, db } = await world(); await db.exec(`DROP TABLE admin_login_failures`);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await login('boss@x.com', 'nope')).status).toBe(401);
    expect((await login('boss@x.com', 'password123')).status).toBe(200);
    expect(spy).toHaveBeenCalled(); spy.mockRestore();
  });
});

describe('migration order and compatibility (018, 019)', () => {
  it('018 sorts before 019 and files are paired up/down', () => {
    const up = readdirSync('db/migrations').filter(f => f.endsWith('.up.sql')).sort(), down = readdirSync('db/migrations').filter(f => f.endsWith('.down.sql')).sort();
    expect(up.map(f => f.replace('.up.sql', ''))).toEqual(down.map(f => f.replace('.down.sql', '')));
    expect(up.indexOf('018_login_attempts.up.sql')).toBeGreaterThan(up.indexOf('017_room_lobby.up.sql'));
    expect(up.indexOf('018_login_attempts.up.sql')).toBeLessThan(up.indexOf('019_effect_config.up.sql'));
  });
  it('a database that is at 017 (production today) upgrades to 019 in order with data kept', async () => {
    const db = new PGlite(); await migrateUp(db);
    await db.exec(`DROP TABLE admin_login_failures; ALTER TABLE card_effects DROP COLUMN config; DELETE FROM schema_migrations WHERE name IN ('018_login_attempts.up.sql','019_effect_config.up.sql')`);
    const svc = new CardService(db, '/tmp/vcz-test-storage'); await svc.createUser('boss@x.com', 'password123', 'super_admin');
    await migrateUp(db);
    expect((await db.query<any>(`SELECT name FROM schema_migrations WHERE name >= '018' AND name < '020' ORDER BY name`)).rows.map(r => r.name)).toEqual(['018_login_attempts.up.sql', '019_effect_config.up.sql']);
    expect((await svc.login('boss@x.com', 'password123')).user.email).toBe('boss@x.com');
  });
  it('018 and 019 are individually reversible', async () => {
    const db = new PGlite(); await migrateUp(db);
    await db.exec(readFileSync('db/migrations/019_effect_config.down.sql', 'utf8')); await db.exec(readFileSync('db/migrations/018_login_attempts.down.sql', 'utf8'));
    expect((await db.query<any>(`SELECT to_regclass('admin_login_failures') t`)).rows[0].t).toBeNull();
    await db.exec(readFileSync('db/migrations/018_login_attempts.up.sql', 'utf8')); await db.exec(readFileSync('db/migrations/019_effect_config.up.sql', 'utf8'));
    expect((await db.query<any>(`SELECT to_regclass('admin_login_failures') t`)).rows[0].t).not.toBeNull();
  });
});
