// Game engine v1 — pure rules, no UI. Rules come from the agreed/proposed game_rules (LP 100, 4 phases, ATK-DEF min 1 x element,
// counter-attack, first player can't attack on turn 1, spells main-phase only, traps face-down & usable from next turn).
// Chain window: with `interactive: true`, when a face-down trap could answer an event the game pauses (g.pending) and the trap's owner
// answers with {t:'respond', back} or {t:'pass'}. Implemented by replaying the original action with the collected answers (deterministic, seeded).
// With `interactive` off (default) the first matching trap fires automatically. Item cards are not included.
import { elementMultiplier, evolveHp, type Element } from './combat';

export type CardType = 'character' | 'evolution' | 'fusion' | 'spell' | 'trap' | 'item';
import type { Effect, EffectTrigger } from './effects';
export interface CardDef { id: string; name: string; type: CardType; level: number | null; chain: string | null; hp: number | null; atk: number | null; def: number; element: string | null; effects?: Effect[] }
export const RULES = { lp: 100, handMax: 5, startHand: 5, fieldSlots: 7, backSlots: 5, sacrifice: { 40: 1, 70: 2, 99: 3 } as Record<number, number>, poison: { dmg: 5, turns: 3 } };
export class EngineError extends Error {}

export interface FusionPair { a: string; b: string; hp: number; atk: number; def: number }
export interface Unit { tempAtk?: number; auraAtk?: number; auraHp?: number; used?: Record<string, number>; stacks?: Record<string, number>; fused?: CardDef[]; uid: number; card: CardDef; hp: number; maxHp: number; atk: number; def: number; bonusAtk: number; bonusDef: number; summonedTurn: number; attacked: boolean; lockedUntil: number; poison: number }
export interface Player { extra?: CardDef[]; lp: number; deck: CardDef[]; hand: CardDef[]; field: (Unit | null)[]; back: ({ card: CardDef; setTurn: number } | null)[]; grave: CardDef[]; summoned: boolean; evolved: boolean; noAttackUntil: number }
export interface TargetInfo { side: 'ally' | 'enemy'; kind: 'atk' | 'heal' | 'damage'; amount: number; text: string; source: string; choices: { slot: number; id: string; name: string; hp: number; maxHp: number; atk: number }[] }   // choices = the candidates as they are at the moment of the question (the board shown is the state before the action)
export interface Pending { responder: 0 | 1; event: string; options: number[]; base: Game; action: Action; answers: number[]; info?: TargetInfo }
export interface Game { interactive?: boolean; pending?: Pending; players: [Player, Player]; turn: number; active: 0 | 1; phase: 'main' | 'battle'; winner: 0 | 1 | null; log: string[]; seed: number; uid: number; fusion: { pairs: FusionPair[]; topPct: number; bottomPct: number }; stats?: [PlayerStats, PlayerStats] }
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
const effAtk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk + (u.auraAtk ?? 0)), effDef = (u: Unit) => Math.max(0, u.def + u.bonusDef);
const els = (u: Unit) => (u.card.element ?? 'neutral') as Element;
const hit = (a: Unit, d: Unit) => Math.max(1, Math.floor(Math.max(1, effAtk(a) - effDef(d)) * elementMultiplier(els(a), els(d))));
const log = (g: Game, m: string) => { g.log.push(`T${g.turn}: ${m}`); };
const mk = (g: Game, c: CardDef, hp?: number): Unit => ({ uid: ++g.uid, card: c, hp: hp ?? c.hp ?? 1, maxHp: c.hp ?? 1, atk: c.atk ?? 0, def: c.def ?? 0, bonusAtk: 0, bonusDef: 0, summonedTurn: g.turn, attacked: false, lockedUntil: 0, poison: 0 });
const units = (p: Player) => p.field.filter((u): u is Unit => !!u);

