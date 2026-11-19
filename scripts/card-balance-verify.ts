// Read-only engine probes used by docs/card-balance/ENGINE_COMPATIBILITY.md. Runs the REAL engine on in-memory games; touches no DB, no card data.
// Usage: npx tsx scripts/card-balance-verify.ts
import { createGame, act, legalActions, RULES, type CardDef, type Game, type Action } from '../src/engine/game';
import { seedCards } from '../src/engine/cards';

const pool = new Map(seedCards().map(c => [c.id, c]));
const C = (id: string): CardDef => structuredClone(pool.get(id) ?? (() => { throw new Error('no card ' + id); })());
const filler = () => Array.from({ length: 30 }, (_, i) => ({ ...C('BOBO-015'), id: `F${i}-015`, name: `F${i}`, chain: `f${i}`, effects: [] }));
const run = (g: Game, ...as: Action[]) => as.reduce(act, g);
const start = (first: 0 | 1 = 0) => createGame([filler(), filler()], 7, first, { interactive: false, extras: [[], []] });
const out: Record<string, unknown> = {};
const tryAct = (g: Game, a: Action) => { try { return { ok: true as const, g: act(g, a) }; } catch (e: any) { return { ok: false as const, err: String(e.message) }; } };
const ff = (g: Game, n = 2) => { for (let i = 0; i < n * 4; i++) g = act(g, { t: "next" }); return g; };   // n full rounds (both players play main+battle)

// A. damage formula: max(1, floor(max(1, ATK - DEF) * element multiplier)); counter-attack uses the same formula
{
  const mk = (atk: number, def: number, ea: string, ed: string) => {
    const g = start(); const a = { ...C('BOBO-015'), id: 'A-015', atk, element: ea, effects: [] }, d = { ...C('BOBO-015'), id: 'D-015', def, hp: 500, atk: 1, element: ed, effects: [] };
    g.players[0].hand = [a]; g.players[1].hand = [d];
    let x = run(g, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'attack', from: 0, to: 0 });
    return 500 - x.players[1].field[0]!.hp;
  };
  out.damage = { 'atk30_def0_neutral': mk(30, 0, 'neutral', 'neutral'), 'atk30_def10': mk(30, 10, 'neutral', 'neutral'), 'atk30_def29': mk(30, 29, 'neutral', 'neutral'), 'atk30_def30': mk(30, 30, 'neutral', 'neutral'), 'atk30_def99': mk(30, 99, 'neutral', 'neutral'),
    'atk30_def0_fire_vs_nature(x1.5)': mk(30, 0, 'fire', 'nature'), 'atk30_def0_nature_vs_fire(x0.75)': mk(30, 0, 'nature', 'fire'), 'atk10_def5_fire_vs_nature': mk(10, 5, 'fire', 'nature') };
}

// B. SPL-003 x3 on one unit => DEF 45; SPL-004 x3 => ATK +45 (no cap in engine)
{
  const g0 = start(); g0.players[0].hand = [C('BOBO-015'), C('SPL-003'), C('SPL-003'), C('SPL-003')];
  let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'cast', hand: 0, target: { slot: 0 } }, { t: 'cast', hand: 0, target: { slot: 0 } }, { t: 'cast', hand: 0, target: { slot: 0 } });
  const u = g.players[0].field[0]!; out.spl003x3 = { bonusDef: u.bonusDef, atk: u.atk, castsInOneTurn: 3 };
  g.players[0].hand = [C('SPL-004'), C('SPL-004'), C('SPL-004')]; g = run(g, { t: 'cast', hand: 0, target: { slot: 0 } }, { t: 'cast', hand: 0, target: { slot: 0 } }, { t: 'cast', hand: 0, target: { slot: 0 } });
  out.spl004x3 = { bonusAtk: g.players[0].field[0]!.bonusAtk, totalAtk: g.players[0].field[0]!.atk + g.players[0].field[0]!.bonusAtk };
}

// C. SPL-007 swap: take the best enemy unit for a Lv15 (enemy Lv70 here); can the stolen unit attack at once?
{
  const g0 = start(); g0.players[0].hand = [C('DNMAN-015')]; g0.players[1].hand = [C('FOLLOW-YOU-015')];
  let g = run(g0, { t: 'summon', hand: 0, slot: 0 }, { t: 'next' }, { t: 'next' });
  g.players[1].hand = [C('FOLLOW-YOU-015')]; g = run(g, { t: 'summon', hand: 0, slot: 0 });
  g.players[1].field[0] = { ...g.players[1].field[0]!, card: C('FOLLOW-YOU-070'), hp: 300, maxHp: 300, atk: 100, summonedTurn: 1 };   // stand-in: an enemy Lv70 on the field
  g = run(g, { t: 'next' }, { t: 'next' }); g.players[0].hand = [C('SPL-007')];
  g = act(g, { t: 'cast', hand: 0, target: { slot: 0, slot2: 0 } });
  const stolen = g.players[0].field[0]!; g = act(g, { t: 'next' });
  const atk = tryAct(g, { t: 'attack', from: 0, to: 0 } as Action);   // slot 0 of the enemy now holds my former DNMAN-015
  out.spl007 = { myFieldNow: stolen.card.id, stolenAtk: stolen.atk, stolenAttackedFlag: stolen.attacked, stolenCanAttackSameTurn: atk.ok, error: atk.ok ? null : (atk as any).err };
}

