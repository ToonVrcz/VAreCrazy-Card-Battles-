// Regression (F-01): player-controlled names must never become markup. Local-only (in-memory DB). Run: NODE_PATH=$(npm root -g) PORT=8798 node scripts/xss-regression-e2e.cjs
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const PORT = Number(process.env.PORT || 8798), BASE = `http://127.0.0.1:${PORT}`;
(async () => {
  const srv = spawn('npx', ['tsx', 'scripts/playtest-server.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { srv.stdout.on('data', d => /READY/.test(String(d)) && res()); srv.on('exit', c => rej(new Error('exit ' + c))); setTimeout(() => rej(new Error('timeout')), 120000); });
  const br = await chromium.launch(); let fired = null;
  try {
    const mkRoom = async name => (await fetch(BASE + '/api/play/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, public: true }) })).status;
    console.log('markup room <u>:', await mkRoom('<u id=inj>X</u>'));
    // two public rooms (each name <= 24 chars) whose names together form one event handler; only an alert is raised
    const n1 = "<img src=x onerror='/*", n2 = "*/alert(1)'>";
    console.log('payload part lengths:', n1.length, n2.length, '(limit 24)', await mkRoom(n2), await mkRoom(n1));
    const p = await (await br.newContext()).newPage(); let bad = 0;
    p.on('dialog', async d => { fired = d.message(); await d.dismiss(); });
    await p.goto(BASE + '/play'); await p.waitForTimeout(1500);
    await p.evaluate(() => roomList()); await p.waitForTimeout(1500);
    const inj = await p.evaluate(() => !!document.querySelector('#inj')); console.log('markup injected (must be false):', inj); if (inj) bad++;
    console.log('script executed (must be false):', fired !== null); if (fired !== null) bad++;
    const shown = await p.evaluate(() => document.querySelector('#md').textContent.includes('<u id=inj>X</u>')); console.log('name shown as text (must be true):', shown); if (!shown) bad++;
    process.exitCode = bad ? 1 : 0; console.log(bad ? 'FAIL' : 'PASS');
    const pk = await p.evaluate(() => { try { return localStorage.getItem('vcz_pk') ? 'present in localStorage (readable by that script)' : 'absent'; } catch (e) { return 'n/a'; } });
    console.log('profile key:', pk);
  } catch (e) { console.log('ERROR', e.message); process.exitCode = 1; }
  await br.close(); srv.kill(); setTimeout(() => process.exit(process.exitCode || 0), 200);
})();
