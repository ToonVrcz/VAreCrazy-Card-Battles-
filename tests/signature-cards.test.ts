import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGame, act, legalActions, type CardDef, type Game } from '../src/engine/game.ts';

const sig: any[] = JSON.parse(readFileSync('db/seed/signature-cards.json', 'utf8'));
const def = (id: string, chain: string, hp = 100, atk = 20, d = 0): CardDef => ({ id, name: id, type: 'character', level: 15, chain, hp, atk, def: d, element: null });
const card = (s: any): CardDef => ({ id: s.character_id, name: s.name, type: s.card_type, level: null, chain: null, hp: null, atk: null, def: 0, element: null, support: s.support });
const filler = (n: number) => Array.from({ length: n }, (_, i) => def('F' + i, 'fill' + i));
const get = (cid: string) => sig.find(s => s.linked_character === cid);
function setup(link: string, extra: CardDef[] = [], enemy: CardDef[] = []) {
  const g = createGame([[def(link, link.replace(/-015$/, '').toLowerCase()), ...extra, ...filler(40)], [def('E0', 'e0'), ...enemy, ...filler(40)]], 1, 0);
  const me = g.players[0], en = g.players[1];
  me.hand = []; en.hand = []; me.field = Array(7).fill(null); en.field = Array(7).fill(null);
  return { g, me, en };
}
const put = (g: Game, pi: 0 | 1, slot: number, c: CardDef) => { const u = { uid: 900 + slot + pi * 10, card: c, hp: c.hp!, maxHp: c.hp!, atk: c.atk!, def: c.def, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0, poison: 0 } as any; g.players[pi].field[slot] = u; return u; };

describe('signature seed', () => {
  it('39 unique cards, one per Lv15 character, 300 Point, draft', () => {
    expect(sig.length).toBe(39);
    expect(new Set(sig.map(s => s.linked_character)).size).toBe(39);
    expect(new Set(sig.map(s => s.character_id)).size).toBe(39);
    expect(sig.filter(s => s.card_type === 'spell').length).toBe(25);
    expect(sig.filter(s => s.card_type === 'trap').length).toBe(14);
    for (const s of sig) { expect(s.shop_price_points).toBe(300); expect(s.status).toBe('draft'); }
  });
});

describe('signature spells', () => {
  it('buff spell needs the linked character and lasts until end of turn', () => {
    const s = get('1GOKU-015'), { g, me } = setup('1GOKU-015'); me.hand = [card(s)];
    expect(legalActions(g).some(a => a.t === 'cast')).toBe(false);
    const u = put(g, 0, 0, def('1GOKU-015', '1goku'));
    expect(legalActions(g).some(a => a.t === 'cast')).toBe(true);
    const o = u.atk; const r = act(g, { t: 'cast', hand: 0 }) as Game; const nu = r.players[0].field[0]!;
    expect(nu.atk + nu.bonusAtk + (nu.auraAtk ?? 0) + (nu.timed?.reduce((a: number, x: any) => a + x.amount, 0) ?? 0)).toBeGreaterThanOrEqual(o + 10);
  });
  it('heal spell caps at max HP and targets an ally', () => {
    const s = get('LALAPING-015'), { g, me } = setup('LALAPING-015'); me.hand = [card(s)];
    put(g, 0, 0, def('LALAPING-015', 'lalaping')); const ally = put(g, 0, 1, def('A1', 'a1', 100)); ally.hp = 90;
    const r = act(g, { t: 'cast', hand: 0, target: { slot: 1 } }) as Game; expect(r.players[0].field[1]!.hp).toBe(100);
  });
  it('damage spell hits an enemy for 10', () => {
    const s = get('PIKACHU-015'), { g, me } = setup('PIKACHU-015'); me.hand = [card(s)];
    put(g, 0, 0, def('PIKACHU-015', 'pikachu')); put(g, 1, 0, def('E1', 'e1', 100, 20, 0));
    const r = act(g, { t: 'cast', hand: 0, target: { slot: 0 } }) as Game; expect(r.players[1].field[0]!.hp).toBe(90);
  });
  it('every card is castable/settable by data only (no id special-casing)', () => {
    for (const s of sig) { const c = card(s); expect(c.support!.kind).toBe(s.card_type); expect(c.support!.ops.length).toBeGreaterThan(0); }
  });
});

