# VAreCrazy Card Battles — Balance Audit
**Branch:** balance/audit-2026-11
**Status:** READ-ONLY AUDIT / PROPOSALS ONLY
**Scope:** Seed data and current engine source inspected. No gameplay/card data/code changes.
**Hard constraint:** HP and ATK must never be changed. Values are only analytical references.

## 1. Verified Card Inventory
- Character cards: 48 (Lv15: 39, Lv40: 7, Lv70: 2)
- Spell cards: 10
- Trap cards: 10
- Support cards: 2 (Evolution and Fusion)
- Fusion pairs: 1
- Character effect trigger counts: on_attack 21; on_summon 15; on_destroyed 4; combo 1; on_evolve 3; passive 2; turn_start 2; turn_end 6; to_graveyard 2.

## 2. Preliminary Balance Findings
### A. Card advantage / draw engine concentration
Several Lv15 characters draw on summon (CHAEM, FOLLOW-YOU, MON, PK, THOMAS). Thief characters draw only when an attack destroys a target (GOD-WA, JAOJAY, NONG-TAENGMO, WENDYWENDIE). This creates a clear distinction between reliable summon-trigger draw and conditional combat draw. Proposal: track early-game hand advantage and automatic-inclusion rates during playtests; no stat changes.
### B. Repeated attack buffs
A large portion of Lv15 characters use temporary on-attack ATK buffs. This risks effects feeling interchangeable and makes trigger timing/counterplay important. Proposal: differentiate future designs through conditions, target restrictions, strategic trade-offs, or usage limits—not ATK changes.
### C. Conditional assassins
BACKJI-015 and BADGUY-015 use target HP lower than self as a condition. BADGUY-040 has a stronger conditional buff plus a destruction-trigger effect. Proposal: verify condition evaluation at the exact resolution moment, especially if other effects can change HP.
### D. Evolution reward / counterplay
Evolution is a major tempo investment and TRP-005 can cancel it. Trap text says the evolution card is discarded, the new form returns to its prior state, and sacrifices are not required. Proposal: test cancellation rollback, resource loss, and state consistency.
### E. Fusion
Only one pair is defined (Backji + Nong-Taengmo). Fusion metadata adds HP/ATK bonuses and the engine supports pair lookup. Proposal: leave existing bonuses untouched; audit slot economy, attack eligibility, graveyard handling, and whether component effects behave consistently.
### F. Spell power / control
SPL-005 draws two; SPL-007 swaps a friendly and enemy character; SPL-008 prevents enemy attacks; SPL-009 applies poison; SPL-010 destroys a face-down trap. These are high-impact effects. Proposal: test frequency, target availability, and opportunity cost. Any future adjustment should use restrictions, conditions, costs, durations, or limits—not HP/ATK.
### G. Trap timing and reactive strength
TRP-001 cancels attack; TRP-002 reflects half damage; TRP-003 halves direct LP damage; TRP-004 locks a summoned/fused character from attacking; TRP-005 cancels evolution; TRP-008 prevents destruction at 1 HP; TRP-009 cancels and returns attacker; TRP-010 draws after a character reaches graveyard. Proposal: validate trigger windows and choice behavior, especially TRP-009 with full hand and TRP-008 with sequential/simultaneous damage.

## 3. Engine Capability Verification — Source Confirmed
- Generic character effects are parsed from seed effect rows; unsupported rows are filtered out by parseEffect.
- Parser trigger vocabulary: on_attack, on_summon, on_evolve, on_destroyed, to_graveyard, turn_start, turn_end, passive. combo exists in seed but is not in the parser trigger list: unsupported/unverified at parser level.
- Generic parser restricts conditions/actions/durations; a trigger name alone does not guarantee execution.
- Trap behavior is hardcoded by trap ID in the engine trigger map and resolution logic.
- Spell behavior is hardcoded by spell ID in the cast switch (SPL-001 through SPL-010).
- Element multipliers are 1.5 strong and 0.75 weak. The current matrix is asymmetric and has gaps (e.g. wind strong vs poison; poison strong vs nature). Treat as a rules/data characteristic requiring owner confirmation.
- Fusion bonus is looked up by chain keys; the current pair list contains one entry.
- on_summon trap trigger also occurs for fusion; source sets lock to g.turn + 3. Exact duration needs a turn-semantics test.
- SPL-008 sets noAttackUntil = g.turn + 2; exact duration needs simulation.
- SPL-009 uses the engine poison turn count; verify tick timing and whether poison refreshes or stacks.
- SPL-003/004 seed rules_text says until target leaves the field, while effect metadata says until_end_of_turn. Engine cast cases directly add bonuses; cleanup needs verification.
- SPL-007 effect metadata says swap two friendly characters, but rules_text and runtime swap a friendly with an enemy: data/description mismatch.
- TRP-003 seed trigger says on_attack while runtime maps it to on_attack_direct.
- TRP-004 seed says summon; runtime also applies to fusion. Lock duration needs verification.
- Other trap resolutions are hardcoded; text/runtime differences need targeted tests.

## 4. Priority Test Matrix
1. Every seeded character effect: parsed or rejected, with reason.
2. once_per_turn and once_per_game scope.
3. on_attack ordering: before damage, after damage, destruction, target condition.
4. turn_start/turn_end ordering with traps and character effects.
5. passive aura recalculation and field changes.
6. combo trigger behavior and field requirement.
7. summon trap behavior for normal summon and fusion; lock duration.
8. evolution cancellation: rollback, Evolution card loss, sacrifice rollback.
9. fusion: component effects, bonuses, death/graveyard, slot occupancy.
10. hand-full behavior for draw, return-to-hand, graveyard recovery.
11. poison timing, refresh/stacking, duration.
12. element multiplier coverage and asymmetric matchup expectations.

## 5. Proposals — No Changes Applied
- P0: Resolve description/runtime mismatches before competitive balance testing: SPL-003, SPL-004, SPL-007; TRP-003 trigger label; TRP-004 fusion wording; evolution cancellation.
- P1: Build test coverage and a capability table marking each seeded effect Supported / Unsupported / Partial / Hardcoded / Unverified.
- P1: Collect match telemetry: draw advantage, spells cast, traps fired, evolution/fusion frequency, unit damage, LP damage, active turns, and win rate by card/element.
- P2: Reassess summon-draw effects, control spells, and once-per-game traps using telemetry. If needed, adjust conditions, costs, targets, durations, or usage limits only.
- P2: Clarify element matrix ownership and intended symmetry; do not change multipliers without owner approval.

## 6. Owner Decisions Needed
1. Should unsupported combo effects be rejected by CMS validation or retained as draft-only warnings?
2. Are SPL-003 and SPL-004 intended to last until end of turn or until target leaves field?
3. For SPL-007, is the intended mechanic cross-side swapping (text/runtime) or friendly-side swapping (effect metadata)?
4. Should TRP-004 apply to Fusion as well as summon, and what lock duration is intended?
5. Should poison refresh, stack, or overwrite if reapplied?
6. Is the current element matrix intentional despite asymmetry?

## 7. Safety / Change Control
- No HP or ATK values changed or proposed for change.
- No card data, engine code, CMS, database, deployment, or main branch changes.
- This report is an audit artifact only; balance adjustments require separate owner approval.