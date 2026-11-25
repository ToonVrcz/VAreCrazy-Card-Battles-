'use strict';
// Admin extension "ตั้งค่าละเอียด": เพศ / เกมที่เคยเล่นด้วยกัน / Story / Fusion for every card in one table.
// Uses the existing per-card meta API (PUT /cards/:id/meta), so permissions, validation and "Draft only" are enforced by the server.
// Globals from admin.html: app, api, J, esc, toast, can.
async function bulkMeta() {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const w = can('write');
  app.innerHTML = '<p>กำลังโหลดการ์ดทั้งหมด…</p>';
  let cards, gs, af, chs;
  try { [cards, gs, af, chs] = await Promise.all([api('/cards'), api('/genders'), api('/affiliations'), api('/chains')]); }
  catch (e) { app.innerHTML = '<p>โหลดไม่สำเร็จ</p>'; return toast(e.message); }
  const nameOf = (l, k) => { const x = l.find(y => y.key === k); return x ? x.name : k; };
  const mk = m => ({ gender: m.gender || null, aff: new Map((m.affiliations || []).map(a => [a.key, a.reason ?? null])), sl: (m.story_links || []).map(x => ({ ...x })), fp: (m.fusion_partners || []).map(x => ({ ...x })) });
  const cl = s => ({ gender: s.gender, aff: new Map(s.aff), sl: s.sl.map(x => ({ ...x })), fp: s.fp.map(x => ({ ...x })) });
  const byP = (a, b) => (a.partner < b.partner ? -1 : a.partner > b.partner ? 1 : 0);
  const SIG = {
    gender: s => s.gender || '',
    aff: s => JSON.stringify([...s.aff.keys()].sort()),
    sl: s => JSON.stringify([...s.sl].sort(byP).map(x => [x.partner, x.name, x.stat || '', x.amount ?? '', x.description || ''])),
    fp: s => JSON.stringify([...s.fp].sort(byP).map(x => [x.partner, x.hp || 0, x.atk || 0, x.def || 0, x.note || '']))
  };
  const KINDS = ['gender', 'aff', 'sl', 'fp'];
  const orig = new Map(), curS = new Map();
  for (let i = 0; i < cards.length; i += 10) {
    await Promise.all(cards.slice(i, i + 10).map(async c => {
      try { const m = mk(await api('/cards/' + c.id + '/meta')); orig.set(c.id, m); curS.set(c.id, cl(m)); } catch { /* row skipped */ }
    }));
  }
  cards = cards.filter(c => orig.has(c.id));
  const f = { q: '', status: 'draft', type: '', level: '' };
  const sel = new Set(), open = new Set();
  const editable = c => w && c.status === 'draft';
  const NEXT = new Map([['draft', 'in_review'], ['in_review', 'approved'], ['approved', 'published']]);
  const selectable = c => editable(c) || (can('publish') && NEXT.has(c.status));
  const kinds = id => KINDS.filter(k => SIG[k](curS.get(id)) !== SIG[k](orig.get(id)));
  const shown = () => cards.filter(c => (!f.status || c.status === f.status) && (!f.type || c.card_type === f.type) && (!f.level || String(c.level) === f.level) &&
    (!f.q || (c.name + ' ' + c.character_id).toLowerCase().includes(f.q.toLowerCase())));
  const dirty = () => cards.filter(c => editable(c) && kinds(c.id).length);
  const opts = (l, ph) => `<option value="">${esc(ph)}</option>` + l.map(x => `<option value="${esc(x.key)}">${esc(x.name)}</option>`).join('');
  const short = (a, n) => { const t = a.join(', '); return t.length > n ? t.slice(0, n) + '…' : t; };

  const row = c => {
    const s = curS.get(c.id), ed = editable(c), dd = ed ? '' : 'disabled="disabled"', id = esc(c.id), d = kinds(c.id).length;
    const others = chs.filter(x => x.key !== c.chain_key);
    const addSel = (act, ph) => ed && c.chain_key ? `<select data-c="${id}" data-a="${esc(act)}"><option value="">${esc(ph)}</option>${others.map(x => `<option value="${esc(x.key)}">${esc(x.name)}</option>`).join('')}</select>` : (ed ? '<span class="s">การ์ดนี้ไม่มีสายตัวละคร</span>' : '');
    const g = `<select data-c="${id}" data-a="gender" ${dd}><option value="">ไม่ระบุ</option>${gs.map(x => `<option value="${esc(x.key)}" ${s.gender === x.key ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
    const affBody = af.map(x => `<label style="display:flex;gap:4px;align-items:center;margin:0"><input type="checkbox" data-c="${id}" data-a="aff" data-k="${esc(x.key)}" ${s.aff.has(x.key) ? 'checked' : ''} ${dd}> ${esc(x.name)}</label>`).join('') || '<span class="s">ยังไม่มีเกมในรายการ</span>';
    const slBody = s.sl.map((x, i) => `<div>${esc(nameOf(chs, x.partner))} · ${esc(x.name)} ${x.stat ? esc(String(x.stat).toUpperCase() + ' ' + x.amount) : ''} ${ed ? `<button class="warn" data-c="${id}" data-a="sldel" data-i="${esc(i)}">✕</button>` : ''}</div>`).join('') + addSel('sladd', '+ เพิ่มคู่ Story');
    const fpBody = s.fp.map((x, i) => `<div>${esc(nameOf(chs, x.partner))} · HP${esc(x.hp ?? 0)} ATK${esc(x.atk ?? 0)} DEF${esc(x.def ?? 0)} ${ed ? `<button class="warn" data-c="${id}" data-a="fpdel" data-i="${esc(i)}">✕</button>` : ''}</div>`).join('') + addSel('fpadd', '+ เพิ่มคู่ Fusion');
    const affNames = [...s.aff.keys()].map(k => nameOf(af, k));
    return `<tr data-row="${id}" style="${d ? 'background:#3a2f12' : ''}"><td><input type="checkbox" data-c="${id}" data-a="sel" ${sel.has(c.id) ? 'checked' : ''} ${selectable(c) ? '' : 'disabled="disabled"'}></td>
 <td><b>${esc(c.name)}</b><div class="s">${esc(c.character_id)} · Lv.${esc(c.level ?? '-')} · ${esc(c.card_type)} <span class="badge ${esc(c.status)}">${esc(c.status)}</span></div></td>
 <td>${g}</td><td><details data-o="${id}:aff" ${open.has(c.id + ':aff') ? 'open' : ''}><summary>${esc(affNames.length ? short(affNames, 26) : '— ไม่ระบุ —')}</summary>${affBody}</details></td>
 <td><details data-o="${id}:sl" ${open.has(c.id + ':sl') ? 'open' : ''}><summary>${esc(s.sl.length + ' Story')}</summary>${slBody}</details></td><td><details data-o="${id}:fp" ${open.has(c.id + ':fp') ? 'open' : ''}><summary>${esc(s.fp.length + ' Fusion')}</summary>${fpBody}</details></td></tr>`;
  };

  const bar = () => `<div class="row" style="align-items:center"><input id="bq" placeholder="ค้นหาชื่อ/Character ID" value="${esc(f.q)}">
 <select id="bst"><option value="">ทุกสถานะ</option>${['draft', 'in_review', 'approved', 'published', 'archived'].map(s => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
 <select id="bty"><option value="">ทุกประเภท</option>${FT.map(([k, n]) => `<option value="${esc(k)}" ${f.type === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
 <select id="blv"><option value="">ทุกเลเวล</option>${['15', '40', '70', '99'].map(l => `<option ${f.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
 ${w ? `<div class="card" style="cursor:default;display:block"><div class="row" style="align-items:center"><b id="bn">เลือก 0 ใบ</b><button data-b="all">เลือกทั้งหมดที่แสดง</button><button data-b="none">ล้างที่เลือก</button></div>
 <div class="s">ตั้งค่าให้การ์ดที่เลือกพร้อมกัน — ยังไม่บันทึกจนกว่าจะกด "บันทึกที่เปลี่ยน"</div>
 <div class="row"><select id="bg"><option value="">— เลือกเพศ —</option><option value="__none">ไม่ระบุ</option>${gs.map(x => `<option value="${esc(x.key)}">${esc(x.name)}</option>`).join('')}</select><button data-b="gset">ตั้งเพศ</button>
  <input id="gn" placeholder="เพิ่มเพศใหม่ (ชื่อ)"><button data-b="gnew">+ เพิ่มเพศ</button></div>
 <div class="row"><select id="ba">${opts(af, '— เลือกเกม —')}</select><button data-b="aadd">+ ใส่เกมนี้</button><button data-b="adel">− เอาเกมนี้ออก</button>
  <input id="an" placeholder="เพิ่มเกมใหม่ (เช่น among-us)"><button data-b="anew">+ เพิ่มเกม</button></div>
 <div class="row"><select id="bs">${opts(chs, '— ตัวละครคู่ Story —')}</select><input id="bsn" placeholder="ชื่อ Story (จำเป็น)"><select id="bss"><option value="">ไม่มี (ข้อความอย่างเดียว)</option><option>atk</option><option>hp</option><option>def</option></select><input id="bsa" type="number" placeholder="ค่า +/−" style="width:80px"><input id="bsd" placeholder="คำอธิบาย"><button data-b="sadd">+ เพิ่ม Story ให้ที่เลือก</button></div>
 <div class="row"><select id="bf">${opts(chs, '— ตัวละครคู่ Fusion —')}</select><input id="bfh" type="number" placeholder="HP" value="0" style="width:70px"><input id="bfa" type="number" placeholder="ATK" value="0" style="width:70px"><input id="bfd" type="number" placeholder="DEF" value="0" style="width:70px"><button data-b="fadd">+ เพิ่ม Fusion ให้ที่เลือก</button></div>
 <div class="s">ใช้ช่องในแต่ละแถวเพื่อเพิ่มคู่ Story/Fusion ทีละใบ โดยใช้ชื่อ/ค่าจากแถบนี้</div>
 <div class="row"><button class="pri" data-b="save" id="bsave">บันทึกที่เปลี่ยน (0)</button>${can('publish') ? '<button class="pri" data-b="pub">🚀 เผยแพร่ที่เลือก (ส่งตรวจ → อนุมัติ → เผยแพร่)</button>' : ''}</div><div class="s">เผยแพร่: ทำทีละขั้นผ่านระบบเดิม (มีประวัติเวอร์ชันและตัวตรวจครบ) ใบที่ไม่ผ่านจะแสดงเหตุผลด้านล่าง ไม่กระทบใบอื่น</div></div>` : '<p class="s">บัญชีนี้ดูได้อย่างเดียว</p>'}<pre id="br" hidden></pre>`;

  const drawCount = () => { const n = $('#bn'); if (n) n.textContent = 'เลือก ' + sel.size + ' ใบ'; const b = $('#bsave'); if (b) b.textContent = 'บันทึกที่เปลี่ยน (' + dirty().length + ')'; };
  const drawTable = () => { $('#bkt').innerHTML = `<tr><th></th><th>การ์ด</th><th>เพศ</th><th>เกมที่เคยเล่นด้วยกัน</th><th>Story</th><th>Fusion</th></tr>` + shown().map(row).join('') || ''; drawCount(); };
  const drawRow = id => { const c = cards.find(x => x.id === id), t = document.querySelector('tr[data-row="' + CSS.escape(id) + '"]'); if (c && t) t.outerHTML = row(c); drawCount(); };
  const full = () => { app.innerHTML = `<div id="bk"><h3>ตั้งค่าละเอียด — เพศ / เกม / Story / Fusion</h3><div id="bkb">${bar()}</div><div style="overflow-x:auto"><table id="bkt"></table></div></div>`; drawTable(); wire(); };
  const selected = () => cards.filter(c => sel.has(c.id) && editable(c));

  const addStory = (s, own, x) => { if (!own || s.sl.some(y => y.partner === x.partner) || x.partner === own) return false; s.sl.push(x); return true; };
  const addFusion = (s, own, x) => { if (!own || s.fp.some(y => y.partner === x.partner) || x.partner === own) return false; s.fp.push(x); return true; };
  const storyFromBar = partner => {
    const name = $('#bsn').value.trim(), stat = $('#bss').value, amt = $('#bsa').value;
    if (!name) { toast('ใส่ชื่อ Story ก่อน'); return null; }
    if (stat && !/^-?\d+$/.test(amt)) { toast('ใส่ค่า +/− เป็นจำนวนเต็ม'); return null; }
    return { partner, name, stat: stat || null, amount: stat ? +amt : null, description: $('#bsd').value.trim() || null };
  };
  const fusionFromBar = partner => {
    const v = ['#bfh', '#bfa', '#bfd'].map(q => $(q).value.trim() === '' ? 0 : $(q).value);
    if (!v.every(x => /^-?\d+$/.test(String(x)))) { toast('โบนัสต้องเป็นจำนวนเต็ม'); return null; }
    return { partner, hp: +v[0], atk: +v[1], def: +v[2], note: null };
  };

  const save = async () => {
    const ids = dirty(); if (!ids.length) return toast('ไม่มีอะไรเปลี่ยน');
    let ok = 0; const errs = [];
    for (const c of ids) {
      const s = curS.get(c.id), ks = kinds(c.id), b = {};
      if (ks.includes('gender')) b.gender = s.gender || null;
      if (ks.includes('aff')) b.affiliations = [...s.aff].map(([key, reason]) => ({ key, reason }));
      if (ks.includes('sl')) b.story_links = s.sl;
      if (ks.includes('fp')) b.fusion_partners = s.fp;
      try { await api('/cards/' + c.id + '/meta', J('PUT', b)); orig.set(c.id, cl(s)); ok++; } catch (e) { errs.push(c.character_id + ': ' + e.message); }
    }
    const r = $('#br'); r.hidden = !errs.length; r.textContent = errs.join('\n');
    toast(errs.length ? `บันทึกแล้ว ${ok} ใบ, ผิดพลาด ${errs.length} ใบ (ดูรายการด้านล่าง)` : `บันทึกแล้ว ${ok} ใบ`, !errs.length);
    drawTable();
  };

  function wire() {
    const bk = $('#bk');
    bk.addEventListener('toggle', e => { const o = e.target.dataset && e.target.dataset.o; if (!o) return; if (e.target.open) open.add(o); else open.delete(o); }, true);
    bk.addEventListener('input', e => { if (e.target.id === 'bq') { f.q = e.target.value; drawTable(); } });
    bk.addEventListener('change', async e => {
      const t = e.target, a = t.dataset.a, id = t.dataset.c;
      if (t.id === 'bst') { f.status = t.value; return drawTable(); }
      if (t.id === 'bty') { f.type = t.value; return drawTable(); }
      if (t.id === 'blv') { f.level = t.value; return drawTable(); }
      if (!a || !id) return;
      const c = cards.find(x => x.id === id); if (!c || (a !== 'sel' && !editable(c))) return;
      const s = curS.get(id);
      if (a === 'sel') { if (t.checked) sel.add(id); else sel.delete(id); return drawCount(); }
      if (a === 'gender') s.gender = t.value || null;
      else if (a === 'aff') { if (t.checked) s.aff.set(t.dataset.k, null); else s.aff.delete(t.dataset.k); }
      else if (a === 'sladd') { if (!t.value) return; const x = storyFromBar(t.value); if (!x || !addStory(s, c.chain_key, x)) { t.value = ''; return; } }
      else if (a === 'fpadd') { if (!t.value) return; const x = fusionFromBar(t.value); if (!x || !addFusion(s, c.chain_key, x)) { t.value = ''; return; } }
      drawRow(id);
    });
    bk.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      const a = t.dataset.a, id = t.dataset.c, b = t.dataset.b;
      if (a === 'sldel' || a === 'fpdel') { const c = cards.find(x => x.id === id); if (!c || !editable(c)) return; const s = curS.get(id); (a === 'sldel' ? s.sl : s.fp).splice(+t.dataset.i, 1); return drawRow(id); }
      if (!b) return;
      const each = fn => { const ss = selected(); if (!ss.length) { toast('ยังไม่ได้เลือกการ์ด (ติ๊กที่หน้าแถว)'); return null; } let n = 0; ss.forEach(c => { if (fn(curS.get(c.id), c)) n++; }); drawTable(); toast(`ตั้งค่าให้ ${n} จาก ${ss.length} ใบ (ยังไม่บันทึก)`, true); return n; };
      try {
        if (b === 'all') { shown().filter(selectable).forEach(c => sel.add(c.id)); return drawTable(); }
        if (b === 'none') { sel.clear(); return drawTable(); }
        if (b === 'gset') { const v = $('#bg').value; if (!v) return toast('เลือกเพศก่อน'); return each(s => { s.gender = v === '__none' ? null : v; return true; }); }
        if (b === 'aadd') { const k = $('#ba').value; if (!k) return toast('เลือกเกมก่อน'); return each(s => { s.aff.set(k, s.aff.get(k) ?? null); return true; }); }
        if (b === 'adel') { const k = $('#ba').value; if (!k) return toast('เลือกเกมก่อน'); return each(s => s.aff.delete(k)); }
        if (b === 'sadd') { const p = $('#bs').value; if (!p) return toast('เลือกตัวละครคู่ Story ก่อน'); const x = storyFromBar(p); if (!x) return; return each((s, c) => addStory(s, c.chain_key, { ...x })); }
        if (b === 'fadd') { const p = $('#bf').value; if (!p) return toast('เลือกตัวละครคู่ Fusion ก่อน'); const x = fusionFromBar(p); if (!x) return; return each((s, c) => addFusion(s, c.chain_key, { ...x })); }
        if (b === 'gnew') { const n = $('#gn').value.trim(); if (!n) return; const k = 'g-' + Date.now().toString(36); await api('/genders', J('POST', { key: k, name: n })); gs.push({ key: k, name: n }); $('#bkb').innerHTML = bar(); drawTable(); return toast('เพิ่มเพศแล้ว', true); }
        if (b === 'anew') { const k = $('#an').value.trim().toLowerCase(); if (!k) return; await api('/affiliations', J('POST', { key: k, name: k })); af.push({ key: k, name: k }); $('#bkb').innerHTML = bar(); drawTable(); return toast('เพิ่มเกมแล้ว', true); }
        if (b === 'pub') {
          const ids = [...sel].map(id => cards.find(x => x.id === id)).filter(c => c && selectable(c));
          if (!ids.length) return toast('ยังไม่ได้เลือกการ์ดที่เผยแพร่ได้ (ติ๊กที่หน้าแถว)');
          const unsaved = ids.filter(c => kinds(c.id).length);
          if (unsaved.length) return toast('มี ' + unsaved.length + ' ใบที่ตั้งค่ายังไม่บันทึก กด "บันทึกที่เปลี่ยน" ก่อน');
          if (!confirm('เผยแพร่การ์ด ' + ids.length + ' ใบ? ผู้เล่นจะเห็นทันที และการ์ดที่เผยแพร่แล้วจะแก้เพศ/เกม/Story/Fusion ไม่ได้ (ต้องถอนเป็นร่างก่อน)')) return;
          t.disabled = true; let ok = 0; const errs = [];
          try {
            for (const c of ids) {
              try {
                while (c.status !== 'published') {
                  const to = NEXT.get(c.status); if (!to) throw new Error('สถานะ ' + c.status + ' เผยแพร่ต่อไม่ได้');
                  const r = await api('/cards/' + c.id + '/status', J('POST', { to })); c.status = r.status;
                }
                ok++; sel.delete(c.id);
              } catch (e) { errs.push(c.character_id + ' (ค้างที่ ' + c.status + '): ' + e.message); }
            }
          } finally { t.disabled = false; }
          const r = $('#br'); r.hidden = !errs.length; r.textContent = errs.join('\n');
          toast(errs.length ? `เผยแพร่แล้ว ${ok} ใบ, ไม่ผ่าน ${errs.length} ใบ (ดูรายการด้านล่าง)` : `เผยแพร่แล้ว ${ok} ใบ`, !errs.length);
          return drawTable();
        }
        if (b === 'save') { t.disabled = true; try { await save(); } finally { t.disabled = false; } }
      } catch (err) { toast(err.message); }
    });
  }
  full();
}
