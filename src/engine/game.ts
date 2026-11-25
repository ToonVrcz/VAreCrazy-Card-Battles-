// Game engine v1 — pure rules, no UI. Rules come from the agreed/proposed game_rules (LP 100, 4 phases, ATK-DEF min 1 x element,
// counter-attack, first player can't attack on turn 1, spells main-phase only, traps face-down & usable from next turn).
// Chain window: with `interactive: true`, when a face-down trap could answer an event the game pauses (g.pending) and the trap's owner
// answers with {t:'respond', back} or {t:'pass'}. Implemented by replaying the original action with the collected answers (deterministic, seeded).
// With `interactive` off (default) the first matching trap fires automatically. Item cards are not included.
import { elementMultiplier, evolveHp, type Element } from './combat';

export type CardType = 'character' | 'evolution' | 'fusion' | 'spell' | 'trap' | 'item';
import type { Effect, EffectTrigger } from './effects';
import { emit, type GameEvent } from './events';
/** Data-driven Spell/Trap (Signature cards). Everything a card does is described here, never by card id. */
export type TrapTrigger = 'enemy_attack' | 'self_attacked' | 'own_attack' | 'ally_grave' | 'self_destroyed' | 'kill_by_attack' | 'ally_battle_damage' | 'enemy_target' | 'effect_destroy';
export type SupportWho = 'link' | 'ally' | 'other_ally' | 'enemy' | 'attacker' | 'victim';
export interface SupportOp { op: 'buff' | 'heal' | 'damage' | 'draw' | 'search_evo_top3' | 'negate_target' | 'reduce_numeric' | 'redirect_attack' | 'survive_at_1' | 'reduce_battle_damage'; who?: SupportWho; stat?: 'atk' | 'def'; amount?: number; until?: 'turn' | 'opp_turn' | 'battle' | 'next_attack' }
export interface SupportDef { kind: 'spell' | 'trap'; link: string; trigger?: TrapTrigger; source?: 'spell'; ops: SupportOp[] }
export interface CardDef { support?: SupportDef; id: string; name: string; type: CardType; level: number | null; chain: string | null; hp: number | null; atk: number | null; def: number; element: string | null; effects?: Effect[] }
export const RULES = { lp: 100, handMax: 10, startHand: 5, fieldSlots: 7, backSlots: 5, sacrifice: { 40: 1, 70: 2, 99: 3 } as Record<number, number>, sacrificeSameLevel: true, poison: { dmg: 5, turns: 3 } };
export class EngineError extends Error {}

/** Story link: while a unit of chain `a` and a unit of chain `b` are on the SAME side's field, every unit of chain `a` gets the modifiers (directional: one row = one side of the story). Never stacked per duplicate copy of `b`. */
export interface StoryLink { a: string; b: string; name?: string; mods: { stat: 'hp' | 'atk' | 'def'; amount: number }[] }
export interface FusionPair { a: string; b: string; hp: number; atk: number; def: number }
export interface Unit { nextAtk?: { amount: number; turn: number }; untargetableTurn?: number; tempAtk?: number; tempDef?: number; splTurn?: Record<string, number>; timed?: { stat: 'atk' | 'def'; amount: number; until: number }[]; auraAtk?: number; auraDef?: number; auraHp?: number; storyNames?: string[]; used?: Record<string, number>; stacks?: Record<string, number>; fused?: CardDef[]; uid: number; card: CardDef; hp: number; maxHp: number; atk: number; def: number; bonusAtk: number; bonusDef: number; summonedTurn: number; attacked: boolean; lockedUntil: number; poison: number }
export interface Player { extra?: CardDef[]; lp: number; deck: CardDef[]; hand: CardDef[]; field: (Unit | null)[]; back: ({ card: CardDef; setTurn: number } | null)[]; grave: CardDef[]; summoned: boolean; evolved: boolean; noAttackUntil: number }
export interface TargetInfo { side: 'ally' | 'enemy'; kind: 'atk' | 'heal' | 'damage' | 'discard'; amount: number; text: string; source: string; choices: { slot: number; id: string; name: string; hp: number; maxHp: number; atk: number }[] }   // choices = the candidates as they are at the moment of the question (the board shown is the state before the action)
export interface Pending { responder: 0 | 1; event: string; options: number[]; base: Game; action: Action; answers: number[]; info?: TargetInfo }
export interface Game { interactive?: boolean; pending?: Pending; players: [Player, Player]; turn: number; active: 0 | 1; phase: 'main' | 'battle'; winner: 0 | 1 | null; log: string[]; seed: number; uid: number; fusion: { pairs: FusionPair[]; topPct: number; bottomPct: number }; story?: StoryLink[]; stats?: [PlayerStats, PlayerStats]; events?: GameEvent[]; evSeq?: number }
/** Per-player counters of server-validated, state-changing actions (data collection only; never sent to clients, see viewFor). Absent on games created before this existed. */
export interface PlayerStats {
  summon: number; evolve: number; fuse: number; set: number; cast: number;
  attack: number;          // attacks declared (unit or direct); an attack cancelled by a trap still counts
  attackDirect: number;    // subset of `attack` aimed at the player
  trap: number;            // face-down traps of this player that actually fired
  dmgUnit: number;         // unit HP actually removed by this player's attacks, spells, counter-attacks and trap reflections
  dmgLp: number;           // LP actually removed from the opponent
  dmgDelayed: number;      // unit HP removed by this player's lingering effects (poison ticks, turn-start / turn-end traps)
  activeTurns: number;     // own turns in which at least one of summon/evolve/fuse/set/cast/attack succeeded
  lastActiveTurn: number;  // g.turn of the last counted active turn (bookkeeping for activeTurns)
}
/** Version of the PlayerStats layout stored in pvp_matches.stats_version. Bump when a counter's meaning changes. */
export const STATS_VERSION = 1;
export const newStats = (): PlayerStats => ({ summon: 0, evolve: 0, fuse: 0, set: 0, cast: 0, attack: 0, attackDirect: 0, trap: 0, dmgUnit: 0, dmgLp: 0, dmgDelayed: 0, activeTurns: 0, lastActiveTurn: 0 });
type Counter = Exclude<keyof PlayerStats, 'lastActiveTurn' | 'activeTurns'>;
/** Adds to a counter; a no-op for games without stats. Only called after an action has been validated, on the cloned state of that action. */
function bump(g: Game, pi: 0 | 1, k: Counter, n = 1) { if (g.stats && n > 0) g.stats[pi][k] += n; }
/** An own-turn action succeeded: counts the turn once. */
function active(g: Game, pi: 0 | 1, k: 'summon' | 'evolve' | 'fuse' | 'set' | 'cast' | 'attack') {
  const s = g.stats?.[pi]; if (!s) return;
  s[k]++; if (s.lastActiveTurn !== g.turn) { s.lastActiveTurn = g.turn; s.activeTurns++; }
}
export type Action =
  | { t: 'summon'; hand: number; slot: number }
  | { t: 'evolve'; slot: number; evo: number; form: number; sacrifice: number[] }
  | { t: 'cast'; hand: number; target?: { slot?: number; slot2?: number; grave?: number } }
  | { t: 'fuse'; fusion: number; top: number; bottom: number; slot: number }
  | { t: 'set'; hand: number }
  | { t: 'attack'; from: number; to: number | 'player' }
  | { t: 'respond'; back: number }
  | { t: 'pass' }
  | { t: 'next' };

