import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../../db/migrate.ts';
import { CardService, AppError } from './service.ts';
import { dispatch } from './api.ts';

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

export function makeHandler(svc: CardService, root = process.cwd()) {
  const body = (req: IncomingMessage) => new Promise<Buffer>((res, rej) => {
    const ch: Buffer[] = []; let n = 0;
    req.on('data', d => { n += d.length; if (n > 8 * 1024 * 1024) { rej(new AppError(413, 'ข้อมูลใหญ่เกินไป')); req.destroy(); } else ch.push(d); });
    req.on('end', () => res(Buffer.concat(ch))); req.on('error', rej);
  });
  const send = (r: ServerResponse, code: number, data: unknown, type = 'application/json') => {
    r.writeHead(code, { 'content-type': type, 'x-content-type-options': 'nosniff' });
    r.end(type === 'application/json' ? JSON.stringify(data) : (data as any));
  };
  const file = (r: ServerResponse, base: string, rel: string) => {
    const p = normalize(join(base, rel));
    if (!p.startsWith(normalize(base)) || !existsSync(p) || !statSync(p).isFile()) return send(r, 404, { error: 'ไม่พบไฟล์' });
    send(r, 200, readFileSync(p), MIME[extname(p)] ?? 'application/octet-stream');
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, 'http://x'); const path = url.pathname; const m = req.method!;
    try {
      if (path.startsWith('/media/')) return file(res, svc.storageDir, path.slice(7));
      if (path.startsWith('/assets/')) return file(res, join(root, 'assets'), path.slice(8));
      if (!path.startsWith('/api/')) return file(res, join(root, 'public'), path === '/' ? 'admin.html' : path.slice(1));

      const out = await dispatch(svc, { method: m, path, query: url.searchParams, headers: req.headers as any, body: () => body(req) });
      return send(res, out.status, out.data, out.type);
    } catch (e: any) {
      if (e instanceof AppError) return send(res, e.code, { error: e.message });
      if (e instanceof SyntaxError) return send(res, 400, { error: 'JSON ไม่ถูกต้อง' });
      console.error(e); send(res, 500, { error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
    }
  };
}

// ---- local dev entrypoint ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = new PGlite(process.env.DB_DIR ?? './data');
  await migrateUp(db);
  const svc = new CardService(db, './storage');
  const empty = (await db.query<any>(`SELECT count(*)::int c FROM admin_users`)).rows[0].c === 0;
  if (empty) {
    await svc.createUser('admin@local', process.env.ADMIN_PASSWORD ?? 'admin12345', 'super_admin');
    if (process.env.SEED !== '0') {
      const admin = (await svc.login('admin@local', process.env.ADMIN_PASSWORD ?? 'admin12345')).user;
      const r = await svc.importCards(admin, JSON.parse(readFileSync('./db/seed/toon-cards.json', 'utf8')));
      console.log(r.ok ? `นำเข้าการ์ดตัวอย่าง ${r.created} ใบ (Draft)` : `นำเข้าไม่สำเร็จ: ${JSON.stringify(r.errors.slice(0, 3))}`);
    }
    console.log('สร้างผู้ดูแลเริ่มต้น admin@local (เปลี่ยนรหัสผ่านก่อนใช้งานจริง)');
  }
  const port = Number(process.env.PORT ?? 8787);
  createServer(makeHandler(svc)).listen(port, '127.0.0.1', () => console.log(`Admin CMS: http://127.0.0.1:${port}`));
}
