# Card Balance Review V2

> **PROPOSED / NOT APPROVED. AUDIT ONLY.** HP and ATK are not changed anywhere. No card data was touched. This document re-checks the V1 proposals in `docs/card-balance/` against the engine rules verified in `ENGINE_RULE_AUDIT.md`.
> **Everything numeric here is a Theoretical Estimate** from a heuristic model (`scripts/card-balance-model.ts`: power = effective HP x effective ATK x (1 + effect bonus), tier relative to the mean of the same level). **There is no playtest data** (Production `pvp_matches` was empty when checked). A tier is **not** a win rate.

## 1. Engine facts that matter for balance (re-verified)

1. **LP = 100** (confirmed by the owner and by `game.ts:12`). A direct attack deals full ATK and ignores DEF and elements, and is possible **only when the enemy has no units**. So ATK 35-40 needs 3 hits; board presence is what protects LP. DEF therefore only matters in unit-vs-unit combat and counter-attacks.
2. **DEF is subtracted before the element multiplier**: `floor(max(1, ATK - DEF) x mult)`. Against a x1.5 attacker, 1 point of DEF saves 1.5 damage; against x0.75 it saves 0.75. DEF is worth more where elements are unfavourable.
3. **DEF is currently 0 on every character**, so any DEF > 0 is a new dimension: damage floor stays 1.
4. **Fusion** adds DEF: `floor(top.def x 100 %) + floor(bottom.def x 50 %) + pair bonus (max over rows)`. A fused BACKJI(3)+NONG(0) would have DEF 3.
5. **Evolution replaces the unit's base DEF with the new form's DEF** (`bonusDef` from spells carries over; base `def` comes from the new card, `game.ts:301`). A form with lower DEF than its Lv15 is a **regression**. (New finding, see 3.)
6. LP-per-room is **not implemented** (E-1). If the owner adds it, every number here must be re-checked at the new LP (direct-hit math changes most).
7. Spells/traps are fixed by card ID; their numbers cannot be rebalanced from data.

## 2. Verdict on each V1 proposal group

| V1 proposal | Verdict | Why (engine-grounded) |
|---|---|---|
| Summon/attack-bonus trims on the S-tier Lv15 (PIKACHU/CUTIE damage 10->5; DNMAN/LINLADA/MELON +10->+5; SMILE heal 10->5) | **KEEP, low impact** | Effects are expressible with existing wordings (re-validated with `parseEffect`). They stay S (1.35-1.45x). The remaining gap comes from the locked HP/ATK; only an HP/ATK review can close it. Chip damage hits units, never LP, so a 10 -> 5 trim matters mainly for finishing weak units. |
| MON-015 draw -> loot (discard 1 to draw 1) | **KEEP** | Removes a free card; the cost is supported. Side effect: the discarded card reaches the graveyard, which triggers LEON/OUFILLING `to_graveyard` and TRP-010 and is revivable by SPL-006 (minor). Empty-hand case: the cost cannot be paid so no draw (matches `runEffects`). |
| BABY-015 DEF 5 + heal 20->30 | **KEEP, watch loop** | Heal 30 equals SPL-002. SPL-006 + re-summon or TRP-009 bounce re-fires it (per-instance limit) but summons are limited to 1 per turn. |
| WENDYWENDIE-015 DEF 5 + unconditional draw on attack (V1) | **MODIFY / owner decision** | The draw would fire on every attack including suicidal ones (a 10-ATK unit attacking into a board takes a counter-attack but still draws): a repeatable card engine on a 95-HP body. Option A (V1): keep, once per turn. Option B (safer): `on_attack` loot with the supported cost (discard 1 draw 1, once per turn) - selection only, stays weak. Needs playtest; recommend B until data exists. |
| TEE-015 temporary ally ATK +15, DEF 4 | **KEEP** | Temporary buff, no stacking risk beyond SPL-004 (see ENGINE-PROP-02). |
| SATOSHI-015 heal 15 + DEF 5; LALAPING-015 DEF 4 | **KEEP** | Heal 15/turn can offset a 15-ATK attacker; stall decks need a test. |
| Small DEF (2-4) on the C/D Lv15 (LORDNAM, LUCKY, TAN, THAI32, BACKJI, NORMAN, LEON, OUFILLING, ZEESKY, 1GOKU, FOLLOW-YOU-015, BADGUY-015...) | **KEEP, but see 3** | At average incoming ATK 33, DEF 3 is about -9 % damage taken. Real effect depends on element (point 2). |
| FOLLOW-YOU-040 attack bonus +10 -> +20 | **KEEP** | Brings it level with the other Lv40 attackers; the dead `combo` row stays an owner decision. |
| BADGUY-040 (+25 -> +20, death damage 20 -> 15), 1GOKU-040 (death damage 20 -> 10), SATOSHI-040 (heals 20 -> 15, 30 -> 20) | **KEEP** | Trims only the secondary values. |
| LALAPING-040 / TEE-040 DEF 6 | **KEEP** | OK, and they already satisfy the chain rule below. |
| Spells/traps unchanged; ENGINE-PROP-01..05 | **KEEP all five** | Re-verified (SPL-007 same-turn attack, SPL-003/004 stacking, spell volume, combo, text mismatch). |

