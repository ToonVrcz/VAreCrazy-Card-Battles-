// Heuristic balance model for the card review (docs/card-balance/). PURE: no I/O. Every constant is an ASSUMPTION, documented in CARD_BALANCE_REVIEW.md §Rubric.
// There is no playtest data yet (production pvp_matches is empty), so this model ranks cards relative to each other; it does not predict win rates.
import type { Effect } from '../src/engine/effects';

export const INCOMING_ATK: Record<number, number> = { 15: 33, 40: 55, 70: 90 };   // average ATK an attacker brings at that level incl. typical +10/+20 attack buffs
export const DRAW_VALUE = 0.20;          // +20 % power for one extra card (one extra card is about one extra unit of tempo)
export const LOOT_VALUE = 0.08;          // discard 1 to draw 1: card selection only
export const KILL_DRAW_PROB = 0.4;       // draw-on-kill fires in ~40 % of the turns the unit attacks
export const COND_HPLOWER_PROB = 0.5;    // "target HP lower than self" is true about half the time
export const HORIZON_TURNS = 3;          // an average Lv15 stays on the field about 3 of its own turns

export interface Stat { hp: number; atk: number; def: number }
export interface Model { hpEff: number; atkEff: number; evPct: number; ap: number; parts: string[] }

/** Estimated power of one card = effective HP x effective ATK x (1 + effect bonus). Relative number, not a win rate. */
export function model(level: number, base: Stat, effects: Effect[]): Model {
  const parts: string[] = [];
  let hp = base.hp, atk = base.atk, ev = 0;
  for (const e of effects) {
    const x = e.amount, once = e.limit === 'game';
    switch (e.kind) {
      case 'atk':
        if (e.trigger === 'passive') { atk += x; parts.push(`passive ATK+${x}`); }
        else if (e.trigger === 'on_attack' && e.target === 'self' && x > 0) { const f = e.cond === 'target_hp_lower' ? COND_HPLOWER_PROB : 1; atk += (x * f) / 2; parts.push(`attack ATK+${x}${f < 1 ? ' (cond)' : ''} = +${((x * f) / 2).toFixed(1)} eff`); }
        else if (e.trigger === 'turn_start' && e.perm) { const cap = e.max ?? x * 3; atk += cap / 2; parts.push(`ramp ATK +${x}/turn up to ${cap} = +${(cap / 2).toFixed(1)} eff`); }
        else if (e.target === 'ally1' && e.perm) { ev += (x * 2.5) / 100; parts.push(`ally ATK+${x} perm = +${(x * 2.5).toFixed(0)}%`); }
        else if (e.target === 'ally1' || e.target === 'allies') { ev += (x * 0.3) / 100; parts.push(`temp ally ATK+${x} = +${(x * 0.3).toFixed(1)}%`); }
        else if (e.target === 'enemy1' && x < 0) { ev += (-x * 0.4) / 100; parts.push(`enemy ATK${x} = +${(-x * 0.4).toFixed(1)}%`); }
        else if (e.trigger === 'to_graveyard') { ev += 0.01; parts.push('graveyard ATK+5 = +1%'); }
        break;
      case 'maxhp': hp += x; parts.push(`passive HP+${x}`); break;
      case 'draw': { const v = (e.cost ? LOOT_VALUE : DRAW_VALUE) * x * (e.cond === 'target_destroyed' ? KILL_DRAW_PROB : 1); ev += v; parts.push(`${e.cost ? 'loot' : 'draw'} ${x}${e.cond ? ' on kill' : ''} = +${(v * 100).toFixed(0)}%`); break; }
      case 'damage': { const v = (x * 0.8) / 100 * (once || e.trigger === 'on_summon' ? 1 : HORIZON_TURNS); ev += v; parts.push(`${x} dmg = +${(v * 100).toFixed(0)}%`); break; }
      case 'heal': {
        const amt = e.full ? 0.5 * base.hp : x, per = e.limit === 'game' || e.trigger === 'on_summon' || e.trigger === 'on_evolve' || e.trigger === 'on_destroyed' ? 1 : HORIZON_TURNS;
        const n = e.target === 'allies' ? 2 : 1, v = (0.6 * amt * per * n) / 85 / (per === 1 ? 1 : 1.6);
        ev += v; parts.push(`heal ${e.full ? 'full' : x}${per > 1 ? '/turn' : ''}${n > 1 ? ' all' : ''} = +${(v * 100).toFixed(0)}%`); break;
      }
      case 'protect': ev += 0.02; parts.push('untargetable on summon = +2%'); break;
      case 'search_evo': ev += 0.10; parts.push('search EVO = +10%'); break;
    }
  }
  const A = INCOMING_ATK[level] ?? 33, hpEff = hp * (A / Math.max(1, A - base.def)), ap = hpEff * atk * (1 + ev);
  if (base.def) parts.push(`DEF ${base.def}: HP x${(A / (A - base.def)).toFixed(2)} vs ATK ${A}`);
  return { hpEff, atkEff: atk, evPct: ev, ap, parts };
}
export const tierOf = (ratio: number) => ratio >= 1.25 ? 'S' : ratio >= 1.10 ? 'A' : ratio >= 0.90 ? 'B' : ratio >= 0.75 ? 'C' : 'D';
