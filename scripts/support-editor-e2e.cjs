// Local-only browser check of the Signature (Spell/Trap) config editor in the Admin CMS. In-memory DB; never touches production.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const PORT = process.env.PORT || 8798, BASE = `http://127.0.0.1:${PORT}`; const out = [];
const ok = (n, p, i = '') => { out.push(!!p); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const srv = process.env.E2E_NOSPAWN ? { kill() {} } : spawn('npx', ['tsx', 'scripts/playtest-server.ts'], { env: { ...process.env, PORT: String(PORT), E2E_SIGNATURE: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  if (!process.env.E2E_NOSPAWN) await new Promise((res, rej) => { srv.stdout.on('data', d => /READY/.test(String(d)) && res()); srv.on('exit', c => rej(new Error('exit ' + c))); setTimeout(() => rej(new Error('server timeout')), 90000); });
  const br = await chromium.launch(), errs = [];
  try {
    const p = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage();
    p.on('pageerror', e => errs.push(String(e.stack || e).split('\n').slice(0, 3).join(' <- ')));
    await p.goto(BASE + '/'); await p.waitForSelector('#e');
    await p.fill('#e', 'e2e@local'); await p.fill('#p', 'e2e-password-123'); await p.click('#go');
    await p.waitForSelector('#q'); await p.fill('#q', 'SPL-011'); await p.press('#q', 'Enter'); await p.waitForSelector('.card:has-text("SPL-011")'); await p.click('.card:has-text("SPL-011")');
    await p.waitForSelector('#sup');
    ok('support panel shown for a Draft spell', /Signature/.test(await p.innerText('#sup')));
    ok('op/who/stat/amount/until controls', (await p.inputValue('#sup select[data-f=op]')) === 'buff' && (await p.inputValue('#sup input[data-f=amount]')) === '10');
    await p.fill('#sup input[data-f=amount]', '15'); await p.dispatchEvent('#sup input[data-f=amount]', 'change');
    await p.click('#supadd'); ok('add row', (await p.locator('#sup [data-i]').count()) === 2);
    await p.selectOption('#sup [data-i="1"] select[data-f=op]', 'draw'); ok('op change re-renders params (draw has no stat)', (await p.locator('#sup [data-i="1"] select[data-f=stat]').count()) === 0);
    await p.click('#supsave'); await p.waitForSelector('#sup');
    ok('saved and reloaded: amount 15 and 2 ops', (await p.inputValue('#sup input[data-f=amount]')) === '15' && (await p.locator('#sup [data-i]').count()) === 2);
    // invalid: unknown chain is rejected with a message, nothing saved
    await p.fill('#sup input[data-f=link]', 'no-such-chain'); await p.dispatchEvent('#sup input[data-f=link]', 'change');
    const [resp] = await Promise.all([p.waitForResponse(r => /\/support$/.test(r.url())), p.click('#supsave')]);
    ok('invalid chain is rejected by the server (422, Thai message)', resp.status() === 422 && /ไม่พบสาย/.test(await resp.text()), String(resp.status()));
    ok('no page errors', errs.length === 0, errs.join(' | '));
  } finally { await br.close(); srv.kill(); }
  const bad = out.filter(x => !x).length; console.log(bad ? `${bad} FAILED` : 'ALL PASS'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