## 3. NEW in V2: DEF regression on evolution (6 of 7 chains)

V1 gave DEF to the Lv15 form but left most Lv40/70 forms at 0, so evolving **removes** the DEF (point 5). Proposed rule: **DEF must be non-decreasing along a chain.** Theoretical results (proposed V1 effect values assumed):

| Chain | V1 DEF (15 / 40 / 70) | **V2 DEF (15 / 40 / 70)** | Theoretical tier of the changed form |
|---|---|---|---|
| 1goku | 3 / 0 | **3 / 3** | 1GOKU-040: 1.17x (A) |
| badguy | 4 / 0 | **1 / 1** | BADGUY-015 about 0.75x (C/D border); BADGUY-040 1.24x (A). A higher DEF would push BADGUY-040 back to S (DEF 4 -> 1.31x), so the Lv15 DEF is **lowered from 4 to 1** instead |
| follow-you | 2 / 0 / 0 | **2 / 2 / 2** | -040 0.84x (C); -070 1.03x (B) |
| lalaping | 4 / 6 / 0 | **4 / 6 / 6** | -070 1.07x (B) |
| norman | 3 / 0 | **3 / 3** | NORMAN-040 0.97x (B) |
| satoshi | 5 / 0 | **5 / 5** | SATOSHI-040 1.21x (A, lowest A): acceptable as the payoff for a 70-ATK healer that costs an evolution |
| tee | 4 / 6 | 4 / 6 (unchanged) | - |

The V1 changes that V2 modifies: BADGUY-015 DEF 4 -> 1; new DEF on 1GOKU-040 (3), BADGUY-040 (1), NORMAN-040 (3), SATOSHI-040 (5), FOLLOW-YOU-040 (2), FOLLOW-YOU-070 (2), LALAPING-070 (6). Everything else in V1 stands. HP/ATK still unchanged.

## 4. Things V1 under-weighted

- **Direct-attack race at LP 100** (E-9): after a board wipe, one Lv15 with ATK 40 deals 40 % of LP. Cards that remove units (SPL-001, TRP-007, chip effects) and the steal in SPL-007 are worth far more than their raw numbers. SPL-007 same-turn attack remains the top fix.
- **Draw-on-summon family** (MON/PK/CHAEM/FOLLOW-YOU-015) is tied to the one-summon-per-turn limit; the real cap is the 5-card hand.
- **Healers** share one niche; with `once_per_turn` heals and TRP-008 (survive at 1 HP) a stall is possible, test it (TEST_PLAN E).
- **Counter-attack** applies the same DEF formula, so DEF helps the defender twice (less damage taken, and the attacker still takes its own counter). Not modelled.
- **Elements:** 8 of the 10 used elements have 3-7 characters; neutral has 2 and earth has 1 (MELON), so "strong vs earth" has very few targets. No change proposed.

## 5. What is still unknown

- Win rates, play frequency, deck compositions (no data).
- The intended LP once rooms can set it (E-1).
- Whether the owner wants HP/ATK touched in a later round (the only way to fix the S-tier body stats).
