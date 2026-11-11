// Local server for the browser playtest (scripts/playtest-e2e.cjs). In-memory database, every seed card imported, and the same
// /play -> play.html rewrite that vercel.json does in production. Nothing here touches Supabase or any real data.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate.ts';
import { CardService } from '../src/server/service.ts';
import { makeHandler } from '../src/server/http.ts';

const db = new PGlite(); await migrateUp(db);
const svc = new CardService(db, process.env.E2E_STORAGE ?? '/tmp/vcz-e2e-storage');
await svc.createUser('e2e@local', 'e2e-password-123', 'super_admin');
const admin = (await svc.login('e2e@local', 'e2e-password-123')).user;
for (const f of ['toon-cards.json', 'support-cards.json', 'spell-cards.json', 'trap-cards.json']) await svc.importCards(admin, JSON.parse(readFileSync(`db/seed/${f}`, 'utf8')));
const handler = makeHandler(svc), port = Number(process.env.PORT ?? 8791);
createServer((req, res) => { req.url = req.url!.replace(/^\/play(?=[?#]|$)/, '/play.html'); return handler(req, res); })
  .listen(port, '127.0.0.1', () => console.log(`READY ${port}`));
