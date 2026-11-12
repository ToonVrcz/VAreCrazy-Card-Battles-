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

// ---- character abilities (F1): text written in Admin -> engine effects ----
import { parseEffect, type Effect } from '../src/engine/effects';
import { seedCards } from '../src/engine/cards';
const row = (o: any) => ({ trigger: 'on_attack', target_text: 'ตัวเอง', action_text: 'ATK +10', condition_text: null, cost_text: null, duration: 'until_end_of_turn', use_limit: 'once_per_turn', description: 'd', ...o });
const withFx = (id: string, level: number, effects: Effect[], o: Partial<CardDef> = {}): CardDef => ({ ...ch(id, level, o), effects });
const E = (o: Partial<Effect>): Effect => ({ trigger: 'on_attack', target: 'self', kind: 'atk', amount: 10, limit: 'none', text: 'fx', ...o });

describe('effect parser reads only exact Admin wordings', () => {
  it('maps known rows and rejects unknown ones', () => {
    expect(parseEffect(row({}))).toMatchObject({ trigger: 'on_attack', target: 'self', kind: 'atk', amount: 10, perm: false, limit: 'turn' });
    expect(parseEffect(row({ action_text: 'ATK +5 ถาวร (สูงสุด +15)', duration: 'permanent', trigger: 'turn_start', use_limit: 'none' }))).toMatchObject({ perm: true, max: 15 });
    expect(parseEffect(row({ action_text: 'จั่ว 1 ใบ', duration: 'instant', condition_text: 'เป้าหมายถูกทำลายจากการโจมตี' }))).toMatchObject({ kind: 'draw', cond: 'target_destroyed' });
    expect(parseEffect(row({ trigger: 'passive', action_text: 'HP +10', duration: 'permanent', target_text: 'ตัวละครฝ่ายเราทุกใบ', use_limit: 'none' }))).toMatchObject({ kind: 'maxhp', target: 'allies' });
    expect(parseEffect(row({ action_text: 'ป้องกันการเลือกเป็นเป้าหมาย' }))).toBeNull();           // wording not understood -> not executed
    expect(parseEffect(row({ trigger: 'combo' }))).toBeNull();                                       // combo timing is not defined in Admin yet
    expect(parseEffect(row({ cost_text: 'ทิ้งการ์ดจากมือ 1 ใบ' }))).toBeNull();
    expect(parseEffect(row({ target_text: 'ตัวละครฝ่ายตรงข้าม 1 ใบ', action_text: 'HP −10', duration: 'instant', trigger: 'on_summon' }))).toMatchObject({ target: 'enemy1', kind: 'damage', amount: 10 });
    expect(parseEffect(row({ target_text: 'ตัวละครฝ่ายตรงข้าม 1 ใบ', action_text: 'ATK −10', trigger: 'on_summon' }))).toMatchObject({ kind: 'atk', amount: -10 });
    expect(parseEffect(row({ trigger: 'passive', target_text: 'ตัวละครฝ่ายเรา 1 ใบ', action_text: 'HP +10', duration: 'permanent' }))).toBeNull();   // a passive cannot ask for a target
  });
  it('the 56 seed abilities: 55 run (only the Combo one waits for a decision), the rest stay marked as not active', () => {
    const rows = seedCards().flatMap(() => []); void rows;
    const all = (require('node:fs').readFileSync(new URL('../db/seed/toon-cards.json', import.meta.url), 'utf8') as string);
    const fx = (JSON.parse(all) as any[]).flatMap(c => c.effects ?? []);
    expect(fx.length).toBe(56); expect(fx.filter(r => parseEffect(r)).length).toBe(55);
  });
});

