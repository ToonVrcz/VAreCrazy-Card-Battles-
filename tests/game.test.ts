import { describe, it, expect } from 'vitest';
import { createGame, act, legalActions, EngineError, RULES, type CardDef, type Game, type Action } from '../src/engine/game';
import { seedCards } from '../src/engine/cards';

const ch = (id: string, level: number, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level, chain: id.split('-')[0], hp: 50, atk: 30, def: 5, element: 'neutral', ...o });
const sp = (id: string): CardDef => ({ id, name: id, type: id.startsWith('TRP') ? 'trap' : id.startsWith('EVO') ? 'evolution' : 'spell', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const filler = (n = 30) => Array.from({ length: n }, (_, i) => ch(`FILL${i}-15`, 15));
/** Build a game with exact starting hands (player 0 / 1) and a filler deck. */
const setup = (h0: CardDef[], h1: CardDef[]): Game => { const g = createGame([filler(), filler()], 7); g.players[0].hand = h0; g.players[1].hand = h1; return g; };
const run = (g: Game, ...as: Action[]) => as.reduce(act, g);
const skipTurn = (g: Game) => run(g, { t: 'next' }, { t: 'next' });   // main -> battle -> end turn
const err = (f: () => any) => { try { f(); } catch (e) { return e instanceof EngineError ? e.message : 'other'; } return null; };

describe('engine: turn flow', () => {
  it('summon: Lv.15 only, once per turn, free', () => {
    const g = setup([ch('A-15', 15), ch('B-15', 15), ch('A-40', 40)], []);
    expect(err(() => act(g, { t: 'summon', hand: 2, slot: 0 }))).toMatch(/Lv\.15/);
    const g2 = act(g, { t: 'summon', hand: 0, slot: 0 });
    expect(g2.players[0].field[0]?.card.id).toBe('A-15');
    expect(err(() => act(g2, { t: 'summon', hand: 0, slot: 1 }))).toMatch(/1 ใบต่อเทิร์น/);
  });
  it('first player cannot attack on turn 1; units cannot attack the turn they are summoned', () => {
    let g = setup([ch('A-15', 15)], [ch('B-15', 15)]);
    g = run(g, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' });
    expect(err(() => act(g, { t: 'attack', from: 0, to: 'player' }))).toMatch(/เทิร์นแรก/);
    g = run(g, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' });          // P2 turn 2: summons B
    expect(err(() => act(g, { t: 'attack', from: 0, to: 'player' }))).toMatch(/เพิ่งถูกเรียก/);
  });
  it('draws up to hand max 5 each turn; losing when unable to draw from an empty deck', () => {
    let g = setup([ch('A-15', 15)], []); g.players[1].deck = [];
    g = skipTurn(g);
    expect(g.winner).toBe(0);
  });
});

describe('engine: combat', () => {
  const duel = () => { let g = setup([ch('A-15', 15, { atk: 30, hp: 100 })], [ch('B-15', 15, { atk: 12, def: 10, hp: 40 })]);
    g = run(g, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }); return g; };
  it('damage = max(1, ATK-DEF), defender strikes back if it survives', () => {
    let g = duel(); g = run(g, { t: 'next' }, { t: 'attack', from: 0, to: 0 });
    expect(g.players[1].field[0]!.hp).toBe(20);        // 30-10 = 20
    expect(g.players[0].field[0]!.hp).toBe(100 - 7);   // counter 12-5
  });
  it('destroyed targets go to the graveyard and do not counter', () => {
    let g = duel(); g.players[1].field[0]!.hp = 15; g = run(g, { t: 'next' }, { t: 'attack', from: 0, to: 0 });
    expect(g.players[1].field[0]).toBeNull(); expect(g.players[1].grave.map(c => c.id)).toContain('B-15');
    expect(g.players[0].field[0]!.hp).toBe(100);
  });
  it('direct attack only on an empty field, full ATK to LP, LP 0 wins', () => {
    let g = duel(); g.players[1].field[0] = null; g = run(g, { t: 'next' });
    g.players[1].lp = 25; g = act(g, { t: 'attack', from: 0, to: 'player' });
    expect(g.winner).toBe(0); expect(g.players[1].lp).toBe(0);
    expect(RULES.lp).toBe(100);
  });
});

describe('engine: evolution', () => {
  it('needs evolution card + next form + sacrifice; keeps damage taken; counts as a summon', () => {
    const hand = [ch('A-15', 15), ch('B-15', 15), sp('EVO-001'), ch('A-40', 40, { hp: 90 })];
    let g = setup(hand, []); g = run(g, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' });   // back to P1 turn 3
    g.players[0].field[1] = { ...structuredClone(g.players[0].field[0]!), uid: 99, card: ch('B-15', 15) };
    g.players[0].field[0]!.hp = 30;   // took 20 of 50
    const evo = g.players[0].hand.findIndex(c => c.id === 'EVO-001'), form = g.players[0].hand.findIndex(c => c.id === 'A-40');
    expect(err(() => act(g, { t: 'evolve', slot: 0, evo, form, sacrifice: [] }))).toMatch(/สังเวย/);
    const g2 = act(g, { t: 'evolve', slot: 0, evo, form, sacrifice: [1] });
    const u = g2.players[0].field[0]!;
    expect(u.card.id).toBe('A-40'); expect(u.hp).toBe(70); expect(g2.players[0].field[1]).toBeNull();
    expect(g2.players[0].grave.map(c => c.id)).toEqual(expect.arrayContaining(['EVO-001', 'B-15', 'A-15']));
    expect(err(() => run(g2, { t: 'next' }, { t: 'attack', from: 0, to: 'player' }))).toMatch(/เพิ่งถูกเรียก/);
  });
});

describe('engine: spells & traps', () => {
  it('spells: only in main phase, to graveyard after use', () => {
    let g = setup([sp('SPL-005'), sp('SPL-001')], []);
    g = act(g, { t: 'cast', hand: 0 }); expect(g.players[0].grave[0].id).toBe('SPL-005'); expect(g.players[0].hand.length).toBe(3);
    g = act(g, { t: 'next' }); expect(err(() => act(g, { t: 'cast', hand: 0 }))).toMatch(/เฟสหลัก/);
  });
  it('trap is usable only from the turn after it was set; TRP-001 cancels an attack', () => {
    let g = setup([ch('A-15', 15), sp('TRP-001')], [ch('B-15', 15)]);
    g = run(g, { t: 'summon', hand: 0, slot: 0 }, { t: 'set', hand: 0 }, { t: 'next' }, { t: 'next' });
    g = run(g, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' });  // P2 turn 2, P1 turn 3 -> attack allowed
    g = run(g, { t: 'next' });
    const g2 = act(g, { t: 'attack', from: 0, to: 0 });
    expect(g2.players[1].field[0]!.hp).toBe(50);   // untouched
  });
  it('TRP-008 saves a unit at 1 HP once (set on an earlier turn)', () => {
    let g = setup([sp('SPL-001'), sp('SPL-001')], [ch('B-15', 15, { hp: 10 }), sp('TRP-008')]);
    g = run(g, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'set', hand: 0 }, { t: 'next' }, { t: 'next' });
    g = act(g, { t: 'cast', hand: 0, target: { slot: 0 } });
    expect(g.players[1].field[0]!.hp).toBe(1);
    g = act(g, { t: 'cast', hand: 0, target: { slot: 0 } });
    expect(g.players[1].field[0]).toBeNull();   // trap already used
  });
  it('a trap set this turn cannot fire yet', () => {
    let g = setup([sp('SPL-001')], [ch('B-15', 15, { hp: 10 }), sp('TRP-008')]);
    g = run(g, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'set', hand: 0 });
    g.active = 0; g.turn = 2; g.phase = 'main';   // same turn number as the set
    g = act(g, { t: 'cast', hand: 0, target: { slot: 0 } });
    expect(g.players[1].field[0]).toBeNull();
  });
  it('SPL-009 poison deals 5 at the start of the target owner\'s turn, 3 times', () => {
    let g = setup([sp('SPL-009')], [ch('B-15', 15, { hp: 50 })]);
    g = run(g, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' });
    g = act(g, { t: 'cast', hand: 0, target: { slot: 0 } });
    const hps: number[] = [];
    for (let i = 0; i < 4; i++) { g = skipTurn(g); hps.push(g.players[1].field[0]!.hp); g = skipTurn(g); }
    expect(hps).toEqual([45, 40, 35, 35]);
  });
});

describe('engine: simulation with the real seed cards', () => {
  const pool = seedCards();
  const pickDeck = (seed: number) => { let s = seed; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    const chars = pool.filter(c => c.type === 'character'), lv15 = chars.filter(c => c.level === 15), rest = pool.filter(c => c.type !== 'character' && c.type !== 'fusion');
    return Array.from({ length: 40 }, (_, i) => (i < 22 ? lv15 : i < 30 ? chars : rest)[Math.floor(r() * (i < 22 ? lv15 : i < 30 ? chars : rest).length)]); };
  it('200 random games always end legally (no crashes, invariants hold)', () => {
    let finished = 0;
    for (let n = 1; n <= 200; n++) {
      let g = createGame([pickDeck(n), pickDeck(n + 1000)], n, (n % 2) as 0 | 1), steps = 0, s = n;
      const r = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 2 ** 32; };
      while (g.winner === null && steps++ < 3000) {
        const acts = legalActions(g), nonNext = acts.filter(a => a.t !== 'next');
        const a = nonNext.length && r() < 0.8 ? nonNext[Math.floor(r() * nonNext.length)] : { t: 'next' } as Action;
        try { g = act(g, a); } catch (e) { if (!(e instanceof EngineError)) throw e; g = act(g, { t: 'next' }); }
        for (const p of g.players) { expect(p.lp).toBeGreaterThanOrEqual(0); expect(p.hand.length).toBeLessThanOrEqual(RULES.handMax); expect(p.field.length).toBe(RULES.fieldSlots); }
      }
      if (g.winner !== null) finished++;
    }
    expect(finished).toBeGreaterThan(150);
  }, 120000);
});

import { botPick } from '../src/engine/bot';
describe('bot', () => {
  it('bot vs bot: 100 games finish without illegal moves', () => {
    const pool = seedCards(), chars = pool.filter(c => c.type === 'character'), l15 = chars.filter(c => c.level === 15), rest = pool.filter(c => c.type !== 'character' && c.type !== 'fusion');
    let fin = 0;
    for (let n = 1; n <= 100; n++) {
      let s = n; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
      const deck = () => Array.from({ length: 40 }, (_, i) => { const a = i < 24 ? l15 : i < 32 ? chars : rest; return a[Math.floor(r() * a.length)]; });
      let g = createGame([deck(), deck()], n, (n % 2) as 0 | 1), st = 0;
      while (g.winner === null && st++ < 4000) g = act(g, botPick(g));
      if (g.winner !== null) fin++;
    }
    expect(fin).toBe(100);
  }, 120000);
});
