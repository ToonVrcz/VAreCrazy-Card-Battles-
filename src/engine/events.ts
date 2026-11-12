// Battle event stream: the engine records what actually happened (structured, perspective-free); viewEvents() turns it into a
// viewer-relative, redacted copy (0 = you, 1 = opponent) and formatEvent() into Thai text. Additive only: nothing here changes a rule.
import type { Game } from './game';

export type EventType =
  | 'turn_start' | 'phase_battle' | 'turn_timeout' | 'draw' | 'summon' | 'fuse' | 'set_trap' | 'cast' | 'trap_fired'
  | 'attack' | 'attack_cancelled' | 'attack_returned' | 'dmg' | 'lp' | 'destroyed' | 'swap' | 'buff' | 'heal' | 'poison' | 'noattack'
  | 'trap_destroyed' | 'revive' | 'protect' | 'search_evo' | 'discard' | 'evolve' | 'evolve_cancelled' | 'game_over';
export type Level = 'normal' | 'important' | 'special';
/** `p` = the player the event is about (actor, or owner of the thing that was hit). Numbers are real seats in the engine, viewer-relative after viewEvents. */
export interface GameEvent { id: number; turn: number; t: EventType; p: 0 | 1; card?: string; to?: string | null; v?: number; stat?: string; src?: string; why?: string }
export const MAX_EVENTS = 60;

/** Records one event on the game (called by the engine at the point where it really happens). */
export function emit(g: Game, e: Omit<GameEvent, 'id' | 'turn'>) {
  g.evSeq = (g.evSeq ?? 0) + 1;
  (g.events ??= []).push({ id: g.evSeq, turn: g.turn, ...e });
  if (g.events.length > MAX_EVENTS) g.events.splice(0, g.events.length - MAX_EVENTS);
}

/** Events as seen from `seat`: seats flipped so 0 = viewer, and information the viewer must not have removed (face-down trap name, card found in the opponent's deck). */
export function viewEvents(events: GameEvent[] | undefined, seat: 0 | 1): GameEvent[] {
  return (events ?? []).map(e => {
    const o: GameEvent = { ...e, p: (seat === 1 ? 1 - e.p : e.p) as 0 | 1 };
    if (e.p !== seat && (e.t === 'set_trap' || e.t === 'search_evo')) { delete o.card; if (e.t === 'search_evo') delete o.to; }
    return o;
  });
}

export const LEVEL: Record<EventType, Level> = {
  turn_start: 'normal', phase_battle: 'normal', turn_timeout: 'normal', draw: 'normal', summon: 'normal', set_trap: 'normal', attack: 'normal', dmg: 'normal', poison: 'normal', noattack: 'normal', trap_destroyed: 'normal', revive: 'normal',
  cast: 'important', trap_fired: 'important', attack_cancelled: 'important', attack_returned: 'important', lp: 'important', destroyed: 'important', swap: 'important', buff: 'important', heal: 'important', protect: 'important', search_evo: 'important', discard: 'important', evolve_cancelled: 'important',
  fuse: 'special', evolve: 'special', game_over: 'special',
};
const ICON: Record<EventType, string> = { turn_start: '⏳', phase_battle: '⚔️', turn_timeout: '⏱', draw: '🃏', summon: '✨', fuse: '🔮', set_trap: '🪤', cast: '📜', trap_fired: '⚡', attack: '🗡️', attack_cancelled: '🛡️', attack_returned: '↩️', dmg: '💥', lp: '💔', destroyed: '☠️', swap: '🔄', buff: '⬆️', heal: '💚', poison: '☣️', noattack: '⛔', trap_destroyed: '💨', revive: '🕯️', protect: '🛡️', search_evo: '🔎', discard: '🗑️', evolve: '🌟', evolve_cancelled: '✖️', game_over: '🏆' };

