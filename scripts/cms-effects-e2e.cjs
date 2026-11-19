// Local-only browser check of the Registry-driven Effect editor in the Admin CMS. In-memory DB; never touches production.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const PORT = process.env.PORT || 8799, BASE = `http://127.0.0.1:${PORT}`; const out = [];
const ok = (n, p, i = '') => { out.push(!!p); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const srv = spawn('npx', ['tsx', 'scripts/playtest-server.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /READY/.test(String(d)) && res()); srv.on('exit', c => rej(new Error('exit ' + c))); setTimeout(() => rej(new Error('timeout')), 90000); });
  const br = await chromium.launch(), errs = [];
  try {
    const p = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage();
    p.on('pageerror', e => errs.push(String(e.stack || e).split('\n').slice(0, 3).join(' <- ')));
    await p.goto(BASE + '/'); await p.waitForSelector('#e');
    await p.fill('#e', 'e2e@local'); await p.fill('#p', 'e2e-password-123'); await p.click('#go');
    await p.waitForSelector('#q'); await p.fill('#q', '1GOKU-015'); await p.waitForSelector('.card'); await p.click('.card');
    await p.waitForSelector('#fx .card');
    ok('admin tools bundle loaded', await p.evaluate(() => typeof VCZX !== 'undefined'));
    ok('effect shows as Supported with A/B blocks', /Supported/.test(await p.innerText('#fx')) && /ตั้งค่าระบบ/.test(await p.innerText('#fx')) && /ข้อความที่ผู้เล่นเห็น/.test(await p.innerText('#fx')));
    ok('trigger select = on_attack, action = atk_up', (await p.inputValue('select[data-s=trigger]')) === 'on_attack' && (await p.inputValue('select[data-s=action]')) === 'atk_up');
    ok('unsupported trigger options are disabled', await p.locator('select[data-s=trigger] option[value=combo]').isDisabled() && await p.locator('select[data-s=trigger] option[value=on_cast]').isDisabled());
    ok('no warning for the seeded text', (await p.locator('#fxd0 [data-ack]').count()) === 0);
    ok('character counters shown', /\/ 180/.test(await p.innerText('#fxd0')) && /\/ 240/.test(await p.innerText('#ct_rules_text')) && /\/ 200/.test(await p.innerText('#ct_flavor_text')));
    // change amount -> mismatch warning, acknowledge
    await p.fill('input[data-s=amount]', '11'); await p.dispatchEvent('input[data-s=amount]', 'change');
    await p.waitForSelector('#fxd0 [data-ack]'); ok('different number gives a warning (does not edit the text)', /ไม่ตรง|ไม่มีตัวเลข/.test(await p.innerText('#fxd0')) && /ATK \+10/.test(await p.inputValue('textarea[data-f=description]')));
    await p.locator('#fxd0 [data-ack]').first().check();
    // passive switches action choices
    await p.selectOption('select[data-s=trigger]', 'passive');
    ok('after choosing passive, "draw" is switched off', await p.locator('select[data-s=action] option[value=draw]').isDisabled());
    await p.waitForFunction(() => document.querySelector('select[data-s=duration]').value === 'permanent');
    ok('duration follows the rule automatically', (await p.inputValue('select[data-s=duration]')) === 'permanent');
    // limit: too long description is refused before saving
    await p.fill('textarea[data-f=description]', 'ก'.repeat(181)); await p.waitForTimeout(100);
    ok('counter turns red over the limit', await p.locator('#fxd0 span[style*="ff6b6b"]').count() > 0);
    await p.click('#save'); await p.waitForSelector('#msg.err'); ok('save refused with a Thai message', /ยาวเกิน/.test(await p.innerText('#msg')));
    // valid save with name, then persisted structure
    await p.selectOption('select[data-s=trigger]', 'on_attack'); await p.selectOption('select[data-s=duration]', 'until_end_of_turn');
    await p.fill('input[data-s=amount]', '10'); await p.dispatchEvent('input[data-s=amount]', 'change');
    await p.fill('textarea[data-f=description]', 'เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)');
    await p.fill('input[data-c=effect_name]', 'พลังหมัด');
    await p.click('#save'); await p.waitForSelector('#msg.ok'); await p.waitForSelector('#fx .card');
    ok('reopened card keeps the effect name and structure', (await p.inputValue('input[data-c=effect_name]')) === 'พลังหมัด' && (await p.inputValue('select[data-s=action]')) === 'atk_up');
    const stored = await p.evaluate(async () => { const t = sessionStorage.getItem('t'); const r = await fetch('/api/cards?q=1GOKU-015', { headers: { authorization: 'Bearer ' + t } }); const l = await r.json(); const c = await (await fetch('/api/cards/' + l[0].id, { headers: { authorization: 'Bearer ' + t } })).json(); return c.effects[0]; });
    ok('server stored config + derived legacy text', stored.config && stored.config.system.action === 'atk_up' && stored.action_text === 'ATK +10' && stored.config.content.effect_name === 'พลังหมัด', JSON.stringify(stored.config && stored.config.ack));
    ok('no page errors', errs.length === 0, errs.join(' | '));
  } catch (e) { console.log('ERROR', e.message); out.push(false); }
  await br.close(); srv.kill();
  console.log(out.every(Boolean) ? 'ALL PASS' : 'SOME FAILED'); process.exit(out.every(Boolean) ? 0 : 1);
})();
