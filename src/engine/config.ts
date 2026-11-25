/** Per-game rules snapshot. Admin edits to game_rules / element_matrix are read when a game is CREATED and stored in the game (g.cfg),
 *  so a running game is never changed by an edit. Pure; shared by the server (resolve/validate) and the engine (apply). */
import elementsJson from '../../db/seed/elements.json' with { type: 'json' };

export const ELEMENT_KEYS = Object.keys(elementsJson.elements);
export interface GameConfig {
  lp: number; handMax: number; sacrifice: Record<number, number>; sacrificeSameLevel: boolean;
  strong: number; weak: number; elements: Record<string, string[]>;     // elements: attacker -> elements it is strong against
}
export const DEFAULT_CONFIG: GameConfig = {
  lp: 100, handMax: 10, sacrifice: { 40: 1, 70: 2, 99: 3 }, sacrificeSameLevel: true,
  strong: elementsJson.multiplier_strong, weak: elementsJson.multiplier_weak,
  elements: Object.fromEntries(Object.entries(elementsJson.elements as Record<string, { strong: string[] }>).map(([k, v]) => [k, [...v.strong]])),
};
/** Keys of game_rules that feed a game, with the shape check used when an admin edits them. Returns an error message or null. */
export const CONFIG_RULE_KEYS = ['starting_lp', 'hand_max', 'evolution_sacrifice', 'evolution_sacrifice_same_level', 'element_multiplier', 'element_matrix'] as const;

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const int = (v: unknown, lo: number, hi: number) => { const x = num(v); return Number.isInteger(x) && x >= lo && x <= hi ? x : null; };

export function validateRuleValue(key: string, value: unknown): string | null {
  switch (key) {
    case 'starting_lp': return int(value, 1, 9999) === null ? 'LP เริ่มต้นต้องเป็นจำนวนเต็ม 1–9999' : null;
    case 'hand_max': return int(value, 1, 20) === null ? 'ไพ่บนมือสูงสุดต้องเป็นจำนวนเต็ม 1–20' : null;
    case 'evolution_sacrifice_same_level': return typeof value === 'boolean' ? null : 'ต้องเป็น true หรือ false';
    case 'evolution_sacrifice': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return 'ต้องเป็น {"40":1,"70":2,"99":3}';
      const o = value as Record<string, unknown>;
      for (const k of ['40', '70', '99']) if (int(o[k], 0, 6) === null) return `จำนวนสังเวยของ Lv.${k} ต้องเป็นจำนวนเต็ม 0–6`;
      return null;
    }
    case 'element_multiplier': {
      const o = value as any; const s = num(o?.strong), w = num(o?.weak);
      if (!(s >= 1 && s <= 5)) return 'strong ต้องอยู่ระหว่าง 1–5';
      if (!(w > 0 && w <= 1)) return 'weak ต้องมากกว่า 0 และไม่เกิน 1';
      return null;
    }
    case 'element_matrix': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return 'ต้องเป็นออบเจ็กต์ {ธาตุผู้โจมตี: [ธาตุที่ชนะ]}';
      for (const [a, list] of Object.entries(value as Record<string, unknown>)) {
        if (!ELEMENT_KEYS.includes(a)) return `ไม่รู้จักธาตุ "${a.slice(0, 20)}"`;
        if (!Array.isArray(list) || list.some(d => typeof d !== 'string' || !ELEMENT_KEYS.includes(d))) return `รายการของ ${a} ต้องเป็นรายชื่อธาตุที่รู้จัก`;
        if ((list as string[]).includes(a)) return `${a} ชนะธาตุตัวเองไม่ได้`;
      }
      return null;
    }
  }
  return null;
}

/** Build the snapshot from game_rules rows. Any missing or invalid row falls back to the default (never throws), so a bad edit cannot break new games. */
export function resolveConfig(rows: { key: string; value: unknown }[]): GameConfig {
  const m = new Map(rows.map(r => [r.key, r.value])), ok = (k: string) => m.has(k) && validateRuleValue(k, m.get(k)) === null;
  const c: GameConfig = structuredClone(DEFAULT_CONFIG);
  if (ok('starting_lp')) c.lp = int(m.get('starting_lp'), 1, 9999)!;
  if (ok('hand_max')) c.handMax = int(m.get('hand_max'), 1, 20)!;
  if (ok('evolution_sacrifice_same_level')) c.sacrificeSameLevel = m.get('evolution_sacrifice_same_level') as boolean;
  if (ok('evolution_sacrifice')) { const o = m.get('evolution_sacrifice') as any; c.sacrifice = { 40: num(o['40']), 70: num(o['70']), 99: num(o['99']) }; }
  if (ok('element_multiplier')) { const o = m.get('element_multiplier') as any; c.strong = num(o.strong); c.weak = num(o.weak); }
  if (ok('element_matrix')) c.elements = Object.fromEntries(Object.entries(m.get('element_matrix') as Record<string, string[]>).map(([k, v]) => [k, [...v]]));
  return c;
}
