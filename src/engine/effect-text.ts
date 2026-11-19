// Player-facing text rules for the CMS: per-field limits, Unicode-safe counting and the warn-only consistency check.
// Pure functions shared by the Admin page (via the generated public/admin-tools.js) and the server.
import type { SystemConfig } from './effect-registry';

/** Character limits (Unicode code points). Change here = changes both the Editor and the server. */
export const LIMITS = { effect_name: 30, description: 180, special_condition_text: 120, flavor_text: 200, rules_text: 240 } as const;
export type LimitField = keyof typeof LIMITS;

/** NFC, no control characters (newline kept), no zero-width characters, trimmed. Same result on the client and the server. */
export function normalizeText(s: unknown): string {
  return String(s ?? '').normalize('NFC').replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '').replace(/[​-‍⁠﻿]/g, '').trim();
}
/** Length in Unicode code points (not String.length, which counts emoji as 2). */
export const cpLen = (s: string) => Array.from(s).length;
export function checkLimit(field: LimitField, raw: unknown): { text: string; len: number; max: number; over: boolean } {
  const text = normalizeText(raw), len = cpLen(text), max = LIMITS[field];
  return { text, len, max, over: len > max };
}
/** Counter colour for the Editor: ok (<90%), near (>=90%), over. */
export const counterState = (len: number, max: number) => (len > max ? 'over' : len >= max * 0.9 ? 'near' : 'ok');

export interface Warning { code: string; field: 'description'; message: string }
const hasAny = (t: string, words: string[]) => words.some(w => t.includes(w));
const TRIGGER_WORDS: Record<string, string[]> = { on_summon: ['เรียก'], on_attack: ['โจมตี'], on_evolve: ['วิวัฒนาการ'], on_destroyed: ['ทำลาย'], to_graveyard: ['สุสาน'], turn_start: ['เริ่มเทิร์น'], turn_end: ['จบเทิร์น'] };
const ENEMY = ['ศัตรู', 'ฝ่ายตรงข้าม', 'คู่ต่อสู้'];

/** Warn-only: does the Thai description agree with the System Configuration? Heuristic word/number matching, never edits anything. */
export function consistencyWarnings(s: Partial<SystemConfig>, description: string): Warning[] {
  const t = normalizeText(description), out: Warning[] = [];
  const w = (code: string, message: string) => out.push({ code, field: 'description', message });
  if (!t) return out;
  const nums = (t.match(/\d+/g) ?? []).map(Number);
  const known = new Set<number>([1, ...[s.amount, s.max].filter((x): x is number => typeof x === 'number')]);
  if (typeof s.amount === 'number' && !nums.includes(s.amount)) w('amount_missing', `ค่าในระบบคือ ${s.amount} แต่ข้อความไม่มีตัวเลขนี้`);
  const stray = [...new Set(nums.filter(n => !known.has(n)))];
  if (stray.length) w('amount_mismatch', `ข้อความมีตัวเลข ${stray.join(', ')} ที่ไม่ตรงกับค่าในระบบ${typeof s.amount === 'number' ? ` (${s.amount}${s.max ? ` / สูงสุด ${s.max}` : ''})` : ''}`);
  if (s.duration === 'permanent' && !hasAny(t, ['ถาวร', 'ตลอด', 'ต่อเนื่อง'])) w('duration_permanent', 'ระยะเวลาในระบบคือ ถาวร แต่ข้อความไม่พูดถึง');
  if (s.duration === 'until_end_of_turn' && !hasAny(t, ['จบเทิร์น', 'สิ้นเทิร์น', 'ในเทิร์น'])) w('duration_turn', 'ระยะเวลาในระบบคือ จนจบเทิร์น แต่ข้อความไม่พูดถึง');
  if (s.duration && s.duration !== 'permanent' && t.includes('ถาวร')) w('duration_extra_permanent', 'ข้อความพูดถึง "ถาวร" แต่ระยะเวลาในระบบไม่ใช่ ถาวร');
  const perTurn = /เทิร์นละ ?1|1 ?ครั้ง ?\/ ?เทิร์น|ต่อเทิร์น/.test(t), perGame = /เกมละ ?1|1 ?ครั้ง ?\/ ?เกม|ต่อเกม/.test(t);
  const repeating = !s.trigger || ['on_attack', 'turn_start', 'turn_end', 'passive'].includes(s.trigger);   // one-shot triggers are naturally limited, so their text rarely says it
  if (repeating && s.use_limit === 'once_per_turn' && !perTurn) w('limit_turn', 'ขีดจำกัดในระบบคือ 1 ครั้ง/เทิร์น แต่ข้อความไม่พูดถึง');
  if (repeating && s.use_limit === 'once_per_game' && !perGame) w('limit_game', 'ขีดจำกัดในระบบคือ 1 ครั้ง/เกม แต่ข้อความไม่พูดถึง');
  if (s.use_limit === 'none' && (perTurn || perGame)) w('limit_extra', 'ข้อความพูดถึงขีดจำกัดการใช้ แต่ในระบบเป็น ไม่จำกัด');
  const enemyText = hasAny(t, ENEMY);
  if (s.target === 'enemy1' && !enemyText) w('target_enemy', 'เป้าหมายในระบบคือฝ่ายตรงข้าม แต่ข้อความไม่พูดถึง');
  if (s.target && s.target !== 'enemy1' && enemyText && s.trigger !== 'on_attack' && s.action !== 'protect') w('target_side', 'ข้อความพูดถึงฝ่ายตรงข้าม แต่เป้าหมายในระบบเป็นฝ่ายเรา');
  if (s.cost === 'discard_hand_1' && !t.includes('ทิ้ง')) w('cost_missing', 'ต้นทุนในระบบคือทิ้งการ์ดจากมือ แต่ข้อความไม่พูดถึง');
  if (!s.cost && hasAny(t, ['ทิ้งการ์ด', 'สังเวย'])) w('cost_unlisted', 'ข้อความพูดถึงต้นทุน (ทิ้ง/สังเวย) แต่ในระบบไม่มีต้นทุน');
  const tw = s.trigger ? TRIGGER_WORDS[s.trigger] : undefined;
  if (tw && !hasAny(t, tw)) w('trigger_missing', `จังหวะในระบบไม่ปรากฏในข้อความ (คาดว่าจะมีคำว่า "${tw[0]}")`);
  return out;
}