/** Viewer-relative text. Only states what the event says: numbers and names come straight from the engine; a missing name is left out, never guessed. */
export function formatEvent(e: GameEvent): { text: string; level: Level; icon: string } {
  const me = e.p === 0, who = me ? 'คุณ' : 'ฝ่ายตรงข้าม', of = me ? 'ของคุณ' : 'ของฝ่ายตรงข้าม', other = me ? 'ฝ่ายตรงข้าม' : 'คุณ', otherOf = me ? 'ของฝ่ายตรงข้าม' : 'ของคุณ';
  const c = e.card ? ` ${e.card}` : '', ch = (n?: string) => (n ? `ตัวละคร ${n}` : 'ตัวละคร');
  let text: string;
  switch (e.t) {
    case 'turn_start': text = `เทิร์น ${e.turn}: เทิร์น${of}เริ่มแล้ว`; break;
    case 'phase_battle': text = `${who}เข้าสู่เฟสต่อสู้`; break;
    case 'turn_timeout': text = `${who}หมดเวลา ระบบจบเทิร์นให้`; break;
    case 'draw': text = `${who}จั่วการ์ด ${e.v ?? 1} ใบ${e.src ? ` (${e.src})` : ''}`; break;
    case 'summon': text = `${who}เรียก${ch(e.card)}`; break;
    case 'fuse': text = `${who}ฟิวชั่น${c}${e.to ? ` + ${e.to}` : ''}`; break;
    case 'set_trap': text = e.card ? `${who}วางกับดัก ${e.card} ลงคว่ำ` : `${who}วางกับดักคว่ำ 1 ใบ`; break;
    case 'cast': text = `${who}ใช้เวทมนตร์${c}`; break;
    case 'trap_fired': text = `กับดัก${c} ${of}ทำงาน`; break;
    case 'attack': text = e.to ? `${ch(e.card)} ${of}โจมตี${ch(e.to)} ${otherOf}` : `${ch(e.card)} ${of}โจมตี${other}โดยตรง`; break;
    case 'attack_cancelled': text = `การโจมตีของ${ch(e.card)} ${of}ถูกยกเลิก`; break;
    case 'attack_returned': text = `${ch(e.card)} ${of}ถูกส่งกลับขึ้นมือ`; break;
    case 'dmg': text = `${ch(e.card)} ${of}ได้รับความเสียหาย ${e.v}${e.src ? ` (${e.src})` : ''}`; break;
    case 'lp': text = `${who}เสีย LP ${e.v}`; break;
    case 'destroyed': text = `${ch(e.card)} ${of}ถูกทำลาย`; break;
    case 'swap': text = `${who}สลับ${ch(e.card)} ${of} กับ${ch(e.to ?? undefined)} ${otherOf}`; break;
    case 'buff': text = `${ch(e.card)} ${of} ${(e.stat ?? 'atk').toUpperCase()} +${e.v}${e.src ? ` (${e.src})` : ''}`; break;
    case 'heal': text = `${ch(e.card)} ${of}ฟื้นฟู HP +${e.v}${e.src ? ` (${e.src})` : ''}`; break;
    case 'poison': text = `${ch(e.card)} ${of}ติดพิษ`; break;
    case 'noattack': text = `${who}ถูกห้ามโจมตีในเทิร์นถัดไป`; break;
    case 'trap_destroyed': text = `กับดัก${c} ${of}ถูกทำลาย`; break;
    case 'revive': text = `${who}นำ${ch(e.card)} จากสุสานขึ้นมือ`; break;
    case 'protect': text = `${ch(e.card)} ${of}ไม่สามารถถูกเลือกเป็นเป้าหมายในเทิร์นนี้`; break;
    case 'search_evo': text = e.to ? `${ch(e.card)} ${of}ค้นหาการ์ด ${e.to} ขึ้นมือ` : `${ch(e.card)} ${of}ค้นหาการ์ดวิวัฒนาการขึ้นมือ`; break;
    case 'discard': text = `${ch(e.card)} ${of}: ทิ้งการ์ด${e.to ? ` ${e.to}` : ''}`; break;
    case 'evolve': text = `${ch(e.card)} ${of}วิวัฒนาการเป็น ${e.to}`; break;
    case 'evolve_cancelled': text = `การวิวัฒนาการของ${ch(e.card)} ${of}ถูกยกเลิก`; break;
    case 'game_over': text = me ? `🎉 คุณชนะ! ${({ lp: `LP ของฝ่ายตรงข้ามหมด`, deck: `ฝ่ายตรงข้ามจั่วการ์ดไม่ได้`, timeout: `ฝ่ายตรงข้ามหมดเวลาหลายครั้ง`, absent: `ฝ่ายตรงข้ามหลุดจากห้อง`, left: `ฝ่ายตรงข้ามยอมแพ้` } as Record<string, string>)[e.why ?? ''] ?? ''}`.trim() : `💀 คุณแพ้ ${({ lp: `LP ของคุณหมด`, deck: `คุณจั่วการ์ดไม่ได้`, timeout: `คุณหมดเวลาหลายครั้ง`, absent: `คุณหลุดจากห้อง`, left: `คุณยอมแพ้` } as Record<string, string>)[e.why ?? ''] ?? ''}`.trim(); break;
  }
  return { text, level: LEVEL[e.t], icon: ICON[e.t] };
}

export interface Note { text: string; level: Level; icon: string; n?: number; noMerge?: boolean }
/** Collapses runs of small notices into "+N เหตุการณ์" once the queue is long (order is kept; Important/Special are never merged or dropped). */
export function squash(q: Note[], max = 5): Note[] {
  if (q.length <= max) return q;
  const o: Note[] = [];
  for (const it of q) { const p = o[o.length - 1]; if (it.level === 'normal' && p && p.level === 'normal' && !it.noMerge) { p.n = (p.n ?? 1) + 1; p.text = `+${p.n} เหตุการณ์`; p.icon = '…'; } else o.push({ ...it }); }
  return o;
}
/** Remembers which events a screen has already seen so the same event is never shown twice (poll repeats, re-renders, refresh). Pure; the caller queues and draws the returned notes. */
export function createNotifier(init: number | null = null) {
  let last = init, hist: string[] = [];
  return {
    get last() { return last; },
    reset(v: number | null) { last = v; hist = []; },
    /** `evs` = viewer-relative events still held by the game, `latest` = the game's evSeq. First call with no memory only records a baseline (no replay of old events). */
    ingest(evs: GameEvent[], latest: number, opts: { maxShown?: number } = {}): Note[] {
      if (last === null) { last = latest; hist = evs.map(e => formatEvent(e).text).slice(-40); return []; }
      const fresh = evs.filter(e => e.id > last!).sort((a, b) => a.id - b.id); if (!fresh.length) return [];
      const missed = Math.max(0, latest - last), gap = missed > fresh.length;
      last = Math.max(last, ...fresh.map(e => e.id));
      const f = fresh.map(formatEvent); hist = [...hist, ...f.map(x => x.text)].slice(-40);
      const cap = opts.maxShown ?? 3, show = gap ? f.slice(-cap) : f;
      return gap ? [{ text: `ระหว่างที่คุณไม่อยู่ มี ${missed} เหตุการณ์ (แสดง ${show.length} ล่าสุด)`, level: 'important', icon: '🕘', noMerge: true }, ...show] : show;
    },
    history(n: number) { return hist.slice(-n).reverse(); },
  };
}
