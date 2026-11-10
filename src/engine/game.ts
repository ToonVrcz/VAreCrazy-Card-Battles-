// Game engine v1 — pure rules, no UI. Rules come from the agreed/proposed game_rules (LP 100, 4 phases, ATK-DEF min 1 x element,
// counter-attack, first player can't attack on turn 1, spells main-phase only, traps face-down & usable from next turn).
// Not yet included: Fusion stacking, interactive chain (traps auto-resolve, first matching, one per event), item cards.
import { elementMultiplier, evolveHp, type Element } from './combat';

export type CardType = 'character' | 'evolution' | 'fusion' | 'spell' | 'trap' | 'item';
export interface CardDef { id: string; name: string; type: CardType; level: number | null; chain: string | null; hp: number | null; atk: number | null; def: number; element: string | null }
export const RULES = { lp: 100, handMax: 5, startHand: 5, fieldSlots: 7, backSlots: 5, sacrifice: { 40: 1, 70: 2, 99: 3 } as Record<number, number>, poison: { dmg: 5, turns: 3 } };
export class EngineError extends Error {}

export interface Unit { uid: number; card: CardDef; hp: number; maxHp: number; atk: number; def: number; bonusAtk: number; bonusDef: number; summonedTurn: number; attacked: boolean; lockedUntil: number; poison: number }
export interface Player { lp: number; deck: CardDef[]; hand: CardDef[]; field: (Unit | null)[]; back: ({ card: CardDef; setTurn: number } | null)[]; grave: CardDef[]; summoned: boolean; evolved: boolean; noAttackUntil: number }
export interface Game { players: [Player, Player]; turn: number; active: 0 | 1; phase: 'main' | 'battle'; winner: 0 | 1 | null; log: string[]; seed: number; uid: number }
export type Action =
  | { t: 'summon'; hand: number; slot: number }
  | { t: 'evolve'; slot: number; evo: number; form: number; sacrifice: number[] }
  | { t: 'cast'; hand: number; target?: { slot?: number; slot2?: number; grave?: number } }
  | { t: 'set'; hand: number }
  | { t: 'attack'; from: number; to: number | 'player' }
  | { t: 'next' };