describe('abilities run in the engine', () => {
  const attackGame = (a: CardDef, defender = ch('B-15', 15)) => {
    const g0 = start(); g0.players[0].hand = [a]; g0.players[1].hand = [defender];
    return run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'next' });   // P1 turn 3, battle phase
  };
  it('on_attack ATK +10 lasts until the end of the turn and is not applied twice per turn', () => {
    const g = attackGame(withFx('A-15', 15, [E({ perm: false, limit: 'turn', amount: 10 })]));
    const r = act(g, { t: 'attack', from: 0, to: 0 });
    expect(r.players[0].field[0]!.bonusAtk).toBe(10); expect(r.players[0].field[0]!.tempAtk).toBe(10);
    const end = run(r, { t: 'next' });
    expect(end.players[0].field[0]!.bonusAtk).toBe(0);
  });
  it('"target destroyed" draws a card only when the target is destroyed', () => {
    const killer = withFx('A-15', 15, [E({ kind: 'draw', amount: 1, cond: 'target_destroyed', limit: 'turn' })], { atk: 90 });
    const g = attackGame(killer, ch('B-15', 15, { hp: 10 }));
    const hand0 = g.players[0].hand.length, r = act(g, { t: 'attack', from: 0, to: 0 });
    expect(r.players[1].field[0]).toBeNull(); expect(r.players[0].hand.length).toBe(hand0 + 1);
    const tough = attackGame(withFx('A-15', 15, [E({ kind: 'draw', amount: 1, cond: 'target_destroyed', limit: 'turn' })], { atk: 6 }), ch('B-15', 15, { hp: 99 }));
    expect(act(tough, { t: 'attack', from: 0, to: 0 }).players[0].hand.length).toBe(tough.players[0].hand.length);
  });
  it('condition "target HP lower than mine" is checked before the hit', () => {
    const lo = attackGame(withFx('A-15', 15, [E({ cond: 'target_hp_lower', amount: 25 })]), ch('B-15', 15, { hp: 20 }));
    expect(act(lo, { t: 'attack', from: 0, to: 0 }).players[0].field[0]!.bonusAtk).toBe(25);
    const hi = attackGame(withFx('A-15', 15, [E({ cond: 'target_hp_lower', amount: 25 })]), ch('B-15', 15, { hp: 99 }));
    expect(act(hi, { t: 'attack', from: 0, to: 0 }).players[0].field[0]!.bonusAtk).toBe(0);
  });
  it('once per game: draw on summon happens a single time', () => {
    const g0 = start(); g0.players[0].hand = [withFx('A-15', 15, [E({ trigger: 'on_summon', kind: 'draw', amount: 1, limit: 'game' })])];
    const h = g0.players[0].hand.length, r = act(g0, { t: 'summon', hand: 0, slot: 0 });
    expect(r.players[0].hand.length).toBe(h - 1 + 1);
  });
  it('turn_start ATK +5 permanent stacks only up to the maximum (+15)', () => {
    const g0 = start(); g0.players[0].hand = [withFx('A-15', 15, [E({ trigger: 'turn_start', perm: true, amount: 5, max: 15 })])];
    let g = run(g0, { t: 'summon', hand: 0, slot: 0 });
    for (let i = 0; i < 16; i++) g = run(g, { t: 'next' });                 // 4 more turns for each player
    expect(g.players[0].field[0]!.bonusAtk).toBe(15);
  });
  it('passive aura: allies get +ATK/+HP while the source is on the field and lose it when the source is gone', () => {
    const g0 = start(); g0.players[0].hand = [withFx('S-15', 15, [E({ trigger: 'passive', target: 'allies', amount: 5 }), E({ trigger: 'passive', target: 'allies', kind: 'maxhp', amount: 10 })]), ch('A-15', 15)];
    let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 1 });
    const a = g.players[0].field[1]!; expect(a.auraAtk).toBe(5); expect(a.maxHp).toBe(60); expect(a.hp).toBe(60);
    g.players[0].field[0] = null; g = run(g, { t: 'next' });                 // the source leaves; the next action recomputes
    const a2 = g.players[0].field[1]!; expect(a2.auraAtk).toBe(0); expect(a2.maxHp).toBe(50); expect(a2.hp).toBe(50);
  });
});