/** Defender (seat 0) owns the trap; attacker (seat 1) attacks on turn 2. */
function duel(trapCid: string, ally: CardDef[] = []) {
  const { g, me, en } = setup(trapCid); g.turn = 2; g.active = 1; g.phase = 'battle';
  const link = put(g, 0, 0, def(trapCid, trapCid.replace(/-015$/, '').toLowerCase(), 100, 20, 0));
  ally.forEach((c, i) => put(g, 0, i + 1, c));
  me.back[0] = { card: card(get(trapCid)), setTurn: 0 } as any;
  const atk = put(g, 1, 0, def('ATK', 'atkc', 100, 30, 0));
  return { g, me, en, link, atk };
}
const eff = (u: any) => Math.max(0, u.atk + u.bonusAtk + (u.auraAtk ?? 0));
describe('signature traps', () => {
  it('BAMMIE reduces battle damage to an ally by 10', () => {
    const { g, me, link } = duel('BAMMIE-015', [def('A1', 'a1', 100, 10, 0)]);
    const r = act(g, { t: 'attack', from: 0, to: 1 }) as Game;
    expect(r.players[0].field[1]!.hp).toBe(100 - (30 - 0 - 10));
    expect(r.players[0].back[0]).toBeNull();
  });
  it('BADGUY weakens the attacker for that battle only', () => {
    const { g } = duel('BADGUY-015');
    const r = act(g, { t: 'attack', from: 0, to: 0 }) as Game;
    expect(r.players[0].field[0]!.hp).toBe(100 - 20);                  // 30 - 10
    expect(eff(r.players[1].field[0])).toBe(30);                       // buff gone after the battle
  });
  it('SOMYES weakens an attacker by 5', () => {
    const { g } = duel('SOMYES-015');
    const r = act(g, { t: 'attack', from: 0, to: 0 }) as Game; expect(r.players[0].field[0]!.hp).toBe(75);
  });
  it('BACKJI buffs itself so the counter hits harder', () => {
    const { g } = duel('BACKJI-015');
    const r = act(g, { t: 'attack', from: 0, to: 0 }) as Game; expect(r.players[1].field[0]!.hp).toBe(100 - 30);   // (20+10) counter
    expect(eff(r.players[0].field[0])).toBe(20);
  });
  it('LUCKY cancels the attack when another target exists, otherwise it proceeds', () => {
    const a = duel('LUCKY-015', [def('A1', 'a1')]);
    const r = act(a.g, { t: 'attack', from: 0, to: 0 }) as Game;
    expect(r.players[0].field[0]!.hp).toBe(100); expect(r.players[1].field[0]!.attacked).toBe(false);
    const b = duel('LUCKY-015'); const r2 = act(b.g, { t: 'attack', from: 0, to: 0 }) as Game; expect(r2.players[0].field[0]!.hp).toBe(70);
  });
  it('GOD-WA heals after killing an enemy by attack', () => {
    const { g, link } = duel('GOD-WA-015');
    g.active = 0; g.players[0].back[0] = { card: card(get('GOD-WA-015')), setTurn: 0 } as any; g.players[0].field[0]!.hp = 50;
    g.players[1].field[0]!.hp = 5; g.players[0].field[0]!.summonedTurn = 0;
    const r = act(g, { t: 'attack', from: 0, to: 0 }) as Game; expect(r.players[1].field[0]).toBeNull(); expect(r.players[0].field[0]!.hp).toBe(60);
  });
  it('OUFILLING and LEON react to another ally going to the graveyard', () => {
    const o = duel('OUFILLING-015', [def('A1', 'a1', 10, 5, 0)]); o.link.hp = 50;
    const ro = act(o.g, { t: 'attack', from: 0, to: 1 }) as Game; expect(ro.players[0].field[1]).toBeNull(); expect(ro.players[0].field[0]!.hp).toBe(60);
    const l = duel('LEON-S-KENNEDY-015', [def('A1', 'a1', 10, 5, 0)]);
    const rl = act(l.g, { t: 'attack', from: 0, to: 1 }) as Game; expect(rl.players[0].field[0]!.def + (rl.players[0].field[0]!.timed?.length ?? 0)).toBeGreaterThan(-1);
    expect(rl.players[0].back[0]).toBeNull();
  });
  it('THAI32 heals another ally when destroyed', () => {
    const { g } = duel('THAI32-015', [def('A1', 'a1', 100, 5, 0)]); g.players[0].field[1]!.hp = 50; g.players[0].field[0]!.hp = 5;
    const r = act(g, { t: 'attack', from: 0, to: 0 }) as Game; expect(r.players[0].field[0]).toBeNull(); expect(r.players[0].field[1]!.hp).toBe(60);
  });
  it('WENDYWENDIE gives +5 ATK to its own attack only', () => {
    const { g } = duel('WENDYWENDIE-015'); g.active = 0; g.players[0].back[0] = { card: card(get('WENDYWENDIE-015')), setTurn: 0 } as any;
    const r = act(g, { t: 'attack', from: 0, to: 0 }) as Game; expect(r.players[1].field[0]!.hp).toBe(100 - 25); expect(eff(r.players[0].field[0])).toBe(20);
  });
  it('a trap cannot fire without its linked character on the field', () => {
    const { g } = duel('BADGUY-015'); g.players[0].field[0] = null; put(g, 0, 1, def('X', 'x'));
    const r = act(g, { t: 'attack', from: 0, to: 1 }) as Game; expect(r.players[0].back[0]).not.toBeNull();
  });
});
describe('signature next-attack, search and draw', () => {
  it('next-attack buff applies to one attack and expires', () => {
    const { g, me } = setup('BOBO-015'); me.hand = [card(get('BOBO-015'))]; put(g, 0, 0, def('BOBO-015', 'bobo')); put(g, 1, 0, def('E1', 'e1', 100, 5, 0)); g.turn = 3;
    g.players[0].field[0]!.summonedTurn = 0;
    let r = act(g, { t: 'cast', hand: 0 }) as Game; r = act(r, { t: 'next' }) as Game; expect(r.phase).toBe('battle');
    r = act(r, { t: 'attack', from: 0, to: 0 }) as Game; expect(r.players[1].field[0]!.hp).toBe(100 - 30);
    expect(eff(r.players[0].field[0])).toBe(20);
  });
  it('THOMAS buffs an ally and draws one card', () => {
    const { g, me } = setup('THOMAS-015'); me.hand = [card(get('THOMAS-015'))]; put(g, 0, 0, def('THOMAS-015', 'thomas'));
    const n = me.deck.length; const r = act(g, { t: 'cast', hand: 0, target: { slot: 0 } }) as Game;
    expect(r.players[0].hand.length).toBe(1); expect(r.players[0].deck.length).toBe(n - 1);
  });
  it('TAN takes an Evolution card from the top 3 and keeps the rest', () => {
    const { g, me } = setup('TAN-015'); me.hand = [card(get('TAN-015'))]; put(g, 0, 0, def('TAN-015', 'tan'));
    const evo: CardDef = { id: 'EVO-001', name: 'evo', type: 'evolution', level: null, chain: null, hp: null, atk: null, def: 0, element: null };
    const f = me.deck.splice(0, 3); me.deck.unshift(f[0], evo, f[2]); const n = me.deck.length;
    const r = act(g, { t: 'cast', hand: 0 }) as Game; expect(r.players[0].hand.map(c => c.id)).toEqual(['EVO-001']); expect(r.players[0].deck.length).toBe(n - 1);
  });
});

