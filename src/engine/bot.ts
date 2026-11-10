// Simple opponent AI: picks one legal action at a time (call repeatedly until it returns { t: 'next' } twice in a row = turn over).
import { legalActions, RULES, type Action, type Game, type Unit } from './game';
const atk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk), def = (u: Unit) => Math.max(0, u.def + u.bonusDef);
export function botPick(g: Game): Action {
  const L = legalActions(g), me = g.players[g.active], en = g.players[1 - g.active];
  const pick = <T extends Action>(t: T['t']) => L.filter(a => a.t === t) as T[];
  const myUnits = me.field.map((u, i) => ({ u, i })).filter((x): x is { u: Unit; i: number } => !!x.u);
  const enUnits = en.field.map((u, i) => ({ u, i })).filter((x): x is { u: Unit; i: number } => !!x.u);
  if (g.phase === 'main') {
    const ev = pick('evolve')[0]; if (ev) return ev;
    const su = pick<Extract<Action, { t: 'summon' }>>('summon').sort((a, b) => (me.hand[b.hand].atk ?? 0) - (me.hand[a.hand].atk ?? 0))[0]; if (su) return su;
    const st = pick('set')[0]; if (st) return st;
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
