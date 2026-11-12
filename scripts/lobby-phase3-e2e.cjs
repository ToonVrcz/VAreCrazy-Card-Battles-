// Local-only browser check of Phase 3 room system (create form, public list, ready/start, spectator, kick). Never touches production.
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const PORT = process.env.PORT || 8797, BASE = `http://127.0.0.1:${PORT}`; const out = [];
const ok = (n, p, i = '') => { out.push(!!p); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const srv = spawn('npx', ['tsx', 'scripts/playtest-server.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /READY/.test(String(d)) && res()); srv.on('exit', c => rej(new Error('exit ' + c))); setTimeout(() => rej(new Error('timeout')), 90000); });
  const br = await chromium.launch(), errs = [];
  const mk = async n => { const c = await br.newContext({ ...devices['Pixel 5'] }); await c.addInitScript(() => { try { localStorage.setItem('vcz_guide', '1'); } catch (e) {} }); const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ':' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|40[0-9]/.test(m.text())) errs.push(n + ':' + m.text()); }); p.on('dialog', d => d.accept()); await p.goto(BASE + '/play'); await p.waitForSelector('#lb'); return p; };
  try {
    const a = await mk('host'), b = await mk('guest'), s = await mk('spec');
    await a.click('#lc'); await a.waitForSelector('#rgo');
    ok('create form has name / public / timer', (await a.locator('#rnm,#rpb,#rtm').count()) === 3);
    await a.fill('#rnm', 'ห้องทดสอบ'); await a.check('#rpb'); await a.selectOption('#rtm', '60'); await a.click('#rgo'); await a.waitForSelector('.box.wait');
    const code = (await a.locator('.box.wait div').first().innerText()).trim(); ok('room code shown', /^[A-Z0-9]{5}$/.test(code), code);
    ok('lobby shows name + public + 60s + guide', (t => /ห้องทดสอบ/.test(t) && /สาธารณะ/.test(t) && /60/.test(t) && /ขั้นตอน/.test(t))(await a.innerText('#md')));
    ok('start disabled with no guest', await a.locator('#rst').isDisabled());
    await b.click('#lrl'); await b.waitForSelector('[data-jn]'); ok('public list shows the room', (await b.innerText('#md')).includes('ห้องทดสอบ'));
    await b.click('[data-jn]'); await b.waitForSelector('#rrd');
    await a.waitForFunction(() => /ยังไม่พร้อม/.test(document.querySelector('#md').innerText), null, { timeout: 15000 });
    ok('host sees guest not ready, start still disabled', await a.locator('#rst').isDisabled());
    await b.click('#rrd'); await a.waitForSelector('#rst:not([disabled])', { timeout: 15000 }); ok('guest ready enables Start', true);
    // spectator joins lobby
    await s.click('#lrl'); await s.waitForSelector('[data-wt]'); await s.click('[data-wt]'); await s.waitForTimeout(2500);
    ok('spectator sees room lobby without ready/start', (await s.locator('#rst,#rrd').count()) === 0 && /ผู้ชม/.test(await s.innerText('#md')));
    await a.click('#rst'); await a.waitForSelector('#nx', { timeout: 20000 }); await b.waitForSelector('#nx', { timeout: 20000 });
    await s.waitForSelector('#app', { timeout: 20000 }); await s.waitForFunction(() => document.querySelector('#app') && /ผู้ชม/.test(document.querySelector('#app').innerText), null, { timeout: 20000 });
    ok('spectator sees board, end-turn disabled, hands face-down', (await s.locator('#nx').isDisabled()) && (await s.locator('.hand img[src*="card-back"]').count()) > 0);
    // host kicks guest? game started -> expect resign flow instead; guest leaves via resign
    await b.click('#lv'); await a.waitForSelector('#again', { timeout: 20000 }); ok('resign ends game for host', true);
    await s.waitForSelector('.box', { timeout: 20000 }); ok('spectator sees game over', /จบเกม/.test(await s.innerText('body')));
    ok('no JS errors', errs.length === 0, errs.join(' | ').slice(0, 300));
    // kick flow
    const k1 = await mk('h2'), k2 = await mk('g2');
    await k1.click('#lc'); await k1.click('#rgo'); await k1.waitForSelector('.box.wait'); const c2 = (await k1.locator('.box.wait div').first().innerText()).trim();
    await k2.goto(`${BASE}/play?join=${c2}`); await k2.waitForSelector('#rrd'); await k1.waitForSelector('#rkk', { timeout: 15000 }); await k1.click('#rkk');
    await k2.waitForSelector('#lb', { timeout: 15000 }); ok('kicked guest returns to the lobby with a message', /ถูกเชิญออก/.test(await k2.innerText('body')));
    ok('no horizontal overflow', (await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  } catch (e) { console.log('CRASH', e.message.split('\n')[0]); out.push(false); } finally { await br.close(); srv.kill(); }
  console.log(out.filter(Boolean).length + '/' + out.length); process.exit(out.every(Boolean) ? 0 : 1);
})();