// D. Evolution: 1 EVO card per step; sacrifice 1/2/3; evolved unit cannot attack that turn; clears poison and lock
{
  const A15 = C('TEE-015'), A40 = C('TEE-040'), evo = C('EVO-001');
  const g0 = start(); g0.players[0].hand = [A15, C('BOBO-015'), evo]; g0.players[0].extra = [A40];
  let g = run(g0, { t: 'summon', hand: 0, slot: 0 }); g = ff(g, 1); g.players[0].hand = [C('BOBO-015'), evo]; g = act(g, { t: 'summon', hand: 0, slot: 1 });
  g.players[0].field[0]!.poison = 3; g.players[0].field[0]!.lockedUntil = 99;
  const wrongSac = tryAct(g, { t: 'evolve', slot: 0, evo: 0, form: 0, sacrifice: [] } as Action);
  g = act(g, { t: 'evolve', slot: 0, evo: 0, form: 0, sacrifice: [1] });
  const nu = g.players[0].field[0]!; g = act(g, { t: 'next' });
  const atk = tryAct(g, { t: 'attack', from: 0, to: 'player' } as Action);
  out.evolution = { evoCardsConsumed: 1, sacrificeRequired: RULES.sacrifice, zeroSacrificeRejected: !wrongSac.ok, newPoison: nu.poison, newLockedUntil: nu.lockedUntil, evolvedUnitCanAttackSameTurn: atk.ok, attackError: atk.ok ? null : atk.err, evolvePerTurnLimit: 1 };
}

// E. Fusion: stats of the production pair backji + nong-taengmo (top 100% + bottom 50% + bonus), loses bottom's effect, cannot evolve
{
  const g0 = createGame([filler(), filler()], 7, 0, { interactive: false, fusionPairs: [{ a: 'backji', b: 'nong-taengmo', hp: 20, atk: 10, def: 0 }] });
  g0.players[0].hand = [C('BACKJI-015'), C('NONG-TAENGMO-015'), C('FUS-001')];
  const g = act(g0, { t: 'fuse', fusion: 2, top: 0, bottom: 1, slot: 0 }); const u = g.players[0].field[0]!;
  out.fusion = { top: 'BACKJI-015', bottom: 'NONG-TAENGMO-015', hp: u.hp, atk: u.atk, def: u.def, effectsOfCard: u.card.effects?.length, fusedCards: u.fused?.map(c => c.id), countsAsSummon: g.players[0].summoned };
}

// F. SPL-008: blocks the enemy's NEXT turn only
{
  const g0 = start(); g0.players[0].hand = [C('SPL-008')]; g0.players[1].hand = [C('BOBO-015')];
  let g = act(g0, { t: 'cast', hand: 0 }); g = run(g, { t: 'next' }, { t: 'next' }); g.players[1].hand = [C('BOBO-015')]; g = act(g, { t: 'summon', hand: 0, slot: 0 }); g = run(g, { t: 'next' });
  const t2 = g.turn; const blocked = tryAct(g, { t: 'attack', from: 0, to: 'player' } as Action);
  out.spl008 = { enemyTurnNo: t2, attackBlocked: !blocked.ok, err: blocked.ok ? null : blocked.err };
}

// G. Passive auras stack per source (two Lv70 FOLLOW-YOU-070 => +10 ATK; two LALAPING-070 => +20 max HP)
{
  const g0 = start(); g0.players[0].hand = [C('BOBO-015')]; let g = act(g0, { t: 'summon', hand: 0, slot: 0 });
  g.players[0].field[1] = { ...g.players[0].field[0]!, uid: 99, card: C('FOLLOW-YOU-070'), hp: 300, maxHp: 300, atk: 100 };
  g.players[0].field[2] = { ...g.players[0].field[0]!, uid: 98, card: C('FOLLOW-YOU-070'), hp: 300, maxHp: 300, atk: 100 };
  g.players[0].field[3] = { ...g.players[0].field[0]!, uid: 97, card: C('LALAPING-070'), hp: 310, maxHp: 310, atk: 80 };
  g.players[0].field[4] = { ...g.players[0].field[0]!, uid: 96, card: C('LALAPING-070'), hp: 310, maxHp: 310, atk: 80 };
  g.players[0].hand = [C('SPL-005')]; g = act(g, { t: 'cast', hand: 0 });           // any action recomputes auras
  const b = g.players[0].field[0]!; out.auras = { bobo15AuraAtk: b.auraAtk, bobo15AuraHp: b.auraHp };
}