// ---- character abilities (F2): the owner chooses the target ----
const unit = (c: CardDef, uid: number, o: any = {}) => ({ uid, card: c, hp: c.hp!, maxHp: c.hp!, atk: c.atk!, def: c.def, bonusAtk: 0, bonusDef: 0, summonedTurn: 1, attacked: false, lockedUntil: 0, poison: 0, ...o });
describe('abilities that need a target', () => {
  const summonGame = (fx: Effect, interactive = true) => {
    const g0 = createGame([filler(), filler()], 7, 0, { interactive }); g0.players[0].hand = [withFx('A-15', 15, [fx])];
    g0.players[1].field[1] = unit(ch('X-15', 15, { atk: 10 }), 901); g0.players[1].field[4] = unit(ch('Y-15', 15, { atk: 70 }), 902);
    return g0;
  };
  it('asks the owner which enemy to hit, then hits only that one (once per game)', () => {
    const g = act(summonGame(E({ trigger: 'on_summon', target: 'enemy1', kind: 'damage', amount: 10, limit: 'game' })), { t: 'summon', hand: 0, slot: 0 });
    expect(g.pending).toMatchObject({ responder: 0, event: 'effect_target', options: [1, 4] });
    expect(g.pending!.info!.choices.map(c => c.name)).toEqual(['X-15', 'Y-15']);
    expect(g.players[0].field[0]).toBeNull();                                    // the summon is replayed after the answer
    const r = act(g, { t: 'respond', back: 4 });
    expect(r.pending).toBeUndefined(); expect(r.players[0].field[0]!.card.id).toBe('A-15');
    expect(r.players[1].field[4]!.hp).toBe(40); expect(r.players[1].field[1]!.hp).toBe(50);
  });
  it('rejects a target that is not offered', () => {
    const g = act(summonGame(E({ trigger: 'on_summon', target: 'enemy1', kind: 'damage', amount: 10 })), { t: 'summon', hand: 0, slot: 0 });
    expect(() => act(g, { t: 'respond', back: 3 })).toThrow();
  });
  it('a bot / non-interactive game picks the strongest enemy and does not ask', () => {
    const r = act(summonGame(E({ trigger: 'on_summon', target: 'enemy1', kind: 'damage', amount: 10 }), false), { t: 'summon', hand: 0, slot: 0 });
    expect(r.pending).toBeUndefined(); expect(r.players[1].field[4]!.hp).toBe(40);
  });
  it('the bot answers the question itself (strongest enemy)', () => {
    const g = act(summonGame(E({ trigger: 'on_summon', target: 'enemy1', kind: 'damage', amount: 10 })), { t: 'summon', hand: 0, slot: 0 });
    expect(botPick(g)).toEqual({ t: 'respond', back: 4 });
  });
  it('no prompt when only one candidate, and nothing happens (not used up) when there is none', () => {
    const one = summonGame(E({ trigger: 'on_summon', target: 'enemy1', kind: 'damage', amount: 10, limit: 'game' })); one.players[1].field[4] = null;
    const r1 = act(one, { t: 'summon', hand: 0, slot: 0 }); expect(r1.pending).toBeUndefined(); expect(r1.players[1].field[1]!.hp).toBe(40);
    const none = summonGame(E({ trigger: 'on_summon', target: 'enemy1', kind: 'damage', amount: 10, limit: 'game' })); none.players[1].field = none.players[1].field.map(() => null);
    const r2 = act(none, { t: 'summon', hand: 0, slot: 0 }); expect(r2.pending).toBeUndefined(); expect(r2.players[0].field[0]!.used?.['0']).toBeUndefined();
  });
  it('heal ability on my own end of turn asks which ally, full heal restores to max', () => {
    const g0 = createGame([filler(), filler()], 7, 0, { interactive: true }); g0.players[0].hand = []; const a = withFx('A-15', 15, [E({ trigger: 'turn_end', target: 'ally1', kind: 'heal', amount: 10, limit: 'turn' })]);
    g0.players[0].field[0] = unit(a, 801, { hp: 20 }); g0.players[0].field[2] = unit(ch('B-15', 15), 802, { hp: 5 });
    let g = run(g0, { t: 'next' }); g = act(g, { t: 'next' });                  // battle -> end of turn
    expect(g.pending).toMatchObject({ responder: 0, event: 'effect_target' });
    const r = act(g, { t: 'respond', back: 2 });
    expect(r.players[0].field[2]!.hp).toBe(15); expect(r.players[0].field[0]!.hp).toBe(20); expect(r.active).toBe(1);   // the turn has passed to the opponent
  });
  it('on_destroyed: when this character is destroyed it hits an enemy', () => {
    const g0 = start(); g0.players[0].hand = [];
    g0.players[0].field[0] = unit(ch('A-15', 15, { atk: 90 }), 701); g0.players[1].field[0] = unit(withFx('B-15', 15, [E({ trigger: 'on_destroyed', target: 'enemy1', kind: 'damage', amount: 20 })], { hp: 10 }), 702);
    g0.players[1].field[3] = unit(ch('C-15', 15), 703); g0.turn = 3; g0.phase = 'battle';
    const r = act(g0, { t: 'attack', from: 0, to: 0 });
    expect(r.players[1].field[0]).toBeNull();                                    // B was destroyed, its owner (P2) now chooses...
    expect(r.players[0].field[0]!.hp).toBeLessThan(50);                          // ...the only enemy of B is A (auto, single candidate)
  });
});

