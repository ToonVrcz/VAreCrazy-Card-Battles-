import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

const dir = join(import.meta.dirname, 'migrations');
const files = (suffix: 'up' | 'down') =>
  readdirSync(dir).filter(f => f.endsWith(`.${suffix}.sql`)).sort();

export async function migrateUp(db: PGlite) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, at timestamptz DEFAULT now())`);
  for (const f of files('up')) {
    const done = await db.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
    if (done.rows.length) continue;
    await db.exec(readFileSync(join(dir, f), 'utf8'));
    await db.query('INSERT INTO schema_migrations(name) VALUES($1)', [f]);
  }
}

export async function migrateDown(db: PGlite) {
  for (const f of files('down').reverse()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
    await db.query('DELETE FROM schema_migrations WHERE name=$1', [f.replace('.down.', '.up.')]);
  }
}
