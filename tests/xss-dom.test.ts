// DOM-level XSS regression for play.html and admin.html. Real Chromium (Playwright) against an in-memory server (PGlite); nothing here
// touches Supabase. Skipped automatically when Playwright / Chrome are not available. Run: NODE_PATH=$(npm root -g) npx vitest run tests/xss-dom.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
vi.setConfig({ testTimeout: 60000 });
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { migrateUp } from '../db/migrate';
import { CardService } from '../src/server/service';
import { makeHandler } from '../src/server/http';

let chromium: any = null;
try { const root = execSync('npm root -g', { encoding: 'utf8' }).trim(); chromium = createRequire(root + '/')('playwright').chromium; } catch { /* not installed */ }
const CHROME = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
const can = !!chromium && !!CHROME;

// Every payload tries to run script through a different injection point. `window.__x` is set only if one of them executes.
const P = {
  tag: '<img src=x onerror="window.__x=1">',
  attr: '"><svg onload="window.__x=2">',
  quote: `' onmouseover='window.__x=3' x='`,
  script: '<script>window.__x=4</script>',
};
const ALL = Object.values(P).join('');

let srv: Server, base = '', svc: CardService, browser: any;
beforeAll(async () => {
  if (!can) return;
  const db = new PGlite(); await migrateUp(db);
  svc = new CardService(db, '/tmp/vcz-xss-dom-storage');
  await svc.createUser('xss@local', 'xss-password-123', 'super_admin');
  const admin = (await svc.login('xss@local', 'xss-password-123')).user;
  await svc.saveCard(admin, { character_id: 'XSS-1', name: ALL, card_type: 'character', level: 15, chain_key: 'xss', hp: 10, atk: 2, flavor_text: ALL, rules_text: ALL });
  const handler = makeHandler(svc);
  srv = createServer((req, res) => { req.url = req.url!.replace(/^\/play(?=[?#]|$)/, '/play.html'); return handler(req, res); });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(srv.address() as any).port}`;
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}, 120000);
afterAll(async () => { await browser?.close(); srv?.close(); });

/** Nothing executed and nothing parsed into an event-handler / script element anywhere in the document. */
async function assertClean(page: any, label: string) {
  const r = await page.evaluate(() => ({
    x: (window as any).__x,
    handlers: [...document.querySelectorAll('*')].flatMap(e => [...e.attributes].filter(a => /^on/i.test(a.name)).map(a => e.tagName + '@' + a.name)),
    scripts: [...document.querySelectorAll('script')].filter(s => /__x/.test(s.textContent || '')).length,
    injected: document.querySelectorAll('img[src="x"], svg[onload]').length,
    where: [...document.querySelectorAll('[onerror],[onload]')].map(e => (e.parentElement?.outerHTML || '').slice(0, 300)),
  }));
  const { where, ...r2 } = r as any; if (where.length) console.log(label, 'INJECTED AT', where);
  expect(r2, label).toEqual({ x: undefined, handlers: [], scripts: 0, injected: 0 });
}

describe.skipIf(!can)('play.html DOM', () => {
  async function open(routes: Record<string, any> = {}) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    page.on('dialog', (d: any) => d.dismiss());
    for (const [pat, body] of Object.entries(routes)) await page.route(pat, (r: any) => r.fulfill({ status: body.__status ?? 200, contentType: 'application/json', body: JSON.stringify(body.__status ? { error: body.error } : body) }));
    await page.goto(base + '/play'); await page.waitForFunction(() => typeof (window as any).lobby === 'function' && (0, eval)('typeof DEFS') !== 'undefined');
    return { ctx, page };
  }
  const run = async (name: string, routes: Record<string, any>, fn: string) => {
    const { ctx, page } = await open(routes);
    try { await page.evaluate(fn); await page.waitForTimeout(400); await assertClean(page, name); const html = await page.evaluate(() => document.body.innerHTML); return html; }
    finally { await ctx.close(); }
  };
  const me = { ok: true, name: ALL, points: 1, vrcoin: 1, matches: 0, inventory: {}, matchesToVrcoin: 5, rules: {} };

  it('public room list: room and host names', async () => {
    const html = await run('rooms', { '**/api/play/rooms/public': { rooms: [{ code: 'ABCDE', name: ALL, host: ALL, status: 'waiting', players: 1, spectators: 0, turnSec: 90 }] } }, 'roomList()');
    expect(html).toContain('&lt;img src=x');
  });
  it('profile screen: player name', async () => { await run('profile', { '**/api/play/me': me, '**/api/play/matches*': { total: 0, wins: 0, losses: 0, items: [] }, '**/api/play/profile': { key: 'k'.repeat(20) } }, 'profile()'); });
  it('match history: opponent / reason fields', async () => {
    await run('matches', { '**/api/play/me': me, '**/api/play/profile': { key: 'k'.repeat(20) }, '**/api/play/matches*': { total: 1, wins: 0, losses: 1, items: [{ opponent: ALL, opponentName: ALL, result: ALL, reason: ALL, turns: 7, at: new Date().toISOString(), points: 200 }] } }, 'matchHistory()');
  });
  it('purchase ledger: card name, reason, source', async () => {
    await run('ledger', { '**/api/play/me': me, '**/api/play/profile': { key: 'k'.repeat(20) }, '**/api/play/ledger*': { items: [{ id: 1, kind: ALL, reason: ALL, source: ALL, card: ALL, cardId: ALL, delta: 5, currency: 'points', balance: 5, at: new Date().toISOString() }] } }, 'purchases()');
  });
  it('server error messages shown in the UI', async () => {
    await run('errors', { '**/api/play/rooms/public': { __status: 500, error: ALL }, '**/api/play/shop': { __status: 500, error: ALL } }, 'roomList()');
    await run('errors2', { '**/api/play/me': me, '**/api/play/profile': { key: 'k'.repeat(20) }, '**/api/play/shop': { __status: 500, error: ALL } }, 'shop(40)');
  });
  it('card name / text / flavor / image on card detail, collection and shop', async () => {
    await run('detail', { '**/api/play/me': me, '**/api/play/profile': { key: 'k'.repeat(20) } }, `(()=>{const id=DEFS.find(d=>d.type==='character'&&d.level===40).id;const d=BY[id];Object.assign(d,{name:${JSON.stringify(ALL)},text:${JSON.stringify(ALL)},flavor:${JSON.stringify(ALL)},img:${JSON.stringify('x" onerror="window.__x=5')},chainName:${JSON.stringify(ALL)}});detail({id},'col',0);})()`);
    await run('collection', { '**/api/play/me': me, '**/api/play/profile': { key: 'k'.repeat(20) } }, `(()=>{for(const d of DEFS.slice(0,60))Object.assign(d,{name:${JSON.stringify(ALL)},img:${JSON.stringify('x" onerror="window.__x=6')}});collection('e40')})()`);
  });
  it('imported deck code (VCZD1.) with a hostile deck name', async () => {
    const code = 'VCZD1.' + Buffer.from(JSON.stringify({ n: ALL, c: [], e: [] })).toString('base64');
    await run('deckcode', { '**/api/play/me': me, '**/api/play/profile': { key: 'k'.repeat(20) } }, `(()=>{const d=decodeDeck(${JSON.stringify(code)});if(d){DS.list.push({id:'zz',...d});DS.active='zz';}deckList();})()`);
  });
  it('online room state: deck name, player names, event log', async () => {
    await run('online', { '**/api/play/me': me, '**/api/play/profile': { key: 'k'.repeat(20) } }, `(()=>{ON={code:'ABCDE',token:'t',seat:0,deckName:${JSON.stringify(ALL)},room:{name:${JSON.stringify(ALL)},isPublic:true,turnSec:90,ready:[true,true],players:[{name:${JSON.stringify(ALL)},here:true},{name:${JSON.stringify(ALL)},here:true}]}};roomLobby();})()`);
  });
});

describe.skipIf(!can)('admin.html DOM', () => {
  it('card list / editor render hostile card data inertly', async () => {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); page.on('dialog', (d: any) => d.dismiss());
    try {
      await page.goto(base + '/'); await page.fill('#e', 'xss@local'); await page.fill('#p', 'xss-password-123'); await page.click('#go');
      await page.waitForSelector('#lo', { timeout: 20000 }); await page.waitForTimeout(800);
      await assertClean(page, 'admin card list');
      const shown = await page.evaluate(() => document.body.textContent!.includes('<img src=x'));
      expect(shown).toBe(true);   // the hostile name is visible as text
      const card = page.locator('.card').first(); if (await card.count()) { await card.click(); await page.waitForTimeout(600); await assertClean(page, 'admin editor'); }
    } finally { await ctx.close(); }
  });
});