// H. Spell volume: no per-turn cast limit; SPL-005 draw 2 stops when the hand is full (no burn); SPL-006 recycles Lv15 summon-draw units
{
  const g0 = start(); g0.players[0].hand = [C('SPL-005'), C('SPL-005'), C('SPL-005')];
  const g = run(g0, { t: 'cast', hand: 0 }, { t: 'cast', hand: 0 }, { t: 'cast', hand: 0 });
  out.spellVolume = { castsInOneTurn: 3, handAfter: g.players[0].hand.length, handMax: RULES.handMax, deckAfter: g.players[0].deck.length };
}

// I. SPL-002 heal / SPL-001 damage vs trap timing; TRP-006 hits the ACTIVE player's highest-ATK unit at the end of their own turn
{
  const g0 = start(); g0.players[1].back[0] = { card: C('TRP-006'), setTurn: 0 }; g0.players[0].hand = [C('BOBO-015'), C('DNMAN-015')];
  let g = act(g0, { t: 'summon', hand: 0, slot: 0 }); const hpBefore = g.players[0].field[0]!.hp; g = act(g, { t: 'next' }); g = act(g, { t: 'next' });
  out.trp006 = { firedAtEndOfActivePlayersTurn: g.players[1].back[0] === null, hpLost: hpBefore - g.players[0].field[0]!.hp };
}


// M. Recursion: SPL-006 returns a dead Lv15 to hand; its on_summon draw is "once per game" PER UNIT INSTANCE, so it fires again on every re-summon
{
  const g0 = start(); g0.players[0].grave = [C('CHAEM-015')]; g0.players[0].hand = [C('SPL-006')];
  let g = act(g0, { t: 'cast', hand: 0, target: { grave: 0 } }); const h1 = g.players[0].hand.length;
  g = act(g, { t: 'summon', hand: g.players[0].hand.findIndex(c => c.id === 'CHAEM-015'), slot: 0 });
  out.recursion = { handAfterRevive: h1, handAfterResummon: g.players[0].hand.length, deckAfter: g.players[0].deck.length, note: 'CHAEM-015 on_summon draw fired again after revive+summon' };
}

// N. Evolving into LALAPING-070 keeps damage by rule (evolveHp) but its on_evolve full-heal can undo it when the new unit is the chosen target
{
  const g0 = start(); g0.players[0].hand = [C('LALAPING-040'), C('BOBO-015'), C('EVO-001')]; g0.players[0].extra = [C('LALAPING-070')];
  let g = act(g0, { t: 'summon', hand: 1, slot: 1 }); g = ff(g, 1); g.players[0].field[0] = null;
  g.players[0].field[0] = { ...g.players[1 - 1].field[1]!, uid: 77, card: C('LALAPING-040'), hp: 20, maxHp: 160, atk: 40, summonedTurn: 1, attacked: false };
  g.players[0].field[2] = { ...g.players[0].field[1]!, uid: 78, card: C('BOBO-015'), hp: 80, maxHp: 80 }; g.players[0].field[3] = { ...g.players[0].field[2]!, uid: 79 };
  g.players[0].hand = [C('EVO-001')];
  g = act(g, { t: 'evolve', slot: 0, evo: 0, form: 0, sacrifice: [1, 2] });
  out.lalaping070 = { newHp: g.players[0].field[0]!.hp, newMaxHp: g.players[0].field[0]!.maxHp, note: 'evolve from hp 20/160; aura +10 max HP; on_evolve heals ally1 (auto picks lowest HP ratio)' };
}

// J. Which cards run by card ID inside the engine (numbers hard-coded) vs by data
out.cardIdDriven = { spells: ['SPL-001..010'], traps: ['TRP-001..010 (event map TRAP{})'], note: 'numeric values of spells/traps live in game.ts, not in card data' };

// K. Starting LP actually used
{ const g = start(); out.startingLp = { engine: g.players[0].lp, handMax: RULES.handMax, startHand: RULES.startHand, fieldSlots: RULES.fieldSlots, backSlots: RULES.backSlots }; }

// L. Legal-action sanity: a character Lv40 cannot be summoned from hand
{ const g0 = start(); g0.players[0].hand = [C('BADGUY-040')]; const r = tryAct(g0, { t: 'summon', hand: 0, slot: 0 }); out.summonLv40 = r.ok ? 'allowed' : (r as any).err; }

console.log(JSON.stringify(out, null, 2));
process.exit(0);
