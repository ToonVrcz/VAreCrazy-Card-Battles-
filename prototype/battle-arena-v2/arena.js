// VISUAL PROTOTYPE ONLY — mock data, no engine / API / DB. Presentation behaviour only.
(() => {
  const $ = s => document.querySelector(s), A = n => `assets/art/${n}.jpg`;
  const EL = { fire: 'ไฟ', water: 'น้ำ', earth: 'ดิน', light: 'แสง', dark: 'มืด' };
  const ADV = { fire: 'earth', earth: 'water', water: 'fire', light: 'dark', dark: 'light' }; // mock matrix
  const C = {
    reddrake: { t: 'ch', n: 'มังกรอัคคี', lv: 15, atk: 28, def: 22, hp: 46, el: 'fire', art: 'reddrake', grp: 'Among Us', d: 'มังกรที่มีพลังเพลิงรุนแรง' },
    dragon: { t: 'ch', n: 'มังกรเพลิงดำ', lv: 15, atk: 26, def: 20, hp: 44, el: 'fire', art: 'dragon', grp: 'Among Us', d: 'พ่นเปลวเพลิงเผาทุกสิ่งตรงหน้า' },
    knight: { t: 'ch', n: 'อัศวินเงิน', lv: 15, atk: 22, def: 30, hp: 50, el: 'light', art: 'knight', grp: 'Roblox', d: 'ผู้พิทักษ์เกราะเงินแห่งแสง' },
    witch: { t: 'ch', n: 'แม่มดสีม่วง', lv: 15, atk: 30, def: 14, hp: 36, el: 'dark', art: 'witch', grp: 'Ghost Story', d: 'เวทมนตร์ม่วงที่ทรงพลัง' },
    angel: { t: 'ch', n: 'นางฟ้านักรบ', lv: 40, atk: 34, def: 26, hp: 62, el: 'light', art: 'angel', grp: 'Among Us', d: 'ปีกแห่งแสงสว่างผู้ตัดสิน' },
    goldknight: { t: 'ch', n: 'จอมทัพทองคำ', lv: 15, atk: 24, def: 28, hp: 52, el: 'earth', art: 'goldknight', grp: 'RoV', d: 'เกราะทองที่ไม่เคยพ่ายแพ้' },
    bluedrake: { t: 'ch', n: 'มังกรสายน้ำ', lv: 15, atk: 25, def: 21, hp: 45, el: 'water', art: 'bluedrake', grp: 'Goose Goose Duck', d: 'ครองคลื่นและพายุ' },
    demon: { t: 'ch', n: 'ปีศาจม่วง', lv: 15, atk: 29, def: 18, hp: 40, el: 'dark', art: 'demon', grp: 'Ghost Story', d: 'เงามืดที่กลืนกินแสง' },
    vortex: { t: 'sp', n: 'น้ำวนมหาสมุทร', art: 'vortex', d: 'ดึงตัวละครของศัตรูเข้าสู่น้ำวน' },
    chains: { t: 'tr', n: 'โซ่ผนึก', art: 'chains', d: 'ผนึกการโจมตีของศัตรู 1 ครั้ง' },
  };
  const S = { oChars: [null, 'bluedrake', 'goldknight', 'demon', null, null, null], mChars: ['reddrake', null, 'angel', 'knight', null, 'witch', null],
    oBack: ['?', '?', null, '?', null], mBack: [null, 'chains', 'vortex', null, null] };
  const st = { turn: 4, phase: 'battle', hand: ['dragon', 'knight', 'witch', 'vortex', 'chains'], sel: null, att: null, lp: { o: 100, m: 80 }, used: {} };
  const PH = { main: 'MAIN PHASE', battle: 'BATTLE PHASE', end: 'END PHASE' };

  function cardEl(id, o = {}) {
    const c = C[id], d = document.createElement('div');
    d.className = `card ${c.t} ${o.fd ? 'fd' : ''}`;
    d.dataset.id = id;
    d.innerHTML = `<div class="art" style="background-image:url(${A(c.art)})"></div><div class="nm">${c.n}</div>` +
      (c.t === 'ch' ? `<i class="el sp-${c.el}"></i><div class="lv">★ ${c.lv}</div><div class="st"><b class="a"><i>ATK</i>${c.atk}</b><b class="d"><i>DEF</i>${c.def}</b><b class="h"><i>HP</i>${c.hp}</b></div>` : `<div class="tag">${c.t === 'sp' ? 'เวท' : 'กับดัก'}</div>`);
    return d;
  }
  function row(elId, arr, side, kind) {
    const r = $(elId); r.innerHTML = '';
    arr.forEach((id, i) => {
      const s = document.createElement('div'); s.className = 'slot'; s.dataset.side = side; s.dataset.kind = kind; s.dataset.i = i;
      if (id) { const c = id === '?' ? cardEl('chains', { fd: true }) : cardEl(id); s.appendChild(c); s.dataset.has = id; }
      r.appendChild(s);
    });
  }
  function render() {
    row('#oBack', S.oBack, 'o', 'back'); row('#oChars', S.oChars, 'o', 'chars');
    row('#mChars', S.mChars, 'm', 'chars'); row('#mBack', S.mBack, 'm', 'back');
    const h = $('#hand'); h.innerHTML = '';
    st.hand.forEach((id, i) => {
      const w = document.createElement('div'); w.className = 'hc' + (st.sel === i ? ' sel' : ''); w.dataset.i = i;
      const k = i - (st.hand.length - 1) / 2;
      const cl = $('#canvas').classList, step = cl.contains('port') ? 62 : cl.contains('pl') ? 54 : 98, half = cl.contains('port') ? 36 : cl.contains('pl') ? 28 : 66;
      w.style.left = `calc(50% - ${half}px + ${k * step}px)`; w.style.transform = `rotate(${k * 5}deg) translateY(${Math.abs(k) * 9 - (st.sel === i ? 34 : 0)}px)`; w.style.zIndex = i;
      w.appendChild(cardEl(id)); h.appendChild(w);
    });
    $('#oLP').textContent = st.lp.o; $('#oBar').style.width = st.lp.o + '%'; $('#mLP').textContent = st.lp.m; $('#mBar').style.width = st.lp.m + '%';
    $('#turnTxt').textContent = 'TURN ' + String(st.turn).padStart(2, '0'); $('#phaseTxt').textContent = PH[st.phase];
    document.querySelectorAll('.ph').forEach(b => b.classList.toggle('on', b.dataset.p === st.phase));
    // highlights
    if (st.sel != null) {
      const c = C[st.hand[st.sel]];
      document.querySelectorAll('#mChars .slot,#mBack .slot').forEach(s => {
        const ok = !s.dataset.has && ((c.t === 'ch' && s.dataset.kind === 'chars') || (c.t !== 'ch' && s.dataset.kind === 'back'));
        s.classList.toggle('lit', ok && st.phase === 'main');
      });
    }
    if (st.phase === 'battle') document.querySelectorAll('#mChars .card').forEach(c => { if (!st.used[c.parentNode.dataset.i]) c.classList.add('rdy'); });
    if (st.att != null) {
      const a = C[S.mChars[st.att]];
      document.querySelectorAll('#mChars .slot')[st.att].querySelector('.card').classList.add('sel');
      document.querySelectorAll('#oChars .slot').forEach(s => {
        if (!s.dataset.has) return; s.classList.add('tgt');
        const t = C[s.dataset.has], c = s.querySelector('.card');
        c.classList.toggle('adv', ADV[a.el] === t.el); c.classList.toggle('dis', ADV[t.el] === a.el);
      });
    }
  }
  function info(id) {
    const c = C[id]; if (!c) return;
    $('#dName').textContent = c.n; $('#dArt').style.backgroundImage = `url(${A(c.art)})`;
    $('#dLv').textContent = c.t === 'ch' ? '★ ' + c.lv + ' · ' + EL[c.el] : (c.t === 'sp' ? 'เวท' : 'กับดัก');
    $('#dSt').innerHTML = c.t === 'ch' ? `<b><i>ATK</i>${c.atk}</b><b><i>DEF</i>${c.def}</b><b><i>HP</i>${c.hp}</b>` : '';
    $('#dDesc').innerHTML = c.d + (c.grp ? `<br><em>🎮 Game Synergy: ${c.grp}</em>` : '');
  }
  function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 1600); }
  function pop(el, txt) {
    const cv = $('#canvas'), r = el.getBoundingClientRect(), k = cv.getBoundingClientRect(), s = k.width / cv.offsetWidth;
    const d = document.createElement('div'); d.className = 'dmg'; d.textContent = txt;
    d.style.left = (r.left - k.left + r.width / 2) / s - 30 + 'px'; d.style.top = (r.top - k.top) / s + 'px';
    $('#fx').appendChild(d); setTimeout(() => d.remove(), 1100);
  }

  document.addEventListener('click', e => {
    const hc = e.target.closest('.hc'), slot = e.target.closest('.slot'), ph = e.target.closest('.ph');
    if (hc) { const i = +hc.dataset.i; st.sel = st.sel === i ? null : i; st.att = null; info(st.hand[i]); render(); return; }
    if (ph) { st.phase = ph.dataset.p; st.sel = null; st.att = null; render(); return; }
    if (slot) {
      const id = slot.dataset.has; if (id && id !== '?') info(id);
      if (st.sel != null && slot.classList.contains('lit')) {
        const arr = slot.dataset.side === 'm' ? (slot.dataset.kind === 'chars' ? S.mChars : S.mBack) : null;
        arr[+slot.dataset.i] = st.hand[st.sel]; st.hand.splice(st.sel, 1); st.sel = null; render(); toast('ลงสนามแล้ว (ตัวอย่าง)'); return;
      }
      if (st.phase === 'battle' && slot.dataset.side === 'm' && slot.dataset.kind === 'chars' && id) { st.att = st.att === +slot.dataset.i ? null : +slot.dataset.i; render(); return; }
      if (st.att != null && slot.classList.contains('tgt')) {
        const a = C[S.mChars[st.att]], t = C[id], c = slot.querySelector('.card'); c.classList.add('shake');
        pop(slot, '-' + Math.max(1, a.atk - t.def)); st.used[st.att] = 1; st.att = null; setTimeout(render, 450); return;
      }
    }
    if (e.target.closest('#opp') && st.att != null) {
      const a = C[S.mChars[st.att]], dm = Math.min(60, a.atk); st.lp.o = Math.max(0, st.lp.o - dm); pop($('#opp'), '-' + dm); st.used[st.att] = 1; st.att = null; render(); return;
    }
    if (e.target.closest('#endTurn')) {
      const o = ['main', 'battle', 'end']; const i = o.indexOf(st.phase);
      if (i < 2) st.phase = o[i + 1]; else { st.phase = 'main'; st.turn++; st.used = {}; toast('เทิร์นของคุณ (ตัวอย่าง)'); }
      st.sel = null; st.att = null; render(); return;
    }
    if (e.target.closest('#menuBtn')) { $('#menu').classList.toggle('on'); return; }
    const c = e.target.closest('.card'); if (c && c.dataset.id && !c.classList.contains('fd')) info(c.dataset.id);
  });
  $('#menuFx').addEventListener('click', () => { document.body.classList.toggle('lowfx'); toast(document.body.classList.contains('lowfx') ? 'โหมดประหยัดเครื่อง: เปิด' : 'โหมดประหยัดเครื่อง: ปิด'); });
  $('#lowfx').addEventListener('change', e => document.body.classList.toggle('lowfx', e.target.checked));

  function fit() {
    const cv = $('#canvas'), w = innerWidth, h = innerHeight, force = new URLSearchParams(location.search).get('m');
    const wide = force ? force !== 'port' : w / h > 1.05;
    const mode = !wide ? 'port' : (force ? force : (h <= 520 ? 'pl' : 'land'));
    cv.className = mode; document.body.classList.toggle('isphone', mode !== 'land'); document.body.classList.toggle('isport', mode !== 'land');
    const cw = { land: 1672, port: 430, pl: 940 }[mode], ch = { land: 941, port: 932, pl: 430 }[mode], s = Math.min(w / cw, (h - 0) / ch);
    cv.style.transform = `scale(${s})`; cv.style.left = (w - cw * s) / 2 + 'px'; cv.style.top = (h - ch * s) / 2 + 'px';
  }
  addEventListener('resize', () => { fit(); render(); }); fit(); render(); info('dragon');
})();
