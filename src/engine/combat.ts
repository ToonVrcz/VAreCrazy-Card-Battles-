// Battle rules v0 (proposed defaults; every number comes from game_rules / elements.json, nothing hard-coded to a card)
import elements from '../../db/seed/elements.json' with { type: 'json' };

export type Element = keyof typeof elements.elements;
export interface Unit { hp: number; atk: number; def: number; element: Element }
export interface Rules { strong: number; weak: number; startingLp: number }
export const DEFAULT_RULES: Rules = { strong: elements.multiplier_strong, weak: elements.multiplier_weak, startingLp: 8000 };

/** x1.5 if attacker element beats defender's, x0.75 if defender's beats attacker's, else x1. */
export function elementMultiplier(a: Element, d: Element, r: Rules = DEFAULT_RULES) {
  const E = elements.elements as Record<string, { strong: string[] }>;
  if (E[a]?.strong.includes(d)) return r.strong;
  if (E[d]?.strong.includes(a)) return r.weak;
  return 1;
}
/** Damage = (ATK - DEF, min 0) x element multiplier, rounded down. */
export function damage(att: Unit, def: Unit, r: Rules = DEFAULT_RULES) {
  return Math.floor(Math.max(0, att.atk - def.def) * elementMultiplier(att.element, def.element, r));
}
/** Attack a character: reduces its HP; destroyed at 0. LP is not affected. */
export function attackUnit(att: Unit, def: Unit, r: Rules = DEFAULT_RULES) {
  const dmg = damage(att, def, r), hp = Math.max(0, def.hp - dmg);
  return { dmg, hp, destroyed: hp === 0 };
}
/** Direct attack on a player is allowed only when the opponent has no characters on the field; damage is the full ATK (no DEF). */
export function attackPlayer(att: Unit, opponentUnitsOnField: number, lp: number) {
  if (opponentUnitsOnField > 0) return { ok: false as const, error: 'โจมตีผู้เล่นตรง ๆ ได้เมื่อฝั่งตรงข้ามไม่มีตัวละครบนสนาม' };
  const lpAfter = Math.max(0, lp - att.atk);
  return { ok: true as const, dmg: att.atk, lp: lpAfter, won: lpAfter === 0 };
}
export const PHASES = ['draw', 'main', 'battle', 'end'] as const;   // main = summon / evolve / spells
/** The first player cannot attack on their first turn. */
export const canAttack = (turnNo: number, isFirstPlayer: boolean) => !(turnNo === 1 && isFirstPlayer);
/** Evolution keeps accumulated damage: new HP = new max HP - damage taken (min 1). */
export const evolveHp = (oldMax: number, oldHp: number, newMax: number) => Math.max(1, newMax - (oldMax - oldHp));
