// Anti-farming phase 1: per-player action statistics collected by the engine (data collection only, nothing enforced).
import { describe, it, expect } from 'vitest';
import { createGame, act, EngineError, newStats, STATS_VERSION, type CardDef, type Game, type Action } from '../src/engine/game';
import { autoEndTurn } from '../src/engine/turn-timer';
import { viewFor } from '../src/engine/deck-view';

const ch = (id: string, level: number, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level, chain: id.split('-')[0], hp: 50, atk: 30, def: 5, element: 'neutral', ...o });
const sp = (id: string): CardDef => ({ id, name: id, type: id.startsWith('TRP') ? 'trap' : id.startsWith('EVO') ? 'evolution' : id.startsWith('FUS') ? 'fusion' : 'spell', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const filler = (n = 30) => Array.from({ length: n }, (_, i) => ch(`FILL${i}-15`, 15));
const run = (g: Game, ...as: Action[]) => as.reduce(act, g);
const err = (f: () => any) => { try { f(); } catch (e) { return e instanceof EngineError ? e.message : 'other'; } return null; };
const S = (g: Game, i: 0 | 1) => g.stats![i];
/** P1 (seat 0) has a unit and is in the battle phase of turn 3; P2 (seat 1) has a unit and the given traps set on turn 2. */
const ready = (traps: string[], interactive = true): Game => {
  const g0 = createGame([filler(), filler()], 7, 0, { interactive });
  g0.players[0].hand = [ch('A-15', 15)]; g0.players[1].hand = [ch('B-15', 15), ...traps.map(sp)];
  let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' });
  g = run(g, { t: 'summon', hand: 0, slot: 0 }, ...traps.map(() => ({ t: 'set', hand: 0 }) as Action), { t: 'next' }, { t: 'next' });
  return run(g, { t: 'next' });
};

describe('stats: what is counted', () => {
  it('a new game starts with zeroed stats for both seats', () => {
    const g = createGame([filler(), filler()], 1);
    expect(g.stats).toEqual([newStats(), newStats()]); expect(STATS_VERSION).toBe(1);
  });
  it('counts successful summon / set per player; activeTurns counts own turns once, not actions', () => {
    const g = ready(['TRP-001', 'TRP-002']);
    expect(S(g, 0)).toMatchObject({ summon: 1, set: 0, activeTurns: 1 });
    expect(S(g, 1)).toMatchObject({ summon: 1, set: 2, activeTurns: 1 });   // summon + 2 sets happened in ONE turn
  });
  it('counts cast, evolve and fuse', () => {
    let g = createGame([filler(), filler()], 7, 0, { fusionPairs: [{ a: 'A', b: 'B', hp: 20, atk: 10, def: 0 }] });
    g.players[0].hand = [ch('A-15', 15), sp('SPL-005')];
    g = run(g, { t: 'cast', hand: 1 }, { t: 'summon', hand: 0, slot: 0 });
    expect(S(g, 0)).toMatchObject({ cast: 1, summon: 1, activeTurns: 1 });
    let e = createGame([filler(), filler()], 7); e.players[0].hand = [ch('A-15', 15), ch('B-15', 15), sp('EVO-001'), ch('A-40', 40, { hp: 90 })];
    e = run(e, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' });
    e.players[0].field[1] = { ...structuredClone(e.players[0].field[0]!), uid: 99, card: ch('B-15', 15) };
    const evo = e.players[0].hand.findIndex(c => c.id === 'EVO-001'), form = e.players[0].hand.findIndex(c => c.id === 'A-40');
    e = act(e, { t: 'evolve', slot: 0, evo, form, sacrifice: [1] });
    expect(S(e, 0)).toMatchObject({ summon: 1, evolve: 1, activeTurns: 2 });
    let f = createGame([filler(), filler()], 3, 0, { fusionPairs: [{ a: 'A', b: 'B', hp: 20, atk: 10, def: 0 }] });
    f.players[0].hand = [sp('FUS-001'), ch('A-15', 15), ch('B-15', 15)];
    f = act(f, { t: 'fuse', fusion: 0, top: 1, bottom: 2, slot: 3 });
    expect(S(f, 0)).toMatchObject({ fuse: 1, summon: 0, activeTurns: 1 });
  });
  it('next and pass are never counted', () => {
    const g = ready(['TRP-001']);
    const before = structuredClone(g.stats);
    expect(run(g, { t: 'next' }).stats).toEqual(before);                                   // end turn
    const pending = act(g, { t: 'attack', from: 0, to: 0 });
    expect(pending.pending).toBeTruthy();
    const done = act(pending, { t: 'pass' });
    expect(S(done, 0).attack).toBe(1); expect(S(done, 1).trap).toBe(0);                    // the attack counts once; the pass itself counts as nothing
  });
});

describe('stats: failed and duplicate requests', () => {
  it('invalid actions throw and leave the stats untouched', () => {
    const g = ready([]);
    const before = JSON.stringify(g.stats);
    expect(err(() => act(g, { t: 'summon', hand: 0, slot: 0 }))).not.toBeNull();            // battle phase / empty hand
    expect(err(() => act(g, { t: 'attack', from: 5, to: 'player' }))).not.toBeNull();       // no unit there
    expect(err(() => act(g, { t: 'attack', from: 0, to: 'player' }))).not.toBeNull();       // opponent still has a unit
    expect(err(() => act(g, { t: 'cast', hand: 9 }))).not.toBeNull();
    expect(JSON.stringify(g.stats)).toBe(before);
  });
  it('the same request replayed on the same state gives the same stats and never mutates its input', () => {
    const g = ready([]), before = JSON.stringify(g.stats);
    const a = act(g, { t: 'attack', from: 0, to: 0 }), b = act(g, { t: 'attack', from: 0, to: 0 });
    expect(a.stats).toEqual(b.stats); expect(JSON.stringify(g.stats)).toBe(before);
    expect(S(a, 0).attack).toBe(1);
    expect(err(() => act(a, { t: 'attack', from: 0, to: 0 }))).toMatch(/โจมตีแล้ว/);        // a duplicate request is refused, so it is not counted twice
    expect(S(a, 0).attack).toBe(1);
  });
  it('a chain window does not count anything until it is resolved, and then only once', () => {
    const pending = act(ready(['TRP-001']), { t: 'attack', from: 0, to: 0 });
    expect(S(pending, 0).attack).toBe(0); expect(S(pending, 1).trap).toBe(0);
    const resolved = act(pending, { t: 'respond', back: 0 });
    expect(S(resolved, 0).attack).toBe(1); expect(S(resolved, 1).trap).toBe(1);
    expect(act(pending, { t: 'respond', back: 0 }).stats).toEqual(resolved.stats);
  });
  it('server-generated automatic pass / next (turn timer) count nothing of their own', () => {
    const g = ready(['TRP-001']), pending = act(g, { t: 'attack', from: 0, to: 0 });
    const viaTimer = autoEndTurn(pending), viaPlayer = act(pending, { t: 'pass' });
    expect(viaTimer.stats).toEqual(viaPlayer.stats); expect(S(viaTimer, 1).trap).toBe(0);
    const idle = ready([], false), turns = idle.stats!.map(s => s.activeTurns);
    expect(autoEndTurn(idle).stats!.map(s => s.activeTurns)).toEqual(turns);               // an auto-ended turn is not an active turn
    expect(autoEndTurn(idle).stats).toEqual(idle.stats);
  });
});

describe('stats: damage, traps, per-player isolation', () => {
  it('credits attack damage and the counter-attack to the right seats', () => {
    const g = act(ready([], false), { t: 'attack', from: 0, to: 0 });
    expect(S(g, 0)).toMatchObject({ attack: 1, attackDirect: 0, dmgUnit: 25, dmgLp: 0, trap: 0 });   // 30 ATK - 5 DEF
    expect(S(g, 1)).toMatchObject({ attack: 0, summon: 1, dmgUnit: 25 });                           // counter-attack credited to the defender
    expect(S(g, 1).activeTurns).toBe(1);                                                            // its own turn 2 only; seat 1 did nothing on turn 3
  });
  it('direct attack counts actual LP removed (clamped at the remaining LP)', () => {
    let g = createGame([filler(), filler()], 7); g.players[0].hand = [ch('A-15', 15)]; g.players[1].hand = [];
    g = run(g, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' });   // T1 summon, T2 skipped, T3 battle phase
    expect(g.turn).toBe(3);
    g = act(g, { t: 'attack', from: 0, to: 'player' });
    expect(S(g, 0)).toMatchObject({ attack: 1, attackDirect: 1, dmgLp: 30 });
    const low = structuredClone(g); low.players[1].lp = 10; low.players[0].field[0]!.attacked = false; low.stats![0].dmgLp = 0;
    const fin = act(low, { t: 'attack', from: 0, to: 'player' });
    expect(fin.winner).toBe(0); expect(S(fin, 0).dmgLp).toBe(10);
  });
  it('a fired trap is credited to its owner; a trap that cancels the attack means no damage', () => {
    const g = act(act(ready(['TRP-001']), { t: 'attack', from: 0, to: 0 }), { t: 'respond', back: 0 });
    expect(S(g, 1).trap).toBe(1); expect(S(g, 0).trap).toBe(0); expect(S(g, 0)).toMatchObject({ attack: 1, dmgUnit: 0 });
    expect(S(g, 1).dmgUnit).toBe(0);
  });
  it('reflect trap damage and the counter-attack are credited to the trap owner; delayed damage (poison) is kept apart', () => {
    const g = act(act(ready(['TRP-002']), { t: 'attack', from: 0, to: 0 }), { t: 'respond', back: 0 });
    expect(S(g, 0).dmgUnit).toBe(25); expect(S(g, 1)).toMatchObject({ trap: 1, dmgUnit: 12 + 25 });
    let p = createGame([filler(), filler()], 7); p.players[0].hand = [ch('A-15', 15), sp('SPL-009')]; p.players[1].hand = [ch('B-15', 15)];
    p = run(p, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' });
    p.players[0].hand.push(sp('SPL-009'));
    p = act(p, { t: 'cast', hand: p.players[0].hand.length - 1, target: { slot: 0 } });
    expect(S(p, 0).cast).toBe(1);
    p = run(p, { t: 'next' }, { t: 'next' });                                                  // P2's turn starts: poison ticks
    expect(S(p, 0)).toMatchObject({ dmgDelayed: 5, dmgUnit: 0 }); expect(S(p, 1).dmgDelayed).toBe(0);
  });
  it('damage on a unit is clamped to its remaining HP', () => {
    const g = ready([], false); g.players[1].field[0]!.hp = 7;
    expect(S(act(g, { t: 'attack', from: 0, to: 0 }), 0).dmgUnit).toBe(7);
  });
});

describe('stats: compatibility and secrecy', () => {
  it('games without stats (created before this update) keep working and stay without stats', () => {
    const g = ready(['TRP-001']); delete g.stats;
    const a = act(g, { t: 'attack', from: 0, to: 0 }), b = act(a, { t: 'pass' });
    expect(a.stats).toBeUndefined(); expect(b.stats).toBeUndefined(); expect(b.players[1].field[0]!.hp).toBeLessThan(50);
  });
  it('viewFor never sends the counters to either seat (incl. during a chain window)', () => {
    const g = ready(['TRP-001']), pending = act(g, { t: 'attack', from: 0, to: 0 });
    for (const game of [g, pending]) for (const seat of [0, 1] as const) {
      const v: any = viewFor(game, seat);
      expect('stats' in v).toBe(false); expect(JSON.stringify(v)).not.toMatch(/"(stats|activeTurns|lastActiveTurn|dmgUnit|dmgLp|dmgDelayed)"/);
    }
  });
});
