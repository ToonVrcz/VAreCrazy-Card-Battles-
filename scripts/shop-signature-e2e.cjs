// Local-only check: the shop shows a Signature tab with the Signature Spell/Trap cards and they can be bought.
// Run: E2E_SIGNATURE=1 PORT=8798 npx tsx scripts/playtest-server.ts  (background), then E2E_NOSPAWN=1 PORT=8798 node scripts/shop-signature-e2e.cjs
const { chromium, devices } = require('playwright');
const BASE = `http://127.0.0.1:${process.env.PORT || 8798}`; const out = []; const ok = (n, p, i = '') => { out.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/play'); await p.waitForSelector('#md.on');
    await p.click('#gnx'); await p.click('#gnx'); await p.click('#gnx'); await p.click('#gsk'); await p.waitForSelector('#lb');
    await p.waitForTimeout(800);
    ok('random deck never holds unowned Signature cards', await p.evaluate(() => { for (let i = 0; i < 30; i++) if (deck().some(c => c.support)) return false; return true; }));
    await p.click('[data-nav=shop]'); await p.waitForSelector('[data-l]');
    ok('Signature tab exists', (await p.locator('[data-l=sig]').count()) === 1);
    await p.click('[data-l=sig]'); await p.waitForTimeout(300);
    const n = await p.locator('[data-b]').count(); ok('Signature cards listed', n >= 39, 'buttons=' + n);
    ok('price 300', /300/.test(await p.locator('[data-b]').first().innerText()));
    await p.locator('[data-b]').first().click(); await p.waitForSelector('#sok');
    ok('confirm says Signature', /Signature/.test(await p.innerText('#md')));
    await p.click('#sok'); await p.waitForSelector('#rsh');
    ok('bought', /ซื้อสำเร็จ/.test(await p.innerText('#md')));
    await p.click('#rsh'); await p.waitForSelector('[data-b]');
    ok('back on Signature tab with owned 1/3', /มีแล้ว 1\//.test(await p.innerText('#md')));
    ok('no page errors', errs.length === 0, errs.join('|'));
  } finally { await b.close(); }
  process.exit(out.every(Boolean) ? 0 : 1);
})();
