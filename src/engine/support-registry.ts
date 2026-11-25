/** Allowed vocabulary for data-driven Signature Spell/Trap configs (cards.support). Shared by the server validator and the Admin editor.
 *  Everything listed here MUST be handled by the engine (tests/support-registry.test.ts checks parity against game.ts). */
export const SUPPORT_OPS = ['buff', 'heal', 'damage', 'draw', 'search_evo_top3', 'negate_target', 'reduce_numeric', 'redirect_attack', 'survive_at_1', 'reduce_battle_damage'] as const;
export const SUPPORT_WHO = ['link', 'ally', 'other_ally', 'enemy', 'attacker', 'victim'] as const;
export const SUPPORT_STAT = ['atk', 'def'] as const;
export const SUPPORT_UNTIL = ['turn', 'opp_turn', 'battle', 'next_attack'] as const;
export const SUPPORT_TRIGGERS = ['enemy_attack', 'self_attacked', 'own_attack', 'ally_grave', 'self_destroyed', 'kill_by_attack', 'ally_battle_damage', 'enemy_target', 'effect_destroy'] as const;
export const SUPPORT_KINDS = ['spell', 'trap'] as const;

/** Thai labels for the Admin dropdowns. */
export const SUPPORT_LABELS = {
  op: { buff: 'เพิ่ม/ลด ATK-DEF', heal: 'ฟื้น HP', damage: 'สร้างความเสียหาย', draw: 'จั่วการ์ด', search_evo_top3: 'หา Evolution จากกอง 3 ใบบน', negate_target: 'ยกเลิกเอฟเฟกต์ที่เลือกเป้า', reduce_numeric: 'ลดตัวเลขของเอฟเฟกต์', redirect_attack: 'เปลี่ยนเป้าการโจมตี', survive_at_1: 'รอดที่ HP 1 (เอฟเฟกต์เท่านั้น)', reduce_battle_damage: 'ลดดาเมจการต่อสู้' },
  who: { link: 'ตัวละครที่ผูก', ally: 'ตัวละครฝ่ายเรา (เลือก)', other_ally: 'ตัวละครฝ่ายเราตัวอื่น (เลือก)', enemy: 'ตัวละครศัตรู (เลือก)', attacker: 'ผู้โจมตี', victim: 'ผู้ถูกโจมตี' },
  stat: { atk: 'ATK', def: 'DEF' },
  until: { turn: 'จนจบเทิร์น', opp_turn: 'จนจบเทิร์นศัตรู', battle: 'ระหว่างการต่อสู้', next_attack: 'การโจมตีครั้งถัดไป' },
  trigger: { enemy_attack: 'ศัตรูโจมตี', self_attacked: 'ตัวละครที่ผูกถูกโจมตี', own_attack: 'ตัวละครที่ผูกโจมตี', ally_grave: 'พันธมิตรตาย', self_destroyed: 'ตัวละครที่ผูกถูกทำลาย', kill_by_attack: 'ฆ่าด้วยการโจมตี', ally_battle_damage: 'พันธมิตรโดนดาเมจการต่อสู้', enemy_target: 'ศัตรูเลือกเป้า', effect_destroy: 'ถูกทำลายด้วยเอฟเฟกต์' },
} as const;

/** Which parameters each op takes. */
export const OP_PARAMS: Record<string, { who?: boolean; stat?: boolean; amount?: 'req' | 'opt'; until?: boolean }> = {
  buff: { who: true, stat: true, amount: 'req', until: true },
  heal: { who: true, amount: 'req' },
  damage: { who: true, amount: 'req' },
  draw: { amount: 'opt' },
  search_evo_top3: {},
  negate_target: {},
  reduce_numeric: { amount: 'req' },
  redirect_attack: {},
  survive_at_1: {},
  reduce_battle_damage: { amount: 'req' },
};

const has = (a: readonly string[], v: unknown) => typeof v === 'string' && a.includes(v);

