import { describe, it, expect } from 'vitest';
import { createGame, act, legalActions, type CardDef, type Game, type Action } from '../src/engine/game';
import { botPick } from '../src/engine/bot';

const ch = (id: string, level: number, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level, chain: id.split('-')[0], hp: 50, atk: 30, def: 5, element: 'neutral', ...o });
const sp = (id: string): CardDef => ({ id, name: id, type: 'spell', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const evo = (): CardDef => ({ id: 'EVO-001', name: 'EVO-001', type: 'evolution', level: null, chain: null, hp: null, atk: null, def: 0, element: null });
const filler = () => Array.from({ length: 30 }, (_, i) => ch(`FILL${i}-15`, 15));
const run = (g: Game, ...as: Action[]) => as.reduce(act, g);
const start = () => createGame([filler(), filler()], 7, 0, { interactive: false });

describe('buffs stay until the unit leaves the field', () => {
  it('keeps +ATK/+DEF across turn ends', () => {
    const g0 = start(); g0.players[0].hand = [ch('A-15', 15), sp('SPL-004'), sp('SPL-003')];
    let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'cast', hand: 0, target: { slot: 0 } }, { t: 'cast', hand: 0, target: { slot: 0 } });
    expect([g.players[0].field[0]!.bonusAtk, g.players[0].field[0]!.bonusDef]).toEqual([15, 15]);
    g = run(g, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' });   // both players end a full turn twice
    expect([g.players[0].field[0]!.bonusAtk, g.players[0].field[0]!.bonusDef]).toEqual([15, 15]);
  });
  it('is carried to the evolved form', () => {
    const g0 = start(); g0.players[0].hand = [ch('A-15', 15), sp('SPL-004')];
    let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'cast', hand: 0, target: { slot: 0 } }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' });
    g.players[0].hand = [ch('B-15', 15), evo(), ch('A-40', 40)];
    g = run(g, { t: 'summon', hand: 0, slot: 1 }, { t: 'evolve', slot: 0, evo: 0, form: 1, sacrifice: [1] });
    expect(g.players[0].field[0]!.card.id).toBe('A-40'); expect(g.players[0].field[0]!.bonusAtk).toBe(15);
  });
});

describe('swap spell works across both sides', () => {
  const setup = () => {
    const g0 = start(); g0.players[0].hand = [ch('A-15', 15)]; g0.players[1].hand = [ch('B-15', 15)];
    let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 2 }, { t: 'next' }, { t: 'next' });
    g.players[0].hand.push(sp('SPL-007')); return g;
  };
  it('exchanges my unit with an opposing unit', () => {
    const g = setup(); const h = g.players[0].hand.findIndex(c => c.id === 'SPL-007');
    const r = act(g, { t: 'cast', hand: h, target: { slot: 0, slot2: 2 } });
    expect(r.players[0].field[0]!.card.id).toBe('B-15'); expect(r.players[1].field[2]!.card.id).toBe('A-15');
  });
  it('needs a unit on both sides and lists only valid pairs', () => {
    const g = setup(); const h = g.players[0].hand.findIndex(c => c.id === 'SPL-007');
    expect(() => act(g, { t: 'cast', hand: h, target: { slot: 0, slot2: 0 } })).toThrow();   // enemy slot 0 is empty
    const pairs = legalActions(g).filter(a => a.t === 'cast' && a.hand === h);
    expect(pairs).toEqual([{ t: 'cast', hand: h, target: { slot: 0, slot2: 2 } }]);
  });
  it('the bot only swaps when it clearly gains', () => {
    const g = setup(); g.players[1].field[2]!.atk = 90;                                          // P2's unit is far stronger
    g.players[0].hand = [sp('SPL-007')]; const a = botPick(g);
    expect(a).toMatchObject({ t: 'cast', target: { slot: 0, slot2: 2 } });
  });
});

describe('revive lets the player choose the card', () => {
  it('returns the chosen Lv.15 card from the graveyard to the hand', () => {
    const g = start(); g.players[0].hand = [sp('SPL-006')]; g.players[0].grave = [ch('X-15', 15), ch('Y-15', 15)];
    const r = act(g, { t: 'cast', hand: 0, target: { grave: 1 } });
    expect(r.players[0].hand.map(c => c.id)).toEqual(['Y-15']); expect(r.players[0].grave.map(c => c.id)).toContain('X-15');
  });
});