export function createGame(decks: [CardDef[], CardDef[]], seed = 1, first: 0 | 1 = 0, opts: { fusionPairs?: FusionPair[]; topPct?: number; bottomPct?: number; interactive?: boolean; extras?: [CardDef[], CardDef[]] } = {}): Game {
  // extras = each player's separate Evolution deck (Lv40/70/99 forms). Without it, forms live in the hand (legacy rules).
  const g: Game = { players: [0, 1].map(i => ({ lp: RULES.lp, deck: [...decks[i]], hand: [], field: Array(RULES.fieldSlots).fill(null), back: Array(RULES.backSlots).fill(null), grave: [], summoned: false, evolved: false, noAttackUntil: 0 })) as unknown as [Player, Player], turn: 1, active: first, phase: 'main', winner: null, log: [], seed, uid: 0, interactive: !!opts.interactive, fusion: { pairs: opts.fusionPairs ?? [], topPct: opts.topPct ?? 100, bottomPct: opts.bottomPct ?? 50 }, stats: [newStats(), newStats()] };
  if (opts.extras) g.players.forEach((p, i) => { p.extra = [...opts.extras![i]]; });
  for (const p of g.players) { for (let i = p.deck.length - 1; i > 0; i--) { const j = Math.floor(rnd(g) * (i + 1)); [p.deck[i], p.deck[j]] = [p.deck[j], p.deck[i]]; } p.hand = p.deck.splice(0, RULES.startHand); }
  return g;
}
function draw(g: Game, pi: 0 | 1, loseIfEmpty = false) {
  const p = g.players[pi]; if (p.hand.length >= RULES.handMax) return false;
  if (!p.deck.length) { if (loseIfEmpty) { g.winner = other(pi); log(g, `ผู้เล่น ${pi + 1} จั่วไม่ได้ แพ้`); } return false; }
  p.hand.push(p.deck.shift()!); return true;
}
const TRAP: Record<string, string> = { 'TRP-001': 'on_attack', 'TRP-002': 'on_attack', 'TRP-003': 'on_attack_direct', 'TRP-009': 'on_attack', 'TRP-004': 'on_summon', 'TRP-005': 'on_evolve', 'TRP-006': 'turn_end', 'TRP-007': 'turn_start', 'TRP-008': 'on_destroyed', 'TRP-010': 'to_graveyard' };
class NeedAnswer extends Error { constructor(public responder: 0 | 1, public event: string, public options: number[], public info?: TargetInfo) { super('need answer'); } }
let CTX: { answers: number[]; i: number } = { answers: [], i: 0 };
/** Trap slots of `owner` that could answer this event (usable only from the turn after they were set). */
export function trapOptions(g: Game, owner: 0 | 1, ev: string): number[] {
  const out: number[] = [];
  g.players[owner].back.forEach((t, i) => { if (!t || t.setTurn >= g.turn) return; const k = TRAP[t.card.id]; if (k === ev || (ev === 'on_attack_direct' && k === 'on_attack')) out.push(i); });
  return out;
}
/** Fire a face-down trap of `owner` for this event: first match automatically, or the owner's choice in interactive games. */
function fire(g: Game, owner: 0 | 1, ev: string): string | null {
  const opts = trapOptions(g, owner, ev); if (!opts.length) return null;
  let pick = opts[0];
  if (g.interactive) {
    if (CTX.i >= CTX.answers.length) throw new NeedAnswer(owner, ev, opts);
    const ans = CTX.answers[CTX.i++]; if (ans === -1) return null;
    if (!opts.includes(ans)) fail('เลือกกับดักไม่ถูกต้อง'); pick = ans;
  }
  const p = g.players[owner], t = p.back[pick]!;
  p.back[pick] = null; p.grave.push(t.card); log(g, `กับดัก ${t.card.name} ทำงาน`); bump(g, owner, 'trap'); return t.card.id;
}
function toGrave(g: Game, pi: 0 | 1, u: Unit) { g.players[pi].grave.push(...(u.fused ?? [u.card])); }
/** Bonus for fusing two characters, or null if their chains are not ticked as a Fusion pair (highest bonus per stat wins). */
export function fusionBonus(g: Game, x: CardDef, y: CardDef) {
  if (x.type !== 'character' || y.type !== 'character' || !x.chain || !y.chain || x.chain === y.chain) return null;
  const m = g.fusion.pairs.filter(p => (p.a === x.chain && p.b === y.chain) || (p.a === y.chain && p.b === x.chain)); if (!m.length) return null;
  return { hp: Math.max(...m.map(p => p.hp)), atk: Math.max(...m.map(p => p.atk)), def: Math.max(...m.map(p => p.def)) };
}
/** `by` = the player the damage is credited to in the stats; `delayed` = caused by a lingering effect rather than by the action being resolved. */
function damageUnit(g: Game, pi: 0 | 1, slot: number, amount: number, by: 0 | 1, delayed = false) {
  const p = g.players[pi], u = p.field[slot]; if (!u) return;
  bump(g, by, delayed ? 'dmgDelayed' : 'dmgUnit', Math.min(Math.max(0, amount), Math.max(0, u.hp)));
  u.hp -= amount;
  if (u.hp > 0) return;
  if (fire(g, pi, 'on_destroyed')) { u.hp = 1; return; }
  p.field[slot] = null; toGrave(g, pi, u); log(g, `${u.card.name} ถูกทำลาย`);
  runEffects(g, pi, u, 'on_destroyed');
  if (fire(g, pi, 'to_graveyard')) draw(g, pi);
}
function dealLp(g: Game, pi: 0 | 1, n: number, by: 0 | 1) { const p = g.players[pi]; bump(g, by, 'dmgLp', Math.min(Math.max(0, n), p.lp)); p.lp = Math.max(0, p.lp - n); if (p.lp === 0) { g.winner = other(pi); log(g, `ผู้เล่น ${pi + 1} LP หมด`); } }

