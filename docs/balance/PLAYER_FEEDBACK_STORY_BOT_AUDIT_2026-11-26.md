# VAreCrazy Card Battles — Player Feedback Audit: Story Balance & Bot AI
**Date:** 2026-11-26  
**Source:** Player feedback screenshot supplied by Toon, plus read-only inspection of repository `main`.  
**Status:** AUDIT FINDINGS / RECOMMENDATIONS ONLY — NO GAMEPLAY CODE OR PRODUCTION DATA CHANGED  
**Owner:** Toon (final approval)  
**Audit:** Ball

## 1. Executive summary

The player reports that:
- A three-card combo can deal more than 100 damage.
- There is no character that can reliably withstand the resulting burst.
- Tank, healing, and damage-reduction strategies feel ineffective.
- The Bot sometimes does not attack an evolved character, and can continue passing until it loses by deck-out.

Repository inspection confirms a real Story stacking pathway and a simplistic Bot combat evaluator. The reported exact 100+ damage combo is plausible but **not yet reproduced**: the screenshot does not include a full deck list, turn-by-turn replay, card IDs, field state, element matchup, or combat log. Do not change numeric balance based on the anecdote alone.

## 2. Story system — confirmed code behavior

### 2.1 How Story currently applies
In `src/engine/game.ts`, `refreshAuras()`:
- Rebuilds effective aura totals from the current field after actions.
- Activates a row when chain `b` is present on the same player's field.
- Applies all modifiers in that row to every unit matching source chain `a`.
- Supports multiple modifiers in a Mixed Story row.
- Adds modifiers from distinct qualifying Story rows into the same per-stat total.
- Recomputes values rather than incrementally accumulating them; removing a partner removes that row's contribution.
- Keeps base `u.atk` and `u.def` unchanged; combat reads `auraAtk` / `auraDef`.
- HP Story modifiers contribute to `maxHp` and current HP through `auraHp` reconciliation.

The current test `tests/story-runtime.test.ts` explicitly asserts that two distinct Story rows can stack on one character. It tests no duplicate stacking from repeated copies of the same partner, but does not test a designed upper bound because none currently exists.

### 2.2 Current seed shape and potential hotspots
The repository seed `db/seed/story-links.json` currently contains 29 rows (8 baseline + 21 additions). This is a repository seed observation, **not a fresh read of the live Supabase table**.

Source-chain counts in those 29 rows:
- 2 rows each: BABY, BACKJI, BADGUY, CHAEM, LALAPING, BOBO, CUTIE.
- 1 row each: 1GOKU, BAM, BAMMIE, NONG-TAENGMO, LORDNAM, GOD-WA, LEON-S-KENNEDY, MELON, NORMAN, WENDYWENDIE, PKXCY, FOLLOW-YOU, TAN, ZEESKY, THAI26.

If both partner conditions are simultaneously satisfied:
- BABY can receive ATK +10 across its two rows.
- BACKJI can receive ATK +10 and DEF net 0 across its two rows (one row grants DEF +5, another mixed row grants ATK +10 / DEF -5).
- LALAPING can receive HP +20 and ATK -5 across its two rows.
- BADGUY can receive ATK net +5 and DEF -5.
- CUTIE can receive ATK net 0 and HP -5.
- BOBO can receive ATK net 0 from +5 and -5.
These are Story-only totals before card effects, Fusion contributions, other auras, temporary buffs, element multipliers, and target DEF. They are not proof of a 100+ damage result.

### 2.3 Balance finding
**Confirmed risk: unbounded-by-design stacking across distinct Story rows.**
There is no per-unit cap or diminishing-return rule in `refreshAuras()`. The only bound is the number of simultaneously satisfied Story rows and their configured values. This is a balance policy gap, not a repeated-refresh accumulation bug.

Do not simply disable stacking: existing tests and the current design explicitly permit distinct Story rows to stack. Any cap changes that behavior and requires Owner approval.

### 2.4 Recommended Story experiments (not applied)
Run deterministic combat scenarios with:
1. All current 29 Story rows enabled.
2. Story disabled (control).
3. One qualifying Story row per source unit.
4. Current stacking, but proposed experimental caps applied only in a simulation harness (not engine/production).
5. Story + Fusion + character effects + element advantage/disadvantage.

Measure peak effective ATK, effective DEF, max HP, actual damage per attack, turns-to-destroy, healing per turn, and LP damage. Record exact card IDs, side, field slots, chain pairs, and active effects.

Candidate policies to test, not decisions:
- Cap only the sum of Story ATK bonus per unit.
- Cap Story ATK and DEF separately.
- Keep HP Story modifiers uncapped initially, but separately inspect max-HP and healing interactions.
- Alternative: limit one positive and one negative Story contribution per unit.
Compare all against the current behavior before selecting a rule. No cap values are recommended until simulations and playtests exist.

## 3. Bot AI — confirmed code behavior