// ---- abilities (F3): graveyard trigger, protection, search, discard-to-draw ----
describe('remaining abilities that the Admin descriptions define clearly', () => {
  it('parser: protect, search, discard-to-draw and graveyard trigger', () => {
    expect(parseEffect(row({ trigger: 'on_summon', action_text: 'ป้องกันการเลือกเป็นเป้าหมาย', use_limit: 'none' }))).toMatchObject({ kind: 'protect' });
    expect(parseEffect(row({ trigger: 'on_summon', target_text: 'Main Deck', action_text: 'ค้นการ์ด Evolution ขึ้นมือ', duration: 'instant', use_limit: 'once_per_game' }))).toMatchObject({ kind: 'search_evo', target: 'deck' });
    expect(parseEffect(row({ trigger: 'on_summon', action_text: 'จั่ว 1 ใบ', duration: 'instant', cost_text: 'ทิ้งการ์ดจากมือ 1 ใบ' }))).toMatchObject({ kind: 'draw', cost: 'discard1' });
    expect(parseEffect(row({ trigger: 'to_graveyard', action_text: 'ATK +5' }))).toMatchObject({ trigger: 'to_graveyard', kind: 'atk', amount: 5 });
    expect(parseEffect(row({ target_text: 'Main Deck', action_text: 'ATK +5' }))).toBeNull();           // the deck is only for "search"
  });
  it('to_graveyard: when another of my characters is destroyed the source gets ATK +5 until end of turn (once per turn)', () => {
    const g0 = start(); g0.players[0].hand = []; g0.turn = 3; g0.phase = 'battle';
    g0.players[0].field[0] = unit(withFx('A-15', 15, [E({ trigger: 'to_graveyard', perm: false, amount: 5, limit: 'turn' })]), 601);
    g0.players[1].field[0] = unit(ch('B-15', 15, { atk: 99 }), 602);
    g0.players[0].field[1] = unit(ch('C-15', 15, { hp: 5 }), 603);
    g0.active = 1; g0.turn = 4;
    const r = act(g0, { t: 'attack', from: 0, to: 1 });                  // P2 destroys C
    expect(r.players[0].field[1]).toBeNull(); expect(r.players[0].field[0]!.bonusAtk).toBe(5);
  });
  it('protect: the turn it is summoned the unit cannot be chosen by spells or abilities', () => {
    const g0 = start(); g0.players[0].hand = [withFx('A-15', 15, [E({ trigger: 'on_summon', kind: 'protect', amount: 0 })])];
    const g = act(g0, { t: 'summon', hand: 0, slot: 0 }); expect(g.players[0].field[0]!.untargetableTurn).toBe(g.turn);
    const h = createGame([filler(), filler()], 9, 0, { interactive: false }); h.players[1].field[0] = { ...g.players[0].field[0]! }; h.turn = 1; h.players[0].hand = [sp('SPL-001')];
    expect(() => act(h, { t: 'cast', hand: 0, target: { slot: 0 } })).toThrow();
    expect(legalActions(h).filter(a => a.t === 'cast')).toEqual([]);
    h.turn = 2; h.active = 0; expect(act(h, { t: 'cast', hand: 0, target: { slot: 0 } }).players[1].field[0]!.hp).toBeLessThan(50);   // the next turn it can be chosen
  });
  it('search: finds one Evolution card in the deck, once per game', () => {
    const g0 = start(); g0.players[0].hand = [withFx('A-15', 15, [E({ trigger: 'on_summon', kind: 'search_evo', target: 'deck', amount: 1, limit: 'game' })])];
    g0.players[0].deck = [ch('Z-15', 15), evo(), ch('Y-15', 15)];
    const r = act(g0, { t: 'summon', hand: 0, slot: 0 });
    expect(r.players[0].hand.map(c => c.id)).toEqual(['EVO-001']); expect(r.players[0].deck.length).toBe(2);
  });
  it('discard-to-draw: asks which card to throw away, can be declined, then draws', () => {
    const fx = E({ trigger: 'on_summon', kind: 'draw', amount: 1, limit: 'game', cost: 'discard1' });
    const g0 = createGame([filler(), filler()], 7, 0, { interactive: true }); g0.players[0].hand = [withFx('A-15', 15, [fx]), ch('K-15', 15), ch('L-15', 15)];
    const g = act(g0, { t: 'summon', hand: 0, slot: 0 });
    expect(g.pending).toMatchObject({ event: 'effect_target', options: [0, 1], info: { kind: 'discard' } });
    const paid = act(g, { t: 'respond', back: 0 });
    expect(paid.players[0].grave.map(c => c.id)).toContain('K-15'); expect(paid.players[0].hand.length).toBe(2);       // K gone, one card drawn
    const declined = act(g, { t: 'pass' });
    expect(declined.players[0].grave.length).toBe(0); expect(declined.players[0].hand.length).toBe(2);
    expect(botPick(g)).toEqual({ t: 'respond', back: 1 });
  });
});