/** Which of `options` (field slots of `side`) a bot / non-interactive game picks for an ability. */
function autoTarget(g: Game, side: 0 | 1, options: number[], kind: TargetInfo['kind']): number {
  const f = g.players[side].field, score = (i: number) => kind === 'heal' ? -(f[i]!.hp / f[i]!.maxHp) : effAtk(f[i]!);
  return options.reduce((best, i) => (score(i) > score(best) ? i : best), options[0]);
}
/** The one character an ability targets: the owner chooses (a pending question in interactive games). Returns null when nothing can be targeted. */
function chooseTarget(g: Game, owner: 0 | 1, e: Effect, u: Unit): Unit | null {
  const side = e.target === 'ally1' ? owner : other(owner), f = g.players[side].field;
  const options = f.map((x, i) => x ? i : -1).filter(i => i >= 0); if (!options.length) return null;
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
    else { const t = chooseTarget(g, pi, e, u); if (!t) return; ts = [t]; }   // nothing to target: the ability does not fire and is not used up
    u.used[k] = e.limit === 'game' ? 1 : g.turn;
    for (const t of ts) {
      if (e.kind === 'atk') {
        let amt = e.amount;
        if (e.perm && e.max !== undefined) { t.stacks ??= {}; amt = Math.min(amt, e.max - (t.stacks[k] ?? 0)); if (amt <= 0) continue; t.stacks[k] = (t.stacks[k] ?? 0) + amt; }
        t.bonusAtk += amt; if (!e.perm) t.tempAtk = (t.tempAtk ?? 0) + amt;
      } else if (e.kind === 'heal') t.hp = e.full ? t.maxHp : Math.min(t.maxHp, t.hp + e.amount);
      else if (e.kind === 'draw') for (let n = 0; n < e.amount; n++) draw(g, pi);
      else if (e.kind === 'damage') { const side = e.target === 'ally1' ? pi : other(pi), slot = g.players[side].field.indexOf(t); if (slot >= 0) damageUnit(g, side, slot, e.amount, pi, true); }
    }
    log(g, `${u.card.name}: ${e.text}`);
  });
}
/** Passive abilities ("while on the field") are recomputed after every action, so they vanish the moment their source leaves. */
function refreshAuras(g: Game) {
  for (const pi of [0, 1] as const) {
    const us = g.players[pi].field.filter((x): x is Unit => !!x), atk = new Map<Unit, number>(), hp = new Map<Unit, number>();
    for (const src of us) for (const e of src.card.effects ?? []) {
      if (e.trigger !== 'passive') continue;
      for (const t of e.target === 'self' ? [src] : us) { const m = e.kind === 'atk' ? atk : e.kind === 'maxhp' ? hp : null; if (m) m.set(t, (m.get(t) ?? 0) + e.amount); }
    }
    for (const u of us) {
      u.auraAtk = atk.get(u) ?? 0;
      const want = hp.get(u) ?? 0, d = want - (u.auraHp ?? 0);
      if (d) { u.maxHp += d; u.hp = d > 0 ? u.hp + d : Math.min(u.hp, u.maxHp); u.auraHp = want; }
    }
  }
}

function startTurn(g: Game) {
  const pi = g.active, p = g.players[pi]; p.summoned = false; p.evolved = false;
  p.field.forEach(u => { if (u) u.attacked = false; });
  p.field.forEach((u, i) => { if (u?.poison) { u.poison--; damageUnit(g, pi, i, RULES.poison.dmg, other(pi), true); } });
  if (fire(g, other(pi), 'turn_start')) p.field.forEach((u, i) => { if (u) damageUnit(g, pi, i, 5, other(pi), true); });
  if (g.winner === null) p.field.forEach(u => { if (u) runEffects(g, pi, u, 'turn_start'); });
  if (g.winner === null) draw(g, pi, true);
  g.phase = 'main';
}
function endTurn(g: Game) {
  const pi = g.active, opp = other(pi);
  if (fire(g, opp, 'turn_end')) { let best = -1; g.players[pi].field.forEach((u, i) => { if (u && (best < 0 || effAtk(u) > effAtk(g.players[pi].field[best]!))) best = i; }); if (best >= 0) damageUnit(g, pi, best, 15, opp, true); }
  g.players[pi].field.forEach(u => { if (u) runEffects(g, pi, u, 'turn_end'); });
  g.players.forEach(p => p.field.forEach(u => { if (u?.tempAtk) { u.bonusAtk -= u.tempAtk; u.tempAtk = 0; } }));   // "until the end of the turn" bonuses
  if (g.winner !== null) return;
  g.active = opp; g.turn++; startTurn(g);
}

