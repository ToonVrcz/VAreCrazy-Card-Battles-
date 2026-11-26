// Bot AI round 2 + combat-log breakdown. Scenarios come from docs/balance/BOT_AI_COMBO_SIMULATION_RESULTS_2026-11-26.md (S1–S4, S6b).
import { describe, it, expect } from 'vitest';
import { createGame, act, legalActions, type CardDef, type Game, type Unit } from '../src/engine/game';
import { botPick } from '../src/engine/bot';
import { formatEvent } from '../src/engine/events';
import signature from '../db/seed/signature-cards.json';

const ch = (id: string, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level: 15, chain: id, hp: 80, atk: 20, def: 2, element: 'neutral', ...o });
const base = (): Game => { const g = createGame([Array.from({ length: 30 }, (_, i) => ch('F' + i)), Array.from({ length: 30 }, (_, i) => ch('G' + i))], 1, 0, { storyLinks: [], fusionPairs: [], interactive: false }); g.players[0].hand = []; g.players[1].hand = []; g.turn = 2; g.active = 0; g.phase = 'battle'; return g; };
const put = (g: Game, side: 0 | 1, slot: number, c: CardDef, o: Partial<Unit> = {}) => { const u = { uid: ++g.uid, card: c, hp: c.hp!, maxHp: c.hp!, atk: c.atk!, def: c.def, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0, poison: 0, ...o } as Unit; g.players[side].field[slot] = u; return u; };
/** Runs the Bot for one battle phase and returns the attack actions it chose. */
const turn = (g0: Game) => { let g = g0; const seq: string[] = []; for (let i = 0; i < 20; i++) { const a = botPick(g); if (a.t === 'next') break; seq.push(JSON.stringify(a)); g = act(g, a); } return { g, seq }; };

describe('Bot attack choice', () => {
  it('S1: prefers the target the attacker has element advantage against', () => {
    const g = base(); put(g, 0, 0, ch('ATK', { element: 'fire', hp: 100, atk: 40 }));
    put(g, 1, 0, ch('W', { element: 'water', hp: 60, atk: 25, def: 5 })); put(g, 1, 1, ch('N', { element: 'neutral', hp: 60, atk: 25, def: 5 })); put(g, 1, 2, ch('T', { element: 'nature', hp: 60, atk: 25, def: 5 }));
    expect(botPick(g)).toMatchObject({ t: 'attack', to: 2 });
  });
  it('S4: does not attack into a counter that element advantage turns lethal', () => {
    const g = base(); put(g, 0, 0, ch('A', { element: 'nature', hp: 60, atk: 50 })); put(g, 1, 0, ch('E', { element: 'fire', hp: 80, atk: 42 }));
    expect(botPick(g).t).toBe('next');
  });
  it('S3: among lethal targets picks the more valuable one', () => {
    const g = base(); put(g, 0, 0, ch('A', { hp: 100, atk: 40 })); put(g, 1, 0, ch('WEAK', { hp: 10, atk: 10, def: 0 })); put(g, 1, 1, ch('BIG', { level: 70, hp: 300, atk: 100, def: 3 }), { hp: 20 });
    expect(botPick(g)).toMatchObject({ t: 'attack', to: 1 });
  });
  it('S2/S6b: focus-fires a target no single unit can kill (chip, then finish)', () => {
    const g = base(); for (let i = 0; i < 4; i++) put(g, 0, i, ch('A' + i, { hp: 100, atk: 40 })); put(g, 1, 0, ch('TANK', { level: 40, hp: 130, atk: 70, def: 5 }));
    const { g: g2, seq } = turn(g); expect(seq.length).toBe(4); expect(g2.players[1].field[0]).toBeNull();
  });
  it('does not focus-fire when the chip would be lost to the counter and nothing can finish', () => {
    const g = base(); put(g, 0, 0, ch('A0', { hp: 60, atk: 30 })); put(g, 0, 1, ch('A1', { hp: 60, atk: 30 })); put(g, 1, 0, ch('TANK', { hp: 300, atk: 90, def: 5 }));
    expect(turn(g).seq.length).toBe(0);
  });
  it('never returns an illegal attack (attack ban, summoned this turn)', () => {
    const g = base(); put(g, 0, 0, ch('A0', { atk: 50 })); put(g, 0, 1, ch('A1', { atk: 50 })); put(g, 1, 0, ch('E', { hp: 60 })); g.players[0].noAttackUntil = 99;
    expect(botPick(g).t).toBe('next');
    g.players[0].noAttackUntil = 0; g.players[0].field.forEach(u => { if (u) u.summonedTurn = g.turn; });
    expect(botPick(g).t).toBe('next');
  });
});

describe('Bot and Signature spells', () => {
  const sig = (id: string) => (signature as any[]).find(c => c.character_id === id);
  const toDef = (c: any): CardDef => ({ id: c.character_id, name: c.name, type: c.card_type, level: null, chain: null, hp: null, atk: null, def: 0, element: null, support: c.support, effects: [] });
  it('casts a linked ATK spell (SPL-011) when its unit can attack this turn, and not when it was just summoned', () => {
    const c = sig('SPL-011'), def = toDef(c), link = c.linked_character as string;
    const g = base(); g.phase = 'main'; put(g, 0, 0, ch(link, { chain: link.replace(/-\d+$/, '').toLowerCase() === link ? link : c.support.link, hp: 100, atk: 40 }), {}); g.players[0].field[0]!.card.chain = c.support.link; g.players[0].hand = [def]; put(g, 1, 0, ch('E', { hp: 60 }));
    expect(botPick(g)).toMatchObject({ t: 'cast', hand: 0 });
    g.players[0].field[0]!.summonedTurn = g.turn; expect(botPick(g).t).not.toBe('cast');
  });
});

describe('Combat log breakdown', () => {
  it('a unit attack emits a hit_detail event with base / buff / Story / DEF / element parts', () => {
    const g = base(); const a = put(g, 0, 0, ch('A', { element: 'fire', hp: 100, atk: 40 }), { bonusAtk: 10 }); put(g, 1, 0, ch('E', { element: 'nature', hp: 100, atk: 5, def: 5 }));
    const g2 = act(g, { t: 'attack', from: 0, to: 0 }); const ev = (g2.events ?? []).filter(e => e.t === 'hit_detail'); expect(ev.length).toBeGreaterThanOrEqual(1);
    const t = formatEvent(ev[0]).text; expect(t).toContain('ATK 50'); expect(t).toContain('บัฟ 10'); expect(t).toContain('DEF 5'); expect(t).toContain('ธาตุ 1.5'); expect(ev[0].v).toBe(67);
    expect(a.atk).toBe(40);
  });
  it('a direct attack explains the LP loss', () => {
    const g = base(); put(g, 0, 0, ch('A', { atk: 40 })); const g2 = act(g, { t: 'attack', from: 0, to: 'player' });
    const ev = (g2.events ?? []).filter(e => e.t === 'hit_detail'); expect(ev[0].why).toContain('LP = 40');
  });
});