const rnd = (g: Game) => { let t = (g.seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const fail = (m: string): never => { throw new EngineError(m); };
const other = (i: 0 | 1) => (1 - i) as 0 | 1;
const effAtk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk), effDef = (u: Unit) => Math.max(0, u.def + u.bonusDef);
const els = (u: Unit) => (u.card.element ?? 'neutral') as Element;
const hit = (a: Unit, d: Unit) => Math.max(1, Math.floor(Math.max(1, effAtk(a) - effDef(d)) * elementMultiplier(els(a), els(d))));
const log = (g: Game, m: string) => { g.log.push(`T${g.turn}: ${m}`); };
const mk = (g: Game, c: CardDef, hp?: number): Unit => ({ uid: ++g.uid, card: c, hp: hp ?? c.hp ?? 1, maxHp: c.hp ?? 1, atk: c.atk ?? 0, def: c.def ?? 0, bonusAtk: 0, bonusDef: 0, summonedTurn: g.turn, attacked: false, lockedUntil: 0, poison: 0 });
const units = (p: Player) => p.field.filter((u): u is Unit => !!u);

export function createGame(decks: [CardDef[], CardDef[]], seed = 1, first: 0 | 1 = 0): Game {
  const g: Game = { players: [0, 1].map(i => ({ lp: RULES.lp, deck: [...decks[i]], hand: [], field: Array(RULES.fieldSlots).fill(null), back: Array(RULES.backSlots).fill(null), grave: [], summoned: false, evolved: false, noAttackUntil: 0 })) as unknown as [Player, Player], turn: 1, active: first, phase: 'main', winner: null, log: [], seed, uid: 0 };
  for (const p of g.players) { for (let i = p.deck.length - 1; i > 0; i--) { const j = Math.floor(rnd(g) * (i + 1)); [p.deck[i], p.deck[j]] = [p.deck[j], p.deck[i]]; } p.hand = p.deck.splice(0, RULES.startHand); }
  return g;
}
function draw(g: Game, pi: 0 | 1, loseIfEmpty = false) {
  const p = g.players[pi]; if (p.hand.length >= RULES.handMax) return false;
  if (!p.deck.length) { if (loseIfEmpty) { g.winner = other(pi); log(g, `ผู้เล่น ${pi + 1} จั่วไม่ได้ แพ้`); } return false; }
  p.hand.push(p.deck.shift()!); return true;
}
const TRAP: Record<string, string> = { 'TRP-001': 'on_attack', 'TRP-002': 'on_attack', 'TRP-003': 'on_attack_direct', 'TRP-009': 'on_attack', 'TRP-004': 'on_summon', 'TRP-005': 'on_evolve', 'TRP-006': 'turn_end', 'TRP-007': 'turn_start', 'TRP-008': 'on_destroyed', 'TRP-010': 'to_graveyard' };
/** Fire the first usable face-down trap of `owner` for this event (usable only from the turn after it was set). */
function fire(g: Game, owner: 0 | 1, ev: string): string | null {
  const p = g.players[owner];
  for (let i = 0; i < p.back.length; i++) {
    const t = p.back[i]; if (!t || t.setTurn >= g.turn) continue;
    const k = TRAP[t.card.id]; if (!(k === ev || (ev === 'on_attack_direct' && k === 'on_attack'))) continue;
    p.back[i] = null; p.grave.push(t.card); log(g, `กับดัก ${t.card.name} ทำงาน`); return t.card.id;
  }
  return null;
}
function toGrave(g: Game, pi: 0 | 1, u: Unit) { g.players[pi].grave.push(u.card); }
function damageUnit(g: Game, pi: 0 | 1, slot: number, amount: number) {
  const p = g.players[pi], u = p.field[slot]; if (!u) return;
  u.hp -= amount;
  if (u.hp > 0) return;
  if (fire(g, pi, 'on_destroyed')) { u.hp = 1; return; }
  p.field[slot] = null; toGrave(g, pi, u); log(g, `${u.card.name} ถูกทำลาย`);
  if (fire(g, pi, 'to_graveyard')) draw(g, pi);
}
function dealLp(g: Game, pi: 0 | 1, n: number) { const p = g.players[pi]; p.lp = Math.max(0, p.lp - n); if (p.lp === 0) { g.winner = other(pi); log(g, `ผู้เล่น ${pi + 1} LP หมด`); } }

function startTurn(g: Game) {
  const pi = g.active, p = g.players[pi]; p.summoned = false; p.evolved = false;
  p.field.forEach(u => { if (u) u.attacked = false; });
  p.field.forEach((u, i) => { if (u?.poison) { u.poison--; damageUnit(g, pi, i, RULES.poison.dmg); } });
  if (fire(g, other(pi), 'turn_start')) p.field.forEach((u, i) => { if (u) damageUnit(g, pi, i, 5); });
  if (g.winner === null) draw(g, pi, true);
  g.phase = 'main';
}
function endTurn(g: Game) {
  const pi = g.active, opp = other(pi);
  if (fire(g, opp, 'turn_end')) { let best = -1; g.players[pi].field.forEach((u, i) => { if (u && (best < 0 || effAtk(u) > effAtk(g.players[pi].field[best]!))) best = i; }); if (best >= 0) damageUnit(g, pi, best, 15); }
  g.players[pi].field.forEach(u => { if (u) { u.bonusAtk = 0; u.bonusDef = 0; } });
  if (g.winner !== null) return;
  g.active = opp; g.turn++; startTurn(g);
}

export function act(g0: Game, a: Action): Game {
  if (g0.winner !== null) fail('เกมจบแล้ว');
  const g = structuredClone(g0), pi = g.active, opp = other(pi), me = g.players[pi], en = g.players[opp];
  const card = (i: number) => me.hand[i] ?? fail('ไม่พบการ์ดบนมือ');
  const mine = (s: number) => me.field[s] ?? fail('ไม่มีตัวละครในช่องนั้น');
  const theirs = (s: number) => en.field[s] ?? fail('ไม่มีตัวละครฝ่ายตรงข้ามในช่องนั้น');
  const main = () => { if (g.phase !== 'main') fail('ทำได้เฉพาะเฟสหลัก'); };
  const sendTo = (c: CardDef) => me.grave.push(c);
  switch (a.t) {
    case 'next':
      if (g.phase === 'main') g.phase = 'battle'; else endTurn(g);
      return g;
    case 'summon': {
      main(); const c = card(a.hand);
      if (c.type !== 'character' || c.level !== 15) fail('เรียกได้เฉพาะตัวละคร Lv.15'); if (me.summoned) fail('เรียกได้ 1 ใบต่อเทิร์น');
      if (a.slot < 0 || a.slot >= RULES.fieldSlots || me.field[a.slot]) fail('ช่องไม่ว่าง');
      me.hand.splice(a.hand, 1); const u = mk(g, c); me.field[a.slot] = u; me.summoned = true; log(g, `เรียก ${c.name}`);
      if (fire(g, opp, 'on_summon')) u.lockedUntil = g.turn + 3;
      return g;
    }
    case 'evolve': {
      main(); if (me.evolved) fail('วิวัฒนาการได้ 1 ครั้งต่อเทิร์น');
      const u = mine(a.slot), evo = card(a.evo), form = card(a.form);
      if (evo.type !== 'evolution') fail('ต้องใช้การ์ดวิวัฒนาการ');
      const next = ({ 15: 40, 40: 70, 70: 99 } as Record<number, number>)[u.card.level ?? 0];
      if (form.type !== 'character' || form.chain !== u.card.chain || form.level !== next) fail('ร่างใหม่ต้องเป็นขั้นถัดไปของสายเดียวกัน');
      const need = RULES.sacrifice[next], sac = [...new Set(a.sacrifice)];
      if (sac.length !== need || sac.some(s => s === a.slot || !me.field[s])) fail(`ต้องสังเวยตัวละครอื่น ${need} ใบ`);
      const [hi, lo] = [Math.max(a.evo, a.form), Math.min(a.evo, a.form)]; me.hand.splice(hi, 1); me.hand.splice(lo, 1);
      sendTo(evo); me.evolved = true;
      if (fire(g, opp, 'on_evolve')) { me.hand.push(form); log(g, 'การวิวัฒนาการถูกยกเลิก'); return g; }
      sac.forEach(s => { toGrave(g, pi, me.field[s]!); me.field[s] = null; });
      const nu = mk(g, form, evolveHp(u.maxHp, u.hp, form.hp ?? 1)); me.field[a.slot] = nu; toGrave(g, pi, u); log(g, `${u.card.name} วิวัฒนาการเป็น ${form.name}`);
      return g;
    }
    case 'set': {
      main(); const c = card(a.hand); if (c.type !== 'trap') fail('ต้องเป็นกับดัก');
      const i = me.back.findIndex(x => !x); if (i < 0) fail('ช่องหลังเต็ม');
      me.hand.splice(a.hand, 1); me.back[i] = { card: c, setTurn: g.turn }; return g;
    }
    case 'cast': {
      main(); const c = card(a.hand); if (c.type !== 'spell') fail('ต้องเป็นเวทมนตร์');
      const t = a.target ?? {}; const need = (v: number | undefined) => v ?? fail('ต้องเลือกเป้าหมาย');
      switch (c.id) {
        case 'SPL-001': damageUnit(g, opp, (theirs(need(t.slot)), t.slot!), 20); break;
        case 'SPL-002': { const u = mine(need(t.slot)); u.hp = Math.min(u.maxHp, u.hp + 30); break; }
        case 'SPL-003': mine(need(t.slot)).bonusDef += 15; break;
        case 'SPL-004': mine(need(t.slot)).bonusAtk += 15; break;
        case 'SPL-005': draw(g, pi); draw(g, pi); break;
        case 'SPL-006': {
          if (me.hand.length - 1 >= RULES.handMax) fail('มือเต็ม');
          const gi = t.grave ?? me.grave.findIndex(x => x.type === 'character' && x.level === 15);
          const gc = me.grave[gi]; if (!gc || gc.type !== 'character' || gc.level !== 15) fail('ไม่มีตัวละคร Lv.15 ในสุสาน');
          me.grave.splice(gi, 1); me.hand.splice(a.hand, 1); me.hand.push(gc); sendTo(c); log(g, `ใช้ ${c.name}`); return g;
        }
        case 'SPL-007': { const x = need(t.slot), y = need(t.slot2); mine(x); if (y < 0 || y >= RULES.fieldSlots || x === y) fail('ช่องไม่ถูกต้อง'); [me.field[x], me.field[y]] = [me.field[y], me.field[x]]; break; }
        case 'SPL-008': en.noAttackUntil = g.turn + 2; break;
        case 'SPL-009': theirs(need(t.slot)).poison = RULES.poison.turns; break;
        case 'SPL-010': { const b = en.back[need(t.slot)] ?? fail('ไม่มีกับดักในช่องนั้น'); en.grave.push(b.card); en.back[t.slot!] = null; break; }
        default: fail('ยังไม่รองรับเวทมนตร์ใบนี้');
      }
      me.hand.splice(a.hand, 1); sendTo(c); log(g, `ใช้ ${c.name}`); return g;
    }
    case 'attack': {
      if (g.phase !== 'battle') fail('โจมตีได้เฉพาะเฟสต่อสู้'); if (g.turn === 1) fail('ผู้เริ่มก่อนโจมตีไม่ได้ในเทิร์นแรก');
      if (g.turn < me.noAttackUntil) fail('ถูกห้ามโจมตีในเทิร์นนี้');
      const u = mine(a.from); if (u.attacked) fail('ตัวนี้โจมตีแล้ว'); if (u.summonedTurn === g.turn) fail('ตัวที่เพิ่งถูกเรียกโจมตีไม่ได้'); if (g.turn < u.lockedUntil) fail('ตัวนี้ถูกห้ามโจมตี');
      const direct = a.to === 'player';
      if (direct && units(en).length) fail('โจมตีผู้เล่นได้เมื่อฝั่งตรงข้ามไม่มีตัวละคร');
      const tgt = direct ? null : theirs(a.to as number); u.attacked = true;
      const t = fire(g, opp, direct ? 'on_attack_direct' : 'on_attack');
      if (t === 'TRP-001') { log(g, 'การโจมตีถูกยกเลิก'); return g; }
      if (t === 'TRP-009') { me.field[a.from] = null; if (me.hand.length < RULES.handMax) me.hand.push(u.card); else toGrave(g, pi, u); return g; }
      if (direct) { const d = effAtk(u); dealLp(g, opp, t === 'TRP-003' ? Math.floor(d / 2) : d); if (t === 'TRP-002') damageUnit(g, pi, a.from, Math.floor(d / 2)); log(g, `${u.card.name} โจมตีตรง`); return g; }
      const d1 = hit(u, tgt!); damageUnit(g, opp, a.to as number, d1); log(g, `${u.card.name} โจมตี ${tgt!.card.name} ${d1}`);
      if (t === 'TRP-002') damageUnit(g, pi, a.from, Math.floor(d1 / 2));
      if (en.field[a.to as number] === tgt && tgt!.hp > 0 && me.field[a.from] === u) damageUnit(g, pi, a.from, hit(tgt!, u));
      return g;
    }
  }
}

export function legalActions(g: Game): Action[] {
  if (g.winner !== null) return [];
  const me = g.players[g.active], en = g.players[other(g.active)], out: Action[] = [{ t: 'next' }];
  if (g.phase === 'main') {
    const slot = me.field.findIndex(x => !x);
    me.hand.forEach((c, h) => {
      if (c.type === 'character' && c.level === 15 && !me.summoned && slot >= 0) out.push({ t: 'summon', hand: h, slot });
      if (c.type === 'trap' && me.back.some(x => !x)) out.push({ t: 'set', hand: h });
      if (c.type === 'spell') {
        const ms = me.field.map((u, i) => u ? i : -1).filter(i => i >= 0), es = en.field.map((u, i) => u ? i : -1).filter(i => i >= 0);
        if (['SPL-002', 'SPL-003', 'SPL-004'].includes(c.id)) ms.forEach(s => out.push({ t: 'cast', hand: h, target: { slot: s } }));
        else if (['SPL-001', 'SPL-009'].includes(c.id)) es.forEach(s => out.push({ t: 'cast', hand: h, target: { slot: s } }));
        else if (c.id === 'SPL-010') en.back.forEach((b, i) => b && out.push({ t: 'cast', hand: h, target: { slot: i } }));
        else if (c.id === 'SPL-007') { if (ms.length) out.push({ t: 'cast', hand: h, target: { slot: ms[0], slot2: (ms[0] + 1) % RULES.fieldSlots } }); }
        else out.push({ t: 'cast', hand: h });
      }
    });
    if (!me.evolved) me.field.forEach((u, s) => {
      if (!u) return; const nx = ({ 15: 40, 40: 70, 70: 99 } as Record<number, number>)[u.card.level ?? 0];
      const e = me.hand.findIndex(c => c.type === 'evolution'), f = me.hand.findIndex(c => c.type === 'character' && c.chain === u.card.chain && c.level === nx);
      const sac = me.field.map((x, i) => x && i !== s ? i : -1).filter(i => i >= 0).slice(0, RULES.sacrifice[nx] ?? 9);
      if (e >= 0 && f >= 0 && sac.length === RULES.sacrifice[nx]) out.push({ t: 'evolve', slot: s, evo: e, form: f, sacrifice: sac });
    });
  } else {
    if (g.turn === 1 || g.turn < me.noAttackUntil) return out;
    me.field.forEach((u, s) => { if (!u || u.attacked || u.summonedTurn === g.turn || g.turn < u.lockedUntil) return; const es = en.field.map((x, i) => x ? i : -1).filter(i => i >= 0); if (es.length) es.forEach(i => out.push({ t: 'attack', from: s, to: i })); else out.push({ t: 'attack', from: s, to: 'player' }); });
  }
  return out;
}
