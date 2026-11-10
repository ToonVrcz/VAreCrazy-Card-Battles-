import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const cards = JSON.parse(readFileSync('db/seed/toon-cards.json', 'utf8'));
const thumb = (p, size = 180, q = 70) => {
  const b = execFileSync('python3', ['-c', `
import sys,io,base64
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGB'); im.thumbnail((int(sys.argv[2]),int(sys.argv[2]))); b=io.BytesIO(); im.save(b,'JPEG',quality=int(sys.argv[3])); sys.stdout.write(base64.b64encode(b.getvalue()).decode())`, p, String(size), String(q)]).toString();
  return 'data:image/jpeg;base64,' + b;
};
const rows = cards.map(c => ({ ...c, img: thumb(c.image_path), big: thumb(c.image_path, 440, 78) }));
const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>รายการการ์ดที่นำเข้า — ตรวจสอบ</title><style>
body{margin:0;background:#15101d;color:#eee;font:14px system-ui,sans-serif}h1{font-size:16px;margin:12px}p{margin:0 12px 8px;color:#aaa;font-size:12px}
.f{display:flex;gap:6px;padding:0 12px 8px;flex-wrap:wrap}button{background:#2c2040;color:#fff;border:1px solid #6a5a8a;border-radius:14px;padding:6px 12px}
button.on{background:#6b3fd1}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:8px;padding:8px 12px}
.c{background:#201733;border:1px solid #3d2f5c;border-radius:10px;padding:6px}.c img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px}
.n{font-weight:700;margin-top:4px}.s{font-size:12px;color:#c9b}.lv{background:#8a6a10;border-radius:8px;padding:0 6px;font-size:11px;margin-left:4px}
.m{position:fixed;inset:0;background:#000d;z-index:9;display:none;overflow:auto;padding:12px}.m.on{display:block}.sh{max-width:440px;margin:auto;background:#1e1530;border:2px solid #d9a93b;border-radius:14px;padding:12px;position:relative}.sh img{width:100%;border-radius:8px}.sh .x{position:absolute;right:8px;top:8px;width:36px;height:36px;border-radius:50%;padding:0;font-size:16px}.c{cursor:pointer}.sh .e{background:#2a1f42;border-radius:8px;padding:8px;margin:6px 0;font-size:13px;line-height:1.5}.sh .e b{display:block;color:#9fe;font-size:11px}.sh h2{margin:8px 0 2px;font-size:18px}.chips span{display:inline-block;background:#3a2a5c;border-radius:10px;padding:2px 9px;font-size:12px;margin:2px 3px 2px 0}</style></head><body><h1>การ์ดที่นำเข้าเป็น Draft (${cards.length} ใบ)</h1><p>ค่า Element / ความสามารถ / คำบรรยาย เป็นข้อเสนอของ Claude ตามคลาสและภาพการ์ด (ยังไม่ใช่กติกาจริง) ตรวจแล้วบอกรหัสการ์ดที่ต้องแก้ได้เลย</p>
<div class="f" id="f"></div><div class="g" id="g"></div><div class="m" id="m"><div class="sh" id="sh"></div></div>
<script>const C=${JSON.stringify(rows)};let lv='';const T={on_summon:'เมื่อถูกเรียก',on_evolve:'เมื่อวิวัฒนาการ',on_attack:'เมื่อโจมตี',on_destroyed:'เมื่อถูกทำลาย',turn_start:'เริ่มเทิร์น',turn_end:'จบเทิร์น',to_graveyard:'ลงสุสาน',passive:'ต่อเนื่อง',combo:'Combo'};
const f=document.getElementById('f'),g=document.getElementById('g');
f.innerHTML=[['','ทั้งหมด'],['15','Lv.15'],['40','Lv.40'],['70','Lv.70']].map(([v,l])=>'<button data-v="'+v+'">'+l+'</button>').join('');
function r(){g.innerHTML=C.filter(c=>!lv||String(c.level)===lv).map(c=>'<div class="c" data-k="'+c.character_id+'"><img src="'+c.img+'"><div class="n">'+c.chain_name+'<span class="lv">Lv.'+c.level+'</span></div><div class="s">'+c.name+'</div><div class="s">❤ '+c.hp+' · ATK '+c.atk+' ('+c.atk_icon+')</div><div class="s" style="color:#887">'+c.character_id+(c.evolves_from?' ← '+c.evolves_from:'')+'</div></div>').join('');
 f.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===lv))}
const M=document.getElementById('m'),SH=document.getElementById('sh');
function open_(k){const c=C.find(x=>x.character_id===k);SH.innerHTML='<button class="x" id="cx">✕</button><img src="'+c.big+'"><h2>'+c.chain_name+' <span class="lv">Lv.'+c.level+'</span></h2><div class="s">'+c.name+' · '+c.character_id+(c.evolves_from?' ← '+c.evolves_from:'')+'</div><div class="chips"><span>❤ '+c.hp+'</span><span>ATK '+c.atk+' ('+c.atk_icon+')</span><span>'+c.element+'</span>'+(c.has_combo?'<span>⚡ Combo</span>':'')+'</div>'+c.effects.map(e=>'<div class="e"><b>'+T[e.trigger]+(e.use_limit!=='none'?' · '+({once_per_turn:'1 ครั้ง/เทิร์น',once_per_game:'1 ครั้ง/เกม'}[e.use_limit]):'')+'</b>'+e.description+(e.cost_text?'<br><small>ต้นทุน: '+e.cost_text+'</small>':'')+(e.condition_text?'<br><small>เงื่อนไข: '+e.condition_text+'</small>':'')+'</div>').join('')+'<div class="s" style="font-style:italic;margin-top:6px">'+c.flavor_text+'</div>';M.classList.add('on');document.getElementById('cx').onclick=()=>M.classList.remove('on')}
g.onclick=e=>{const d=e.target.closest('.c');if(d)open_(d.dataset.k)};M.onclick=e=>{if(e.target===M)M.classList.remove('on')};document.addEventListener('keydown',e=>{if(e.key==='Escape')M.classList.remove('on')});
f.onclick=e=>{if(e.target.dataset.v!==undefined){lv=e.target.dataset.v;r()}};r();</script></body></html>`;
writeFileSync('dist-review.html', html);
console.log((html.length/1024|0)+' KB');
