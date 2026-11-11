// Turn timers and disconnect handling for online rooms (and the Universe module). Pure functions; no db, no clock of their own.
import { act, type Game } from './game.ts';

export const TIMING = { turnMs: 90_000, maxMisses: 3, absentMs: 120_000, seenRefreshMs: 10_000 } as const;
export type EndReason = 'timeout' | 'absent' | 'left';
export interface RoomMeta { deadline: number | null; misses: [number, number]; seen: [number | null, number | null]; endReason?: EndReason | null; forfeit?: 0 | 1 | null; rewarded?: boolean; rewards?: ({ points: number; vrcoin: number; matches: number } | null)[] }

export const mover = (g: Game): 0 | 1 => (g.pending ? g.pending.responder : g.active);
export const newMeta = (now: number): RoomMeta => ({ deadline: now + TIMING.turnMs, misses: [0, 0], seen: [now, now], endReason: null, forfeit: null });

/** Ends the current mover's turn the way a player would: pass a pending chain window, or press "next" until the turn changes. */
export function autoEndTurn(g: Game): Game {
  if (g.pending) return act(g, { t: 'pass' });
  const turn = g.turn; let cur = g;
  for (let i = 0; i < 3 && cur.turn === turn && cur.winner === null && !cur.pending; i++) cur = act(cur, { t: 'next' });
  return cur;
}

export function forfeit(g: Game, seat: 0 | 1, reason: EndReason, meta: RoomMeta): void {
  g.winner = (1 - seat) as 0 | 1; g.pending = undefined;
  g.log.push(`T${g.turn}: ผู้เล่น ${seat + 1} ${reason === 'timeout' ? 'หมดเวลาหลายครั้ง' : reason === 'absent' ? 'หลุดจากห้อง' : 'ยอมแพ้'}`);
  meta.deadline = null; meta.endReason = reason; meta.forfeit = seat;
}

/** Whether a poll/act at `now` could change anything (so the caller knows to take the write path). */
export function needsTick(g: Game, meta: RoomMeta, seat: 0 | 1, now: number): boolean {
  if (g.winner !== null) return false;
  const opp = (1 - seat) as 0 | 1;
  return (meta.deadline !== null && now >= meta.deadline)
    || meta.seen[seat] === null || now - (meta.seen[seat] as number) > TIMING.seenRefreshMs
    || (meta.seen[opp] !== null && now - (meta.seen[opp] as number) > TIMING.absentMs);
}

/** One step of housekeeping by whoever is asking (`seat`). Returns the (possibly new) game and whether the game itself changed. */
export function tickRoom(g: Game, meta: RoomMeta, seat: 0 | 1, now: number): { game: Game; changed: boolean } {
  meta.seen[seat] = now;
  if (g.winner !== null) return { game: g, changed: false };
  const opp = (1 - seat) as 0 | 1;
  if (meta.seen[opp] !== null && now - (meta.seen[opp] as number) > TIMING.absentMs) { forfeit(g, opp, 'absent', meta); return { game: g, changed: true }; }
  if (meta.deadline !== null && now >= meta.deadline) {
    const m = mover(g);
    if (++meta.misses[m] >= TIMING.maxMisses) { forfeit(g, m, 'timeout', meta); return { game: g, changed: true }; }
    let next = g; try { next = autoEndTurn(g); } catch { /* engine refused: keep state, restart the clock */ }
    meta.deadline = next.winner !== null ? null : now + TIMING.turnMs;
    return { game: next, changed: true };
  }
  return { game: g, changed: false };
}
