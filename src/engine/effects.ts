// Character abilities (card_effects rows made in Admin) turned into values the engine can run.
// The Admin rows keep free-text fields; this parser accepts ONLY wordings it knows exactly. Anything else returns null:
// that ability is then not executed and the UI keeps it marked "not active" (never guessed).
export type EffectTrigger = 'on_attack' | 'on_summon' | 'turn_start' | 'turn_end' | 'passive';
export interface Effect {
  trigger: EffectTrigger;
  target: 'self' | 'allies';                 // allies = every character of the owner on the field (including the source)
  cond?: 'target_destroyed' | 'target_hp_lower';
  kind: 'atk' | 'heal' | 'draw' | 'maxhp';
  amount: number;
  perm?: boolean;                            // ATK stays until the unit leaves the field (otherwise until the end of the turn)
  max?: number;                              // permanent ATK from this effect never exceeds this total per unit
  limit: 'none' | 'turn' | 'game';           // none / once per turn / once per game (per character on the field)
  text: string;                              // the description players read (written in Admin)
}
export interface EffectRow {
  trigger: string; target_text?: string | null; action_text?: string | null; condition_text?: string | null; cost_text?: string | null;
  duration?: string | null; use_limit?: string | null; description?: string | null;
}
const TRIGGERS = ['on_attack', 'on_summon', 'turn_start', 'turn_end', 'passive'];
const TARGETS: Record<string, Effect['target']> = { 'ตัวเอง': 'self', 'ตัวละครฝ่ายเราทุกใบ': 'allies' };
const LIMITS: Record<string, Effect['limit']> = { none: 'none', once_per_turn: 'turn', once_per_game: 'game' };

export function parseEffect(r: EffectRow): Effect | null {
  if (!TRIGGERS.includes(r.trigger) || r.cost_text) return null;
  const target = TARGETS[(r.target_text ?? '').trim()], limit = LIMITS[r.use_limit ?? 'none'], act = (r.action_text ?? '').trim();
  if (!target || !limit) return null;
  const trigger = r.trigger as EffectTrigger, text = (r.description ?? act).trim();
  let cond: Effect['cond'];
  const ct = (r.condition_text ?? '').trim();
  if (ct) {
    if (trigger !== 'on_attack') return null;
    if (ct === 'เป้าหมายถูกทำลายจากการโจมตี') cond = 'target_destroyed'; else if (ct === 'HP ของเป้าหมายน้อยกว่าตัวเอง') cond = 'target_hp_lower'; else return null;
  }
  let m: RegExpMatchArray | null;
  if ((m = act.match(/^ATK \+(\d+)(?: (ถาวร)(?: \(สูงสุด \+(\d+)\))?)?$/))) {
    const perm = !!m[2] || r.duration === 'permanent';
    if (trigger === 'passive') return r.duration === 'permanent' && !m[2] ? { trigger, target, kind: 'atk', amount: +m[1], limit, text } : null;
    if (!perm && r.duration !== 'until_end_of_turn') return null;
    return { trigger, target, cond, kind: 'atk', amount: +m[1], perm, max: m[3] ? +m[3] : undefined, limit, text };
  }
  if (trigger === 'passive') return (m = act.match(/^HP \+(\d+)$/)) && r.duration === 'permanent' ? { trigger, target, kind: 'maxhp', amount: +m[1], limit, text } : null;
  if ((m = act.match(/^ฟื้น HP (\d+)$/)) && r.duration === 'instant') return { trigger, target, cond, kind: 'heal', amount: +m[1], limit, text };
  if ((m = act.match(/^จั่ว (\d+) ใบ$/)) && r.duration === 'instant' && target === 'self') return { trigger, target, cond, kind: 'draw', amount: +m[1], limit, text };
  return null;
}
