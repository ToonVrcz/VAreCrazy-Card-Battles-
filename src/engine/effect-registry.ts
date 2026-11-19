// Effect Registry: the ONE list of what the CMS Card Editor may offer and what the engine really runs.
// Pure data + pure functions (no I/O) so the Admin page, the server and the tests share it.
// Parity with the engine is enforced by tests/effect-registry.test.ts: everything this file allows must be accepted by parseEffect().
export type RegStatus = 'supported' | 'experimental' | 'deprecated' | 'unsupported';
export type RegCategory = 'trigger' | 'condition' | 'cost' | 'target' | 'action' | 'duration' | 'use_limit';
export interface RegEntry { key: string; category: RegCategory; label: string; status: RegStatus; note?: string }

/** The structured "System Configuration" of one effect (what the engine executes). */
export interface SystemConfig {
  trigger: string; condition?: string | null; cost?: string | null; target: string; action: string;
  amount?: number | null; perm?: boolean; max?: number | null; full?: boolean;
  duration: string; use_limit: string;
}
/** The legacy text columns of card_effects (kept in sync so the engine parser keeps working unchanged). */
export interface LegacyRow {
  trigger: string; condition_text: string | null; cost_text: string | null; target_text: string | null; action_text: string | null;
  duration: string; duration_turns: number | null; use_limit: string;
}
export interface Issue { fields: string[]; code: string; message: string }

const E = (category: RegCategory, key: string, label: string, status: RegStatus = 'supported', note?: string): RegEntry => ({ category, key, label, status, ...(note ? { note } : {}) });

export const REGISTRY: RegEntry[] = [
  E('trigger', 'on_summon', 'เมื่อถูกเรียก'), E('trigger', 'on_evolve', 'เมื่อวิวัฒนาการ'), E('trigger', 'on_attack', 'เมื่อโจมตี'),
  E('trigger', 'on_destroyed', 'เมื่อถูกทำลาย'), E('trigger', 'to_graveyard', 'เมื่อลงสุสาน'), E('trigger', 'turn_start', 'เริ่มเทิร์น'),
  E('trigger', 'turn_end', 'จบเทิร์น'), E('trigger', 'passive', 'ต่อเนื่อง'),
  E('trigger', 'on_cast', 'เมื่อใช้เวท', 'unsupported', 'เวททำงานตาม ID ในเอนจิน ไม่ผ่าน Effect'),
  E('trigger', 'combo', 'พลังแฝง (Combo)', 'unsupported', 'เอนจินยังไม่มี Combo'),
  E('condition', 'target_destroyed', 'เป้าหมายถูกทำลายจากการโจมตี'), E('condition', 'target_hp_lower', 'HP ของเป้าหมายน้อยกว่าตัวเอง'),
  E('cost', 'discard_hand_1', 'ทิ้งการ์ดจากมือ 1 ใบ'),
  E('cost', 'sacrifice', 'สังเวยตัวละคร', 'unsupported', 'เอนจินยังไม่รองรับต้นทุนสังเวยใน Effect'),
  E('target', 'self', 'ตัวเอง'), E('target', 'allies', 'ตัวละครฝ่ายเราทุกใบ'), E('target', 'ally1', 'ตัวละครฝ่ายเรา 1 ใบ'),
  E('target', 'enemy1', 'ตัวละครฝ่ายตรงข้าม 1 ใบ'), E('target', 'deck', 'Main Deck'),
  E('action', 'atk_up', 'เพิ่ม ATK'), E('action', 'atk_down', 'ลด ATK'), E('action', 'damage', 'ลด HP (ความเสียหาย)'),
  E('action', 'heal', 'ฟื้น HP'), E('action', 'draw', 'จั่วการ์ด'), E('action', 'maxhp_up', 'เพิ่ม HP สูงสุด'),
  E('action', 'protect', 'ป้องกันการเลือกเป็นเป้าหมาย'), E('action', 'search_evo', 'ค้นการ์ด Evolution ขึ้นมือ'),
  E('duration', 'instant', 'ทันที'), E('duration', 'until_end_of_turn', 'จนจบเทิร์น'), E('duration', 'permanent', 'ถาวร'),
  E('duration', 'n_turns', 'N เทิร์น', 'unsupported', 'เอนจินยังไม่นับจำนวนเทิร์น'),
  E('use_limit', 'none', 'ไม่จำกัด'), E('use_limit', 'once_per_turn', '1 ครั้ง/เทิร์น'), E('use_limit', 'once_per_game', '1 ครั้ง/เกม'),
];
export const entries = (c: RegCategory) => REGISTRY.filter(e => e.category === c);
export const entryOf = (c: RegCategory, key: string | null | undefined) => REGISTRY.find(e => e.category === c && e.key === key);
export const STATUS_LABEL: Record<RegStatus, string> = { supported: 'Supported', experimental: 'Experimental', deprecated: 'Deprecated', unsupported: 'Unsupported' };
/** Registry statuses a card may carry into In review / Approved / Published. */
export const PUBLISHABLE: RegStatus[] = ['supported', 'experimental', 'deprecated'];

