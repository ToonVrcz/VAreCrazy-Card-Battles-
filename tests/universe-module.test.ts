import { describe, it, expect } from 'vitest';
import { cardBattleModule as M, POINTS, type CardBattleState } from '../src/universe/module';
import { botPick } from '../src/engine/bot';
import type { CardDef } from '../src/engine/game';
import type { ModuleSeat, ModuleCtx } from '../src/universe/contract';

const seeded = (s: number) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pool: CardDef[] = [];
for (let i = 0; i < 8; i++) for (const [lv, hp, atk] of [[15, 30, 12], [40, 50, 20], [70, 80, 30]] as const)
  pool.push({ id: `C${i}-${lv}`, name: `c${i}-${lv}`, type: 'character', level: lv, chain: `ch${i}`, hp, atk, def: 2, element: 'fire' });
const seats: ModuleSeat[] = [{ id: 'u-alice', displayName: 'Alice', seatNumber: 1 }, { id: 'u-bob', displayName: 'Bob', seatNumber: 2 }];
const mkctx = (now = 1000, seed = 7): ModuleCtx => ({ now, random: seeded(seed), content: { pool, pairs: [] } });
const fresh = (seed = 7, now = 1000) => M.start(seats, M.defaultSettings(), mkctx(now, seed));
const idOf = (s: CardBattleState, seat: 0 | 1) => s.seatIds[seat];

describe('card_battle module (Universe contract, not connected)', () => {
  it('start: needs content and exactly 2 seats; deadline set', () => {
    expect(() => M.start(seats, M.defaultSettings(), { now: 0, random: seeded(1) })).toThrow(/card pool/);
    expect(() => M.start(seats.slice(0, 1), M.defaultSettings(), mkctx())).toThrow(/2 seats/);
    const s = fresh(); expect(M.deadline(s)).toBe(1000 + 90 * 1000); expect(M.outcome(s)).toBeNull();
    expect(s.game.interactive).toBe(true);
  });
  it('sanitizeSettings clamps and falls back', () => {
    expect(M.sanitizeSettings({ turnSeconds: 5, maxMisses: 99 })).toEqual({ turnSeconds: 20, maxMisses: 10 });
    expect(M.sanitizeSettings('x')).toEqual(M.defaultSettings());
  });
  it('act: wrong player / bad move leave state untouched; good move resets deadline', () => {
    const s = fresh(), m = s.game.active, other = idOf(s, (1 - m) as 0 | 1), me = idOf(s, m);
    const before = JSON.stringify(s);
    expect(M.act(s, seats, other, { t: 'next' }, mkctx(2000))).toEqual({ ok: false, error: 'not your turn' });
    expect(M.act(s, seats, 'stranger', { t: 'next' }, mkctx(2000))).toMatchObject({ ok: false });
    expect(M.act(s, seats, me, { t: 'summon', hand: 99, slot: 0 }, mkctx(2000))).toMatchObject({ ok: false });
    expect(JSON.stringify(s)).toBe(before);
    expect(M.act(s, seats, me, { t: 'next' }, mkctx(5000))).toEqual({ ok: true });
    expect(M.deadline(s)).toBe(5000 + 90 * 1000);
  });
  it('view: seat-relative, no opponent secrets, no seed; spectators get nothing', () => {
    const s = fresh(), v: any = M.view(s, seats, 'u-bob');
    expect(v.you).toBe(1); expect(v.seed).toBe(0);
    expect(v.players[1].hand.every((c: any) => c.id === '?')).toBe(true);
    expect(v.players[0].deck.every((c: any) => c.id === '?')).toBe(true);
    expect(M.view(s, seats, 'nobody')).toEqual({ spectator: true, deadline: s.deadline });
    expect(JSON.stringify(M.view(s, seats, 'u-alice'))).not.toContain('"seed":' + s.game.seed);
  });
  it('plays a whole game bot vs bot through the contract; outcome reports winner + points', () => {
    const s = fresh(11); let now = 1000;
    for (let i = 0; i < 4000 && M.outcome(s) === null; i++) {
      const g = s.game, mv = g.pending ? g.pending.responder : g.active;
      expect(M.act(s, seats, idOf(s, mv), botPick(g), mkctx(now += 100))).toEqual({ ok: true });
    }
    const o = M.outcome(s)!; expect(o).not.toBeNull();
    const w = idOf(s, s.game.winner!), l = idOf(s, (1 - s.game.winner!) as 0 | 1);
    expect(o.winners).toEqual([w]); expect(o.points).toEqual({ [w]: POINTS.win, [l]: POINTS.lose });
    expect(M.deadline(s)).toBeNull(); expect(M.act(s, seats, w, { t: 'next' }, mkctx())).toMatchObject({ ok: false });
    expect(M.tick(s, seats, mkctx(9e9))).toBe(false);
  });
  it('tick: timeout auto-ends the turn, third miss in a row forfeits', () => {
    const s = fresh(), start = s.game.active;
    expect(M.tick(s, seats, mkctx(1000 + 89_000))).toBe(false);
    expect(M.tick(s, seats, mkctx(1000 + 91_000))).toBe(true);
    expect(s.game.active).toBe(1 - start); expect(s.misses[start]).toBe(1);
    // same seat keeps missing: simulate by ticking repeatedly
    let t = 1000 + 91_000; for (let i = 0; i < 6 && M.outcome(s) === null; i++) { t += 100_000; M.tick(s, seats, mkctx(t)); }
    const o = M.outcome(s)!; expect(o.winners).toHaveLength(1); expect(s.forfeit).not.toBeNull();
    expect(o.winners[0]).toBe(idOf(s, (1 - s.forfeit!) as 0 | 1));
  });
  it('tick: a seat that left forfeits immediately', () => {
    const s = fresh(); expect(M.tick(s, [seats[0]], mkctx(1500))).toBe(true);
    expect(M.outcome(s)!.winners).toEqual(['u-alice']);
  });
  it('state survives a JSON round trip (rooms store it as JSON)', () => {
    const s = fresh(), copy: CardBattleState = JSON.parse(JSON.stringify(s));
    const me = idOf(copy, copy.game.active);
    expect(M.act(copy, seats, me, { t: 'next' }, mkctx(3000))).toEqual({ ok: true });
  });
});
