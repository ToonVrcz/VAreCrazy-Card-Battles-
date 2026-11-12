// Simple opponent AI: picks one legal action at a time (call repeatedly until it returns { t: 'next' } twice in a row = turn over).
import { legalActions, RULES, type Action, type Game, type Unit } from './game';
const atk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk + (u.auraAtk ?? 0)), def = (u: Unit) => Math.max(0, u.def + u.bonusDef);
export function botPick(g: Game): Action {
  if (g.pending?.event === 'effect_target') {   // choose the ability's target: hit the strongest enemy, heal the most hurt ally, buff the strongest ally
    const p = g.pending, cs = p.info?.choices ?? [], kind = p.info?.kind;
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
  for (const a of pick<Extract<Action, { t: 'attack' }>>('attack')) {
    const u = me.field[a.from]!; if (u.attacked || u.summonedTurn === g.turn || g.turn < u.lockedUntil || g.turn === 1) continue;
    let s: number;
    if (a.to === 'player') s = 200 + atk(u);
    else { const e = en.field[a.to]!, d = Math.max(1, atk(u) - def(e)), c = Math.max(1, atk(e) - def(u)); s = d >= e.hp ? 100 + d : u.hp > c ? d - c + 1 : 0; }
    if (s > score) { score = s; best = a; }
  }
  return best ?? { t: 'next' };
}
export const _rules = RULES;