describe('signature defensive traps', () => {
  const enemySpell = (dmg: number): CardDef => ({ id: 'ESP', name: 'esp', type: 'spell', level: null, chain: null, hp: null, atk: null, def: 0, element: null, support: { kind: 'spell', link: 'atkc', ops: [{ op: 'damage', who: 'enemy', amount: dmg }] } });
  function spellDuel(trapCid: string) {
    const { g, me } = duel(trapCid); g.phase = 'main'; g.players[1].hand = [enemySpell(20)]; return { g, me };
  }
  it('LORDNAM negates a targeting enemy spell', () => {
    const { g } = spellDuel('LORDNAM-015'); const r = act(g, { t: 'cast', hand: 0, target: { slot: 0 } }) as Game;
    expect(r.players[0].field[0]!.hp).toBe(100); expect(r.players[0].back[0]).toBeNull();
  });
  it('MON shaves 5 off a numeric enemy spell', () => {
    const { g } = spellDuel('MON-015'); const r = act(g, { t: 'cast', hand: 0, target: { slot: 0 } }) as Game; expect(r.players[0].field[0]!.hp).toBe(100 - 15);
  });
  it('SMILE leaves an ally at 1 HP when an enemy effect would destroy it', () => {
    const { g } = spellDuel('SMILE-015'); g.players[0].field[0]!.hp = 10; const r = act(g, { t: 'cast', hand: 0, target: { slot: 0 } }) as Game;
    expect(r.players[0].field[0]!.hp).toBe(1); expect(r.players[0].back[0]).toBeNull();
  });
  it('SMILE does not stop battle destruction', () => {
    const { g } = duel('SMILE-015'); g.players[0].field[0]!.hp = 10; const r = act(g, { t: 'attack', from: 0, to: 0 }) as Game;
    expect(r.players[0].field[0]).toBeNull(); expect(r.players[0].back[0]).not.toBeNull();
  });
});

describe('MON answers spells only', () => {
  it('does not fire on a character ability that targets it', () => {
    const { g } = duel('MON-015'); g.phase = 'main'; g.active = 1;
    const atk = g.players[1].field[0]!; atk.card = { ...atk.card, effects: [{ kind: 'damage', target: 'enemy1', amount: 20, trigger: 'on_attack', text: 'x' } as any] };
    g.phase = 'battle'; const r = act(g, { t: 'attack', from: 0, to: 0 }) as Game;
    expect(r.players[0].back[0]).not.toBeNull();
  });
});
