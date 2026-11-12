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
    expect(parseEffect(row({ trigger: 'to_graveyard' }))).toBeNull();
    expect(parseEffect(row({ cost_text: 'ทิ้งการ์ดจากมือ 1 ใบ' }))).toBeNull();
    expect(parseEffect(row({ target_text: 'ตัวละครฝ่ายตรงข้าม 1 ใบ' }))).toBeNull();                 // needs target selection (round F2)
  });
  it('the 56 seed abilities: 31 run in F1, the rest stay marked as not active', () => {
    const rows = seedCards().flatMap(() => []); void rows;
    const all = (require('node:fs').readFileSync(new URL('../db/seed/toon-cards.json', import.meta.url), 'utf8') as string);
    const fx = (JSON.parse(all) as any[]).flatMap(c => c.effects ?? []);
    expect(fx.length).toBe(56); expect(fx.filter(r => parseEffect(r)).length).toBe(31);
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
