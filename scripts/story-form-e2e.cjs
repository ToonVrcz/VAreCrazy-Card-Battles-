// Local-only browser check of the Story form (several modifiers / Mixed) in the Admin CMS. In-memory DB; never touches production.
const { chromium } = require('playwright');
const BASE = `http://127.0.0.1:${process.env.PORT || 8798}`; const out = [];
const ok = (n, p, i = '') => { out.push(!!p); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const br = await chromium.launch(), errs = [];
  try {
    const p = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage();
    p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await p.goto(BASE + '/'); await p.fill('#e', 'e2e@local'); await p.fill('#p', 'e2e-password-123'); await p.click('#go');
    await p.waitForSelector('#q'); await p.fill('#q', 'BADGUY-015'); await p.press('#q', 'Enter'); await p.waitForSelector('.card:has-text("BADGUY-015")'); await p.click('.card:has-text("BADGUY-015")');
    await p.waitForSelector('#sladd');
    await p.click('#sladd'); await p.waitForSelector('[data-sl="0"][data-f=partner]');
    await p.selectOption('[data-sl="0"][data-f=partner]', { index: 1 });
    await p.fill('[data-sl="0"][data-f=name]', 'ทดสอบ Mixed'); await p.dispatchEvent('[data-sl="0"][data-f=name]', 'change');
    ok('new story starts Positive with one modifier', /Positive/.test(await p.innerText('#meta')) && (await p.locator('[data-sm="0"][data-f=amount]').count()) === 1);
    await p.click('[data-smadd="0"]'); await p.selectOption('[data-sm="0"][data-j="1"][data-f=stat]', 'def');
    await p.fill('[data-sm="0"][data-j="1"][data-f=amount]', '-5'); await p.dispatchEvent('[data-sm="0"][data-j="1"][data-f=amount]', 'change');
    ok('two modifiers (+5 ATK, -5 DEF) show Mixed', /Mixed/.test(await p.innerText('#meta')));
    const [resp] = await Promise.all([p.waitForResponse(r => /\/meta$/.test(r.url()) && r.request().method() === 'PUT'), p.click('#save')]);
    ok('saved (200)', resp.status() === 200, String(resp.status()));
    await p.waitForSelector('#sladd');
    ok('reloaded: still Mixed with 2 modifiers', /Mixed/.test(await p.innerText('#meta')) && (await p.locator('[data-sm="0"][data-f=amount]').count()) === 2 && (await p.inputValue('[data-sm="0"][data-j="1"][data-f=amount]')) === '-5');
    await p.click('[data-smdel="0:1"]'); ok('remove modifier -> Positive', /Positive/.test(await p.innerText('#meta')));
    ok('no page errors', errs.length === 0, errs.join(' | '));
  } finally { await br.close(); }
  const bad = out.filter(x => !x).length; console.log(bad ? `${bad} FAILED` : 'ALL PASS'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
