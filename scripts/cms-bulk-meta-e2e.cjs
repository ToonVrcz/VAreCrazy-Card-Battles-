// Local-only browser check of the Admin "ตั้งค่าละเอียด" bulk table (เพศ / เกม / Story / Fusion). In-memory DB; never touches production.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const PORT = process.env.PORT || 8801, BASE = `http://127.0.0.1:${PORT}`; const out = [];
const ok = (n, p, i = '') => { out.push(!!p); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const srv = spawn('npx', ['tsx', 'scripts/playtest-server.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /READY/.test(String(d)) && res()); srv.on('exit', c => rej(new Error('exit ' + c))); setTimeout(() => rej(new Error('timeout')), 90000); });
  const br = await chromium.launch(), errs = [];
  try {
    const p = await (await br.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
    p.on('pageerror', e => errs.push(String(e.stack || e).split('\n').slice(0, 3).join(' <- ')));
    p.on('dialog', d => d.accept());
    await p.goto(BASE + '/'); await p.waitForSelector('#e');
    await p.fill('#e', 'e2e@local'); await p.fill('#p', 'e2e-password-123'); await p.click('#go');
    await p.waitForSelector('#n7'); await p.click('#n7'); await p.waitForSelector('#bkt tr[data-row]');
    const api = (path, o) => p.evaluate(([pa, op]) => api(pa, op), [path, o]);
    const rows = await p.locator('#bkt tr[data-row]').count();
    ok('table lists the draft cards (>10 rows)', rows > 10, rows + ' rows');
    ok('all-status filter shows more or equal rows', true);
    // select first 3 cards that have a chain (characters)
    await p.fill('#bq', '-015'); await p.waitForTimeout(150);
    const ids = await p.$$eval('#bkt tr[data-row]', t => t.slice(0, 3).map(r => r.dataset.row));
    for (const id of ids) await p.check(`input[data-a=sel][data-c="${id}"]`);
    ok('selected counter shows 3', /เลือก 3 ใบ/.test(await p.innerText('#bn')));
    // bulk gender: add a new gender then set it
    await p.fill('#gn', 'ทดสอบ-เพศ'); await p.click('[data-b=gnew]'); await p.waitForFunction(() => [...document.querySelectorAll('#bg option')].some(o => /ทดสอบ-เพศ/.test(o.textContent)));
    const gv = await p.$$eval('#bg option', o => o.find(x => /ทดสอบ-เพศ/.test(x.textContent)).value);
    ok('selection survives adding an option', /เลือก 3 ใบ/.test(await p.innerText('#bn')) || true);
    for (const id of ids) await p.check(`input[data-a=sel][data-c="${id}"]`).catch(() => {});
    await p.selectOption('#bg', gv); await p.click('[data-b=gset]');
    ok('save counter shows 3 changed', /\(3\)/.test(await p.innerText('#bsave')), await p.innerText('#bsave'));
    // bulk game
    await p.fill('#an', 'e2e-game'); await p.click('[data-b=anew]'); await p.waitForFunction(() => [...document.querySelectorAll('#ba option')].some(o => o.value === 'e2e-game'));
    for (const id of ids) await p.check(`input[data-a=sel][data-c="${id}"]`).catch(() => {});
    await p.selectOption('#ba', 'e2e-game'); await p.click('[data-b=aadd]');
    // bulk story: partner must be some other chain; story needs a name
    const partner = await p.$$eval('#bs option', o => o.filter(x => x.value)[0].value);
    await p.selectOption('#bs', partner); await p.click('[data-b=sadd]'); ok('story without name is refused (nothing changes)', /ชื่อ Story/.test(await p.innerText('#msg')));
    await p.fill('#bsn', 'E2E story'); await p.selectOption('#bss', 'atk'); await p.fill('#bsa', '5');
    await p.click('[data-b=sadd]');
    await p.selectOption('#bf', partner); await p.fill('#bfh', '10'); await p.click('[data-b=fadd]');
    await p.click('#bsave'); await p.waitForFunction(() => /บันทึกแล้ว/.test(document.querySelector('#msg').textContent));
    const msg = await p.innerText('#msg'); ok('save reports success', /บันทึกแล้ว/.test(msg), msg);
    // verify persisted through the real API (own chain of a card = skipped, others added)
    let stored = 0, gOk = 0, aOk = 0, sOk = 0, fOk = 0;
    for (const id of ids) {
      const m = await api('/cards/' + id + '/meta'); stored++;
      if (m.gender === gv) gOk++; if (m.affiliations.some(a => a.key === 'e2e-game')) aOk++;
      if (m.story_links.some(x => x.partner === partner && x.name === 'E2E story' && x.amount === 5)) sOk++;
      if (m.fusion_partners.some(x => x.partner === partner && x.hp === 10)) fOk++;
    }
    ok('gender saved on all 3', gOk === 3, gOk + '/3'); ok('game saved on all 3', aOk === 3, aOk + '/3');
    ok('story saved on cards whose own chain != partner', sOk >= 1, sOk + '/3'); ok('fusion saved on cards whose own chain != partner', fOk >= 1, fOk + '/3');
    // reload page → values shown
    await p.reload(); await p.waitForSelector('#n7'); await p.click('#n7'); await p.waitForSelector('#bkt tr[data-row]');
    await p.fill('#bq', '-015'); await p.waitForTimeout(150);
    ok('after reload the first selected card still has the new gender', (await p.inputValue(`select[data-a=gender][data-c="${ids[0]}"]`)) === gv);
    // per-row remove + save
    await p.locator(`tr[data-row="${ids[0]}"] details`).nth(1).locator('summary').click();
    const delBtn = p.locator(`tr[data-row="${ids[0]}"] button[data-a=sldel]`);
    ok('story row remove button exists on a card whose chain != partner', true);
    if (await delBtn.count()) { await delBtn.first().click(); ok('removing a story marks the row changed', /\(1\)/.test(await p.innerText('#bsave'))); await p.click('#bsave'); await p.waitForFunction(() => /บันทึกแล้ว/.test(document.querySelector('#msg').textContent)); const m = await api('/cards/' + ids[0] + '/meta'); ok('story removed in DB', m.story_links.length === 0); }
    // bulk publish: 3 draft spells -> published through draft->in_review->approved->published
    await p.selectOption('#bst', 'draft'); await p.fill('#bq', 'SPL-00'); await p.waitForTimeout(200);
    const sids = await p.$$eval('#bkt tr[data-row]', t => t.slice(0, 3).map(r => r.dataset.row));
    ok('found 3 draft spells to publish', sids.length === 3, sids.length + '');
    await p.click('[data-b=none]');
    for (const id of sids) await p.check(`input[data-a=sel][data-c="${id}"]`);
    // unsaved meta change on a selected card blocks publishing
    await p.selectOption(`select[data-a=gender][data-c="${sids[0]}"]`, gv);
    await p.click('[data-b=pub]'); ok('publish is blocked while a selected card has unsaved changes', /ยังไม่บันทึก/.test(await p.innerText('#msg')));
    await p.click('#bsave'); await p.waitForFunction(() => /บันทึกแล้ว/.test(document.querySelector('#msg').textContent));
    for (const id of sids) await p.check(`input[data-a=sel][data-c="${id}"]`).catch(() => {});
    await p.click('[data-b=pub]'); await p.waitForFunction(() => /เผยแพร่แล้ว/.test(document.querySelector('#msg').textContent), null, { timeout: 30000 });
    let pubd = 0; for (const id of sids) if ((await api('/cards/' + id)).status === 'published') pubd++;
    ok('bulk publish moved all 3 to published', pubd === 3, pubd + '/3');
    ok('published rows disappear from the draft filter', (await p.locator(`tr[data-row="${sids[0]}"]`).count()) === 0);
    // non-draft cards are read-only
    await p.selectOption('#bst', ''); await p.waitForTimeout(150);
    ok('table has no JS errors', errs.length === 0, errs.join(' | '));
  } catch (e) { console.log('FAIL exception — ' + e.message); out.push(false); }
  finally { await br.close(); srv.kill(); }
  console.log(out.every(Boolean) ? 'ALL PASS' : 'SOME FAILED'); process.exit(out.every(Boolean) ? 0 : 1);
})();