/** Returns a list of Thai error messages (empty = valid) and the cleaned config (only known keys). */
export function validateSupport(input: unknown, opts: { cardType?: string; chains?: string[] } = {}): { errors: string[]; clean: any } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { errors: ['support ต้องเป็นออบเจ็กต์'], clean: null };
  const s = input as any;
  if (!has(SUPPORT_KINDS, s.kind)) errors.push('kind ต้องเป็น spell หรือ trap');
  if (opts.cardType && s.kind && opts.cardType !== s.kind) errors.push(`kind (${s.kind}) ไม่ตรงกับประเภทการ์ด (${opts.cardType})`);
  if (typeof s.link !== 'string' || !s.link.trim()) errors.push('ต้องระบุ link (chain key ของตัวละครที่ผูก)');
  else if (opts.chains && !opts.chains.includes(s.link)) errors.push(`ไม่พบสาย (chain) "${s.link}"`);
  const clean: any = { kind: s.kind, link: typeof s.link === 'string' ? s.link.trim() : s.link };
  if (s.kind === 'trap') {
    if (!has(SUPPORT_TRIGGERS, s.trigger)) errors.push('กับดักต้องมี trigger ที่ถูกต้อง');
    else clean.trigger = s.trigger;
    if (s.source != null) { if (s.source !== 'spell') errors.push('source ต้องเป็น spell เท่านั้น'); else if (s.trigger !== 'enemy_target') errors.push('source ใช้ได้กับ trigger enemy_target เท่านั้น'); else clean.source = 'spell'; }
  } else if (s.kind === 'spell') {
    if (s.trigger != null) errors.push('เวทมนตร์ไม่มี trigger');
    if (s.source != null) errors.push('เวทมนตร์ไม่มี source');
  }
  if (!Array.isArray(s.ops) || s.ops.length === 0) errors.push('ต้องมี ops อย่างน้อย 1 รายการ');
  else if (s.ops.length > 6) errors.push('ops ได้ไม่เกิน 6 รายการ');
  else {
    clean.ops = s.ops.map((o: any, i: number) => {
      const n = i + 1;
      if (!o || typeof o !== 'object') { errors.push(`op #${n} ไม่ถูกต้อง`); return null; }
      if (!has(SUPPORT_OPS, o.op)) { errors.push(`op #${n}: ไม่รู้จัก "${String(o.op).slice(0, 30)}"`); return null; }
      const p = OP_PARAMS[o.op], out: any = { op: o.op };
      if (p.who) {
        if (o.who != null && o.who !== '') { if (!has(SUPPORT_WHO, o.who)) errors.push(`op #${n}: who ไม่ถูกต้อง`); else out.who = o.who; }
      }
      if (p.stat) { if (!has(SUPPORT_STAT, o.stat)) errors.push(`op #${n}: ต้องเลือก ATK หรือ DEF`); else out.stat = o.stat; }
      if (p.amount) {
        if (o.amount == null || o.amount === '') { if (p.amount === 'req') errors.push(`op #${n}: ต้องมีจำนวน`); }
        else if (!Number.isInteger(o.amount) || o.amount < -999 || o.amount > 999) errors.push(`op #${n}: จำนวนต้องเป็นจำนวนเต็ม -999..999`);
        else out.amount = o.amount;
      }
      if (p.until && o.until != null && o.until !== '') { if (!has(SUPPORT_UNTIL, o.until)) errors.push(`op #${n}: until ไม่ถูกต้อง`); else out.until = o.until; }
      return out;
    }).filter(Boolean);
    // Spells that target need a target-picking op (who: ally/other_ally/enemy); traps never pick targets.
    if (s.kind === 'trap' && s.ops.some((o: any) => o?.who === 'enemy')) errors.push('กับดักเลือกเป้าศัตรูเองไม่ได้ (ใช้ link/attacker/victim/ally)');
    // survive_at_1 is declarative: the engine's effect_destroy handler leaves the unit at 1 HP, so the two must go together.
    const sv = s.ops.some((o: any) => o?.op === 'survive_at_1');
    if (s.kind === 'trap' && (s.trigger === 'effect_destroy') !== sv) errors.push('trigger effect_destroy ต้องคู่กับ op survive_at_1 เท่านั้น');
    if (s.kind === 'spell' && s.ops.some((o: any) => ['attacker', 'victim'].includes(o?.who))) errors.push('เวทมนตร์ใช้ attacker/victim ไม่ได้');
    if (s.kind === 'spell' && s.ops.some((o: any) => ['negate_target', 'reduce_numeric', 'redirect_attack', 'survive_at_1', 'reduce_battle_damage'].includes(o?.op))) errors.push('op ชุดป้องกันใช้ได้เฉพาะกับดัก');
  }
  return { errors, clean: errors.length ? null : clean };
}