// The Thai wordings the engine parser (effects.ts) matches exactly. The Registry owns the mapping key <-> wording.
const TARGET_TXT: Record<string, string> = { self: 'ตัวเอง', allies: 'ตัวละครฝ่ายเราทุกใบ', ally1: 'ตัวละครฝ่ายเรา 1 ใบ', enemy1: 'ตัวละครฝ่ายตรงข้าม 1 ใบ', deck: 'Main Deck' };
const COND_TXT: Record<string, string> = { target_destroyed: 'เป้าหมายถูกทำลายจากการโจมตี', target_hp_lower: 'HP ของเป้าหมายน้อยกว่าตัวเอง' };
const COST_TXT: Record<string, string> = { discard_hand_1: 'ทิ้งการ์ดจากมือ 1 ใบ' };
const MINUS = '−';

export const AMOUNT_MIN = 1, AMOUNT_MAX = 99;
export const ACTIONS_WITH_AMOUNT = ['atk_up', 'atk_down', 'damage', 'draw', 'maxhp_up'];   // heal takes an amount OR "full"

/** A non-passive ATK boost is permanent when ticked OR when its duration is permanent (the engine reads it that way). */
const permEff = (s: SystemConfig) => s.trigger !== 'passive' && !!(s.perm || s.duration === 'permanent');
export function actionText(s: SystemConfig): string | null {
  const n = s.amount;
  switch (s.action) {
    case 'atk_up': return n ? `ATK +${n}` + (permEff(s) ? ' ถาวร' + (s.max ? ` (สูงสุด +${s.max})` : '') : '') : null;
    case 'atk_down': return n ? `ATK ${MINUS}${n}` : null;
    case 'damage': return n ? `HP ${MINUS}${n}` : null;
    case 'heal': return s.full ? 'ฟื้น HP เต็ม' : n ? `ฟื้น HP ${n}` : null;
    case 'draw': return n ? `จั่ว ${n} ใบ` : null;
    case 'maxhp_up': return n ? `HP +${n}` : null;
    case 'protect': return 'ป้องกันการเลือกเป็นเป้าหมาย';
    case 'search_evo': return 'ค้นการ์ด Evolution ขึ้นมือ';
  }
  return null;
}
export function toLegacy(s: SystemConfig): LegacyRow {
  return {
    trigger: s.trigger, condition_text: s.condition ? COND_TXT[s.condition] ?? null : null, cost_text: s.cost ? COST_TXT[s.cost] ?? null : null,
    target_text: TARGET_TXT[s.target] ?? null, action_text: actionText(s), duration: s.duration, duration_turns: null, use_limit: s.use_limit,
  };
}
const rev = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
/** Read an existing card_effects row back into a SystemConfig. null = the wording is not one the Registry knows (legacy / not active). */
export function fromLegacy(r: { trigger: string; condition_text?: string | null; cost_text?: string | null; target_text?: string | null; action_text?: string | null; duration?: string | null; use_limit?: string | null }): SystemConfig | null {
  const t = (v?: string | null) => (v ?? '').trim();
  const target = rev(TARGET_TXT)[t(r.target_text)], act = t(r.action_text);
  const condition = t(r.condition_text) ? rev(COND_TXT)[t(r.condition_text)] : null, cost = t(r.cost_text) ? rev(COST_TXT)[t(r.cost_text)] : null;
  if (!target || (t(r.condition_text) && !condition) || (t(r.cost_text) && !cost)) return null;
  const base = { trigger: r.trigger, condition: condition ?? null, cost: cost ?? null, target, duration: r.duration ?? 'instant', use_limit: r.use_limit ?? 'none' };
  let m: RegExpMatchArray | null;
  if ((m = act.match(new RegExp(`^ATK ${MINUS}(\\d+)$`)))) return { ...base, action: 'atk_down', amount: +m[1] };
  if ((m = act.match(new RegExp(`^HP ${MINUS}(\\d+)$`)))) return { ...base, action: 'damage', amount: +m[1] };
  if (act === 'ฟื้น HP เต็ม') return { ...base, action: 'heal', full: true };
  if ((m = act.match(/^ATK \+(\d+)(?: (ถาวร)(?: \(สูงสุด \+(\d+)\))?)?$/))) return { ...base, action: 'atk_up', amount: +m[1], perm: base.trigger !== 'passive' && (!!m[2] || base.duration === 'permanent'), max: m[3] ? +m[3] : null };
  if ((m = act.match(/^HP \+(\d+)$/))) return { ...base, action: 'maxhp_up', amount: +m[1] };
  if ((m = act.match(/^ฟื้น HP (\d+)$/))) return { ...base, action: 'heal', amount: +m[1] };
  if ((m = act.match(/^จั่ว (\d+) ใบ$/))) return { ...base, action: 'draw', amount: +m[1] };
  if (act === 'ป้องกันการเลือกเป็นเป้าหมาย') return { ...base, action: 'protect' };
  if (act === 'ค้นการ์ด Evolution ขึ้นมือ') return { ...base, action: 'search_evo' };
  return null;
}

