// Phase 1 Remediation: migrations 022/023 lock profile_create_log and admin_login_failures against anon/authenticated (Supabase Data API),
// while the owner / BYPASSRLS roles used by the edge function keep working. Roles and default grants mimic Supabase.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp, migrateDown } from '../db/migrate';

const TABLES = ['profile_create_log', 'admin_login_failures'];
const INS: Record<string, string> = { profile_create_log: `INSERT INTO profile_create_log(ip_hash) VALUES('h')`, admin_login_failures: `INSERT INTO admin_login_failures(email) VALUES('a@b.c')` };
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;`);
  await migrateUp(db);
}, 60000);

describe.each(TABLES)('%s', t => {
  it('has RLS enabled and no policies', async () => {
    const r = (await db.query<any>(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.${t}'::regclass`)).rows[0];
    expect(r.relrowsecurity).toBe(true);
    expect((await db.query<any>(`SELECT count(*)::int n FROM pg_policies WHERE tablename = $1`, [t])).rows[0].n).toBe(0);
  });
  it.each(['anon', 'authenticated'])('%s has no privileges and cannot read or write', async role => {
    for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) expect((await db.query<any>(`SELECT has_table_privilege('${role}', 'public.${t}', '${p}') ok`)).rows[0].ok, `${role} ${p}`).toBe(false);
    expect((await db.query<any>(`SELECT has_sequence_privilege('${role}', 'public.${t}_id_seq', 'USAGE') ok`)).rows[0].ok).toBe(false);
    await db.exec(`SET ROLE ${role}`);
    try {
      await expect(db.query(`SELECT * FROM ${t}`)).rejects.toThrow(/permission denied/);
      await expect(db.query(INS[t])).rejects.toThrow(/permission denied/);
    } finally { await db.exec('RESET ROLE'); }
  });
  it('the owner (edge function / server) and the BYPASSRLS service role still read and write', async () => {
    await db.query(INS[t]);   // owner
    expect((await db.query<any>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n).toBeGreaterThan(0);
    await db.exec(`GRANT ALL ON ${t} TO service_role; GRANT ALL ON SEQUENCE ${t}_id_seq TO service_role; SET ROLE service_role`);   // service_role keeps its grant; RLS is bypassed
    try { await db.query(INS[t]); expect((await db.query<any>(`SELECT count(*)::int n FROM ${t}`)).rows[0].n).toBeGreaterThan(1); } finally { await db.exec('RESET ROLE'); }
  });
});

describe('without Supabase roles (plain Postgres / PGlite) and down scripts', () => {
  it('migrates cleanly with no anon/authenticated roles', async () => {
    const plain = new PGlite(); await migrateUp(plain);
    for (const t of TABLES) expect((await plain.query<any>(`SELECT relrowsecurity FROM pg_class WHERE oid='public.${t}'::regclass`)).rows[0].relrowsecurity).toBe(true);
    await migrateDown(plain);
    expect((await plain.query<any>(`SELECT to_regclass('public.profile_create_log') t`)).rows[0].t).toBeNull();
  });
  it('022/023 are no-ops when the base table is absent', async () => {
    const d = new PGlite(); await d.exec(`CREATE TABLE schema_migrations(name text PRIMARY KEY)`);
    const { readFileSync } = await import('node:fs');
    for (const f of ['022_profile_create_log_rls', '023_admin_login_failures_rls']) await d.exec(readFileSync(new URL(`../db/migrations/${f}.up.sql`, import.meta.url), 'utf8'));
  });
});
