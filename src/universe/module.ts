// VAreCrazy Card Battle as a Universe "module game" (start/act/tick/deadline/view/outcome).
// NOT connected to anything yet: this file only has to satisfy the contract in ./contract.ts and be fully tested here.
// Content (the card pool + fusion pairs) arrives through ctx.content, as the platform does for other games' word libraries.
import { createGame, act as engineAct, EngineError, type Action, type CardDef, type FusionPair, type Game } from '../engine/game.ts';
import { buildDeck, viewFor } from '../engine/deck-view.ts';
import type { GameModule, ModuleSeat, ModuleCtx, ActResult, ModuleOutcome } from './contract.ts';

export interface CardBattleContent { pool: CardDef[]; pairs: FusionPair[] }
export interface CardBattleSettings { turnSeconds: number; maxMisses: number }
export interface CardBattleState {
  game: Game;
  seatIds: [string, string];      // seat 0 / seat 1 -> Universe player ids
  settings: CardBattleSettings;
  deadline: number | null;        // ms epoch; null once finished
  misses: [number, number];       // consecutive timed-out turns per seat
  forfeit: 0 | 1 | null;          // seat that left or timed out too often
}
export type CardBattleView = ReturnType<typeof viewFor> & { you: 0 | 1; seatIds: [string, string]; deadline: number | null; forfeit: 0 | 1 | null } | { spectator: true; deadline: number | null };

export const POINTS = { win: 10, lose: 2 } as const;
const DEFAULTS: CardBattleSettings = { turnSeconds: 90, maxMisses: 3 };
const clamp = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
const seatOf = (s: CardBattleState, id: string): 0 | 1 | -1 => (s.seatIds[0] === id ? 0 : s.seatIds[1] === id ? 1 : -1);
const mover = (g: Game): 0 | 1 => (g.pending ? g.pending.responder : g.active);
const done = (s: CardBattleState) => s.game.winner !== null || s.forfeit !== null;
const winnerSeat = (s: CardBattleState): 0 | 1 | null => (s.forfeit !== null ? ((1 - s.forfeit) as 0 | 1) : s.game.winner);

export const cardBattleModule: GameModule<CardBattleState, CardBattleView, CardBattleSettings> = {
  id: 'card_battle', minPlayers: 2, maxPlayers: 2,
  defaultSettings: () => ({ ...DEFAULTS }),
  sanitizeSettings(input) { const o = (input ?? {}) as any; return { turnSeconds: clamp(o.turnSeconds, 20, 300, DEFAULTS.turnSeconds), maxMisses: clamp(o.maxMisses, 1, 10, DEFAULTS.maxMisses) }; },

  start(seats, settings, ctx) {
    const c = ctx.content as CardBattleContent | undefined;
    if (!c || !Array.isArray(c.pool) || c.pool.filter(x => x.type === 'character' && x.level === 15).length < 3) throw new Error('card_battle: ctx.content needs a card pool');
    if (seats.length !== 2) throw new Error('card_battle: exactly 2 seats');
    const [a, b] = [...seats].sort((x, y) => x.seatNumber - y.seatNumber);
    const first = (ctx.random() < 0.5 ? 0 : 1) as 0 | 1;
    const game = createGame([buildDeck(c.pool, c.pairs, ctx.random), buildDeck(c.pool, c.pairs, ctx.random)], Math.floor(ctx.random() * 1e9), first, { fusionPairs: c.pairs, interactive: true });
    return { game, seatIds: [a.id, b.id], settings, deadline: ctx.now + settings.turnSeconds * 1000, misses: [0, 0], forfeit: null };
  },

  act(s, _seats, playerId, action, ctx): ActResult {
    if (done(s)) return { ok: false, error: 'game over' };
    const seat = seatOf(s, playerId);
    if (seat < 0) return { ok: false, error: 'not seated' };
    if (mover(s.game) !== seat) return { ok: false, error: 'not your turn' };
    try { s.game = engineAct(s.game, action as Action); }
    catch (e) { if (e instanceof EngineError) return { ok: false, error: e.message }; throw e; }
    s.misses[seat] = 0;
    s.deadline = done(s) ? null : ctx.now + s.settings.turnSeconds * 1000;
    return { ok: true };
  },

  // Time up: the player on the move is passed/ended automatically; too many misses in a row = forfeit. A seat that left forfeits at once.
  tick(s, seats, ctx) {
    if (done(s)) return false;
    const present = new Set(seats.map(x => x.id));
    const gone = ([0, 1] as const).find(i => !present.has(s.seatIds[i]));
    if (gone !== undefined) { s.forfeit = gone; s.deadline = null; return true; }
    if (s.deadline === null || ctx.now < s.deadline) return false;
    const m = mover(s.game);
    if (++s.misses[m] >= s.settings.maxMisses) { s.forfeit = m; s.deadline = null; return true; }
    try {
      if (s.game.pending) s.game = engineAct(s.game, { t: 'pass' });
      else { const turn = s.game.turn; for (let i = 0; i < 3 && s.game.turn === turn && s.game.winner === null && !s.game.pending; i++) s.game = engineAct(s.game, { t: 'next' }); }   // main -> battle -> next turn
    } catch { /* engine refused: just restart the clock */ }
    s.deadline = done(s) ? null : ctx.now + s.settings.turnSeconds * 1000;
    return true;
  },

  deadline: s => (done(s) ? null : s.deadline),

  view(s, _seats, viewerId) {
    const seat = seatOf(s, viewerId);
    if (seat < 0) return { spectator: true, deadline: s.deadline };
    return { ...viewFor(s.game, seat), you: seat, seatIds: s.seatIds, deadline: s.deadline, forfeit: s.forfeit };
  },

  outcome(s): ModuleOutcome | null {
    const w = winnerSeat(s); if (w === null) return null;
    const win = s.seatIds[w], lose = s.seatIds[1 - w];
    return { winners: [win], winnerFaction: 'SOLO',
      roles: { [win]: { role: 'duelist', faction: 'SOLO' }, [lose]: { role: 'duelist', faction: 'SOLO' } },
      points: { [win]: POINTS.win, [lose]: POINTS.lose } };
  },

  silenced: () => null,
};