### 3.1 Attack evaluator
In `src/engine/bot.ts`, battle scoring is:
- Direct attack: `200 + effective ATK`.
- Against a character: estimates damage as `max(1, atk - def)`.
- Estimates counter damage similarly.
- Scores a lethal attack at `100 + damage`.
- Otherwise scores an attack only if the attacker survives the estimated counter; if not, score is zero.
- If no attack has a positive score, returns `{ t: 'next' }`.

### 3.2 Confirmed weaknesses
1. **Element multiplier omitted from Bot scoring.** The real engine's `hit()` uses `elementMultiplier()`; Bot estimates only ATK minus DEF. Bot can mis-rank attacks and can skip an attack that is favorable after element advantage, or choose a bad one if the multiplier disadvantages it.
2. **No target-value / trade evaluation.** A non-lethal attack that trades the Bot's unit for a more valuable evolved unit scores zero when the Bot unit is expected to die. It does not compare levels, evolution investment, role, or remaining HP/value.
3. **No Evolution-specific threat weighting.** The evaluator treats a Lv.70/Lv.40 unit mainly by its current combat stats; it has no explicit strategic bonus for removing an evolved unit.
4. **No search over attack order.** It greedily selects the highest positive single-attack score; it does not simulate a sequence of attacks, combined damage, or the board after earlier attacks.
5. **Deck-out is a terminal engine rule, not itself a Bot bug.** `draw(..., true)` awards the win to the opponent when a player must draw from an empty deck. The Bot's tendency to pass can expose it to that loss, but whether it should attack instead depends on the tactical value and actual legal attack outcomes.

### 3.3 Important distinction: cannot attack vs chooses not to attack
The engine blocks attacks by a unit summoned/evolved this turn (`summonedTurn === g.turn`), during turn 1, after attack locks, or after it has already attacked. Evolution creates a new unit with the current turn as `summonedTurn`. Therefore, an evolved unit may be legally unable to attack on its evolution turn. That is separate from the Bot refusing to attack an opponent's evolved unit. Do not change the turn rule to address the reported Bot issue.

### 3.4 Existing test gap
`tests/game.test.ts` has a Bot-vs-Bot test requiring 100 random games to finish legally. That checks basic completion, not decision quality. There is no targeted test in the inspected test file for:
- Element-aware attack ranking.
- Trading a lower-level unit to destroy an evolved unit.
- Attacking a high-threat evolved target when it is tactically correct.
- Avoiding an attack when the actual counterattack is lethal.
- Avoiding endless pass behavior when a favorable attack exists.
- A Bot losing by deck-out despite having a favorable legal attack.

## 4. Recommended Bot remediation design (not applied)

1. Export/use the engine's canonical combat damage calculation for Bot evaluation so element multipliers and clamps cannot drift.
2. Evaluate every legal attack using actual outgoing damage and actual counter damage, including current Story aura, timed buffs, and element matchups.
3. Add a target-value term (level/evolution tier and strategic threat) so a deliberate trade can be chosen when destroying an evolved enemy is worth the sacrifice.
4. Add a multi-attack lookahead for the current battle phase, at minimum evaluating the board after each candidate attack.
5. Keep hard legality checks authoritative in `legalActions()` / `act()`; Bot must never invent an illegal attack.
6. Add deterministic unit tests for the cases in §3.4 before running broader simulations.
7. Add telemetry to simulations: pass count while attacks are legal, number of attacks, missed lethal opportunities, evolved units destroyed, Bot deck-outs, and win rate by deck archetype.

## 5. Evidence and confidence

| Finding | Evidence | Confidence |
|---|---|---|
| Distinct Story rows stack | `refreshAuras()` sums per-row modifiers; Story runtime test asserts stacking | Confirmed |
| No explicit Story cap | No cap/limit in inspected `refreshAuras()` path | Confirmed |
| Player's exact 100+ combo | Screenshot only; no replay/deck/log | Unverified |
| Bot ignores element multiplier in combat score | Bot uses ATK-DEF; engine `hit()` applies element multiplier | Confirmed |
| Bot can pass instead of attacking | `best ?? { t: 'next' }`; score can remain 0 | Confirmed |
| Bot does not value Evolution target | No level/evolution weighting in combat score | Confirmed |
| Production Story rows = 29 | No live DB query performed in this audit | Not checked |

## 6. Safe next steps

1. Ask the player for the exact 3-card combo (card IDs/names), screenshot of the board immediately before attack, and the combat log or replay if available.
2. Reproduce the reported 100+ damage in a local deterministic simulation using the exact seed data.
3. Build a Story stacking comparison matrix and identify the smallest set of simultaneous partners needed to reach the observed damage.
4. Implement Bot evaluator changes only on a dedicated branch after Toon approves the proposed behavior.
5. Keep all Story cap experiments in tests/simulation first. Do not write to Supabase, apply migrations, merge, or deploy without explicit Owner approval.

## 7. Scope boundary
This commit contains this audit document only. No game engine code, Bot code, card stats, Story values, SQL seed, database rows, migration, deployment, or production configuration is changed.