const rnd = (g: Game) => { let t = (g.seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const fail = (m: string): never => { throw new EngineError(m); };
const other = (i: 0 | 1) => (1 - i) as 0 | 1;
const effAtk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk + (u.auraAtk ?? 0)), effDef = (u: Unit) => Math.max(0, u.def + u.bonusDef + (u.auraDef ?? 0));
const els = (u: Unit) => (u.card.element ?? 'neutral') as Element;
const hit = (a: Unit, d: Unit) => Math.max(1, Math.floor(Math.max(1, effAtk(a) - effDef(d)) * elementMultiplier(els(a), els(d))));
const log = (g: Game, m: string) => { g.log.push(`T${g.turn}: ${m}`); };
const mk = (g: Game, c: CardDef, hp?: number): Unit => ({ uid: ++g.uid, card: c, hp: hp ?? c.hp ?? 1, maxHp: c.hp ?? 1, atk: c.atk ?? 0, def: c.def ?? 0, bonusAtk: 0, bonusDef: 0, summonedTurn: g.turn, attacked: false, lockedUntil: 0, poison: 0 });
const units = (p: Player) => p.field.filter((u): u is Unit => !!u);

export function createGame(decks: [CardDef[], CardDef[]], seed = 1, first: 0 | 1 = 0, opts: { storyLinks?: StoryLink[]; fusionPairs?: FusionPair[]; topPct?: number; bottomPct?: number; interactive?: boolean; extras?: [CardDef[], CardDef[]] } = {}): Game {
  // extras = each player's separate Evolution deck (Lv40/70/99 forms). Without it, forms live in the hand (legacy rules).
  const g: Game = { players: [0, 1].map(i => ({ lp: RULES.lp, deck: [...decks[i]], hand: [], field: Array(RULES.fieldSlots).fill(null), back: Array(RULES.backSlots).fill(null), grave: [], summoned: false, evolved: false, noAttackUntil: 0 })) as unknown as [Player, Player], turn: 1, active: first, phase: 'main', winner: null, log: [], seed, uid: 0, interactive: !!opts.interactive, fusion: { pairs: opts.fusionPairs ?? [], topPct: opts.topPct ?? 100, bottomPct: opts.bottomPct ?? 50 }, stats: [newStats(), newStats()] };
  if (opts.storyLinks?.length) g.story = opts.storyLinks.map(l => ({ a: l.a, b: l.b, name: l.name, mods: l.mods.map(m => ({ ...m })) }));
  if (opts.extras) g.players.forEach((p, i) => { p.extra = [...opts.extras![i]]; });
  for (const p of g.players) { for (let i = p.deck.length - 1; i > 0; i--) { const j = Math.floor(rnd(g) * (i + 1)); [p.deck[i], p.deck[j]] = [p.deck[j], p.deck[i]]; } p.hand = p.deck.splice(0, RULES.startHand); }
  return g;
}
function draw(g: Game, pi: 0 | 1, loseIfEmpty = false) {
  const p = g.players[pi]; if (p.hand.length >= RULES.handMax) return false;
  if (!p.deck.length) { if (loseIfEmpty) { g.winner = other(pi); log(g, `ผู้เล่น ${pi + 1} จั่วไม่ได้ แพ้`); emit(g, { t: 'game_over', p: other(pi), why: 'deck' }); } return false; }
  p.hand.push(p.deck.shift()!); return true;
}
const TRAP: Record<string, string> = { 'TRP-001': 'on_attack', 'TRP-002': 'on_attack', 'TRP-003': 'on_attack_direct', 'TRP-009': 'on_attack', 'TRP-004': 'on_summon', 'TRP-005': 'on_evolve', 'TRP-006': 'turn_end', 'TRP-007': 'turn_start', 'TRP-008': 'on_destroyed', 'TRP-010': 'to_graveyard' };
class NeedAnswer extends Error { constructor(public responder: 0 | 1, public event: string, public options: number[], public info?: TargetInfo) { super('need answer'); } }
let CTX: { answers: number[]; i: number } = { answers: [], i: 0 };
const chainsOf = (u: Unit) => [u.card.chain, ...(u.fused ?? []).map(c => c.chain)].filter((c): c is string => !!c);
const linkUnit = (g: Game, owner: 0 | 1, link: string) => g.players[owner].field.find((u): u is Unit => !!u && chainsOf(u).includes(link));
/** Whether a Signature trap's linked character condition holds for this event (ctx = the unit the event is about). */
function supportLinkOk(g: Game, owner: 0 | 1, s: SupportDef, ev: string, ctx?: Unit): boolean {
  if (['self_attacked', 'own_attack', 'self_destroyed', 'kill_by_attack', 'enemy_target'].includes(ev)) return !!ctx && chainsOf(ctx).includes(s.link);
  if (ev === 'ally_grave') return !!linkUnit(g, owner, s.link) && !(ctx && chainsOf(ctx).includes(s.link));      // "another allied character"
  return !!linkUnit(g, owner, s.link);
}
let FIRED: CardDef | null = null;
let TSRC: 'spell' | 'ability' = 'ability';        // what is targeting, for traps that only answer spells (MON)
/** Trap slots of `owner` that could answer this event (usable only from the turn after they were set). */
export function trapOptions(g: Game, owner: 0 | 1, ev: string, ctx?: Unit): number[] {
  const out: number[] = [];
  g.players[owner].back.forEach((t, i) => {
    if (!t || t.setTurn >= g.turn) return;
    const sp = t.card.support; if (sp) { if (sp.kind === 'trap' && sp.trigger === ev && (!sp.source || ev !== 'enemy_target' || sp.source === TSRC) && supportLinkOk(g, owner, sp, ev, ctx)) out.push(i); return; }
    const k = TRAP[t.card.id]; if (k === ev || (ev === 'on_attack_direct' && k === 'on_attack')) out.push(i);
  });
  return out;
}
/** Fire a face-down trap of `owner` for this event: first match automatically, or the owner's choice in interactive games. */
function fire(g: Game, owner: 0 | 1, ev: string, ctx?: Unit): string | null {
  const opts = trapOptions(g, owner, ev, ctx); if (!opts.length) return null;
  let pick = opts[0];
  if (g.interactive) {
    if (CTX.i >= CTX.answers.length) throw new NeedAnswer(owner, ev, opts);
    const ans = CTX.answers[CTX.i++]; if (ans === -1) return null;
    if (!opts.includes(ans)) fail('เลือกกับดักไม่ถูกต้อง'); pick = ans;
  }
  const p = g.players[owner], t = p.back[pick]!;
  p.back[pick] = null; p.grave.push(t.card); FIRED = t.card; log(g, `กับดัก ${t.card.name} ทำงาน`); emit(g, { t: 'trap_fired', p: owner, card: t.card.name }); bump(g, owner, 'trap'); return t.card.id;
}

/** What a fired Signature trap asks the caller to do (the immediate parts, e.g. buffs and heals, are already done). */
interface Fx { redirect?: boolean; negate?: boolean; reduce?: number; dmgCut?: number }
type BattleMods = [Unit, 'atk' | 'def', number][];
const mostHurt = (g: Game, pi: 0 | 1, not?: Unit) => g.players[pi].field.reduce<Unit | null>((b, u) => (!u || u === not || (b && b.hp / b.maxHp <= u.hp / u.maxHp) ? b : u), null);
function addMod(g: Game, pi: 0 | 1, u: Unit, stat: 'atk' | 'def', amount: number, until: SupportOp['until'], src: string, mods?: BattleMods) {
  if (until === 'next_attack' && stat === 'atk') { u.nextAtk = { amount: (u.nextAtk?.turn === g.turn ? u.nextAtk.amount : 0) + amount, turn: g.turn }; emit(g, { t: 'buff', p: pi, card: u.card.name, stat, v: amount, src }); return; }
  if (until === 'battle' && mods) { if (stat === 'atk') u.bonusAtk += amount; else u.bonusDef += amount; mods.push([u, stat, amount]); }
  else (u.timed ??= []).push({ stat, amount, until: g.turn + (until === 'opp_turn' ? 1 : 0) });
  if (amount > 0) emit(g, { t: 'buff', p: pi, card: u.card.name, stat, v: amount, src });
}
/** Runs the ops of a Signature card that `owner` just used. ctx names the units the event is about. */
function runOps(g: Game, owner: 0 | 1, card: CardDef, ctx: { unit?: Unit; attacker?: Unit; victim?: Unit }, mods?: BattleMods): Fx {
  const sp = card.support!, fx: Fx = {};
  for (const o of sp.ops) {
    const link = ctx.unit && chainsOf(ctx.unit).includes(sp.link) ? ctx.unit : linkUnit(g, owner, sp.link);
    const u = o.who === 'attacker' ? ctx.attacker : o.who === 'victim' ? ctx.victim : o.who === 'other_ally' ? mostHurt(g, owner, link) : o.who === 'ally' ? mostHurt(g, owner) : link;
    if (o.op === 'buff' && u && o.stat) addMod(g, owner, u, o.stat, o.amount ?? 0, o.until ?? 'turn', card.name, mods);
    else if (o.op === 'heal' && u) { const b = u.hp; u.hp = Math.min(u.maxHp, u.hp + (o.amount ?? 0)); if (u.hp > b) emit(g, { t: 'heal', p: owner, card: u.card.name, v: u.hp - b, src: card.name }); }
    else if (o.op === 'negate_target') fx.negate = true;
    else if (o.op === 'reduce_numeric') fx.reduce = o.amount ?? 0;
    else if (o.op === 'redirect_attack') fx.redirect = true;
    else if (o.op === 'reduce_battle_damage') fx.dmgCut = o.amount ?? 0;
  }
  return fx;
}
/** A targeted effect of the opponent selects `tu` (owned by `side`): a face-down Signature trap may negate it or shave 5 off its number. */
function targetTrap(g: Game, side: 0 | 1, tu: Unit, src: 'spell' | 'ability' = 'ability'): Fx { TSRC = src; try { return fire(g, side, 'enemy_target', tu) && FIRED ? runOps(g, side, FIRED, { unit: tu }) : {}; } finally { TSRC = 'ability'; } }
const cut = (n: number, fx: Fx) => (n < 0 ? -Math.max(0, -n - (fx.reduce ?? 0)) : Math.max(0, n - (fx.reduce ?? 0)));
/** A Signature Spell: needs its linked character on the caster's field, then runs its ops. */
function castSupport(g: Game, pi: 0 | 1, c: CardDef, t: { slot?: number }) {
  const sp = c.support!, me = g.players[pi], opp = other(pi), en = g.players[opp];
  const lu = linkUnit(g, pi, sp.link) ?? fail('ต้องมีตัวละครที่ผูกกับการ์ดใบนี้อยู่ในสนามของคุณ');
  const w = sp.ops.find(o => o.who === 'ally' || o.who === 'other_ally' || o.who === 'enemy')?.who;
  let tu: Unit | undefined;
  if (w) {
    if (t.slot === undefined) fail('ต้องเลือกเป้าหมาย');
    if (w === 'enemy') { tu = en.field[t.slot!] ?? fail('ไม่มีตัวละครในช่องนั้น'); if (!targetable(g, tu)) fail('ตัวละครนี้ถูกป้องกันการเลือกเป็นเป้าหมาย'); }
    else { tu = me.field[t.slot!] ?? fail('ไม่มีตัวละครของคุณในช่องนั้น'); if (w === 'other_ally' && tu === lu) fail('ต้องเลือกตัวละครตัวอื่น'); }
  }
  emit(g, { t: 'cast', p: pi, card: c.name });
  const fx: Fx = w === 'enemy' && tu ? targetTrap(g, opp, tu, 'spell') : {};
  for (const o of sp.ops) {
    const u = o.who === 'link' || !o.who ? lu : tu;
    if (o.op === 'buff' && u && o.stat && !(u !== lu && w === 'enemy' && fx.negate)) addMod(g, pi, u, o.stat, w === 'enemy' && u === tu ? cut(o.amount ?? 0, fx) : o.amount ?? 0, o.until ?? 'turn', c.name);
    else if (o.op === 'heal' && u) { const b = u.hp; u.hp = Math.min(u.maxHp, u.hp + (o.amount ?? 0)); if (u.hp > b) emit(g, { t: 'heal', p: pi, card: u.card.name, v: u.hp - b, src: c.name }); }
    else if (o.op === 'damage' && u && !fx.negate) { const side = u === tu && w === 'enemy' ? opp : pi, slot = g.players[side].field.indexOf(u); if (slot >= 0) damageUnit(g, side, slot, cut(o.amount ?? 0, fx), pi, false, c.name); }
    else if (o.op === 'draw') { let n = 0; for (let i = 0; i < (o.amount ?? 1); i++) if (draw(g, pi)) n++; if (n) emit(g, { t: 'draw', p: pi, v: n, src: c.name }); }
    else if (o.op === 'search_evo_top3') {
      const top = me.deck.splice(0, 3), k = top.findIndex(x => x.type === 'evolution');
      if (k >= 0 && me.hand.length - 1 < RULES.handMax) { me.hand.push(top.splice(k, 1)[0]); emit(g, { t: 'search_evo', p: pi, card: c.name, to: me.hand[me.hand.length - 1].name }); }
      me.deck.push(...top);                                                 // the rest go to the bottom in their original order
    }
  }
}
function toGrave(g: Game, pi: 0 | 1, u: Unit) {
  g.players[pi].grave.push(...(u.fused ?? [u.card]));
  g.players[pi].field.forEach(s => { if (s && s !== u && s.hp > 0) runEffects(g, pi, s, 'to_graveyard'); });   // "when a character of mine goes to the graveyard"
  if (fire(g, pi, 'ally_grave', u) && FIRED) runOps(g, pi, FIRED, { unit: u });
}
/** An opposing unit that effects and spells may choose (a character summoned this turn with "protect" cannot be chosen). */
const targetable = (g: Game, u: Unit | null): u is Unit => !!u && u.untargetableTurn !== g.turn;
/** Bonus for fusing two characters, or null if their chains are not ticked as a Fusion pair (highest bonus per stat wins). */
export function fusionBonus(g: Game, x: CardDef, y: CardDef) {
  if (x.type !== 'character' || y.type !== 'character' || !x.chain || !y.chain || x.chain === y.chain) return null;
  const m = g.fusion.pairs.filter(p => (p.a === x.chain && p.b === y.chain) || (p.a === y.chain && p.b === x.chain)); if (!m.length) return null;
  return { hp: Math.max(...m.map(p => p.hp)), atk: Math.max(...m.map(p => p.atk)), def: Math.max(...m.map(p => p.def)) };
}
/** `by` = the player the damage is credited to in the stats; `delayed` = caused by a lingering effect rather than by the action being resolved. */
function damageUnit(g: Game, pi: 0 | 1, slot: number, amount: number, by: 0 | 1, delayed = false, src?: string) {
  const p = g.players[pi], u = p.field[slot]; if (!u) return;
  if (amount > 0 && u.hp > 0) emit(g, { t: 'dmg', p: pi, card: u.card.name, v: Math.min(amount, u.hp), ...(src ? { src } : {}) });
  bump(g, by, delayed ? 'dmgDelayed' : 'dmgUnit', Math.min(Math.max(0, amount), Math.max(0, u.hp)));
  u.hp -= amount;
  if (u.hp > 0) return;
  if ((delayed || (src !== undefined && src !== 'สวนกลับ')) && fire(g, pi, 'effect_destroy', u)) { u.hp = 1; return; }      // destroyed by an effect (not battle): Signature trap may leave it at 1 HP
  if (fire(g, pi, 'on_destroyed')) { u.hp = 1; return; }
  p.field[slot] = null; toGrave(g, pi, u); log(g, `${u.card.name} ถูกทำลาย`); emit(g, { t: 'destroyed', p: pi, card: u.card.name });
  runEffects(g, pi, u, 'on_destroyed');
  if (fire(g, pi, 'self_destroyed', u) && FIRED) runOps(g, pi, FIRED, { unit: u });
  if (fire(g, pi, 'to_graveyard')) draw(g, pi);
}
function dealLp(g: Game, pi: 0 | 1, n: number, by: 0 | 1) { const p = g.players[pi], real = Math.min(Math.max(0, n), p.lp); bump(g, by, 'dmgLp', real); if (real > 0) emit(g, { t: 'lp', p: pi, v: real }); p.lp = Math.max(0, p.lp - n); if (p.lp === 0) { g.winner = other(pi); log(g, `ผู้เล่น ${pi + 1} LP หมด`); emit(g, { t: 'game_over', p: other(pi), why: 'lp' }); } }

/** Which of `options` (field slots of `side`) a bot / non-interactive game picks for an ability. */
function autoTarget(g: Game, side: 0 | 1, options: number[], kind: TargetInfo['kind']): number {
  const f = g.players[side].field, score = (i: number) => kind === 'heal' ? -(f[i]!.hp / f[i]!.maxHp) : effAtk(f[i]!);
  return options.reduce((best, i) => (score(i) > score(best) ? i : best), options[0]);
}
/** The one character an ability targets: the owner chooses (a pending question in interactive games). Returns null when nothing can be targeted. */
function chooseTarget(g: Game, owner: 0 | 1, e: Effect, u: Unit): Unit | null {
  const side = e.target === 'ally1' ? owner : other(owner), f = g.players[side].field;
  const options = f.map((x, i) => x && (side === owner || targetable(g, x)) ? i : -1).filter(i => i >= 0); if (!options.length) return null;
  const kind: TargetInfo['kind'] = e.kind === 'heal' ? 'heal' : e.kind === 'damage' ? 'damage' : 'atk';
  let slot: number;
  if (options.length === 1) slot = options[0];
  else if (!g.interactive) slot = autoTarget(g, side, options, kind);
  else {
    if (CTX.i >= CTX.answers.length) throw new NeedAnswer(owner, 'effect_target', options, { side: e.target === 'ally1' ? 'ally' : 'enemy', kind, amount: e.amount, text: e.text, source: u.card.name, choices: options.map(i => ({ slot: i, id: f[i]!.card.id, name: f[i]!.card.name, hp: f[i]!.hp, maxHp: f[i]!.maxHp, atk: effAtk(f[i]!) })) });
    const ans = CTX.answers[CTX.i++];
    if (ans === -1) slot = autoTarget(g, side, options, kind); else if (!options.includes(ans)) fail('เลือกเป้าหมายไม่ถูกต้อง'); else slot = ans;
  }
  return f[slot]!;
}
/** The hand card the owner discards to pay an ability cost; null = declined / nothing to discard (the ability is not used up). */
function chooseDiscard(g: Game, owner: 0 | 1, e: Effect, u: Unit): number | null {
  const hand = g.players[owner].hand; if (!hand.length) return null;
  const options = hand.map((_, i) => i);
  if (!g.interactive) return options[options.length - 1];
  if (CTX.i >= CTX.answers.length) throw new NeedAnswer(owner, 'effect_target', options, { side: 'ally', kind: 'discard', amount: 0, text: e.text, source: u.card.name, choices: hand.map((c, i) => ({ slot: i, id: c.id, name: c.name, hp: 0, maxHp: 0, atk: 0 })) });
  const ans = CTX.answers[CTX.i++];
  if (ans === -1) return null;                                                   // "do not discard": the ability is skipped
  if (!options.includes(ans)) fail('เลือกการ์ดไม่ถูกต้อง'); return ans;
}
/** Runs the character abilities of `u` that match `trig` (abilities come from Admin card_effects, see effects.ts). */
function runEffects(g: Game, pi: 0 | 1, u: Unit, trig: EffectTrigger, ctx: { target?: Unit; after?: boolean } = {}) {
  (u.card.effects ?? []).forEach((e, i) => {
    if (e.trigger !== trig) return;
    if ((e.cond === 'target_destroyed') !== !!ctx.after) return;             // "target destroyed" abilities run after the damage, the others before it
    if (e.cond === 'target_hp_lower' && !(ctx.target && ctx.target.hp < u.hp)) return;
    const k = String(i); u.used ??= {};
    if (e.limit === 'turn' && u.used[k] === g.turn) return;
    if (e.limit === 'game' && u.used[k]) return;
    let ts: Unit[];
    if (e.target === 'self') ts = [u];
    else if (e.target === 'allies') ts = g.players[pi].field.filter((x): x is Unit => !!x);
    else if (e.target === 'deck') ts = [];
    else { const t = chooseTarget(g, pi, e, u); if (!t) return; ts = [t]; }   // nothing to target: the ability does not fire and is not used up
    if (e.cost === 'discard1') { const idx = chooseDiscard(g, pi, e, u); if (idx === null) return; const c = g.players[pi].hand.splice(idx, 1)[0]; g.players[pi].grave.push(c); log(g, `${u.card.name}: ทิ้ง ${c.name}`); emit(g, { t: 'discard', p: pi, card: u.card.name, to: c.name }); }
    if (e.kind === 'search_evo') {
      const p = g.players[pi], di = p.deck.findIndex(c => c.type === 'evolution');
      if (di < 0 || p.hand.length >= RULES.handMax) return;                       // nothing to find / hand is full: not used up
      p.hand.push(p.deck.splice(di, 1)[0]); u.used[k] = e.limit === 'game' ? 1 : g.turn; log(g, `${u.card.name}: ${e.text}`); emit(g, { t: 'search_evo', p: pi, card: u.card.name, to: p.hand[p.hand.length - 1].name }); return;
    }
    u.used[k] = e.limit === 'game' ? 1 : g.turn;
    if (e.kind === 'protect') { u.untargetableTurn = g.turn; log(g, `${u.card.name}: ${e.text}`); emit(g, { t: 'protect', p: pi, card: u.card.name }); return; }
    for (const t of ts) {
      if (e.kind === 'atk') {
        let amt = e.amount;
        if (e.perm && e.max !== undefined) { t.stacks ??= {}; amt = Math.min(amt, e.max - (t.stacks[k] ?? 0)); if (amt <= 0) continue; t.stacks[k] = (t.stacks[k] ?? 0) + amt; }
        t.bonusAtk += amt; if (!e.perm) t.tempAtk = (t.tempAtk ?? 0) + amt;
        if (amt > 0) emit(g, { t: 'buff', p: pi, card: t.card.name, stat: 'atk', v: amt, src: u.card.name });
      } else if (e.kind === 'heal') { const before = t.hp; t.hp = e.full ? t.maxHp : Math.min(t.maxHp, t.hp + e.amount); if (t.hp > before) emit(g, { t: 'heal', p: pi, card: t.card.name, v: t.hp - before, src: u.card.name }); }
      else if (e.kind === 'draw') { let n = 0; for (let i = 0; i < e.amount; i++) if (draw(g, pi)) n++; if (n) emit(g, { t: 'draw', p: pi, v: n, src: u.card.name }); }
      else if (e.kind === 'damage') { const side = e.target === 'ally1' ? pi : other(pi), slot = g.players[side].field.indexOf(t); if (slot >= 0) { const fx = side !== pi ? targetTrap(g, side, t) : {}; if (!fx.negate) damageUnit(g, side, slot, cut(e.amount, fx), pi, true, u.card.name); } }
    }
    log(g, `${u.card.name}: ${e.text}`);
  });
}
/** Passive abilities ("while on the field") are recomputed after every action, so they vanish the moment their source leaves. */
export function refreshAuras(g: Game) {
  for (const pi of [0, 1] as const) {
    const us = g.players[pi].field.filter((x): x is Unit => !!x), atk = new Map<Unit, number>(), hp = new Map<Unit, number>(), def = new Map<Unit, number>(), names = new Map<Unit, string[]>();
    for (const src of us) for (const e of src.card.effects ?? []) {
      if (e.trigger !== 'passive') continue;
      for (const t of e.target === 'self' ? [src] : us) { const m = e.kind === 'atk' ? atk : e.kind === 'maxhp' ? hp : null; if (m) m.set(t, (m.get(t) ?? 0) + e.amount); }
    }
    // Story: recomputed from the current field every time, so it starts/stops the moment a partner arrives/leaves and can never accumulate.
    const chains = (u: Unit) => [u.card.chain, ...(u.fused ?? []).map(c => c.chain)].filter((c): c is string => !!c);
    if (g.story?.length) for (const l of g.story) {
      if (!us.some(x => chains(x).includes(l.b))) continue;
      for (const u of us) {
        if (!chains(u).includes(l.a)) continue;
        for (const m of l.mods) { const mm = m.stat === 'atk' ? atk : m.stat === 'hp' ? hp : def; mm.set(u, (mm.get(u) ?? 0) + m.amount); }
        names.set(u, [...(names.get(u) ?? []), l.name ?? `${l.a}+${l.b}`]);
      }
    }
    for (const u of us) if (u.timed?.length) { u.timed = u.timed.filter(x => x.until >= g.turn); for (const x of u.timed) { const mm = x.stat === 'atk' ? atk : def; mm.set(u, (mm.get(u) ?? 0) + x.amount); } }   // Signature buffs with a duration
    for (const u of us) {
      u.auraAtk = atk.get(u) ?? 0; u.auraDef = def.get(u) ?? 0; u.storyNames = names.get(u);
      const want = hp.get(u) ?? 0, d = want - (u.auraHp ?? 0);
      if (d) { u.maxHp += d; u.hp = d > 0 ? u.hp + d : Math.max(1, Math.min(u.hp, u.maxHp)); u.auraHp = want; }
    }
  }
}

function startTurn(g: Game) {
  const pi = g.active, p = g.players[pi]; p.summoned = false; p.evolved = false; emit(g, { t: 'turn_start', p: pi });
  p.field.forEach(u => { if (u) u.attacked = false; });
  p.field.forEach((u, i) => { if (u?.poison) { u.poison--; damageUnit(g, pi, i, RULES.poison.dmg, other(pi), true, 'พิษ'); } });
  if (fire(g, other(pi), 'turn_start')) p.field.forEach((u, i) => { if (u) damageUnit(g, pi, i, 5, other(pi), true, 'กับดัก'); });
  if (g.winner === null) p.field.forEach(u => { if (u) runEffects(g, pi, u, 'turn_start'); });
  if (g.winner === null) draw(g, pi, true);
  g.phase = 'main';
}
function endTurn(g: Game) {
  const pi = g.active, opp = other(pi);
  if (fire(g, opp, 'turn_end')) { let best = -1; g.players[pi].field.forEach((u, i) => { if (u && (best < 0 || effAtk(u) > effAtk(g.players[pi].field[best]!))) best = i; }); if (best >= 0) damageUnit(g, pi, best, 15, opp, true, 'กับดัก'); }
  g.players[pi].field.forEach(u => { if (u) runEffects(g, pi, u, 'turn_end'); });
  g.players.forEach(p => p.field.forEach(u => { { if (u?.tempAtk) { u.bonusAtk -= u.tempAtk; u.tempAtk = 0; } if (u?.tempDef) { u.bonusDef -= u.tempDef; u.tempDef = 0; } } }));   // "until the end of the turn" bonuses
  if (g.winner !== null) return;
  g.active = opp; g.turn++; startTurn(g);
}

/** Every index in a client-sent action must be a plain integer: keys like '__proto__' or 'length' would otherwise reach Array.prototype (F-07). */
function validateAction(a: Action) {
  const x = a as unknown as Record<string, unknown>;
  if (!x || typeof x !== 'object') fail('คำสั่งไม่ถูกต้อง');
  const int = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1000;
  const need = (...ks: string[]) => { for (const k of ks) if (!int(x[k])) fail('คำสั่งไม่ถูกต้อง'); };
  switch (a.t) {
    case 'summon': need('hand', 'slot'); break;
    case 'evolve': need('slot', 'evo', 'form'); if (!Array.isArray(x.sacrifice) || x.sacrifice.length > 10 || !x.sacrifice.every(int)) fail('คำสั่งไม่ถูกต้อง'); break;
    case 'fuse': need('fusion', 'top', 'bottom', 'slot'); break;
    case 'set': need('hand'); break;
    case 'attack': need('from'); if (x.to !== 'player' && !int(x.to)) fail('คำสั่งไม่ถูกต้อง'); break;
    case 'respond': need('back'); break;
    case 'cast': {
      need('hand'); const t = x.target;
      if (t !== undefined && t !== null) {
        if (typeof t !== 'object') fail('คำสั่งไม่ถูกต้อง');
        for (const k of ['slot', 'slot2', 'grave']) { const v = (t as Record<string, unknown>)[k]; if (v !== undefined && !int(v)) fail('คำสั่งไม่ถูกต้อง'); }
      }
      break;
    }
    case 'pass': case 'next': break;
    default: fail('คำสั่งไม่ถูกต้อง');
  }
}
export function act(g0: Game, a: Action): Game {
  validateAction(a);
  if (g0.winner !== null) fail('เกมจบแล้ว');
  if (g0.pending) {
    if (a.t !== 'respond' && a.t !== 'pass') fail('รอการตอบโต้ก่อน');
    const pd = g0.pending, base = structuredClone(pd.base);
    return run(base, pd.action, [...pd.answers, a.t === 'pass' ? -1 : (a as { back: number }).back]);
  }
  if (a.t === 'respond' || a.t === 'pass') fail('ไม่มีอะไรให้ตอบโต้');
  return run(g0, a, []);
}
function run(g0: Game, a: Action, answers: number[]): Game {
  CTX = { answers, i: 0 };
  try { const out = step(structuredClone(g0), a); refreshAuras(out); return out; }
  catch (e) {
    if (!(e instanceof NeedAnswer)) throw e;
    const out = structuredClone(g0); out.pending = { responder: e.responder, event: e.event, options: e.options, base: structuredClone(g0), action: a, answers, info: e.info };
    return out;
  }
}
function step(g: Game, a: Action): Game {
  const pi = g.active, opp = other(pi), me = g.players[pi], en = g.players[opp];
  const card = (i: number) => me.hand[i] ?? fail('ไม่พบการ์ดบนมือ');
  const mine = (s: number) => me.field[s] ?? fail('ไม่มีตัวละครในช่องนั้น');
  const theirs = (s: number) => en.field[s] ?? fail('ไม่มีตัวละครฝ่ายตรงข้ามในช่องนั้น');
  const main = () => { if (g.phase !== 'main') fail('ทำได้เฉพาะเฟสหลัก'); };
  const sendTo = (c: CardDef) => me.grave.push(c);
  switch (a.t) {
    case 'respond': case 'pass': return fail('ไม่มีอะไรให้ตอบโต้');
    case 'next':
      if (g.phase === 'main') { g.phase = 'battle'; emit(g, { t: 'phase_battle', p: pi }); } else endTurn(g);
      return g;
    case 'summon': {
      main(); const c = card(a.hand);
      if (c.type !== 'character' || c.level !== 15) fail('เรียกได้เฉพาะตัวละคร Lv.15'); if (me.summoned) fail('เรียกได้ 1 ใบต่อเทิร์น');
      if (a.slot < 0 || a.slot >= RULES.fieldSlots || me.field[a.slot]) fail('ช่องไม่ว่าง');
      me.hand.splice(a.hand, 1); const u = mk(g, c); me.field[a.slot] = u; me.summoned = true; active(g, pi, 'summon'); log(g, `เรียก ${c.name}`); emit(g, { t: 'summon', p: pi, card: c.name });
      if (fire(g, opp, 'on_summon')) u.lockedUntil = g.turn + 3;
      runEffects(g, pi, u, 'on_summon');
      return g;
    }
    case 'evolve': {
      main(); if (me.evolved) fail('วิวัฒนาการได้ 1 ครั้งต่อเทิร์น');
      const ex = me.extra, u = mine(a.slot), evo = card(a.evo), form = ex ? (ex[a.form] ?? fail('ไม่พบร่างนี้ในเด็คอีโว')) : card(a.form); if (u.fused) fail('ตัวละครที่ฟิวชั่นแล้ววิวัฒนาการไม่ได้');
      if (evo.type !== 'evolution') fail('ต้องใช้การ์ดวิวัฒนาการ');
      const next = ({ 15: 40, 40: 70, 70: 99 } as Record<number, number>)[u.card.level ?? 0];
      if (form.type !== 'character' || form.chain !== u.card.chain || form.level !== next) fail('ร่างใหม่ต้องเป็นขั้นถัดไปของสายเดียวกัน');
      const need = RULES.sacrifice[next], sac = Array.isArray(a.sacrifice) ? [...new Set(a.sacrifice)] : [];
      if (sac.length !== need || sac.some(s => !Number.isInteger(s) || s < 0 || s >= RULES.fieldSlots || s === a.slot || !me.field[s])) fail(`ต้องสังเวยตัวละครอื่น ${need} ใบ`);
      if (RULES.sacrificeSameLevel && sac.some(s => me.field[s]!.card.level !== u.card.level)) fail(`ต้องสังเวยตัวละครเลเวล ${u.card.level} ${need} ใบ`);
      if (ex) { me.hand.splice(a.evo, 1); ex.splice(a.form, 1); } else { const [hi, lo] = [Math.max(a.evo, a.form), Math.min(a.evo, a.form)]; me.hand.splice(hi, 1); me.hand.splice(lo, 1); }
      sendTo(evo); me.evolved = true; active(g, pi, 'evolve');
      if (fire(g, opp, 'on_evolve')) { (ex ?? me.hand).push(form); log(g, 'การวิวัฒนาการถูกยกเลิก'); emit(g, { t: 'evolve_cancelled', p: pi, card: u.card.name }); return g; }
      sac.forEach(s => { toGrave(g, pi, me.field[s]!); me.field[s] = null; });
      const nu = mk(g, form, evolveHp(u.maxHp, u.hp, form.hp ?? 1)); nu.bonusAtk = u.bonusAtk - (u.tempAtk ?? 0); nu.bonusDef = u.bonusDef - (u.tempDef ?? 0); me.field[a.slot] = nu; toGrave(g, pi, u); log(g, `${u.card.name} วิวัฒนาการเป็น ${form.name}`); emit(g, { t: 'evolve', p: pi, card: u.card.name, to: form.name });
      runEffects(g, pi, nu, 'on_evolve');
      return g;
    }
    case 'fuse': {
      main(); const fc = card(a.fusion), top = card(a.top), bot = card(a.bottom);
      if (fc.type !== 'fusion') fail('ต้องใช้การ์ดฟิวชั่น'); if (me.summoned) fail('ฟิวชั่นนับเป็นการเรียก 1 ใบต่อเทิร์น');
      if (new Set([a.fusion, a.top, a.bottom]).size !== 3) fail('ต้องเลือกการ์ดคนละใบ');
      const b = fusionBonus(g, top, bot) ?? fail('การ์ดสองใบนี้ไม่ได้ติ๊กเป็นคู่ Fusion กัน');
      if (a.slot < 0 || a.slot >= RULES.fieldSlots || me.field[a.slot]) fail('ช่องไม่ว่าง');
      const f = g.fusion, mix = (k: 'hp' | 'atk' | 'def') => Math.floor((top[k] ?? 0) * f.topPct / 100) + Math.floor((bot[k] ?? 0) * f.bottomPct / 100) + b[k];
      [a.fusion, a.top, a.bottom].sort((x, y) => y - x).forEach(i => me.hand.splice(i, 1)); sendTo(fc);
      const u = mk(g, top, Math.max(1, mix('hp'))); u.maxHp = u.hp; u.atk = mix('atk'); u.def = mix('def'); u.fused = [top, bot];
      me.field[a.slot] = u; me.summoned = true; active(g, pi, 'fuse'); log(g, `ฟิวชั่น ${top.name} + ${bot.name}`); emit(g, { t: 'fuse', p: pi, card: top.name, to: bot.name });
      if (fire(g, opp, 'on_summon')) u.lockedUntil = g.turn + 3;
      runEffects(g, pi, u, 'on_summon');
      return g;
    }
    case 'set': {
      main(); const c = card(a.hand); if (c.type !== 'trap') fail('ต้องเป็นกับดัก');
      const i = me.back.findIndex(x => !x); if (i < 0) fail('ช่องหลังเต็ม');
      me.hand.splice(a.hand, 1); me.back[i] = { card: c, setTurn: g.turn }; active(g, pi, 'set'); emit(g, { t: 'set_trap', p: pi, card: c.name }); return g;
    }
    case 'cast': {
      main(); const c = card(a.hand); if (c.type !== 'spell') fail('ต้องเป็นเวทมนตร์');
      const t = a.target ?? {}; const need = (v: number | undefined) => v ?? fail('ต้องเลือกเป้าหมาย');
      switch (c.id) {
        case 'SPL-001': { const x = need(t.slot); if (!targetable(g, theirs(x))) fail('ตัวละครนี้ถูกป้องกันการเลือกเป็นเป้าหมาย'); emit(g, { t: 'cast', p: pi, card: c.name }); const fx = targetTrap(g, opp, theirs(x), 'spell'); if (!fx.negate) damageUnit(g, opp, x, cut(20, fx), pi, false, c.name); break; }
        case 'SPL-002': { const u = mine(need(t.slot)), b = u.hp; u.hp = Math.min(u.maxHp, u.hp + 30); emit(g, { t: 'cast', p: pi, card: c.name }); if (u.hp > b) emit(g, { t: 'heal', p: pi, card: u.card.name, v: u.hp - b, src: c.name }); break; }
        case 'SPL-003': { const u = mine(need(t.slot)); if (u.splTurn?.['SPL-003'] === g.turn) fail('ตัวละครนี้ได้รับบัฟนี้ในเทิร์นนี้แล้ว'); (u.splTurn ??= {})['SPL-003'] = g.turn; u.bonusDef += 15; u.tempDef = (u.tempDef ?? 0) + 15; emit(g, { t: 'cast', p: pi, card: c.name }); emit(g, { t: 'buff', p: pi, card: u.card.name, stat: 'def', v: 15, src: c.name }); break; }
        case 'SPL-004': { const u = mine(need(t.slot)); if (u.splTurn?.['SPL-004'] === g.turn) fail('ตัวละครนี้ได้รับบัฟนี้ในเทิร์นนี้แล้ว'); (u.splTurn ??= {})['SPL-004'] = g.turn; u.bonusAtk += 15; u.tempAtk = (u.tempAtk ?? 0) + 15; emit(g, { t: 'cast', p: pi, card: c.name }); emit(g, { t: 'buff', p: pi, card: u.card.name, stat: 'atk', v: 15, src: c.name }); break; }
        case 'SPL-005': { emit(g, { t: 'cast', p: pi, card: c.name }); const n = (draw(g, pi) ? 1 : 0) + (draw(g, pi) ? 1 : 0); if (n) emit(g, { t: 'draw', p: pi, v: n, src: c.name }); break; }
        case 'SPL-006': {
          if (me.hand.length - 1 >= RULES.handMax) fail('มือเต็ม');
          const gi = t.grave ?? me.grave.findIndex(x => x.type === 'character' && x.level === 15);
          const gc = me.grave[gi]; if (!gc || gc.type !== 'character' || gc.level !== 15) fail('ไม่มีตัวละคร Lv.15 ในสุสาน');
          me.grave.splice(gi, 1); me.hand.splice(a.hand, 1); me.hand.push(gc); sendTo(c); active(g, pi, 'cast'); log(g, `ใช้ ${c.name}`); emit(g, { t: 'cast', p: pi, card: c.name }); emit(g, { t: 'revive', p: pi, card: gc.name }); return g;
        }
        case 'SPL-007': { const x = need(t.slot), y = need(t.slot2); const mu = mine(x), eu = theirs(y); if (!targetable(g, eu)) fail('ตัวละครนี้ถูกป้องกันการเลือกเป็นเป้าหมาย'); [me.field[x], en.field[y]] = [eu, mu]; eu.summonedTurn = g.turn; mu.summonedTurn = g.turn;  /* a swapped unit cannot attack this turn (balance D-2) */ emit(g, { t: 'cast', p: pi, card: c.name }); emit(g, { t: 'swap', p: pi, card: mu.card.name, to: eu.card.name }); log(g, `สลับ ${mu.card.name} ของผู้เล่น ${pi + 1} กับ ${eu.card.name} ของฝ่ายตรงข้าม`); break; }
        case 'SPL-008': en.noAttackUntil = g.turn + 2; emit(g, { t: 'cast', p: pi, card: c.name }); emit(g, { t: 'noattack', p: opp }); break;
        case 'SPL-009': { const x = theirs(need(t.slot)); if (!targetable(g, x)) fail('ตัวละครนี้ถูกป้องกันการเลือกเป็นเป้าหมาย'); emit(g, { t: 'cast', p: pi, card: c.name }); if (!targetTrap(g, opp, x, 'spell').negate) { x.poison = RULES.poison.turns; emit(g, { t: 'poison', p: opp, card: x.card.name }); } break; }
        case 'SPL-010': { const b = en.back[need(t.slot)] ?? fail('ไม่มีกับดักในช่องนั้น'); en.grave.push(b.card); en.back[t.slot!] = null; emit(g, { t: 'cast', p: pi, card: c.name }); emit(g, { t: 'trap_destroyed', p: opp, card: b.card.name }); break; }
        default: if (c.support?.kind === 'spell') { castSupport(g, pi, c, t); break; } fail('ยังไม่รองรับเวทมนตร์ใบนี้');
      }
      me.hand.splice(a.hand, 1); sendTo(c); active(g, pi, 'cast'); log(g, `ใช้ ${c.name}`); return g;
    }
    case 'attack': {
      if (g.phase !== 'battle') fail('โจมตีได้เฉพาะเฟสต่อสู้'); if (g.turn === 1) fail('ผู้เริ่มก่อนโจมตีไม่ได้ในเทิร์นแรก');
      if (g.turn < me.noAttackUntil) fail('ถูกห้ามโจมตีในเทิร์นนี้');
      const u = mine(a.from); if (u.attacked) fail('ตัวนี้โจมตีแล้ว'); if (u.summonedTurn === g.turn) fail('ตัวที่เพิ่งถูกเรียกโจมตีไม่ได้'); if (g.turn < u.lockedUntil) fail('ตัวนี้ถูกห้ามโจมตี');
      const direct = a.to === 'player';
      if (direct && units(en).length) fail('โจมตีผู้เล่นได้เมื่อฝั่งตรงข้ามไม่มีตัวละคร');
      const tgt = direct ? null : theirs(a.to as number); u.attacked = true; active(g, pi, 'attack'); if (direct) bump(g, pi, 'attackDirect');
      emit(g, { t: 'attack', p: pi, card: u.card.name, to: tgt ? tgt.card.name : null });
      const mods: BattleMods = [], done = () => { for (const [x, st, n] of mods) { if (st === 'atk') x.bonusAtk -= n; else x.bonusDef -= n; } return g; };   // battle-long Signature buffs end with the battle
      if (u.nextAtk) { if (u.nextAtk.turn === g.turn) addMod(g, pi, u, 'atk', u.nextAtk.amount, 'battle', 'ATK', mods); u.nextAtk = undefined; }   // "for its next attack this turn"
      const t = fire(g, opp, direct ? 'on_attack_direct' : 'on_attack');
      if (t === 'TRP-001') { log(g, 'การโจมตีถูกยกเลิก'); emit(g, { t: 'attack_cancelled', p: pi, card: u.card.name }); return done(); }
      if (t === 'TRP-009') { emit(g, { t: 'attack_returned', p: pi, card: u.card.name }); me.field[a.from] = null; for (const c of u.fused ?? [u.card]) { if (me.hand.length < RULES.handMax) me.hand.push(c); else me.grave.push(c); } return done(); }
      // Signature traps: own attack declared / enemy attack declared / my linked character is attacked (may redirect the attack)
      if (fire(g, pi, 'own_attack', u) && FIRED) runOps(g, pi, FIRED, { unit: u }, mods);
      if (fire(g, opp, 'enemy_attack') && FIRED) runOps(g, opp, FIRED, { attacker: u }, mods);
      if (tgt && fire(g, opp, 'self_attacked', tgt) && FIRED) {
        const fx = runOps(g, opp, FIRED, { unit: tgt, victim: tgt, attacker: u }, mods);
        if (fx.redirect && en.field.some(x => x && x !== tgt)) { u.attacked = false; log(g, 'การโจมตีถูกเบี่ยงเบน'); emit(g, { t: 'attack_cancelled', p: pi, card: u.card.name }); return done(); }
      }
      const bd = (side: 0 | 1, n: number) => { if (n > 0 && fire(g, side, 'ally_battle_damage') && FIRED) return Math.max(0, n - (runOps(g, side, FIRED, {}, mods).dmgCut ?? 0)); return n; };
      runEffects(g, pi, u, 'on_attack', { target: tgt ?? undefined });
      if (direct) { const d = effAtk(u); dealLp(g, opp, t === 'TRP-003' ? Math.floor(d / 2) : d, pi); if (t === 'TRP-002') damageUnit(g, pi, a.from, Math.floor(d / 2), opp, false, 'สะท้อนความเสียหาย'); log(g, `${u.card.name} โจมตีตรง`); return done(); }
      const d1 = bd(opp, hit(u, tgt!)); if (d1 > 0) damageUnit(g, opp, a.to as number, d1, pi); log(g, `${u.card.name} โจมตี ${tgt!.card.name} ${d1}`);
      if (t === 'TRP-002') damageUnit(g, pi, a.from, Math.floor(d1 / 2), opp, false, 'สะท้อนความเสียหาย');
      if (en.field[a.to as number] === tgt && tgt!.hp > 0 && me.field[a.from] === u) { const dc = bd(pi, hit(tgt!, u)); if (dc > 0) damageUnit(g, pi, a.from, dc, opp, false, 'สวนกลับ'); }
      if (me.field[a.from] === u && en.field[a.to as number] !== tgt && fire(g, pi, 'kill_by_attack', u) && FIRED) runOps(g, pi, FIRED, { unit: u }, mods);
      if (me.field[a.from] === u && en.field[a.to as number] !== tgt) runEffects(g, pi, u, 'on_attack', { after: true });
      return done();
    }
  }
}

export function legalActions(g: Game): Action[] {
  if (g.winner !== null) return [];
  if (g.pending) return [...g.pending.options.map(back => ({ t: 'respond', back }) as Action), { t: 'pass' }];
  const me = g.players[g.active], en = g.players[other(g.active)], out: Action[] = [{ t: 'next' }];
  if (g.phase === 'main') {
    const slot = me.field.findIndex(x => !x);
    me.hand.forEach((c, h) => {
      if (c.type === 'character' && c.level === 15 && !me.summoned && slot >= 0) out.push({ t: 'summon', hand: h, slot });
      if (c.type === 'trap' && me.back.some(x => !x)) out.push({ t: 'set', hand: h });
      if (c.type === 'fusion' && !me.summoned && slot >= 0) { let best: Action | null = null, bs = -1; me.hand.forEach((x, i) => me.hand.forEach((y, j) => { if (i === j || i === h || j === h || !fusionBonus(g, x, y)) return; const sc = (x.atk ?? 0) * 2 + (x.hp ?? 0) + (y.atk ?? 0) + (y.hp ?? 0) / 2; if (sc > bs) { bs = sc; best = { t: 'fuse', fusion: h, top: i, bottom: j, slot }; } })); if (best) out.push(best); }
      if (c.type === 'spell' && c.support) {
        const sp = c.support, lu = linkUnit(g, g.active, sp.link); if (!lu) return;
        const w = sp.ops.find(o => o.who === 'ally' || o.who === 'other_ally' || o.who === 'enemy')?.who;
        if (!w) out.push({ t: 'cast', hand: h });
        else if (w === 'enemy') en.field.forEach((u, i) => { if (targetable(g, u)) out.push({ t: 'cast', hand: h, target: { slot: i } }); });
        else me.field.forEach((u, i) => { if (u && (w !== 'other_ally' || u !== lu)) out.push({ t: 'cast', hand: h, target: { slot: i } }); });
        return;
      }
      if (c.type === 'spell') {
        const ms = me.field.map((u, i) => u ? i : -1).filter(i => i >= 0), es = en.field.map((u, i) => u ? i : -1).filter(i => i >= 0);
        if (['SPL-002', 'SPL-003', 'SPL-004'].includes(c.id)) ms.filter(s => !(['SPL-003', 'SPL-004'].includes(c.id) && me.field[s]?.splTurn?.[c.id] === g.turn)).forEach(s => out.push({ t: 'cast', hand: h, target: { slot: s } }));
        else if (['SPL-001', 'SPL-009'].includes(c.id)) es.filter(s => targetable(g, en.field[s])).forEach(s => out.push({ t: 'cast', hand: h, target: { slot: s } }));
        else if (c.id === 'SPL-010') en.back.forEach((b, i) => b && out.push({ t: 'cast', hand: h, target: { slot: i } }));
        else if (c.id === 'SPL-007') ms.forEach(x => es.filter(y => targetable(g, en.field[y])).forEach(y => out.push({ t: 'cast', hand: h, target: { slot: x, slot2: y } })));
        else out.push({ t: 'cast', hand: h });
      }
    });
    if (!me.evolved) me.field.forEach((u, s) => {
      if (!u) return; const nx = ({ 15: 40, 40: 70, 70: 99 } as Record<number, number>)[u.card.level ?? 0];
      const e = me.hand.findIndex(c => c.type === 'evolution'), f = (me.extra ?? me.hand).findIndex(c => c.type === 'character' && c.chain === u.card.chain && c.level === nx);
      const sac = me.field.map((x, i) => x && i !== s && (!RULES.sacrificeSameLevel || x.card.level === u.card.level) ? i : -1).filter(i => i >= 0).slice(0, RULES.sacrifice[nx] ?? 9);
      if (e >= 0 && f >= 0 && sac.length === RULES.sacrifice[nx]) out.push({ t: 'evolve', slot: s, evo: e, form: f, sacrifice: sac });
    });
  } else {
    if (g.turn === 1 || g.turn < me.noAttackUntil) return out;
    me.field.forEach((u, s) => { if (!u || u.attacked || u.summonedTurn === g.turn || g.turn < u.lockedUntil) return; const es = en.field.map((x, i) => x ? i : -1).filter(i => i >= 0); if (es.length) es.forEach(i => out.push({ t: 'attack', from: s, to: i })); else out.push({ t: 'attack', from: s, to: 'player' }); });
  }
  return out;
}
