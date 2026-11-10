// Card renderer v2: uses the owner's frame image (assets/frame/frame.webp) + data overlay.
// viewBox is the frame's native 1024x1536 space. Art sits UNDER the frame; numbers/text drawn on top.
const VCZ = (() => {
  const FLAME = 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 2 3 1-3 1-6 1-9z';
  const DROP = 'M12 2S5 10 5 15a7 7 0 0 0 14 0C19 10 12 2 12 2z';
  const FLASK = 'M9 3h6v2h-1v5l5 9a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3l5-9V5H9z';
  const SHIELD = 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z';
  const p = (d, c, x = '') => `<path d="${d}" fill="${c}" ${x}/>`;
  const GLYPH = {
    hp: p(SHIELD, '#d9302c', 'stroke="#f3d98a" stroke-width="1.2"'),
    def: p(SHIELD, '#3a78c8', 'stroke="#f3d98a" stroke-width="1.2"'),
    fire: p(FLAME, '#ff8a1f'), fire_mp: p(FLAME, '#ff8a1f'), purple_flame: p(FLAME, '#a06bff'),
    water: p(DROP, '#3fa7ff'), drop_green: p(DROP, '#5fd35f'),
    mp_blue: p(FLASK, '#3fa7ff'), mp_green: p(FLASK, '#58c258'), potion_purple: p(FLASK, '#b56bff'), potion_mortar: p(FLASK, '#7ccf6a'),
    lightning: p('M13 2L4 14h6l-1 8 9-12h-6z', '#ffd84a'),
    leaf: p('M20 4C10 4 4 9 4 16c0 2 1 4 1 4s1-6 6-9c-3 3-4 7-4 9 9 0 13-7 13-16z', '#58c258'),
    moon: p('M15 3a9 9 0 1 0 6 14A8 8 0 0 1 15 3z', '#cdbbff'),
    sun: '<circle cx="12" cy="12" r="4.5" fill="#ffc83a"/><g stroke="#ffc83a" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></g>',
    cross: p('M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z', '#fff4d6'),
    swords: '<g stroke="#e6e6ef" stroke-width="2.6" stroke-linecap="round"><path d="M5 19L19 5M5 5l14 14"/></g><g stroke="#d9a93b" stroke-width="2" stroke-linecap="round"><path d="M4 16l4 4M20 16l-4 4"/></g>',
    halo: '<ellipse cx="12" cy="8" rx="7" ry="3" fill="none" stroke="#ffe28a" stroke-width="2.4"/><circle cx="12" cy="16" r="4" fill="#ffe9b8"/>',
    rock_mp: p('M4 18l3-9 5-4 6 4 2 9z', '#c8924a'),
    coin: '<circle cx="12" cy="12" r="9" fill="#f2c94c"/><circle cx="12" cy="12" r="6" fill="none" stroke="#b8860b" stroke-width="1.6"/>',
    skull: p('M12 3a8 8 0 0 0-5 14v3h3v-2h4v2h3v-3A8 8 0 0 0 12 3z', '#ececf2') + '<circle cx="9" cy="11" r="2" fill="#2a1646"/><circle cx="15" cy="11" r="2" fill="#2a1646"/>',
    smoke: p('M7 19a4 4 0 0 1 0-8 5 5 0 0 1 9-1 4.5 4.5 0 0 1 1 9z', '#a99cc4'),
    demon: p('M4 3l4.5 4h7L20 3v9a8 8 0 0 1-16 0z', '#c24ac2') + '<circle cx="9" cy="12" r="1.6" fill="#fff"/><circle cx="15" cy="12" r="1.6" fill="#fff"/>',
  };
  const glyph = (k, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 24})">${GLYPH[k] || GLYPH.fire}</g>`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const defs = '';
  const ref = { frame: '' };            // page sets VCZ.ref.frame = URL of frame image
  const F = `font-family="Georgia,'Times New Roman',serif" font-weight="800"`;
  function svg(card, base = {}) {
    const col = k => (base[k] == null || card[k] === base[k]) ? '#3b2410' : card[k] > base[k] ? '#0a7a2a' : '#b3201a';
    const nm = String(card.chain_name || card.name).toUpperCase(), cls = String(card.name).toUpperCase();
    const nfs = Math.max(40, Math.min(76, 76 - Math.max(0, nm.length - 9) * 3.5));
    const lv = String(card.level), lfs = lv.length > 2 ? 46 : 56;
    const pt = (x, y, sz, t, fill, stroke, sw, ls = 0) => `<text x="${x}" y="${y}" text-anchor="middle" ${F} font-size="${sz}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" paint-order="stroke" letter-spacing="${ls}">${t}</text>`;
    const def = card.def > 0 ? `<g transform="translate(715 1040)"><rect width="190" height="84" rx="42" fill="#2a1244" stroke="#e2b440" stroke-width="6"/>${glyph('def', 16, 12, 60)}<text x="128" y="60" text-anchor="middle" ${F} font-size="50" fill="${card.def === base.def || base.def == null ? '#fff1c9' : card.def > base.def ? '#7dffa0' : '#ff8a80'}" stroke="#12061f" stroke-width="5" paint-order="stroke">${card.def}</text></g>` : '';
    return `<svg viewBox="0 0 1023 1538" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(nm)} ${esc(card.name)} Lv.${lv}">
      <rect x="20" y="20" width="983" height="1498" rx="30" fill="#120620"/>
      <image href="${card.img}" x="60" y="172" width="903" height="990" preserveAspectRatio="xMidYMid slice"/>
      <image href="${card.frame||ref.frame}" x="0" y="0" width="1023" height="1538"/>
      ${pt(512, 135 + nfs * 0.1, nfs, esc(nm), '#f6df9a', '#2a0f44', 7, 3)}
      <circle cx="122" cy="262" r="54" fill="#2a1244" stroke="#e2b440" stroke-width="7"/>
      ${pt(122, 262 + lfs * 0.35, lfs, lv, '#f6df9a', '#12061f', 4)}
      ${pt(512, 1236, 48, esc(cls), '#3b2410', '#f3e2b0', 2, 3)}
      ${card.hp==null?'':pt(372, 1385, 96, card.hp, col('hp'), '#f3e2b0', 4)}
      ${card.atk==null?'':pt(800, 1385, 96, card.atk, col('atk'), '#f3e2b0', 4)}
      ${def}
    </svg>`;
  }
  return { svg, defs, ref, glyph: (k, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" style="vertical-align:middle">${GLYPH[k] || GLYPH.fire}</svg>`, hasGlyph: k => k in GLYPH };
})();
