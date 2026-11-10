import { describe, it, expect } from 'vitest';
import { createGame, act, legalActions, EngineError, type CardDef, type Game, type Action } from '../src/engine/game';
import { botPick } from '../src/engine/bot';
import { seedCards } from '../src/engine/cards';

const ch = (id: string, level: number, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level, chain: id.split('-')[0], hp: 50, atk: 30, def: 5, element: 'neutral', ...o });
const sp = (id: string): CardDef => ({ id, name: id, type: id.startsWith('TRP') ? 'trap' : 'spell', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const filler = () => Array.from({ length: 30 }, (_, i) => ch(`FILL${i}-15`, 15));
const run = (g: Game, ...as: Action[]) => as.reduce(act, g);
const err = (f: () => any) => { try { f(); } catch (e) { return e instanceof EngineError ? e.message : 'other'; } return null; };
/** P1 (index 0) has a unit and attacks on turn 3; P2 (index 1) has a unit and the given traps set on turn 2. */
const ready = (traps: string[], interactive = true): Game => {
  const g0 = createGame([filler(), filler()], 7, 0, { interactive });
  g0.players[0].hand = [ch('A-15', 15)]; g0.players[1].hand = [ch('B-15', 15), ...traps.map(sp)];
  let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' });      // P1 turn 1 -> P2 turn 2
  g = run(g, { t: 'summon', hand: 0, slot: 0 }, ...traps.map(() => ({ t: 'set', hand: 0 }) as Action), { t: 'next' }, { t: 'next' });  // P2 sets, ends turn
  return run(g, { t: 'next' });                                                        // P1 turn 3, battle phase
};

describe('chain window (interactive)', () => {
  it('pauses the attack and lets the trap owner respond or pass', () => {
    const g = act(ready(['TRP-001']), { t: 'attack', from: 0, to: 0 });
    expect(g.pending).toMatchObject({ responder: 1, event: 'on_attack', options: [0] });
    expect(g.players[0].field[0]!.attacked).toBe(false);          // nothing resolved yet
    expect(legalActions(g).map(a => a.t).sort()).toEqual(['pass', 'respond']);
    const cancel = act(g, { t: 'respond', back: 0 });
    expect(cancel.pending).toBeUndefined(); expect(cancel.players[1].field[0]!.hp).toBe(50); expect(cancel.players[1].grave.some(c => c.id === 'TRP-001')).toBe(true);
    const through = act(g, { t: 'pass' });
    expect(through.pending).toBeUndefined(); expect(through.players[1].field[0]!.hp).toBeLessThan(50); expect(through.players[1].back[0]).not.toBeNull();
  });
  it('blocks every other action while waiting, and respond without a pending window', () => {
    const g = act(ready(['TRP-001']), { t: 'attack', from: 0, to: 0 });
    expect(err(() => act(g, { t: 'next' }))).toMatch(/รอการตอบโต้/);
    expect(err(() => act(g, { t: 'respond', back: 3 }))).toMatch(/ไม่ถูกต้อง/);
    expect(err(() => act(ready(['TRP-001']), { t: 'pass' }))).toMatch(/ไม่มีอะไรให้ตอบโต้/);
  });
  it('owner picks which trap when several match', () => {
    const g = act(ready(['TRP-001', 'TRP-002']), { t: 'attack', from: 0, to: 0 });
    expect(g.pending!.options).toEqual([0, 1]);
    const r = act(g, { t: 'respond', back: 1 });
    expect(r.players[1].back[0]!.card.id).toBe('TRP-001'); expect(r.players[1].back[1]).toBeNull();
  });
  it('can ask more than once inside one action (attack trap, then on-destroyed trap)', () => {
    const g0 = ready(['TRP-009', 'TRP-008']);
    g0.players[1].field[0]!.hp = 1;
    let g = act(g0, { t: 'attack', from: 0, to: 0 });
    expect(g.pending!.event).toBe('on_attack');
    g = act(g, { t: 'pass' });
    expect(g.pending!.event).toBe('on_destroyed');
    g = act(g, { t: 'respond', back: 1 });
    expect(g.pending).toBeUndefined(); expect(g.players[1].field[0]!.hp).toBe(1);
  });
  it('replay is deterministic: same answers give the same game', () => {
    const a = run(ready(['TRP-001']), { t: 'attack', from: 0, to: 0 }, { t: 'pass' }), b = run(ready(['TRP-001']), { t: 'attack', from: 0, to: 0 }, { t: 'pass' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('non-interactive games still auto-fire the first matching trap', () => {
    const g = act(ready(['TRP-001'], false), { t: 'attack', from: 0, to: 0 });
    expect(g.pending).toBeUndefined(); expect(g.players[1].field[0]!.hp).toBe(50);
  });
  it('bot vs bot, interactive: 60 games finish and every pending window is answered', () => {
    const pool = seedCards(), chars = pool.filter(c => c.type === 'character'), l15 = chars.filter(c => c.level === 15), rest = pool.filter(c => c.type !== 'character' && c.type !== 'fusion');
    let fin = 0, windows = 0;
    for (let n = 1; n <= 60; n++) {
      let s = n; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
      const deck = () => Array.from({ length: 40 }, (_, i) => { const a = i < 24 ? l15 : i < 32 ? chars : rest; return a[Math.floor(r() * a.length)]; });
      let g = createGame([deck(), deck()], n, (n % 2) as 0 | 1, { interactive: true }), st = 0;
      while (g.winner === null && st++ < 6000) { if (g.pending) windows++; g = act(g, botPick(g)); }
      if (g.winner !== null) fin++;
    }
    expect(fin).toBe(60); expect(windows).toBeGreaterThan(0);
  }, 120000);
});
