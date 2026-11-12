// Browser playtest against a LOCAL server (scripts/playtest-server.ts, in-memory DB). Never touches production.
//   node scripts/playtest-e2e.cjs            (needs the `playwright` package + Chromium, preinstalled in the Claude Code cloud image)
// Covers: bot games to the end (5 in parallel), mobile-viewport EMULATION (not real devices), character-ability notice,
// back-to-lobby button, optional Google Form button, and PvP with two browser contexts incl. resume after refresh.
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const PORT = process.env.PORT || 8791, BASE = `http://127.0.0.1:${PORT}`, BOT_GAMES = +(process.env.BOT_GAMES || 5);
const SHOTS = process.env.SHOTS_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'vcz-shots-'));
const results = [], errors = []; let expectStale = false;
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

function watch(page, tag) {
  page.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text()) && !(expectStale && /403/.test(m.text()))) errors.push(`${tag} console: ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url()) && !(expectStale && /\/rooms\/[A-Z0-9]{5}\?since=-1/.test(r.url()))) errors.push(`${tag} HTTP ${r.status()} ${r.url()}`); });
}
const turnOf = async page => +((await page.locator('#app .bar').first().innerText()).match(/เทิร์น\s+(\d+)/) || [0, 0])[1];

/** Plays one game against the bot through the UI: summon, attack when possible, end turns. Returns 'finished' or 'stuck'. */
async function playBot(page, tag, maxMs = 240000) {
  await page.click('#lb');
  const t0 = Date.now(), summoned = new Set(), attacked = new Set(); let noticeChecked = false;
  while (Date.now() - t0 < maxMs) {
    if (await page.locator('#again').count()) return 'finished';
    if (await page.locator('.resp [data-r="-1"]').count()) { await page.click('.resp [data-r="-1"]'); continue; }
    const nx = page.locator('#nx');
    if (await page.locator('#cx').count()) { await page.click('#cx'); continue; }   // leave a half-finished targeting mode
    if (!(await nx.count()) || !(await nx.isEnabled())) { await page.waitForTimeout(250); continue; }
    const turn = await turnOf(page), main = /ไปเฟสต่อสู้/.test(await nx.innerText());
    if (main && !summoned.has(turn)) {
      summoned.add(turn);
      const n = await page.locator('.hand .c').count();
      for (let i = 0; i < n; i++) {
        await page.locator('.hand .c').nth(i).click();
        if (!noticeChecked) {   // first card opened: a character with abilities must list them
          const txt = await page.locator('#md .box').innerText();
          if (/•/.test(txt)) { noticeChecked = true; ok(`${tag}: character detail lists its abilities (not-yet-supported ones are marked)`, /⚠ ยังไม่เปิดใช้งาน/.test(txt) || /เมื่อ|ตอน|ทุก/.test(txt)); }
        }
        const b = page.locator('#md button', { hasText: 'เรียก' });
        if (await b.count()) { await b.first().click(); break; }
        await page.click('#cl');
      }
      if (await page.locator('#md.on').count()) await page.click('#cl').catch(() => {});
    }
    if (!main && !attacked.has(turn)) {
      attacked.add(turn);
      const units = page.locator('[data-z="f"][data-s="0"][data-uid]');
      for (let i = 0; i < await units.count(); i++) {
        await units.nth(i).click();
        const a = page.locator('#md button', { hasText: 'โจมตี' });
        if (await a.count()) {
          await a.first().click();
          const tgt = page.locator('.c.tg, .lp.tg').first();
          if (await tgt.count()) await tgt.click(); else if (await page.locator('#cx').count()) await page.click('#cx');
          await page.waitForTimeout(150); break;
        }
        await page.click('#cl').catch(() => {});
      }
    }
    if (await nx.isEnabled()) await nx.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  return 'stuck';
}

(async () => {
  const srv = spawn('npx', ['tsx', 'scripts/playtest-server.ts'], { env: { ...process.env, PORT }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /READY/.test(String(d)) && res()); srv.on('exit', c => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server start timeout')), 90000); });
  const browser = await chromium.launch();
  try {
    // ---- 0. new in-game views: graveyard of both sides, Evolution pile with card detail ----
    { const ctx = await browser.newContext(), p = await ctx.newPage(); watch(p, 'views'); await p.goto(BASE + '/play'); await p.waitForSelector('#lb'); await p.click('#lb'); await p.waitForSelector('#nx');
      for (const side of ['0', '1']) {
        await p.click(`[data-g="${side}"]`); await p.waitForSelector('#gx');
        ok(`graveyard button opens the ${side === '0' ? 'own' : 'opponent'} graveyard`, /สุสาน/.test(await p.locator('#md .box').innerText()));
        await p.click('#gx'); }
      if (await p.locator('#exb').count()) {
        await p.click('#exb'); await p.waitForSelector('#exc');
        const n = await p.locator('[data-ei]').count();
        if (n === 0) ok('Evolution pile says so when it is empty (nothing bought yet)', /ยังไม่มีการ์ดในเด็คอีโว/.test(await p.locator('#md .box').innerText()));
        else { await p.locator('[data-ei]').first().click(); await p.waitForSelector('#cl'); await p.click('#cl');
          ok('Evolution pile: tapping a card opens Card Detail and closing returns to the pile', await p.locator('#exc').count() === 1, n + ' cards'); } }
      await ctx.close(); }
    // ---- 1. lobby, feedback button hidden without a URL, shown (1 click) when one is configured ----
    { const ctx = await browser.newContext(), p = await ctx.newPage(); watch(p, 'lobby'); await p.goto(BASE + '/play'); await p.waitForSelector('#lb');
      ok('desktop: /play shows the lobby (not blank)', /VAreCrazy Card Battle/.test(await p.locator('#md').innerText()));
      ok('feedback button hidden while FEEDBACK_URL is empty', !(await p.locator('a.bl').count()));
      await ctx.close(); }
    { const ctx = await browser.newContext(), p = await ctx.newPage(); watch(p, 'feedback');
      await p.route(/\/play(\.html)?(\?.*)?$/, async r => { const resp = await r.fetch(); await r.fulfill({ response: resp, body: (await resp.text()).replace("const FEEDBACK_URL='';", "const FEEDBACK_URL='https://forms.example.test/vcz';") }); });
      await p.goto(BASE + '/play'); await p.waitForSelector('#lb');
      const a = p.locator('#md a.bl'); ok('feedback link in the lobby: 1 click, opens externally, noopener', (await a.count()) === 1 && (await a.getAttribute('href')) === 'https://forms.example.test/vcz' && (await a.getAttribute('target')) === '_blank' && /noopener/.test(await a.getAttribute('rel')));
      await p.click('#lb'); await p.waitForSelector('#nx'); ok('feedback link also in the game bar', (await p.locator('#app a.bl').count()) === 1);
      await ctx.close(); }

    // ---- 2. five bot games in parallel to the end ----
    { const ctxs = await Promise.all(Array.from({ length: BOT_GAMES }, () => browser.newContext({ viewport: { width: 420, height: 900 } })));
      const outs = await Promise.all(ctxs.map(async (c, i) => { const p = await c.newPage(); watch(p, `bot${i + 1}`); await p.goto(BASE + '/play'); await p.waitForSelector('#lb'); const r = await playBot(p, `bot${i + 1}`);
        let again = null; if (r === 'finished') { again = await p.locator('#again').innerText(); }
        return { r, again, p }; }));
      ok(`bot: ${BOT_GAMES} games played to the end without hanging`, outs.every(o => o.r === 'finished'), outs.map(o => o.r).join(','));
      ok('game-over button says "กลับหน้าหลัก"', outs.every(o => o.again === 'กลับหน้าหลัก'), outs.map(o => o.again).join(','));
      const o = outs[0]; if (o.r === 'finished') { await o.p.click('#again'); await o.p.waitForSelector('#lb'); ok('"กลับหน้าหลัก" returns to the lobby (no new game started)', (await o.p.locator('#nx').count()) === 0); }
      await Promise.all(ctxs.map(c => c.close())); }

    // ---- 3. mobile viewport EMULATION (Chromium with phone viewport/UA; NOT real iOS/Android devices) ----
    for (const name of ['Pixel 5', 'iPhone 13']) {
      const ctx = await browser.newContext({ ...devices[name] }), p = await ctx.newPage(); watch(p, name); await p.goto(BASE + '/play'); await p.waitForSelector('#lb');
      const overflow = async () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(`${name} (emulated): lobby fits the screen`, (await overflow()) <= 1, `overflow ${await overflow()}px`);
      await p.screenshot({ path: path.join(SHOTS, `${name.replace(' ', '')}-lobby.png`) });
      await p.click('#lb'); await p.waitForSelector('#nx'); await p.waitForTimeout(800);
      ok(`${name} (emulated): board fits the screen`, (await overflow()) <= 1, `overflow ${await overflow()}px`);
      await p.screenshot({ path: path.join(SHOTS, `${name.replace(' ', '')}-board.png`) });
      await ctx.close();
    }

    // ---- 4. PvP with two contexts: create, join by link, refresh mid-game (resume), surrender, no re-entry ----
    { const ca = await browser.newContext({ viewport: { width: 420, height: 900 } }), cb = await browser.newContext({ viewport: { width: 420, height: 900 } });
      const a = await ca.newPage(), b = await cb.newPage(); watch(a, 'pvpA'); watch(b, 'pvpB'); b.on('dialog', d => d.accept()); a.on('dialog', d => d.accept());
      await a.goto(BASE + '/play'); await a.waitForSelector('#lc'); await a.click('#lc'); await a.waitForSelector('.box.wait');
      const code = (await a.locator('.box.wait div').first().innerText()).trim(); ok('PvP: creator gets a 5-letter room code', /^[A-Z0-9]{5}$/.test(code), code);
      // creator refreshes while waiting -> back in the waiting room
      await a.reload(); await a.waitForSelector('.box.wait'); ok('PvP: refresh while waiting returns to the same waiting room', (await a.locator('.box.wait div').first().innerText()).trim() === code);
      await b.goto(`${BASE}/play?join=${code}`); await a.waitForSelector('#nx', { timeout: 20000 }); await b.waitForSelector('#nx', { timeout: 20000 });
      ok('PvP: invite link joins and both boards appear', true);
      // a few turns of plain end-turn
      for (let i = 0; i < 6; i++) for (const pg of [a, b]) { const nx = pg.locator('#nx'); if (await nx.isEnabled()) { await nx.click(); await pg.waitForTimeout(250); } }
      const tBefore = await turnOf(b);
      await b.reload(); await b.waitForSelector('#nx', { timeout: 20000 });
      ok('PvP: refresh mid-game resumes the same match (no lobby, same or later turn)', (await b.locator('#lb').count()) === 0 && (await turnOf(b)) >= tBefore, `turn ${tBefore} -> ${await turnOf(b)}`);
      ok('PvP: room is stored for resume while playing', !!(await b.evaluate(() => localStorage.getItem('vcz_room'))));
      await b.click('#lv'); await b.waitForSelector('#again', { timeout: 20000 }); await a.waitForSelector('#again', { timeout: 20000 });
      ok('PvP: surrender ends the match for both; button says "กลับหน้าหลัก"', (await b.locator('#again').innerText()) === 'กลับหน้าหลัก' && (await a.locator('#again').innerText()) === 'กลับหน้าหลัก');
      ok('PvP: stored room cleared after the match ends', !(await b.evaluate(() => localStorage.getItem('vcz_room'))) && !(await a.evaluate(() => localStorage.getItem('vcz_room'))));
      await b.reload(); await b.waitForSelector('#lb'); ok('PvP: refresh after the match shows the lobby (finished room is not re-entered)', (await b.locator('#nx').count()) === 0);
      // a stale/finished stored room is dropped with a message
      expectStale = true;
      await a.evaluate(c => localStorage.setItem('vcz_room', JSON.stringify({ code: c, token: 'stale', seat: 0 })), code); await a.reload(); await a.waitForSelector('#lb');
      ok('PvP: stale stored room is discarded safely', !(await a.evaluate(() => localStorage.getItem('vcz_room')))); expectStale = false;
      await ca.close(); await cb.close(); }
  } finally { await browser.close(); srv.kill(); }

  const bad = errors.filter((e, i) => errors.indexOf(e) === i);
  ok('no JavaScript errors / failed requests during the run', bad.length === 0, bad.slice(0, 5).join(' | '));
  console.log(`\nSCREENSHOTS: ${SHOTS}`);
  const failed = results.filter(r => !r.pass); console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify(results, null, 1)); process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('E2E crashed:', e); process.exit(2); });