/** Combination rules (what the engine can really run). Empty list = the configuration is valid and Supported. */
export function validateSystem(s: SystemConfig): Issue[] {
  const out: Issue[] = [];
  const bad = (fields: string[], code: string, message: string) => out.push({ fields, code, message });
  const need: [string, RegCategory][] = [['trigger', 'trigger'], ['target', 'target'], ['action', 'action'], ['duration', 'duration'], ['use_limit', 'use_limit']];
  for (const [f, c] of need) {
    const v = (s as any)[f] as string | undefined;
    if (!v) { bad([f], 'required', `ต้องเลือก ${f}`); continue; }
    const e = entryOf(c, v);
    if (!e) bad([f], 'unknown', `ค่า ${f} "${v}" ไม่อยู่ใน Registry`);
    else if (e.status === 'unsupported') bad([f], 'unsupported', `${e.label}: เอนจินยังไม่รองรับ${e.note ? ` (${e.note})` : ''}`);
  }
  for (const [f, c] of [['condition', 'condition'], ['cost', 'cost']] as [keyof SystemConfig, RegCategory][]) {
    const v = s[f] as string | null | undefined;
    if (!v) continue;
    const e = entryOf(c, v);
    if (!e) bad([f], 'unknown', `ค่า ${f} "${v}" ไม่อยู่ใน Registry`);
    else if (e.status === 'unsupported') bad([f], 'unsupported', `${e.label}: เอนจินยังไม่รองรับ${e.note ? ` (${e.note})` : ''}`);
  }
  if (out.length) return out;
  const { trigger: tr, target: tg, action: ac, duration: du } = s, passive = tr === 'passive';
  if (s.condition && tr !== 'on_attack') bad(['condition', 'trigger'], 'cond_trigger', 'เงื่อนไขใช้ได้กับ "เมื่อโจมตี" เท่านั้น');
  if (s.cost && ac !== 'draw') bad(['cost', 'action'], 'cost_action', 'ต้นทุน "ทิ้งการ์ดจากมือ" ใช้ได้กับการจั่วการ์ดเท่านั้น');
  if (passive && tg !== 'self' && tg !== 'allies') bad(['trigger', 'target'], 'passive_target', '"ต่อเนื่อง" เลือกเป้าหมายได้เฉพาะ ตัวเอง หรือ ฝ่ายเราทุกใบ');
  if ((tg === 'deck') !== (ac === 'search_evo')) bad(['target', 'action'], 'deck_search', 'Main Deck ใช้คู่กับ "ค้นการ์ด Evolution" เท่านั้น');
  if (ACTIONS_WITH_AMOUNT.includes(ac) || (ac === 'heal' && !s.full)) {
    const n = s.amount;
    if (!Number.isInteger(n) || (n as number) < AMOUNT_MIN || (n as number) > AMOUNT_MAX) bad(['action'], 'amount', `ค่าตัวเลขต้องเป็นจำนวนเต็ม ${AMOUNT_MIN}–${AMOUNT_MAX}`);
  }
  if (s.max != null && (ac !== 'atk_up' || !permEff(s))) bad(['action'], 'max_perm', 'ค่าสูงสุดใช้ได้กับ "เพิ่ม ATK ถาวร" ที่ไม่ใช่ต่อเนื่องเท่านั้น');
  if (s.max != null && s.amount != null && s.max < s.amount) bad(['action'], 'max_low', 'ค่าสูงสุดต้องไม่น้อยกว่าค่าที่เพิ่ม');
  if (s.full && ac !== 'heal') bad(['action'], 'full_heal', 'ฟื้นเต็มใช้ได้กับ "ฟื้น HP" เท่านั้น');
  const durOk = (want: string, why: string) => { if (du !== want) bad(['duration', 'action'], 'duration', why); };
  switch (ac) {
    case 'atk_up':
      if (passive) { durOk('permanent', '"เพิ่ม ATK" แบบต่อเนื่องต้องมีระยะเวลา ถาวร'); if (s.perm) bad(['action'], 'passive_perm', 'แบบต่อเนื่องไม่ต้องติ๊กถาวร'); }
      else if (permEff(s)) durOk('permanent', '"เพิ่ม ATK ถาวร" ต้องมีระยะเวลา ถาวร');
      else durOk('until_end_of_turn', '"เพิ่ม ATK" ชั่วคราวต้องมีระยะเวลา จนจบเทิร์น');
      break;
    case 'atk_down': durOk('until_end_of_turn', '"ลด ATK" ต้องมีระยะเวลา จนจบเทิร์น'); break;
    case 'maxhp_up': if (!passive) bad(['trigger', 'action'], 'passive_only', '"เพิ่ม HP สูงสุด" ใช้ได้กับจังหวะ ต่อเนื่อง เท่านั้น'); durOk('permanent', '"เพิ่ม HP สูงสุด" ต้องมีระยะเวลา ถาวร'); break;
    case 'damage': case 'heal':
      if (passive) bad(['trigger', 'action'], 'not_passive', 'การทำความเสียหาย/ฟื้น HP ใช้กับจังหวะ ต่อเนื่อง ไม่ได้');
      durOk('instant', 'การทำความเสียหาย/ฟื้น HP ต้องมีระยะเวลา ทันที'); break;
    case 'draw':
      if (passive) bad(['trigger', 'action'], 'not_passive', 'การจั่วใช้กับจังหวะ ต่อเนื่อง ไม่ได้');
      if (tg !== 'self') bad(['target', 'action'], 'draw_self', 'การจั่วเลือกเป้าหมายได้เฉพาะ ตัวเอง');
      durOk('instant', 'การจั่วต้องมีระยะเวลา ทันที'); break;
    case 'protect':
      if (tr !== 'on_summon' || tg !== 'self') bad(['trigger', 'target', 'action'], 'protect_rule', '"ป้องกันการเลือกเป็นเป้าหมาย" ใช้ได้กับ "เมื่อถูกเรียก" + ตัวเอง เท่านั้น');
      durOk('until_end_of_turn', '"ป้องกันการเลือกเป็นเป้าหมาย" ต้องมีระยะเวลา จนจบเทิร์น'); break;
    case 'search_evo':
      if (passive) bad(['trigger', 'action'], 'not_passive', 'การค้นการ์ดใช้กับจังหวะ ต่อเนื่อง ไม่ได้');
      durOk('instant', 'การค้นการ์ดต้องมีระยะเวลา ทันที'); break;
  }
  return out;
}

export interface OptionState { key: string; label: string; status: RegStatus; enabled: boolean; reason?: string }
/** Options of one dropdown with the ones that clash with the other selected values switched off (for the Editor). */
export function optionsFor(field: keyof SystemConfig & string, cat: RegCategory, s: SystemConfig): OptionState[] {
  return entries(cat).map(e => {
    if (e.status === 'unsupported') return { key: e.key, label: e.label, status: e.status, enabled: false, reason: e.note ?? 'ยังไม่รองรับ' };
    const next = { ...s, [field]: e.key } as SystemConfig;
    if (field === 'duration') next.perm = next.action === 'atk_up' && next.trigger !== 'passive' && e.key === 'permanent'; // perm follows duration in the editor
    const clash = validateSystem(next).find(i => i.fields.includes(field) && i.code !== 'required' && i.code !== 'amount');
    return { key: e.key, label: e.label, status: e.status, enabled: !clash, ...(clash ? { reason: clash.message } : {}) };
  });
}
