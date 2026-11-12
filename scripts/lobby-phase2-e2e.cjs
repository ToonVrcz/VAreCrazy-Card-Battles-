// Local-only browser check of Phase 2 screens (Profile, Match History, Purchase History). Never touches production.
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const PORT = process.env.PORT || 8796, BASE = `http://127.0.0.1:${PORT}`; const out = [];
const ok = (n, p, i = '') => { out.push(!!p); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const srv = spawn('npx', ['tsx', 'scripts/playtest-server.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /READY/.test(String(d)) && res()); srv.on('exit', c => rej(new Error('exit ' + c))); setTimeout(() => rej(new Error('timeout')), 90000); });
  const b = await chromium.launch(), errs = [];
  try {
    const ctx = await b.newContext({ ...devices['Pixel 5'] }); await ctx.addInitScript(() => { try { localStorage.setItem('vcz_guide', '1'); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + '/play'); await p.waitForSelector('#lb'); await p.waitForTimeout(600);
    await p.click('[data-nav=more]'); ok('more lists 3 live items', (await p.locator('[data-lv]').count()) === 3);
    await p.click('[data-lv="0"]'); await p.waitForSelector('#pnm');
    ok('profile shows guest warning + Universe soon', /แขก/.test(await p.innerText('#md')) && /Universe/.test(await p.innerText('#md')));
    await p.fill('#pnm', '  ตูน   ทดสอบ '); await p.click('#psv'); await p.waitForSelector('#pnm'); await p.waitForTimeout(300);
    ok('rename saved', (await p.innerText('#md')).includes('บันทึกชื่อแล้ว') && (await p.inputValue('#pnm')) === 'ตูน ทดสอบ');
    await p.click('[data-nav=home]'); await p.waitForSelector('#lb'); ok('dashboard shows new name', (await p.innerText('#md')).includes('ตูน ทดสอบ'));
    await p.click('[data-nav=more]'); await p.click('[data-lv="1"]'); await p.waitForSelector('.tile, p');
    ok('empty match history explains', (await p.innerText('#md')).includes('ยังไม่มีแมตช์ PvP'));
    await p.click('[data-nav=more]'); await p.click('[data-lv="2"]'); await p.waitForTimeout(500);
    ok('ledger shows starter gift', /ของขวัญเริ่มต้น/.test(await p.innerText('#md')) && /\+500/.test(await p.innerText('#md')));
    await p.click('[data-nav=shop]'); await p.waitForSelector('[data-b]:not([disabled])'); await p.locator('[data-b]:not([disabled])').first().click(); await p.click('#sok'); await p.waitForSelector('#rcl');
    await p.click('#rsh'); await p.waitForSelector('#shph'); await p.click('#shph'); await p.waitForTimeout(500);
    const t = await p.innerText('#md'); ok('purchase appears with card name and -500', /🛒 ซื้อ\s+\S+/.test(t) && /-500/.test(t));
    ok('no horizontal overflow', (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
    ok('no JS errors', errs.length === 0, errs.join(' | ').slice(0, 200));
  } catch (e) { console.log('CRASH', e.message.split('\n')[0]); out.push(false); } finally { await b.close(); srv.kill(); }
  console.log(out.filter(Boolean).length + '/' + out.length); process.exit(out.every(Boolean) ? 0 : 1);
})();
