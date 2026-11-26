// Simple opponent AI: picks one legal action at a time (call repeatedly until it returns { t: 'next' } twice in a row = turn over).
import { legalActions, RULES, type Action, type Game, type Unit } from './game';
import { elementMultiplier, type Element } from './combat';
const els = (u: Unit) => (u.card.element ?? 'neutral') as Element;
/** Damage `a` deals to `d` in one hit: the same formula the engine uses (DEF, minimum 1, element multiplier). */
const dmg = (a: Unit, d: Unit) => Math.max(1, Math.floor(Math.max(1, atk(a) - def(d)) * elementMultiplier(els(a), els(d))));
const worth = (u: Unit) => atk(u) + u.hp / 2 + ((u.card.level ?? 15) - 15);
const atk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk + (u.auraAtk ?? 0)), def = (u: Unit) => Math.max(0, u.def + u.bonusDef + (u.auraDef ?? 0));
export function botPick(g: Game): Action {
  if (g.pending?.event === 'effect_target') {   // choose the ability's target: hit the strongest enemy, heal the most hurt ally, buff the strongest ally
    const p = g.pending, cs = p.info?.choices ?? [], kind = p.info?.kind;
    if (kind === 'discard') return { t: 'respond', back: p.options[p.options.length - 1] };       // throw away the last card in hand
    const score = (c: { hp: number; maxHp: number; atk: number }) => kind === 'heal' ? -(c.hp / c.maxHp) : c.atk;
    const best = cs.reduce((b, c) => (score(c) > score(b) ? c : b), cs[0]);
    return { t: 'respond', back: best ? best.slot : p.options[0] };
  }
  if (g.pending) return g.pending.options.length ? { t: 'respond', back: g.pending.options[0] } : { t: 'pass' };
  const L = legalActions(g), me = g.players[g.active], en = g.players[1 - g.active];
  const pick = <T extends Action>(t: T['t']) => L.filter(a => a.t === t) as T[];
  const myUnits = me.field.map((u, i) => ({ u, i })).filter((x): x is { u: Unit; i: number } => !!x.u);
  const enUnits = en.field.map((u, i) => ({ u, i })).filter((x): x is { u: Unit; i: number } => !!x.u);
  if (g.phase === 'main') {
    const ev = pick('evolve')[0]; if (ev) return ev;
    const fu = pick('fuse')[0]; if (fu) return fu;
    const su = pick<Extract<Action, { t: 'summon' }>>('summon').sort((a, b) => (me.hand[b.hand].atk ?? 0) - (me.hand[a.hand].atk ?? 0))[0]; if (su) return su;
    const st = pick('set')[0]; if (st) return st;
    // Swap spell: trade my weakest unit for their strongest only when it is clearly a gain.
    const val = (u: Unit) => atk(u) + u.hp / 2; let sw: Action | null = null, gain = 19;
    for (const a of pick<Extract<Action, { t: 'cast' }>>('cast')) {
      if (me.hand[a.hand].id !== 'SPL-007' || a.target?.slot === undefined || a.target.slot2 === undefined) continue;
      const g2 = val(en.field[a.target.slot2]!) - val(me.field[a.target.slot]!); if (g2 > gain) { gain = g2; sw = a; }
    }
    if (sw) return sw;
    for (const a of pick<Extract<Action, { t: 'cast' }>>('cast')) { if (me.hand[a.hand].support && signatureCastWorthIt(g, a)) return a; }
    for (const a of pick<Extract<Action, { t: 'cast' }>>('cast')) {
      const id = me.hand[a.hand].id, s = a.target?.slot;
      if (id === 'SPL-005' || (id === 'SPL-006' && me.grave.some(c => c.level === 15)) || (id === 'SPL-008' && enUnits.length) || (id === 'SPL-010' && s !== undefined)) return a;
      if ((id === 'SPL-001' || id === 'SPL-009') && s !== undefined && enUnits.length && enUnits.every(x => x.i !== s || true)) { const best = enUnits.sort((x, y) => atk(y.u) - atk(x.u))[0]; if (s === best.i) return a; }
      if ((id === 'SPL-003' || id === 'SPL-004') && myUnits.length && g.turn > 1) { const best = myUnits.sort((x, y) => atk(y.u) - atk(x.u))[0]; if (s === best.i) return a; }
      if (id === 'SPL-002' && s !== undefined) { const u = me.field[s]; if (u && u.maxHp - u.hp >= 20) return a; }
    }
    return { t: 'next' };
  }
  let best: Action | null = null, score = 0;
  const ready = (u: Unit | null | undefined): u is Unit => !!u && !u.attacked && u.summonedTurn !== g.turn && g.turn >= u.lockedUntil && g.turn !== 1;
  for (const a of pick<Extract<Action, { t: 'attack' }>>('attack')) {
    const u = me.field[a.from]!; if (!ready(u)) continue;
    let s: number;
    if (a.to === 'player') s = 200 + atk(u);
    else { const e = en.field[a.to]!, d = dmg(u, e), c = dmg(e, u); s = d >= e.hp ? 100 + worth(e) : u.hp > c ? d - c + 1 : 0; }   // element-aware; a kill is worth the victim's value, not the overkill damage
    if (s > score) { score = s; best = a; }
  }
  // Focus fire: several attackers together can kill a target none of them kills alone. Chip with units that survive the counter; one finisher (no counter after a kill) may be a unit that would not survive.
  const atts = myUnits.filter(x => ready(x.u));
  if (atts.length > 1) for (const e of enUnits) {
    if (atts.some(x => dmg(x.u, e.u) >= e.u.hp)) continue;                                  // a single attacker already kills it: handled above
    const opts = atts.map(x => ({ ...x, d: dmg(x.u, e.u), safe: x.u.hp > dmg(e.u, x.u) })).sort((p, q) => q.d - p.d);
    const plan: typeof opts = []; let sum = 0; for (const o of opts) { plan.push(o); sum += o.d; if (sum >= e.u.hp) break; }
    if (sum < e.u.hp || plan.filter(o => !o.safe).length > 1) continue;
    const first = plan.filter(o => o.safe)[0]; if (!first) continue;                        // the first hit must be a chip that survives the counter
    const s = 100 + worth(e.u) - 10 * (plan.length - 1);
    if (s > score && L.some(l => l.t === 'attack' && l.from === first.i && l.to === e.i)) { score = s; best = { t: 'attack', from: first.i, to: e.i }; }
  }
  return best ?? { t: 'next' };
}

