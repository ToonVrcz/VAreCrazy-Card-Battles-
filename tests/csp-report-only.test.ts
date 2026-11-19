// Phase 1 Remediation: a Content-Security-Policy in REPORT-ONLY mode (nothing is blocked). Enforce mode is deliberately not enabled.
// The browser check loads the real game and admin with the exact vercel.json policy and records every securitypolicyviolation.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { makeHandler } from '../src/server/http';
vi.setConfig({ testTimeout: 60000 });

const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const hdrs: { key: string; value: string }[] = cfg.headers.flatMap((h: any) => h.headers);
const policy = hdrs.find(h => h.key === 'Content-Security-Policy-Report-Only')?.value ?? '';

describe('vercel.json CSP', () => {
  it('is Report-Only and there is no enforcing Content-Security-Policy header', () => {
    expect(policy).not.toBe('');
    expect(hdrs.some(h => h.key.toLowerCase() === 'content-security-policy')).toBe(false);
  });
  it('contains the baseline directives', () => {
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "connect-src 'self'"]) expect(policy).toContain(d);
  });
  it('allows no external origin', () => { expect(policy).not.toMatch(/https?:|\*/); });
});

let chromium: any = null;
try { chromium = createRequire(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/')('playwright').chromium; } catch { /* not installed */ }
const CHROME = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
const can = !!chromium && !!CHROME;

describe.skipIf(!can)('no CSP violations in the game or Admin (browser)', () => {
  let srv: Server, base = '', browser: any;
  beforeAll(async () => {
    const db = new PGlite(); await migrateUp(db);
    const svc = new CardService(db, '/tmp/vcz-csp-storage'); await svc.createUser('csp@local', 'csp-password-123', 'super_admin');
    const h = makeHandler(svc);
    srv = createServer((req, res) => { req.url = req.url!.replace(/^\/play(?=[?#]|$)/, '/play.html'); return h(req, res); });
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', () => r())); base = `http://127.0.0.1:${(srv.address() as any).port}`;
    browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  }, 120000);
  afterAll(async () => { await browser?.close(); srv?.close(); });

  async function visit(path: string, act: (p: any) => Promise<void>) {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); const v: string[] = [];
    await ctx.route('**/*', async (r: any) => { const resp = await r.fetch(); await r.fulfill({ response: resp, headers: { ...resp.headers(), 'content-security-policy-report-only': policy } }); });
    await page.addInitScript(() => { (window as any).__v = []; document.addEventListener('securitypolicyviolation', e => (window as any).__v.push(e.violatedDirective + ' ' + e.blockedURI), true); });
    await page.goto(base + path); await act(page); await page.waitForTimeout(500);
    v.push(...await page.evaluate(() => (window as any).__v)); await ctx.close(); return v;
  }
  it('play: lobby, shop, collection, bot game start', async () => {
    const v = await visit('/play', async p => {
      await p.waitForFunction(() => typeof (window as any).lobby === 'function');
      await p.evaluate(async () => { await shop(40); collection('e40'); lobby(); start(); });
    });
    expect(v).toEqual([]);
  });
  it('admin: login and card list', async () => {
    const v = await visit('/', async p => { await p.fill('#e', 'csp@local'); await p.fill('#p', 'csp-password-123'); await p.click('#go'); await p.waitForSelector('#lo', { timeout: 20000 }); });
    expect(v).toEqual([]);
  });
});
