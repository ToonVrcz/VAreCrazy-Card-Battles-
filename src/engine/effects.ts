// Character abilities (card_effects rows made in Admin) turned into values the engine can run.
// The Admin rows keep free-text fields; this parser accepts ONLY wordings it knows exactly. Anything else returns null:
// that ability is then not executed and the UI keeps it marked "not active" (never guessed).
export type EffectTrigger = 'on_attack' | 'on_summon' | 'on_evolve' | 'on_destroyed' | 'to_graveyard' | 'turn_start' | 'turn_end' | 'passive';
export interface Effect {
  trigger: EffectTrigger;
  target: 'self' | 'allies' | 'ally1' | 'enemy1' | 'deck';   // allies = every character of the owner on the field (including the source); ally1/enemy1 = ONE character the owner chooses
  cond?: 'target_destroyed' | 'target_hp_lower';
  kind: 'atk' | 'heal' | 'draw' | 'maxhp' | 'damage' | 'protect' | 'search_evo';
  amount: number;                            // atk: negative = lowering ATK
  cost?: 'discard1';                         // the owner must discard one card from hand to use it (draw only)
  full?: boolean;                            // heal: back to full HP
  perm?: boolean;                            // ATK stays until the unit leaves the field (otherwise until the end of the turn)
  max?: number;                              // permanent ATK from this effect never exceeds this total per unit
  limit: 'none' | 'turn' | 'game';           // none / once per turn / once per game (per character on the field)
  text: string;                              // the description players read (written in Admin)
}
export interface EffectRow {
  trigger: string; target_text?: string | null; action_text?: string | null; condition_text?: string | null; cost_text?: string | null;
  duration?: string | null; use_limit?: string | null; description?: string | null;
}
const TRIGGERS = ['on_attack', 'on_summon', 'on_evolve', 'on_destroyed', 'to_graveyard', 'turn_start', 'turn_end', 'passive'];
const TARGETS: Record<string, Effect['target']> = { 'ตัวเอง': 'self', 'ตัวละครฝ่ายเราทุกใบ': 'allies', 'ตัวละครฝ่ายเรา 1 ใบ': 'ally1', 'ตัวละครฝ่ายตรงข้าม 1 ใบ': 'enemy1', 'Main Deck': 'deck' };
const LIMITS: Record<string, Effect['limit']> = { none: 'none', once_per_turn: 'turn', once_per_game: 'game' };

export function parseEffect(r: EffectRow): Effect | null {
  const e = parseRaw(r);
  if (!e) return null;
  if ((e.target === 'deck') !== (e.kind === 'search_evo')) return null;          // the deck is only a target for "search Evolution"
  if ((e.kind === 'protect') && (e.trigger !== 'on_summon' || e.target !== 'self')) return null;
  return e;
}
function parseRaw(r: EffectRow): Effect | null {
  const cost = (r.cost_text ?? '').trim();
  if (!TRIGGERS.includes(r.trigger) || (cost && cost !== 'ทิ้งการ์ดจากมือ 1 ใบ')) return null;
  const target = TARGETS[(r.target_text ?? '').trim()], limit = LIMITS[r.use_limit ?? 'none'], act = (r.action_text ?? '').trim();
  if (!target || !limit) return null;
  if (cost && !/^จั่ว \d+ ใบ$/.test(act)) return null;                      // the only cost the engine knows is "discard 1 to draw"
  const trigger = r.trigger as EffectTrigger, text = (r.description ?? act).trim();
  let cond: Effect['cond'];
  const ct = (r.condition_text ?? '').trim();
  if (ct) {
    if (trigger !== 'on_attack') return null;
    if (ct === 'เป้าหมายถูกทำลายจากการโจมตี') cond = 'target_destroyed'; else if (ct === 'HP ของเป้าหมายน้อยกว่าตัวเอง') cond = 'target_hp_lower'; else return null;
  }
  let m: RegExpMatchArray | null;
  if (trigger === 'passive' && target !== 'self' && target !== 'allies') return null;
  if ((m = act.match(/^ATK −(\d+)$/)) && r.duration === 'until_end_of_turn') return { trigger, target, cond, kind: 'atk', amount: -+m[1], perm: false, limit, text };
  if ((m = act.match(/^HP −(\d+)$/)) && r.duration === 'instant' && trigger !== 'passive') return { trigger, target, cond, kind: 'damage', amount: +m[1], limit, text };
  if (act === 'ฟื้น HP เต็ม' && r.duration === 'instant' && trigger !== 'passive') return { trigger, target, cond, kind: 'heal', amount: 0, full: true, limit, text };
  if ((m = act.match(/^ATK \+(\d+)(?: (ถาวร)(?: \(สูงสุด \+(\d+)\))?)?$/))) {
    const perm = !!m[2] || r.duration === 'permanent';
    if (trigger === 'passive') return r.duration === 'permanent' && !m[2] ? { trigger, target, kind: 'atk', amount: +m[1], limit, text } : null;
    if (!perm && r.duration !== 'until_end_of_turn') return null;
    return { trigger, target, cond, kind: 'atk', amount: +m[1], perm, max: m[3] ? +m[3] : undefined, limit, text };
  }
  if (trigger === 'passive') return (m = act.match(/^HP \+(\d+)$/)) && r.duration === 'permanent' ? { trigger, target, kind: 'maxhp', amount: +m[1], limit, text } : null;
  if ((m = act.match(/^ฟื้น HP (\d+)$/)) && r.duration === 'instant') return { trigger, target, cond, kind: 'heal', amount: +m[1], limit, text };
  if ((m = act.match(/^จั่ว (\d+) ใบ$/)) && r.duration === 'instant' && target === 'self') return { trigger, target, cond, kind: 'draw', amount: +m[1], limit, text, cost: cost ? 'discard1' : undefined };
  if (cost) return null;
  if (act === 'ป้องกันการเลือกเป็นเป้าหมาย' && r.duration === 'until_end_of_turn') return { trigger, target, kind: 'protect', amount: 0, limit, text };
  if (act === 'ค้นการ์ด Evolution ขึ้นมือ' && r.duration === 'instant') return { trigger, target, kind: 'search_evo', amount: 1, limit, text };
  return null;
}