/** Signature spells (data-driven `support` ops): cast only when the result is used this turn. */
function signatureCastWorthIt(g: Game, a: Extract<Action, { t: 'cast' }>): boolean {
  const me = g.players[g.active], en = g.players[1 - g.active], sp = me.hand[a.hand].support; if (!sp || sp.kind !== 'spell') return false;
  const can = (u: Unit | null | undefined) => !!u && !u.attacked && u.summonedTurn !== g.turn && g.turn >= u.lockedUntil && g.turn > 1;
  const tgt = a.target?.slot === undefined ? undefined : (sp.ops.some(o => o.who === 'enemy') ? en : me).field[a.target.slot] ?? undefined;
  const link = me.field.find(u => u && u.card.chain === sp.link) ?? undefined;
  for (const o of sp.ops) {
    if (o.op === 'draw' || o.op === 'search_evo_top3') return me.hand.length < RULES.handMax - 1;
    if (o.op === 'heal') { const u = o.who === 'ally' || o.who === 'other_ally' ? tgt : link; if (u && u.maxHp - u.hp >= Math.min(o.amount ?? 0, 10)) return true; continue; }
    if (o.op === 'buff' && o.stat === 'atk' && (o.amount ?? 0) > 0) { const u = o.who === 'ally' || o.who === 'other_ally' ? tgt : link; if (u && can(u)) { if (o.who === 'ally' || o.who === 'other_ally') { const best = me.field.filter(x => can(x)).sort((p, q) => atk(q!) - atk(p!))[0]; return u === best; } return true; } continue; }
    if (o.op === 'damage' && (o.who === 'enemy') && tgt) { const weakest = en.field.filter((x): x is Unit => !!x).sort((p, q) => p.hp - q.hp)[0]; return tgt === weakest && (o.amount ?? 0) >= 10; }
  }
  return false;                                                                             // DEF-only / unknown ops: not worth a card for the Bot
}
export const _rules = RULES;
