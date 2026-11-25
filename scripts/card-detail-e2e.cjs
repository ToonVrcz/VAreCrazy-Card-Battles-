// Local-only: the card detail view shows element matchup, Story and Fusion partners for a Lv.15 character.
// Run: PORT=8798 npx tsx scripts/playtest-server.ts (background), then PORT=8798 node scripts/card-detail-e2e.cjs
const { chromium, devices } = require('playwright');
const BASE = `http://127.0.0.1:${process.env.PORT || 8798}`; const out = []; const ok = (n, p, i = '') => { out.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/play'); await p.waitForSelector('#md.on');
    await p.click('#gnx'); await p.click('#gnx'); await p.click('#gnx'); await p.click('#gsk'); await p.waitForSelector('#lb');
    await p.click('[data-nav=col]'); await p.waitForSelector('.cgrid');
    await p.click('[data-cat=c15]'); await p.waitForSelector('[data-cd]');
    const ids = await p.locator('[data-cd]').evaluateAll(a => a.map(x => x.dataset.cd));
    let seen = { el: 0, story: 0, fusion: 0 };
    for (const id of ids) {
      await p.click(`[data-cd="${id}"]`); await p.waitForSelector('#cl');
      const t = await p.innerText('#md'); if (/ธาตุ:/.test(t)) seen.el++; if (/Story:/.test(t)) seen.story++; if (/ฟิวชั่นกับสาย:/.test(t)) seen.fusion++; if (/วิวัฒนาการ/.test(t)) seen.evo = (seen.evo||0)+1;
      await p.click('#cl'); await p.waitForSelector('.cgrid'); await p.click('[data-cat=c15]'); await p.waitForSelector('[data-cd]');
    }
    ok('Lv.15 cards listed', ids.length > 0, ids.length + ' cards');
    ok('element matchup shown', seen.el > 0, JSON.stringify(seen));
    ok('Story shown on some cards', seen.story > 0, JSON.stringify(seen));
    ok('Fusion partners shown on some cards', seen.fusion > 0, JSON.stringify(seen));
    ok('no page errors', errs.length === 0, errs.join('|'));
  } finally { await b.close(); }
  process.exit(out.every(Boolean) ? 0 : 1);
})();
