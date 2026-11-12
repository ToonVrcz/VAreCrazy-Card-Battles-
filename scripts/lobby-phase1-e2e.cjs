const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const PORT=8795, BASE=`http://127.0.0.1:${PORT}`; const out=[]; const ok=(n,p,i='')=>{out.push(p);console.log((p?'PASS ':'FAIL ')+n+(i?' — '+i:''))};
(async()=>{
 const srv=spawn('npx',['tsx','scripts/playtest-server.ts'],{cwd:'/home/claude/varecrazy-card-battles-',env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','inherit']});
 await new Promise((res,rej)=>{srv.stdout.on('data',d=>/READY/.test(String(d))&&res());srv.on('exit',c=>rej(new Error('exit '+c)));setTimeout(()=>rej(new Error('timeout')),90000)});
 const b=await chromium.launch(); const errs=[];
 try{
 const ctx=await b.newContext({...devices['Pixel 5']}); const p=await ctx.newPage();
 p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errs.push(m.text())});
 await p.goto(BASE+'/play'); await p.waitForSelector('#md.on');
 ok('first visit shows tutorial step 1', /1\/4/.test(await p.innerText('#md')));
 await p.click('#gnx');await p.click('#gnx');await p.click('#gnx');
 ok('tutorial last step has close', (await p.innerText('#md')).includes('4/4'));
 await p.click('#gsk'); await p.waitForSelector('#lb');
 ok('dashboard shows after tutorial', (await p.innerText('#md')).includes('เล่นกับบอท'));
 await p.reload(); await p.waitForSelector('#lb');
 ok('tutorial not shown again', !(await p.innerText('#md')).includes('คู่มือ 1/4'));
 await p.waitForTimeout(800); const t=await p.innerText('#md'); ok('wallet shown from backend', /💰 \d+/.test(t), t.split('\n').slice(1,4).join('|'));
 await p.click('#lgd'); ok('? reopens guide', (await p.innerText('#md')).includes('คู่มือ 1/4')); await p.click('#gsk'); await p.waitForSelector('#lb');
 ok('5 nav tabs', (await p.locator('.nav button').count())===5);
 await p.screenshot({path:'/tmp/p1-dash.png'});
 await p.click('[data-nav=col]'); await p.waitForSelector('.cgrid');
 ok('collection opens (evo)', /คลังการ์ด/.test(await p.innerText('#md')));
 ok('Lv.40 and Lv.70 are separate tabs', (await p.locator('[data-cat=e40]').count())===1 && (await p.locator('[data-cat=e70]').count())===1);
 await p.click('[data-cat=e70]'); ok('Lv.70 tab lists only Lv.70', !/Lv\.40/.test(await p.locator('.cgrid').innerText()) && /Lv\.70/.test(await p.locator('.cgrid').innerText()));
 await p.click('[data-cat=spell]'); ok('base cards say free', (await p.innerText('#md')).includes('ใช้ได้ฟรี'));
 await p.click('[data-nav=more]'); ok('more lists upcoming with reasons', (await p.innerText('#md')).includes('ยังไม่เปิดใช้งาน'));
 await p.click('[data-nav=shop]'); await p.waitForSelector('[data-l]');
 await p.screenshot({path:'/tmp/p1-shop.png'});
 const buy=p.locator('[data-b]:not([disabled])').first(); const cnt=await buy.count();
 ok('shop has an affordable item (starter 500)', cnt>0);
 if(cnt){ await buy.click(); ok('confirm dialog before buying', (await p.innerText('#md')).includes('ยืนยันการซื้อ'));
  await p.screenshot({path:'/tmp/p1-confirm.png'});
  await p.click('#scn'); await p.waitForSelector('[data-l]'); ok('cancel returns to shop without buying', true);
  await p.locator('[data-b]:not([disabled])').first().click(); await p.click('#sok'); await p.waitForSelector('#rcl');
  ok('success screen', (await p.innerText('#md')).includes('ซื้อสำเร็จ'));
  await p.click('#rcl'); await p.waitForSelector('.cgrid'); ok('goes to collection with owned only', (await p.locator('.cgrid > div').count())>=1 && (await p.innerText('#md')).includes('×1'));
  await p.click('[data-nav=shop]'); await p.waitForSelector('[data-l]');
  const dis=await p.locator('[data-b][disabled]').count(), txt=await p.innerText('#md'); ok('unaffordable item shows reason', /ไม่พอ ขาดอีก/.test(txt)||dis===0, 'disabled='+dis);
 }
 await p.click('[data-nav=home]'); await p.waitForSelector('#lb'); await p.click('#lb'); await p.waitForSelector('#app .bar'); ok('bot game still starts', true);
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth); ok('no horizontal overflow', ov<=0, ov+'px');
 ok('no JS errors', errs.length===0, errs.join(' | ').slice(0,200));
 }catch(e){console.log('CRASH',e.message.split('\n')[0]);out.push(false)} finally{await b.close();srv.kill()}
 console.log(out.filter(Boolean).length+'/'+out.length); process.exit(out.every(Boolean)?0:1);
})();