export function act(g0: Game, a: Action): Game {
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
      if (g.phase === 'main') g.phase = 'battle'; else endTurn(g);
      return g;
    case 'summon': {
      main(); const c = card(a.hand);
      if (c.type !== 'character' || c.level !== 15) fail('เรียกได้เฉพาะตัวละคร Lv.15'); if (me.summoned) fail('เรียกได้ 1 ใบต่อเทิร์น');
      if (a.slot < 0 || a.slot >= RULES.fieldSlots || me.field[a.slot]) fail('ช่องไม่ว่าง');
      me.hand.splice(a.hand, 1); const u = mk(g, c); me.field[a.slot] = u; me.summoned = true; active(g, pi, 'summon'); log(g, `เรียก ${c.name}`);
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
      const need = RULES.sacrifice[next], sac = [...new Set(a.sacrifice)];
      if (sac.length !== need || sac.some(s => s === a.slot || !me.field[s])) fail(`ต้องสังเวยตัวละครอื่น ${need} ใบ`);
      if (ex) { me.hand.splice(a.evo, 1); ex.splice(a.form, 1); } else { const [hi, lo] = [Math.max(a.evo, a.form), Math.min(a.evo, a.form)]; me.hand.splice(hi, 1); me.hand.splice(lo, 1); }
      sendTo(evo); me.evolved = true; active(g, pi, 'evolve');
      if (fire(g, opp, 'on_evolve')) { (ex ?? me.hand).push(form); log(g, 'การวิวัฒนาการถูกยกเลิก'); return g; }
      sac.forEach(s => { toGrave(g, pi, me.field[s]!); me.field[s] = null; });
      const nu = mk(g, form, evolveHp(u.maxHp, u.hp, form.hp ?? 1)); nu.bonusAtk = u.bonusAtk - (u.tempAtk ?? 0); nu.bonusDef = u.bonusDef; me.field[a.slot] = nu; toGrave(g, pi, u); log(g, `${u.card.name} วิวัฒนาการเป็น ${form.name}`);
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
      me.field[a.slot] = u; me.summoned = true; active(g, pi, 'fuse'); log(g, `ฟิวชั่น ${top.name} + ${bot.name}`);
      if (fire(g, opp, 'on_summon')) u.lockedUntil = g.turn + 3;
      runEffects(g, pi, u, 'on_summon');
      return g;
    }
    case 'set': {
      main(); const c = card(a.hand); if (c.type !== 'trap') fail('ต้องเป็นกับดัก');
      const i = me.back.findIndex(x => !x); if (i < 0) fail('ช่องหลังเต็ม');
      me.hand.splice(a.hand, 1); me.back[i] = { card: c, setTurn: g.turn }; active(g, pi, 'set'); return g;
    }
    case 'cast': {
      main(); const c = card(a.hand); if (c.type !== 'spell') fail('ต้องเป็นเวทมนตร์');
      const t = a.target ?? {}; const need = (v: number | undefined) => v ?? fail('ต้องเลือกเป้าหมาย');
      switch (c.id) {
        case 'SPL-001': damageUnit(g, opp, (theirs(need(t.slot)), t.slot!), 20, pi); break;
        case 'SPL-002': { const u = mine(need(t.slot)); u.hp = Math.min(u.maxHp, u.hp + 30); break; }
        case 'SPL-003': mine(need(t.slot)).bonusDef += 15; break;
        case 'SPL-004': mine(need(t.slot)).bonusAtk += 15; break;
        case 'SPL-005': draw(g, pi); draw(g, pi); break;
        case 'SPL-006': {
          if (me.hand.length - 1 >= RULES.handMax) fail('มือเต็ม');
          const gi = t.grave ?? me.grave.findIndex(x => x.type === 'character' && x.level === 15);
          const gc = me.grave[gi]; if (!gc || gc.type !== 'character' || gc.level !== 15) fail('ไม่มีตัวละคร Lv.15 ในสุสาน');
          me.grave.splice(gi, 1); me.hand.splice(a.hand, 1); me.hand.push(gc); sendTo(c); active(g, pi, 'cast'); log(g, `ใช้ ${c.name}`); return g;
        }
        case 'SPL-007': { const x = need(t.slot), y = need(t.slot2); const mu = mine(x), eu = theirs(y); [me.field[x], en.field[y]] = [eu, mu]; log(g, `สลับ ${mu.card.name} ของผู้เล่น ${pi + 1} กับ ${eu.card.name} ของฝ่ายตรงข้าม`); break; }
        case 'SPL-008': en.noAttackUntil = g.turn + 2; break;
        case 'SPL-009': theirs(need(t.slot)).poison = RULES.poison.turns; break;
        case 'SPL-010': { const b = en.back[need(t.slot)] ?? fail('ไม่มีกับดักในช่องนั้น'); en.grave.push(b.card); en.back[t.slot!] = null; break; }
        default: fail('ยังไม่รองรับเวทมนตร์ใบนี้');
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
      const t = fire(g, opp, direct ? 'on_attack_direct' : 'on_attack');
      if (t === 'TRP-001') { log(g, 'การโจมตีถูกยกเลิก'); return g; }
      if (t === 'TRP-009') { me.field[a.from] = null; for (const c of u.fused ?? [u.card]) { if (me.hand.length < RULES.handMax) me.hand.push(c); else me.grave.push(c); } return g; }
      runEffects(g, pi, u, 'on_attack', { target: tgt ?? undefined });
      if (direct) { const d = effAtk(u); dealLp(g, opp, t === 'TRP-003' ? Math.floor(d / 2) : d, pi); if (t === 'TRP-002') damageUnit(g, pi, a.from, Math.floor(d / 2), opp); log(g, `${u.card.name} โจมตีตรง`); return g; }
      const d1 = hit(u, tgt!); damageUnit(g, opp, a.to as number, d1, pi); log(g, `${u.card.name} โจมตี ${tgt!.card.name} ${d1}`);
      if (t === 'TRP-002') damageUnit(g, pi, a.from, Math.floor(d1 / 2), opp);
      if (en.field[a.to as number] === tgt && tgt!.hp > 0 && me.field[a.from] === u) damageUnit(g, pi, a.from, hit(tgt!, u), opp);
      if (me.field[a.from] === u && en.field[a.to as number] !== tgt) runEffects(g, pi, u, 'on_attack', { after: true });
      return g;
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
      if (c.type === 'spell') {
        const ms = me.field.map((u, i) => u ? i : -1).filter(i => i >= 0), es = en.field.map((u, i) => u ? i : -1).filter(i => i >= 0);
        if (['SPL-002', 'SPL-003', 'SPL-004'].includes(c.id)) ms.forEach(s => out.push({ t: 'cast', hand: h, target: { slot: s } }));
        else if (['SPL-001', 'SPL-009'].includes(c.id)) es.forEach(s => out.push({ t: 'cast', hand: h, target: { slot: s } }));
        else if (c.id === 'SPL-010') en.back.forEach((b, i) => b && out.push({ t: 'cast', hand: h, target: { slot: i } }));
        else if (c.id === 'SPL-007') ms.forEach(x => es.forEach(y => out.push({ t: 'cast', hand: h, target: { slot: x, slot2: y } })));
        else out.push({ t: 'cast', hand: h });
      }
    });
    if (!me.evolved) me.field.forEach((u, s) => {
      if (!u) return; const nx = ({ 15: 40, 40: 70, 70: 99 } as Record<number, number>)[u.card.level ?? 0];
      const e = me.hand.findIndex(c => c.type === 'evolution'), f = (me.extra ?? me.hand).findIndex(c => c.type === 'character' && c.chain === u.card.chain && c.level === nx);
      const sac = me.field.map((x, i) => x && i !== s ? i : -1).filter(i => i >= 0).slice(0, RULES.sacrifice[nx] ?? 9);
      if (e >= 0 && f >= 0 && sac.length === RULES.sacrifice[nx]) out.push({ t: 'evolve', slot: s, evo: e, form: f, sacrifice: sac });
    });
  } else {
    if (g.turn === 1 || g.turn < me.noAttackUntil) return out;
    me.field.forEach((u, s) => { if (!u || u.attacked || u.summonedTurn === g.turn || g.turn < u.lockedUntil) return; const es = en.field.map((x, i) => x ? i : -1).filter(i => i >= 0); if (es.length) es.forEach(i => out.push({ t: 'attack', from: s, to: i })); else out.push({ t: 'attack', from: s, to: 'player' }); });
  }
  return out;
}
