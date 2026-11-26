# Bot AI + Combo/Defense Simulation — Results (read-only)

- Date: 2026-11-26
- Branch: `audit/story-bot-player-feedback-2026-11-26` (this report is the only file added)
- Base SHA of the engine code simulated: `7bb9f9a` (= production `main` head at the time; audit branch base commit `103c82d` only adds docs)
- Handoff followed: `docs/balance/BOT_AI_COMBO_SIMULATION_HANDOFF_2026-11-26.md`
- **No game source, Bot, card data, Story seed, rules, tests or DB were changed. No DB / production access. No merge, no deploy.**

## 1. Executive summary

1. **Bot weakness #1 (HIGH, confirmed): the Bot ignores the element multiplier** when scoring attacks. In S1 it attacks the *water* target (×0.75 for a fire attacker) instead of the *nature* target (×1.5): it deals 26 instead of 52 damage and takes 34 instead of 17 counter-damage. In S4 it attacks into a ×1.5 counter and loses its own unit while it predicted survival.
2. **Bot weakness #2 (HIGH, confirmed): the Bot never focus-fires.** It scores each attack in isolation (`d − counter + 1`), so with several attackers against one tanky unit it passes the whole battle phase (S2, S6b). In S6b the greedy Bot made **0 attacks and lost by deck-out at turn 16**, while the legal best sequence (4 attacks) wins at turn 4.
3. **Bot weakness #3 (MEDIUM, confirmed): lethal choice picks the lowest-DEF victim, not the most valuable one** (S3: kills a 10-HP Lv15 instead of the Lv70 that is at 20 HP).
4. **Bot never casts Signature spells** (0 casts in 1,200 simulated games; Signature cards are not in the Bot decks in this harness, see limits) and **attack order is greedy** (S5, small gap).
5. **Bot-vs-Bot batch (N=400 per mode):** 52.3–53.8 % first-player win, avg 28 turns, ~10 % of games end by **deck-out** (draw-out), not LP. Story mode does not move these beyond noise (±2.5 pp at N=400).
6. **Combo ceiling:** best single hit in **Set A (base only)** = **120 damage** (FOLLOW-YOU-070 + SPL-004). That is above the 100-LP pool, so **a Lv70 can one-shot the player from full LP when the enemy field is empty** (direct attack needs an empty enemy field; any one enemy unit blocks all direct attacks). Without a Lv70 the best base-only hit is 90 (1GOKU-040 + SPL-004).
7. **Set B (draft Signature)** adds one Lv40 route to ≥100 (1GOKU-040 + SPL-004 + SPL-011 = 100 vs 0-DEF) and, **if element advantage ×1.5 applies, 15 characters reach ≥100 in one hit, up to 180**. Set B is draft in the seed; repo status ≠ production availability.
8. **Story is a small contributor**: max +10 ATK on any single unit; on the best 7-unit field Story adds 95 of 705 total ATK (13 %). Capping Story at +10 per unit would remove 25 of those 95; the top-end burst comes from Lv70 base ATK and SPL-004, not Story.
9. **Defense:** against a 100-ATK burst on a lone defender, *no defense* survives 22.9 % of base characters; **cancel-type traps (TRP-001, TRP-009) survive 100 %**; reflect (TRP-002) and DEF +15 spell (SPL-003) prevent ~0; Signature DEF/ATK-reduce traps prevent only 2–10 damage. Defensive value is concentrated in two cancel traps; stat-based defenses cannot answer a ≥100 burst.
10. **No critical issue found** (nothing that corrupts state, crashes, or breaks server authority). The one-shot-from-empty-field case is documented as a balance finding, not a hotfix.

## 2. Environment, method and limits

| Item | Value |
|---|---|
| Repo / branch | `ToonVrcz/VAreCrazy-Card-Battles-` / `audit/story-bot-player-feedback-2026-11-26` |
| Engine base | `7bb9f9a` (unchanged on disk; `git status` clean before commit except this file) |
| Runner | `npx tsx` importing the **real** `src/engine/game.ts` (`createGame`, `act`, `legalActions`, `refreshAuras`), `bot.ts` (`botPick`), `cards.ts`, seed JSON |
| Story data | `db/seed/story-links.json` (29 rows as seeded) |
| Harness location | outside the repo (`/tmp/sim/*.ts`), full source in Appendix B |
| Tests (baseline, unmodified branch) | `npx vitest run`: **41 files, 562 tests, all passed** (377 s) on the unmodified audit branch, run before any report file was added |

**Set definitions.** **Set A** = base cards from `seedCards()` (48 characters, 10 base spells, 10 base traps, Evolution, Fusion) — treated as available. **Set B** = the 39 Signature cards in `db/seed/signature-cards.json` (status `draft` in the seed). *Repo seed status is not production availability*; production was last read (2026-11-25) with all 109 cards published, but this run did not touch production.

**Rules as simulated:** LP 100, hand max 10 (engine value), 7 field + 5 back slots, damage `max(1, floor(max(1, ATK−DEF) × elementMultiplier))`, counter-attack after the hit, direct attack only if the enemy has no characters, a unit cannot attack the turn it is summoned, first player cannot attack on turn 1.

**Limitations (read these before using the numbers):**
- Bot scenarios are *constructed* positions with stated stats; "best legal choice" is a depth-limited DFS over legal actions using the evaluation function in Appendix B (`evalState`: unit value = ATK + HP/2 + level bonus, plus 3× LP differential). A different evaluation could rank some lines differently; gaps are indicative, the legal-action results (damage/counter/destroyed) are exact engine output.
- The player's actual "three-card combo" was not provided, so none is reproduced. All combos below are **simulated examples**, labelled as such, found by exhaustive search over card pools.
- Combo damage is measured against a **0-DEF, 9999-HP dummy** unless stated. Real defenders have DEF 0–10; subtract that per hit.
- `dmg` can exceed `atk` for some characters (e.g. 1GOKU-040: 75 damage at 55 ATK). The residual is attributed to the attacker's own attack-time effect/riders; I did not decompose it per card (not verified individually).
- Defense battery uses a single 500-HP neutral attacker and a lone defender; it measures the trap/spell effect in isolation, not full-board play. Signature defensive cards that need a specific linked chain were tested only on that chain (defender count shown).
- Bot-vs-Bot decks come from a port of the browser random-deck builder (`deck()` in `public/play.html`), base cards only. 400 games/mode: ±2.5 pp standard error on win rates.
- Hill-climb for best field is a local search, not a proof of optimum (results are lower bounds on the maximum).
- Not tested: online-room timers, trap-vs-trap chains, Evolution *card* economy, any production data.

## 3. Bot scenarios — current Bot choice vs best legal choice

All rows use the real engine; "Bot" = `botPick` called repeatedly until it ends the turn; "Best" = DFS oracle over legal actions (depth ≤ 4, evaluation in Appendix B). Damage/counter numbers are exact engine results for the legal single attacks.

| # | Position (stats in sim) | Legal single attacks (engine output) | Bot chose | Best legal | Eval gap | Verdict |
|---|---|---|---|---|---|---|
| S1 element ranking | Bot fire L15 (ATK 40) vs three identical enemies: water / neutral / nature | →water: 26 dmg, counter 34 · →neutral: 35 dmg, counter 23 · →nature: 52 dmg, counter 17 | →water (slot 0) | →nature | 21.5 | **Bot error**: ignores ×0.75 / ×1.5 |
| S2 chip then kill | 2 Bot L15 (ATK 40) vs SATOSHI-040 at 50/130 HP | each hit 35 dmg, counter 68 (Bot survives one) | **no attack** | both attack (35 + 35 ≥ 50 kills) | 86 | **Bot error**: no focus-fire |
| S3 evolved vs weak | 1 Bot unit vs WEAK L15 (HP 10) and FOLLOW-YOU-070 (HP 20/300) — both lethal | →WEAK kills (10), →FOLLOW-YOU-070 kills (20) | →WEAK | →FOLLOW-YOU-070 | 155 | **Bot error**: picks lowest-DEF victim, ignores value |
| S4 ×1.5 counter | Bot nature L15 (ATK 50, HP 60) vs fire L15 (ATK 42, HP 80) | →E1: 36 dmg, counter **60** (nature takes ×1.5) → Bot unit destroyed | attacks | pass (no attack) | 62 | **Bot error**: predicts survival with 40 counter |
| S5 attack order | ATK 50 and ATK 25 vs E1 (HP 60) and E2 (HP 22) | s0→E2 kills (22); s0→E1 50 dmg; s1→E2 kills | s0→E2 (kill) only | s0→E1 then s1→E1 | 15 | Minor: greedy ordering, one attack unused |
| S6b pass despite favourable | 4 Bot L15 (ATK 40) vs lone SATOSHI-040 (HP 130, DEF 5, ATK 70) | each hit 35, counter 68; 4 hits kill (140 ≥ 130) | **no attack** | 4 attacks | 58 | **Bot error**: Bot passes forever, see deck-out below |
| S8 summoned this turn | Bot unit with `summonedTurn == turn` | no legal attack | no attack | no attack | 0 | Correct (engine legality respected) |

**Deck-out loop for S6b (engine-run to the end):** greedy Bot: 0 attacks, **loses at turn 16 by deck-out** (`ผู้เล่น 1 จั่วไม่ได้ แพ้`) while the enemy heals each turn; oracle sequence: 7 Bot attacks, **wins at turn 4** (LP 0).

### 3.1 Bot-vs-Bot batch (400 games per mode, base cards only)

| Metric | Story current | Story off | One-per-source Story |
|---|---|---|---|
| Games finished | 400 | 400 | 400 |
| First-player win % | 53.8 | 52.3 | 50.8 |
| Avg turns | 28.2 | 28.4 | 27.8 |
| Avg attacks / game | 39.9 | 40.5 | 39.3 |
| Win by LP / deck-out | 357 / 43 (10.8 %) | 360 / 40 (10.0 %) | 362 / 38 (9.5 %) |
| Decisions that were "pass" | 10,870 / 26,842 | 10,953 / 27,160 | 10,717 / 26,432 |
| Passes while a favourable attack existed | 220 (2.0 % of passes) | 225 (2.1 %) | 225 (2.1 %) |
| …of which "kill with no loss" | 219 | 224 | 224 |
| …of which a lethal-on-player | 0 | 0 | 0 |
| Bot units lost / of which no kill (unfavourable trade) | 271 / 270 | 271 / 267 | 261 / 259 |
| Evolutions performed | 556 | 553 | 535 |
| Signature casts | 0 | 0 | 0 |
| Deck-out games with a favourable pass in the last 12 turns | 12 | 8 | 9 |

Reading: (a) ~10 % of Bot-vs-Bot games are decided by deck-out, a symptom of passing (S6b pattern). (b) Almost every Bot unit lost (270 of 271) died **without destroying its target**, consistent with S4 (counter and element not modelled). (c) Story current vs off vs one-per-source changes first-player win by ≤3 pp, inside the ±2.5 pp noise at N=400: **no evidence from this batch that Story stacking is a balance problem for Bot play.** (d) Signature casts are 0 here because Signature cards are not in the simulated decks; the Bot source also only casts whitelisted `SPL-001..010` (see `src/engine/bot.ts` lines 29–35), so Signature spells would never be cast even if owned.

## 4. Combo scenarios (Set A = base only, Set B = + draft Signature)

Method: for every character, place it with the best Story partners (≤6 on the field), play the best legal spells/traps from the stated pool through the real `legalActions`/`act`, then attack a dummy (0 DEF). Damage = HP the dummy lost. Examples below are **simulated, not the player's combo**.

### 4.1 Best single hit per variant (0-DEF target)

| Variant | Top results (damage, effective ATK at hit) |
|---|---|
| A0 base only | FOLLOW-YOU-070 **105** (105) · LALAPING-070 80 (80) · 1GOKU-040 75 (55) · FOLLOW-YOU-040 70 (50) · NORMAN-040 70 (50) · SATOSHI-040 70 (70) |
| A1 + Story (positive ATK rows) | FOLLOW-YOU-070 105 · LALAPING-070 80 · 1GOKU-040 75 · BADGUY-040 70 · FOLLOW-YOU-040 70 · NORMAN-040 70 |
| A2 + Story + SPL-004 (+15 ATK) | FOLLOW-YOU-070 **120** (120) · LALAPING-070 95 · 1GOKU-040 90 (70) · BADGUY-040 85 · FOLLOW-YOU-040 85 · NORMAN-040 85 |
| B1 A2 + Signature ATK spells/traps (3 copies each) | 1GOKU-040 **120** (100; SPL-004 + 3×SPL-011) · FOLLOW-YOU-070 120 · TEE-040 100 (SPL-004 + 3×SPL-032) · LALAPING-070 95 · BOBO-015 90 (50; SPL-004 + 3×SPL-014) · DNMAN-015 90 (55; SPL-004 + 3×SPL-017) |
| B2 B1 + element advantage ×1.5 | 1GOKU-040 **180** · FOLLOW-YOU-070 180 · TEE-040 150 · LALAPING-070 142 · BOBO-015 135 · DNMAN-015 135 |

Reaching ≥100 in a single hit (0-DEF target):
- Set A, no element advantage: only FOLLOW-YOU-070 (Lv70): 105 base, 120 with SPL-004.
- Set A+B, no element advantage: FOLLOW-YOU-070 (120), **1GOKU-040 (Lv40, 120)** and TEE-040 (100).
- With element advantage ×1.5 (Set A+B): 15 characters reach ≥100 (1GOKU-015 Lv15: 112; BOBO-015: 135; DNMAN-015: 135; Lv40/Lv70 up to 180).

Caveat on B1/B2: they assume **3 copies** of the same Signature spell in hand at the same time and enough hand room; the Signature ops stack as timed buffs. The 3-copy deck rule is allowed (max 3), but drawing all three plus SPL-004 in one turn is a low-probability event — the table is the **ceiling**, not an expected value.

### 4.2 Best two/three-card combos (attacker + up to 2 supports; exhaustive over the pools)

| Set | Combos evaluated | Top | ≥100 and not Lv70 |
|---|---|---|---|
| A | 136 | FOLLOW-YOU-070 + SPL-004 **120** · FOLLOW-YOU-070 + GOD-WA-015 + SPL-004 115 · FOLLOW-YOU-070 + GOD-WA-015 100 · LALAPING-070 + THOMAS-015 + SPL-004 95 · 1GOKU-040 + SPL-004 90 | **0** |
| A+B | 171 | same as A, plus **1GOKU-040 + SPL-004 + SPL-011 = 100** (Lv40) | **1** |

Calculation of the Lv40 route (exact engine run): 1GOKU-040 base ATK 55 → SPL-004 +15 = 70 → SPL-011 (+10 until end of turn) ×3 = 100 effective ATK → 100 damage on a 0-DEF target (plus the character's own attack-time rider as noted in §2, 120 in the B1 row above).

### 4.3 Direct attack on the player (empty enemy field), Set A, with SPL-004

| Attacker | Level | Damage to LP |
|---|---|---|
| FOLLOW-YOU-070 | 70 | **100 (lethal from 100 LP)** |
| LALAPING-070 | 70 | 95 |
| 1GOKU-040 | 40 | 90 |
| BADGUY-040 / FOLLOW-YOU-040 / NORMAN-040 / SATOSHI-040 | 40 | 85 |
| BOBO-015 | 15 | 60 |

Engine check: with **one** enemy character on the field the engine offers **no** direct attack (`directBlockedByOneUnit = true`). So a Lv70 one-shot requires an empty enemy field *and* the attacker not summoned this turn; the attacker must have been evolved earlier (Lv70 needs Lv15 → Lv40 → Lv70 across at least two evolution turns, 1 per turn).

### 4.4 Whole-board burst (hill-climbed field, empty enemy field; total effective ATK, Story on)

| Field | Best found | Total ATK |
|---|---|---|
| 3 units, any level | 3× FOLLOW-YOU-070 | 345 |
| 3 units, no Lv70 | 3× SATOSHI-040 | 210 |
| 3 units, Lv15 only | 3× DNMAN-015 | 120 |
| 7 units, any level | 3× FOLLOW-YOU-070 + 3× LALAPING-070 + BADGUY-040 | 705 |
| 7 units, no Lv70 | NORMAN-040, 3× BADGUY-040, 3× SATOSHI-040 | 470 |
| 7 units, Lv15 only | 3× DNMAN-015, 3× JAOJAY-015, MON-015 | 280 |

Total ATK is an upper bound for LP damage only if the enemy field is empty and the unit can attack (not summoned this turn). Level HP: Lv15 60–100, Lv40 130–170, Lv70 300–310 (so a single 120 hit never kills a Lv40/Lv70 in one blow, but it kills any Lv15 outright).

## 5. Defensive-response comparison

Setup: lone defender (each base character that the option applies to), one 500-HP neutral attacker with ATK X attacks it; the engine resolves traps/spells. "Survive %" = share of defenders left alive; "prevented" = average damage avoided versus no defense (HP).

| Option | Burst 70 survive / prevented | Burst 100 survive / prevented | Burst 115 survive / prevented | Defenders |
|---|---|---|---|---|
| None | 95.8 % / 0 | 22.9 % / 0 | 18.8 % / 0 | 48 |
| TRP-001 cancel attack | 100 % / 67.1 | **100 % / 87.2** | 100 % / 90.2 | 48 |
| TRP-009 return attacker to hand | 100 % / 67.1 | **100 % / 87.2** | 100 % / 90.2 | 48 |
| TRP-002 reflect 50 % | 95.8 % / 0 | 22.9 % / 0 | 18.8 % / 0 | 48 |
| TRP-008 survive at 1 HP | 100 % / 0 | **100 % / 0.8** (survives at 1 HP only) | 100 % / 0.8 | 48 |
| SPL-003 DEF +15 | 95.8 % / 0 | 22.9 % / 0 | 18.8 % / 0 | 48 |
| TRP-013 (Signature, reduce battle damage 10) | 97.9 % / 9.7 | 52.1 % / 3.7 | 18.8 % / 2.0 | 48 |
| TRP-012 (Signature, −10 attacker ATK) | 100 % / 10 | 100 % / 8 | 50 % / 5 | 2 |
| TRP-022 (Signature, −5 attacker ATK) | 100 % / 5 | 100 % / 2 | 0 % / 0 | 1 |
| SPL-019 / SPL-027 (Signature DEF through opp. turn) | 100 % / 5 | 0 % / 0 | 0 % / 0 | 1 each |
| TRP-011 / TRP-015 / TRP-018 (Signature, other) | 0–100 % / 0 | 0 % / 0 | 0 % / 0 | 1 each |

Findings from the table:
- Only **cancel/return** traps (TRP-001, TRP-009) stop a 100–115 burst; both are already in the base set and are **one-shot answers that are fully negated by a single removal/trap-disable** (not tested here).
- **TRP-008** keeps the unit alive at 1 HP but prevents ~0 damage in expectation; it only buys one extra turn.
- **Reflect (TRP-002)** and **DEF +15 (SPL-003)** do not change survival at all against bursts ≥70 because the burst ATK dominates DEF 0–10 and 50 % reflect hits the attacker, not the defender's HP.
- Signature defensive traps/spells are **linked to one chain**, apply flat −5/−10 or +DEF, and do not change outcomes above ~70 ATK.
- **Healing is too small to matter against these bursts:** SPL-002 = 30; Signature heals 10–20 (SPL-012 15, TRP-014 10, SPL-020 20, TRP-020 10, SPL-029 15, TRP-023 10); character turn-end heals 5–10 (on_summon 30 for BABY-015, on_evolve 50 for LALAPING-070). A one-turn burst of 100–180 cannot be healed back.

## 6. Story stacking sensitivity

Method: hill-climb the best 7-unit field by total ATK with Story off, current (uncapped), and capped Story aura per unit (+10/+20/+30). Results are from the real `refreshAuras`.

| Field pool | Story off | Current (uncapped) | Cap +10/unit | Cap +20/unit | Cap +30/unit |
|---|---|---|---|---|---|
| any level | 610 | 705 | 680 | 705 | 705 |
| no Lv70 | 445 | 470 | 470 | 470 | 470 |
| Lv15 only | 280 | 280 | 280 | 280 | 280 |

- Max Story ATK on **any single unit is +10** (BABY-015 with its best 6 partners). Story contributes 95 of 705 (13.5 %) on the best 7-unit board, 25 of 470 (5.3 %) without Lv70, and 0 on a Lv15-only board.
- A per-unit cap at +10 would change nothing today except −25 on the Lv70 board; a cap at +20 or higher is inert with the current 29 rows. Story is therefore **not** what makes the one-shot case possible; Lv70 base ATK (105) and SPL-004 (+15) are.
- Risk grows with *new* Story rows: nothing in the engine caps Story or limits it per source (batch above shows `onepersource` lowers average game length by 0.4 turns and first-player advantage by 3 pp, within noise).
- Story is directional and multi-modifier; negative modifiers were not stress-tested for floor behaviour here (effective ATK is clamped to ≥0 in the engine).

## 7. Findings ranked by severity / confidence

| # | Finding | Severity | Confidence | Evidence |
|---|---|---|---|---|
| F1 | Bot ignores element multiplier in attack choice and counter prediction | High | Confirmed | S1, S4, batch (270/271 Bot losses without kill) |
| F2 | Bot never focus-fires; passes whenever a single hit is non-lethal and counter ≥ damage | High | Confirmed | S2, S6b, deck-out run (turn 16 loss vs turn-4 win), 219/220 favourable passes |
| F3 | Bot lethal selection picks the lowest-DEF victim, not the best target | Medium | Confirmed | S3 |
| F4 | A Lv70 (105 ATK) + SPL-004 deals 120 ≥ LP 100 to the player when the enemy field is empty | High (balance) | Confirmed in engine, probability not measured | §4.1, §4.3 |
| F5 | Draft Signature stacks can raise a Lv40 to 100–120 ATK and make ≥100 hits common *if* element advantage ×1.5 applies (15 characters) | Medium–High (balance, depends on Set B release and 3-copy draws) | Confirmed as ceiling, expected frequency unknown | §4.1 |
| F6 | Defensive tools: only cancel/return traps answer ≥100 burst; stat-based defense, reflect and heals are below the burst scale | Medium | Confirmed | §5 |
| F7 | Bot never casts Signature spells and plays only whitelisted base spells | Medium (Set B once released) | Confirmed from source | `bot.ts` lines 29–35 |
| F8 | ~10 % of Bot-vs-Bot games end by deck-out | Low–Medium | Confirmed | §3.1 |
| F9 | Story contributes ≤ +10 per unit and 13 % of the best board | Low | Confirmed | §6 |
| F10 | Evaluation used by the oracle is a heuristic; gap values are indicative | Info | — | §2 limits |

No finding corrupts state, crashes or breaks server authority; **no critical issue → no hotfix and no extra notification beyond this report.**

## 8. Proposed fixes (NOT implemented; for Toon's approval)

### 8.1 Bot logic
| Proposal | Benefit | Trade-offs | Risk | Tests needed |
|---|---|---|---|---|
| P1 Include element multiplier in `d` and counter `c` (reuse engine hit formula) | Fixes S1/S4, fewer lost units | Bot becomes slightly stronger | Low | Scenario tests S1, S4; batch re-run; bundle drift tests (`public/engine.js`, edge bundle) |
| P2 One-ply lookahead / focus-fire: when the sum of safe hits on one target ≥ HP, attack with the cheapest sequence | Fixes S2/S6b, removes deck-out stalls | More compute per move (still tiny); Bot noticeably harder | Medium (behaviour change for players) | S2, S6b, deck-out rate < 3 %, determinism tests |
| P3 Lethal target ordering by value (level/ATK/HP) | Fixes S3 | None notable | Low | S3 |
| P4 Cast whitelisted Signature spells (linked-unit present) | Bot uses Set B cards if given | Needs per-op rules or generic "cast if buff op and linked unit on field" | Medium | New cast-legality tests |
| P5 Add a difficulty flag so P1–P4 apply only above "normal" | Keeps casual mode forgiving | Extra config | Low | Config tests |

### 8.2 Balance / effect / DEF (no change to base HP or ATK)
| Proposal | Benefit | Trade-offs | Risk | Tests needed |
|---|---|---|---|---|
| B1 Cap total ATK buff stacked from spells/Story per unit per turn (e.g. +30) | Stops 3×SPL-011-type stacks (B1 row) | Reduces combo identity | Medium | Combo suite with cap, Story seed tests |
| B2 Make SPL-004 not stack with Signature ATK spells in the same turn, or reduce SPL-004 to +10 | Takes Lv70 one-shot below 100 (105+10 = 115 still ≥100: needs the next item too) | Nerfs a base card | Medium | Combo re-run |
| B3 Limit direct attacks to units that did not receive a spell buff this turn, or cap direct-attack damage at e.g. 60 % of LP | Removes the one-shot from full LP | New rule to explain | Medium–High (rule change) | Engine legality + damage tests, rules table entry |
| B4 DEF/damage-reduction effects that scale (e.g. DEF +15 → also −X % damage) or a defensive trap that works at ≥100 ATK without cancelling | Gives non-cancel defense relevance | Design effort; could slow games | Medium | Defense battery re-run |
| B5 Increase Lv70 HP floor/DEF gap *only if* Toon decides (not base HP/ATK) | — | Excluded by constraint | — | — |
| B6 Treat element advantage ×1.5 as the multiplier on base ATK only (not on buffed ATK) | Reduces the 135–180 ceilings | Rule change | Medium | Hit-formula tests |

### 8.3 Instrumentation / combat log
| Proposal | Benefit | Trade-offs | Risk | Tests needed |
|---|---|---|---|---|
| I1 Log per attack: effective ATK/DEF, element multiplier, buff sources (Story/spell/trap) and final damage | Lets the player see why a hit was 120 | Larger logs | Low | Log-format tests; engine bundle drift |
| I2 Log "why Bot passed" (debug only) and a turn-end summary for Bot decisions | Easier Bot tuning | Debug noise | Low | None in production path |
| I3 Record burst events (damage ≥ 60 % LP in one turn) into `pvp_matches` stats | Real data to replace this simulation | Small DB write | Low | Migration + stats tests |

## 9. Changed files (this report only)

- **Added:** `docs/balance/BOT_AI_COMBO_SIMULATION_RESULTS_2026-11-26.md` (this file)
- **Changed:** none
- Simulation scripts live outside the repo (`/tmp/sim`); full sources are embedded in Appendix B so the results can be reproduced.

## 10. Statement of actions

No DB read or write, no Supabase or Vercel call for this task, no production access, no migration, no merge to `main`, no push to `main`, no deploy. No game source, Bot, card data, Story seed, rules table or tests were edited. Only this report file was committed to the audit branch. Work stops here until Toon approves any code change.

## Appendix A — Reproduce

```bash
git checkout audit/story-bot-player-feedback-2026-11-26        # base engine = 7bb9f9a
mkdir -p /tmp/sim   # place lib.ts, botA.ts, botB.ts, comboB.ts, storycap.ts from Appendix B
npx tsx /tmp/sim/botA.ts                      # Bot scenarios + deck-out loop -> /tmp/sim/botA.json
N=400 STORY=current      npx tsx /tmp/sim/botB.ts    # Bot-vs-Bot batch -> /tmp/sim/botB-current.json
N=400 STORY=off          npx tsx /tmp/sim/botB.ts
N=400 STORY=onepersource npx tsx /tmp/sim/botB.ts
npx tsx /tmp/sim/comboB.ts                    # combos, direct LP, fields, defense battery -> /tmp/sim/comboB.json
npx tsx /tmp/sim/storycap.ts                  # Story cap sensitivity -> /tmp/sim/storycap.json
npx vitest run                                # baseline tests (unmodified branch)
```

Absolute paths inside the scripts point at `/home/claude/varecrazy-card-battles-/`; adjust if the checkout lives elsewhere.

## Appendix B — Harness sources


### `lib.ts`

```ts
// Shared helpers for the read-only Bot / combo simulation. Imports the REAL engine from the repo; nothing in the repo is modified.
import { readFileSync } from 'node:fs';
import { createGame, act, legalActions, refreshAuras, type CardDef, type Game, type StoryLink, type Unit, type Action } from '/home/claude/varecrazy-card-battles-/src/engine/game.ts';
import { seedCards } from '/home/claude/varecrazy-card-battles-/src/engine/cards.ts';
import { parseEffect } from '/home/claude/varecrazy-card-battles-/src/engine/effects.ts';
export { createGame, act, legalActions, refreshAuras };
export type { CardDef, Game, StoryLink, Unit, Action };
const R = (f: string) => JSON.parse(readFileSync('/home/claude/varecrazy-card-battles-/db/seed/' + f, 'utf8'));
export const STORY: StoryLink[] = R('story-links.json').map((l: any) => ({ a: l.a, b: l.b, name: l.name, mods: l.mods }));
export const PAIRS = R('fusion-pairs.json');
export const BASE: CardDef[] = seedCards();                                   // Set A: base cards (the 48 characters, Evolution, Fusion, 10 base spells, 10 base traps)
export const SIG: CardDef[] = R('signature-cards.json').map((c: any): CardDef => ({ id: c.character_id, name: c.name, type: c.card_type, level: null, chain: null, hp: null, atk: null, def: 0, element: null, support: c.support, effects: [] }));   // Set B: 39 Signature cards (draft in the seed file)
export const CHARS = BASE.filter(c => c.type === 'character');
export const byId = new Map([...BASE, ...SIG].map(c => [c.id, c]));
export const ch = (id: string, chain: string, o: Partial<CardDef> = {}): CardDef => ({ id, name: id, type: 'character', level: 15, chain, hp: 80, atk: 20, def: 2, element: 'neutral', ...o });
const filler = () => Array.from({ length: 30 }, (_, i) => ch('F' + i, 'f' + i));
export function mkGame(opts: { story?: StoryLink[]; seed?: number; deck0?: CardDef[]; deck1?: CardDef[]; interactive?: boolean } = {}): Game {
  const g = createGame([opts.deck0 ?? filler(), opts.deck1 ?? filler()], opts.seed ?? 1, 0, { storyLinks: opts.story ?? [], fusionPairs: PAIRS, interactive: opts.interactive ?? false });
  g.players[0].hand = []; g.players[1].hand = []; return g;
}
export function put(g: Game, side: 0 | 1, slot: number, c: CardDef, o: Partial<Unit> = {}): Unit {
  const u = { uid: ++g.uid, card: c, hp: c.hp!, maxHp: c.hp!, atk: c.atk!, def: c.def, bonusAtk: 0, bonusDef: 0, summonedTurn: 0, attacked: false, lockedUntil: 0, poison: 0, ...o } as Unit;
  g.players[side].field[slot] = u; return u;
}
export const effAtk = (u: Unit) => Math.max(0, u.atk + u.bonusAtk + (u.auraAtk ?? 0));
export const effDef = (u: Unit) => Math.max(0, u.def + u.bonusDef + (u.auraDef ?? 0));
export const battle = (g: Game) => { g.phase = 'battle'; g.turn = 2; g.active = 0; return g; };
export const units = (g: Game, s: 0 | 1) => g.players[s].field.filter((x): x is Unit => !!x);
export const value = (u: Unit) => effAtk(u) + u.hp / 2 + ((u.card.level ?? 15) - 15);      // evaluation heuristic used ONLY by the oracle (documented in the report)
export function evalState(g: Game, me: 0 | 1): number {
  if (g.winner === me) return 10000; if (g.winner === (1 - me)) return -10000;
  return units(g, me).reduce((s, u) => s + value(u), 0) - units(g, (1 - me) as 0 | 1).reduce((s, u) => s + value(u), 0) + 3 * (100 - g.players[1 - me].lp) - 3 * (100 - g.players[me].lp);
}
export { parseEffect };
```

### `botA.ts`

```ts
import { writeFileSync } from 'node:fs';
import { botPick } from '/home/claude/varecrazy-card-battles-/src/engine/bot.ts';
import { mkGame, put, battle, units, evalState, act, legalActions, ch, effAtk, effDef, CHARS, BASE, STORY, type Game, type Action, type CardDef } from './lib.ts';

const atkActs = (g: Game) => legalActions(g).filter(a => a.t === 'attack') as Extract<Action, { t: 'attack' }>[];
const desc = (g: Game, s: 0 | 1) => g.players[s].field.map((u, i) => u ? `s${i}:${u.card.id}(L${u.card.level} ${u.card.element} hp${u.hp}/${u.maxHp} atk${effAtk(u)} def${effDef(u)})` : null).filter(Boolean).join('; ');
function botTurn(g: Game) { const seq: string[] = []; let x = g, n = 0; while (x.winner === null && x.phase === 'battle' && n++ < 20) { const a = botPick(x); if (a.t === 'next') break; seq.push(JSON.stringify(a)); x = act(x, a); } return { g: x, seq }; }
function best(g: Game, depth: number): { score: number; seq: string[] } {
  let top = { score: evalState(g, 0), seq: [] as string[] };
  if (depth === 0 || g.winner !== null) return top;
  for (const a of atkActs(g)) { const x = act(g, a), r = best(x, depth - 1); if (r.score > top.score) top = { score: r.score, seq: [JSON.stringify(a), ...r.seq] }; }
  return top;
}
function one(g: Game, a: Extract<Action, { t: 'attack' }>) {
  const x = act(g, a), eb = a.to === 'player' ? null : g.players[1].field[a.to as number]!, ea = a.to === 'player' ? null : x.players[1].field[a.to as number], me = g.players[0].field[a.from]!, me2 = x.players[0].field[a.from];
  return { a: `s${a.from}->${a.to === 'player' ? 'LP' : 's' + a.to}`, enemyHpLost: eb ? eb.hp - (ea?.hp ?? 0) : null, enemyDestroyed: eb ? !ea : false, lpLost: g.players[1].lp - x.players[1].lp, counter: me.hp - (me2?.hp ?? 0), mineDestroyed: !me2, evalDelta: +(evalState(x, 0) - evalState(g, 0)).toFixed(1) };
}
const C = (id: string) => BASE.find(c => c.id === id)!;
const out: any[] = [];
function scenario(name: string, what: string, build: () => Game, depth = 3) {
  const g = build(); const legal = atkActs(g), bot = botTurn(g), bs = best(g, depth);
  const botEval = evalState(bot.g, 0);
  out.push({ name, what, mine: desc(g, 0), theirs: desc(g, 1), lpTurn: `turn ${g.turn} phase ${g.phase} active P${g.active + 1} LP ${g.players[0].lp}/${g.players[1].lp}`, hand: g.players[0].hand.length, deck: `${g.players[0].deck.length}/${g.players[1].deck.length}`, legal: legal.map(a => one(g, a)), botSeq: bot.seq, botEval: +botEval.toFixed(1), bestSeq: bs.seq, bestEval: +bs.score.toFixed(1), gap: +(bs.score - botEval).toFixed(1) });
}
const T = (id: string, extra: Partial<CardDef> = {}): CardDef => ({ ...C(id), ...extra });

// S1: element advantage / neutral / disadvantage, identical enemy stats except element. Attacker fire (strong vs nature/poison/alchemy, weak vs water).
scenario('S1 element ranking', 'Bot fire unit vs three otherwise identical enemies (water=weak for fire, neutral, nature=strong for fire). Bot score ignores the multiplier.', () => {
  const g = battle(mkGame()); put(g, 0, 0, ch('ATK', 'x', { atk: 40, def: 2, hp: 100, element: 'fire' }));
  put(g, 1, 0, ch('E-WATER', 'e1', { atk: 25, def: 5, hp: 60, element: 'water' })); put(g, 1, 1, ch('E-NEUTRAL', 'e2', { atk: 25, def: 5, hp: 60, element: 'neutral' })); put(g, 1, 2, ch('E-NATURE', 'e3', { atk: 25, def: 5, hp: 60, element: 'nature' })); return g; }, 1);
// S2: weak unit can trade into a Lv40 enemy (the only attacker cannot kill it, counter would kill / not kill?)
scenario('S2 chip then kill (2 attackers vs damaged Lv40)', 'Enemy Lv40 SATOSHI-040 at 50 HP. Two bot Lv15 units (ATK 40) each deal 35; the first survives the counter, the second kills.', () => {
  const g = battle(mkGame()); put(g, 0, 0, ch('A1', 'x', { atk: 40, def: 2, hp: 100, element: 'neutral' })); put(g, 0, 1, ch('A2', 'y', { atk: 40, def: 2, hp: 100, element: 'neutral' }));
  put(g, 1, 0, T('SATOSHI-040', { }), { hp: 50 }); return g; }, 3);
// S3: stronger enemy evolution should be prioritised over a weaker Lv15 when both are lethal
scenario('S3 evolved vs Lv15 lethal target', 'Two lethal targets: weak Lv15 (hp10 def0) and Lv70 FOLLOW-YOU-070 at hp 20. Bot scores lethal as 100+damage => picks the lower-DEF victim.', () => {
  const g = battle(mkGame()); put(g, 0, 0, ch('A1', 'x', { atk: 40, def: 2, hp: 100 }));
  put(g, 1, 0, ch('WEAK15', 'w', { atk: 10, def: 0, hp: 10 })); put(g, 1, 1, T('FOLLOW-YOU-070'), { hp: 20 }); return g; }, 2);
// S4: attack that looks safe but the element multiplier makes the counter lethal
scenario('S4 counter x1.5 kills the attacker', 'Bot unit (nature, ATK 50, hp 60) vs enemy fire unit (ATK 42, hp 80). Bot predicts damage 48 / counter 40 (no multipliers) => attacks; engine applies fire>nature: damage x0.75, counter x1.5 = 60 => attacker dies.', () => {
  const g = battle(mkGame()); put(g, 0, 0, ch('A1', 'x', { atk: 50, def: 2, hp: 60, element: 'nature' }));
  put(g, 1, 0, ch('E1', 'e', { atk: 42, def: 2, hp: 80, element: 'fire' })); return g; }, 1);
// S5: attack order matters
scenario('S5 attack order', 'Two bot attackers (ATK 50 and ATK 25) vs enemies E1 (hp 60 def 0) and E2 (hp 22 def 0). Best order differs from the greedy pick.', () => {
  const g = battle(mkGame()); put(g, 0, 0, ch('STRONG', 'x', { atk: 50, def: 2, hp: 100 })); put(g, 0, 1, ch('WEAKER', 'y', { atk: 25, def: 2, hp: 100 }));
  put(g, 1, 0, ch('E1', 'e1', { atk: 30, def: 0, hp: 60 })); put(g, 1, 1, ch('E2', 'e2', { atk: 20, def: 0, hp: 22 })); return g; }, 3);
// S6: favorable attack exists but Bot passes
scenario('S6b pass despite favorable attack (strong counter)', 'Three bot Lv15 (ATK 40 hp 100) vs lone enemy Lv40 SATOSHI-040 (hp 130 def 5 atk 70). Each hit = 35; counter = 68 (survivable once). Three hits kill it (105<130 needs 4). Bot sees d-c+1<=0 and passes.', () => {
  const g = battle(mkGame()); for (let i = 0; i < 4; i++) put(g, 0, i, ch('A' + i, 'x' + i, { atk: 40, def: 2, hp: 100 })); put(g, 1, 0, T('SATOSHI-040')); return g; }, 4);
// S8: unit summoned this turn must not attack
scenario('S8 summoned-this-turn unit', 'Bot unit with summonedTurn === turn. Engine legality: attack must not be offered/accepted; Bot must respect it.', () => {
  const g = battle(mkGame()); put(g, 0, 0, ch('NEW', 'x', { atk: 60, def: 2, hp: 100 }), { summonedTurn: 2 }); put(g, 1, 0, ch('E1', 'e', { atk: 10, def: 0, hp: 20 })); return g; }, 1);

// S7: deck-out loop. Opponent only ends its turn; Bot (P1, small deck) with the S6b board. Count turns and who loses.
function deckOut(oracle = false) {
  const filler = (n: number) => Array.from({ length: n }, (_, i) => ch('F' + i, 'f' + i, { atk: 1, hp: 10 }));
  let g = mkGame({ deck0: filler(6), deck1: filler(40) }); g.players[0].deck = filler(6); g.players[1].deck = filler(40);
  for (let i = 0; i < 4; i++) put(g, 0, i, ch('A' + i, 'x' + i, { atk: 40, def: 2, hp: 100 })); put(g, 1, 0, T('SATOSHI-040'));
  g.turn = 2; g.active = 0; g.phase = 'main'; const log: string[] = []; let steps = 0, attacks = 0;
  while (g.winner === null && steps++ < 400) {
    if (g.active === 0) { let a = botPick(g); if (oracle && g.phase === 'battle' && a.t === 'next') { const b = best(g, 4); if (b.seq.length) a = JSON.parse(b.seq[0]); } if (a.t === 'attack') attacks++; g = act(g, a); } else g = act(g, { t: 'next' });
  }
  const favorable = (() => { const h = mkGame(); for (let i = 0; i < 4; i++) put(h, 0, i, ch('A' + i, 'x' + i, { atk: 40, def: 2, hp: 100 })); put(h, 1, 0, T('SATOSHI-040')); battle(h); return best(h, 5); })();
  return { winner: g.winner, turns: g.turn, botAttacks: attacks, lastLog: g.log.slice(-2), oracleSeq: favorable.seq, oracleEnemyAfter: 'see S6b' };
}
const dout = { greedy: deckOut(false), oracle: deckOut(true) };
writeFileSync('/tmp/sim/botA.json', JSON.stringify({ scenarios: out, deckOut: dout }, null, 1));
for (const s of out) console.log(`\n== ${s.name}\n mine: ${s.mine}\n theirs: ${s.theirs}\n legal: ${s.legal.map((l: any) => JSON.stringify(l)).join('\n        ')}\n bot: ${s.botSeq.join(' ') || '(next)'} eval ${s.botEval} | best: ${s.bestSeq.join(' ') || '(none)'} eval ${s.bestEval} | gap ${s.gap}`);
console.log('\nDECKOUT', JSON.stringify(dout));
```

### `botB.ts`

```ts
// Bot-vs-Bot batch with decision instrumentation (read-only: botPick/act/legalActions are the repo's real functions).
import { writeFileSync } from 'node:fs';
import { botPick } from '/home/claude/varecrazy-card-battles-/src/engine/bot.ts';
import { createGame, act, legalActions, BASE, CHARS, PAIRS, STORY, units, effAtk, type Game, type CardDef, type Action } from './lib.ts';
const N = +(process.env.N ?? 60), STORYMODE = process.env.STORY ?? 'current';   // current | off | onepersource
const lcg = (s: number) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const chains = [...new Set(CHARS.map(c => c.chain!))], pc = new Set(PAIRS.flatMap((p: any) => [p.a, p.b]));
const spells = BASE.filter(c => c.type === 'spell'), traps = BASE.filter(c => c.type === 'trap'), l15 = CHARS.filter(c => c.level === 15);
const EVO = BASE.find(c => c.id === 'EVO-001')!, FUS = BASE.find(c => c.id === 'FUS-001')!;
// port of the browser's random deck() in public/play.html (7 chains x3 Lv15, 3 Evolution, 2 Fusion, spells/traps, Lv15 filler)
function deck(r: () => number): CardDef[] {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)], d: CardDef[] = [], n: Record<string, number> = {};
  const put = (c?: CardDef) => { if (!c || (n[c.id] ?? 0) >= 3 || d.length >= 40) return; n[c.id] = (n[c.id] ?? 0) + 1; d.push(c); };
  const ch = [...chains].sort(() => r() - .5).sort((x, y) => (pc.has(y) ? 1 : 0) - (pc.has(x) ? 1 : 0)).slice(0, 7);
  for (const k of ch) { const a = CHARS.find(x => x.chain === k && x.level === 15); for (let i = 0; i < 3; i++) put(a); }
  for (let i = 0; i < 3; i++) put(EVO); for (let i = 0; i < 2; i++) put(FUS);
  for (let g = 0; d.length < 40 && g < 400; g++) put(pick(g % 3 === 2 ? traps : spells));
  for (let g = 0; d.length < 40 && g < 400; g++) put(pick(l15)); return d;
}
const formsOf = (d: CardDef[]) => { const cs = new Set(d.filter(c => c.type === 'character').map(c => c.chain)); return CHARS.filter(c => c.level! > 15 && cs.has(c.chain)).sort((a, b) => a.level! - b.level!).slice(0, 15); };
const story = STORYMODE === 'off' ? [] : STORYMODE === 'onepersource' ? Object.values(STORY.reduce((m: any, l) => { const s = (x: any) => x.mods.reduce((t: number, y: any) => t + Math.abs(y.amount), 0); if (!m[l.a] || s(l) > s(m[l.a])) m[l.a] = l; return m; }, {})) as typeof STORY : STORY;
const M = { games: 0, finished: 0, winSeat0: 0, winFirst: 0, deckout: 0, lpWin: 0, turns: 0, attacks: 0, attacksDirect: 0, decisions: 0, passes: 0, passFav: 0, passLethal: 0, passEvoKill: 0, passKillNoLoss: 0, passTradeUp: 0, lethalTaken: 0, unitsLostBot: 0, unfavorableTrades: 0, deckoutWithFavPass: 0, deckoutGames: 0, evolves: 0, signatureCasts: 0 };
let totalSteps = 0;
for (let n = 1; n <= N; n++) {
  const r = lcg(1000 + n), d0 = deck(r), d1 = deck(r), first = (n % 2) as 0 | 1;
  let g: Game = createGame([d0, d1], n, first, { storyLinks: story, fusionPairs: PAIRS as any, interactive: false, extras: [formsOf(d0), formsOf(d1)] });
  let st = 0, favPassTurns: number[] = []; M.games++;
  while (g.winner === null && st++ < 4000) {
    const a = botPick(g), me = g.active;
    if (g.phase === 'battle' && !g.pending) {
      const L = (legalActions(g).filter(x => x.t === 'attack') as Extract<Action, { t: 'attack' }>[]).filter(x => { const u = g.players[me].field[x.from]!; return u && !u.attacked && u.summonedTurn !== g.turn; });
      M.decisions++;
      const cls = L.map(x => { let y: Game; try { y = act(g, x); } catch { return null; } const eb = x.to === 'player' ? null : g.players[1 - me].field[x.to as number], ea = x.to === 'player' ? null : y.players[1 - me].field[x.to as number], mu = g.players[me].field[x.from]!, mu2 = y.players[me].field[x.from];
        const killed = !!eb && !ea, lost = !mu2; return { x, lethal: y.winner === me, killNoLoss: killed && !lost, tradeUp: killed && lost && (eb!.card.level ?? 15) > (mu.card.level ?? 15), evoKill: killed && (eb!.card.level ?? 15) > 15, lost, killed }; }).filter(Boolean) as any[];
      const fav = cls.filter(c => c.lethal || c.killNoLoss || c.tradeUp);
      if (a.t === 'next') { M.passes++; if (fav.length) { M.passFav++; favPassTurns.push(g.turn); if (fav.some(c => c.lethal)) M.passLethal++; if (fav.some(c => c.evoKill)) M.passEvoKill++; if (fav.some(c => c.killNoLoss)) M.passKillNoLoss++; if (fav.some(c => c.tradeUp)) M.passTradeUp++; } }
      else if (a.t === 'attack') { M.attacks++; if (a.to === 'player') M.attacksDirect++; const c = cls.find(c => c.x.from === a.from && c.x.to === a.to); if (c) { if (c.lethal) M.lethalTaken++; if (c.lost) { M.unitsLostBot++; if (!c.killed) M.unfavorableTrades++; } } }
    }
    if (a.t === 'evolve') M.evolves++; if (a.t === 'cast' && g.players[me].hand[a.hand]?.support) M.signatureCasts++;
    g = act(g, a);
  }
  totalSteps += st;
  if (g.winner !== null) { M.finished++; M.turns += g.turn; if (g.winner === 0) M.winSeat0++; if (g.winner === first) M.winFirst++; const last = g.log[g.log.length - 1] ?? ''; if (/จั่วไม่ได้/.test(last)) { M.deckout++; M.deckoutGames++; if (favPassTurns.some(t => t >= g.turn - 12)) M.deckoutWithFavPass++; } else M.lpWin++; }
}
const out = { mode: STORYMODE, N, ...M, avgTurns: +(M.turns / Math.max(1, M.finished)).toFixed(1), avgAttacksPerGame: +(M.attacks / N).toFixed(1), passFavPctOfPasses: +(100 * M.passFav / Math.max(1, M.passes)).toFixed(2), firstPlayerWinPct: +(100 * M.winFirst / Math.max(1, M.finished)).toFixed(1), deckoutPct: +(100 * M.deckout / Math.max(1, M.finished)).toFixed(1) };
console.log(JSON.stringify(out)); writeFileSync(`/tmp/sim/botB-${STORYMODE}.json`, JSON.stringify(out, null, 1));
```

### `comboB.ts`

```ts
// Combo / defense simulation using the REAL engine (act, legalActions, refreshAuras). Read-only; nothing in the repo is changed.
import { writeFileSync } from 'node:fs';
import { mkGame, put, units, effAtk, effDef, act, legalActions, refreshAuras, ch, BASE, SIG, CHARS, STORY, byId, type Game, type CardDef, type Unit } from './lib.ts';
const dummy = (el = 'neutral', def = 0, hp = 9999): CardDef => ({ ...ch('DUMMY', 'dummy', { hp, atk: 0, def, element: el as any }) });
import { readFileSync } from 'node:fs';
const matrix = JSON.parse(readFileSync('/home/claude/varecrazy-card-battles-/db/seed/elements.json', 'utf8')) as any;
const strongVs = (el: string) => (matrix.elements[el]?.strong ?? [])[0] ?? 'neutral';
const rowsOf = (chain: string) => STORY.filter(l => l.a === chain);
const atkAmt = (l: typeof STORY[number]) => l.mods.filter(m => m.stat === 'atk').reduce((s, m) => s + m.amount, 0);
const l15of = (chain: string) => CHARS.find(c => c.chain === chain && c.level === 15)!;
type Setup = { attacker: CardDef; partners: CardDef[]; hand: string[]; traps?: string[]; target: 'dummy' | 'player'; targetEl?: string; targetDef?: number };
function build(s: Setup): { g: Game; atkProgress: string[] } {
  const g = mkGame({ story: STORY }); g.turn = 2; g.active = 0; g.phase = 'main';
  put(g, 0, 0, s.attacker); s.partners.forEach((p, i) => put(g, 0, 1 + i, p)); refreshAuras(g);
  g.players[0].hand = s.hand.map(id => byId.get(id)!).filter(Boolean);
  (s.traps ?? []).forEach((t, i) => { g.players[0].back[i] = { card: byId.get(t)!, setTurn: 0 }; });
  if (s.target === 'dummy') put(g, 1, 0, dummy(s.targetEl ?? 'neutral', s.targetDef ?? 0));
  return { g, atkProgress: [`base+story+passive ${effAtk(g.players[0].field[0]!)}`] };
}
function run(s: Setup) {
  let { g, atkProgress } = build(s); const used: string[] = [];
  for (let guard = 0; guard < 30; guard++) {
    const h = g.players[0].hand; if (!h.length) break;
    let did = false;
    for (let i = 0; i < h.length && !did; i++) { const a = legalActions(g).find(x => x.t === 'cast' && x.hand === i && (!x.target || x.target.slot === 0 || x.target.slot === undefined)); if (a) { used.push(h[i].id); g = act(g, a); atkProgress.push(`${used[used.length - 1]} -> ${effAtk(g.players[0].field[0]!)}`); did = true; } }
    if (!did) break;
  }
  g.phase = 'battle';
  const before = s.target === 'dummy' ? g.players[1].field[0]!.hp : g.players[1].lp, atkEff = effAtk(g.players[0].field[0]!);
  const a = legalActions(g).find(x => x.t === 'attack' && x.from === 0 && (s.target === 'player' ? x.to === 'player' : x.to === 0));
  if (!a) return { ok: false as const, atkProgress, used };
  const x = act(g, a), after = s.target === 'dummy' ? (x.players[1].field[0]?.hp ?? 0) : x.players[1].lp;
  return { ok: true as const, atkProgress, used, effAtkAtHit: atkEff, damage: before - after, finalAtk: effAtk(x.players[0].field[0] ?? g.players[0].field[0]!) };
}
const sigAtkSpells = (chain: string) => SIG.filter(c => c.type === 'spell' && c.support!.link === chain && c.support!.ops.some(o => o.op === 'buff' && o.stat === 'atk' && (o.who === 'link') && (o.amount ?? 0) > 0)).map(c => c.id);
const sigTrapsOwnAtk = (chain: string) => SIG.filter(c => c.type === 'trap' && c.support!.link === chain && c.support!.trigger === 'own_attack').map(c => c.id);
const res: any = {};

// ---- B1: max single-hit per attacker card ----
const rows: any[] = [];
for (const c of CHARS) {
  const best = rowsOf(c.chain!).filter(l => atkAmt(l) > 0 && l.b !== c.chain).sort((x, y) => atkAmt(y) - atkAmt(x)).slice(0, 6);
  const partners = best.map(l => l15of(l.b)).filter(Boolean);
  const variants: Record<string, Setup> = {
    'A0 base only': { attacker: c, partners: [], hand: [], target: 'dummy' },
    'A1 +Story (positive-ATK rows only)': { attacker: c, partners, hand: [], target: 'dummy' },
    'A2 +Story +base SPL-004 (+15)': { attacker: c, partners, hand: ['SPL-004'], target: 'dummy' },
    'B1 +Story +SPL-004 +Signature ATK spells/traps': { attacker: c, partners, hand: ['SPL-004', ...sigAtkSpells(c.chain!).flatMap(id => [id, id, id]).slice(0, 9)], traps: sigTrapsOwnAtk(c.chain!), target: 'dummy' },
    'B2 same + element advantage x1.5': { attacker: c, partners, hand: ['SPL-004', ...sigAtkSpells(c.chain!).flatMap(id => [id, id, id]).slice(0, 9)], traps: sigTrapsOwnAtk(c.chain!), target: 'dummy', targetEl: strongVs(c.element as string) },
  };
  const r: any = { id: c.id, lv: c.level, el: c.element, baseAtk: c.atk, partners: partners.map(p => p.id) };
  for (const [k, v] of Object.entries(variants)) { const o = run(v); r[k] = o.ok ? { dmg: o.damage, atk: o.effAtkAtHit, used: o.used } : null; }
  rows.push(r);
}
res.B1 = rows;
const top = (k: string, n = 10) => [...rows].filter(r => r[k]).sort((a, b) => b[k].dmg - a[k].dmg).slice(0, n).map(r => `${r.id}(L${r.lv}) ${r[k].dmg}`);
res.B1top = Object.fromEntries(['A0 base only', 'A1 +Story (positive-ATK rows only)', 'A2 +Story +base SPL-004 (+15)', 'B1 +Story +SPL-004 +Signature ATK spells/traps', 'B2 same + element advantage x1.5'].map(k => [k, top(k)]));
// excluding Lv70 (needs evolution 15->40->70): the best Lv15/Lv40 results
res.B1topNoLv70 = Object.fromEntries(Object.keys(res.B1top).map(k => [k, [...rows].filter(r => r[k] && r.lv !== 70).sort((a, b) => b[k].dmg - a[k].dmg).slice(0, 8).map(r => `${r.id}(L${r.lv}) ${r[k].dmg}`)]));
res.B1over100 = Object.keys(res.B1top).map(k => [k, rows.filter(r => r[k] && r[k].dmg >= 100).map(r => `${r.id}(L${r.lv}):${r[k].dmg}`)]);

// ---- B1b: three-card combos (attacker + any 2 of: Story partner on field, chain's ATK spell, SPL-004). Set A = base cards only, Set B adds Signature. ----
function triples(includeSig: boolean) {
  const out: any[] = [];
  for (const c of CHARS) {
    const partnerIds = rowsOf(c.chain!).filter(l => l.b !== c.chain).map(l => l15of(l.b)?.id).filter(Boolean) as string[];
    const spells = ['SPL-004', ...(includeSig ? sigAtkSpells(c.chain!) : [])];
    const pool = [...new Set([...partnerIds.map(id => 'P:' + id), ...spells.map(id => 'S:' + id)])];
    for (let i = 0; i < pool.length; i++) for (let j = i; j < pool.length; j++) {
      const picks = [pool[i], ...(j !== i ? [pool[j]] : [])];
      const partners = picks.filter(p => p[0] === 'P').map(p => byId.get(p.slice(2))!), hand = picks.filter(p => p[0] === 'S').map(p => p.slice(2));
      const o = run({ attacker: c, partners, hand, target: 'dummy' }); if (o.ok) out.push({ cards: [c.id, ...picks.map(p => p.slice(2))].join(' + '), lv: c.level, dmg: o.damage });
    }
  }
  return out.sort((a, b) => b.dmg - a.dmg);
}
const tA = triples(false), tB = triples(true);
res.triples = { setA_top: tA.slice(0, 12), setA_over100_nonLv70: tA.filter(x => x.dmg >= 100 && x.lv !== 70).length, setA_count: tA.length, setAB_top: tB.slice(0, 12), setAB_over100_nonLv70: tB.filter(x => x.dmg >= 100 && x.lv !== 70).slice(0, 12), setAB_count: tB.length, setAB_over100_nonLv70_n: tB.filter(x => x.dmg >= 100 && x.lv !== 70).length };

// ---- B2: direct LP damage in one turn with an EMPTY enemy field ----
const directBest = rows.map(r => { const c = byId.get(r.id)!, o = run({ attacker: c, partners: r.partners.map((p: string) => byId.get(p)!), hand: ['SPL-004'], target: 'player' }); return { id: r.id, lv: r.lv, dmg: o.ok ? o.damage : null }; }).sort((a, b) => (b.dmg ?? 0) - (a.dmg ?? 0));
res.directTop = directBest.slice(0, 8);
// block check: any enemy character prevents ALL direct attacks (engine legality)
{ const g = mkGame({ story: STORY }); g.turn = 2; g.phase = 'battle'; g.active = 0; put(g, 0, 0, byId.get('FOLLOW-YOU-070')!); put(g, 1, 0, dummy()); res.directBlockedByOneUnit = !legalActions(g).some(a => a.t === 'attack' && a.to === 'player'); }

// ---- B3: best 7-unit field (hill climb) for total effective ATK, empty enemy field ----
function fieldScore(ids: string[]) { const g = mkGame({ story: STORY }); ids.forEach((id, i) => put(g, 0, i, byId.get(id)!)); refreshAuras(g); return units(g, 0).reduce((s, u) => s + effAtk(u), 0); }
function climb(k: number, allowed: (c: CardDef) => boolean) {
  const pool = CHARS.filter(allowed).map(c => c.id); let cur = pool.slice(0, k); let best = fieldScore(cur); let improved = true;
  while (improved) { improved = false; for (let i = 0; i < k; i++) for (const id of pool) { if (cur.filter(x => x === id).length >= 3) continue; const t = [...cur]; t[i] = id; const s = fieldScore(t); if (s > best) { best = s; cur = t; improved = true; } } }
  return { ids: cur, total: best };
}
res.field = { k3_all: climb(3, () => true), k3_noLv70: climb(3, c => c.level !== 70), k3_lv15only: climb(3, c => c.level === 15), k7_all: climb(7, () => true), k7_lv15only: climb(7, c => c.level === 15), k7_noLv70: climb(7, c => c.level !== 70) };

// ---- B4: hits needed to defeat each level class with the best single hit available at that tier ----
const hp = (l: number) => CHARS.filter(c => c.level === l).map(c => c.hp!);
res.hp = Object.fromEntries([15, 40, 70].map(l => [l, { min: Math.min(...hp(l)), max: Math.max(...hp(l)) }]));

// ---- B5: defensive battery vs a burst. Attacker = neutral dummy with ATK X attacking the defender's only unit (engine resolves traps/DEF/etc.) ----
const burst = [70, 100, 115];
const defOptions: { id: string; kind: string; fn: (c: CardDef) => { traps?: string[]; spell?: string } | null }[] = [
  { id: 'none', kind: 'none', fn: () => ({}) },
  { id: 'TRP-001 (cancel attack)', kind: 'cancel', fn: () => ({ traps: ['TRP-001'] }) },
  { id: 'TRP-009 (return attacker to hand)', kind: 'cancel', fn: () => ({ traps: ['TRP-009'] }) },
  { id: 'TRP-002 (reflect 50% to attacker)', kind: 'reflect', fn: () => ({ traps: ['TRP-002'] }) },
  { id: 'TRP-008 (survive at 1)', kind: 'survive', fn: () => ({ traps: ['TRP-008'] }) },
  { id: 'SPL-003 DEF +15 (own turn, until end of turn)', kind: 'def', fn: () => ({ spell: 'SPL-003' }) },
  ...SIG.filter(c => c.type === 'trap' && ['enemy_attack', 'self_attacked', 'ally_battle_damage'].includes(c.support!.trigger!)).map(c => ({ id: `${c.id} (${c.support!.trigger}:${c.support!.ops.map(o => o.op + (o.amount ?? '')).join('+')})`, kind: c.support!.ops[0].op, fn: (d: CardDef) => d.chain === c.support!.link || c.support!.trigger === 'ally_battle_damage' ? { traps: [c.id], need: c.support!.link } as any : null })),
  ...SIG.filter(c => c.type === 'spell' && c.support!.ops.some(o => o.op === 'buff' && o.stat === 'def' && o.until === 'opp_turn')).map(c => ({ id: `${c.id} (DEF buff through opponent turn)`, kind: 'def', fn: (d: CardDef) => (c.support!.link === d.chain || c.support!.link === undefined) ? { spell: c.id } : null })),
];
function defend(def: CardDef, X: number, opt: typeof defOptions[number]) {
  const o = opt.fn(def); if (!o) return null;
  const g = mkGame({ story: STORY }); g.turn = 2; g.active = 0; g.phase = 'battle';
  put(g, 0, 0, ch('BURST', 'burst', { atk: X, hp: 500, def: 0, element: 'neutral' }));
  const d = put(g, 1, 0, def); const extra = (o as any).need ? byId.get(Object.values(CHARS).find(c => c.chain === (o as any).need && c.level === 15)!.id)! : null;
  if (extra && extra.chain !== def.chain) put(g, 1, 1, extra);
  if (!(o as any).need && opt.kind !== 'none' && (o as any).traps === undefined && !(o as any).spell) {}
  // linked Signature traps need their chain on the field; if the defender is the linked chain it's already there
  (o.traps ?? []).forEach((t, i) => { g.players[1].back[i] = { card: byId.get(t)!, setTurn: 0 }; });
  // defensive spells are cast on the defender's own turn, then the turn passes; here we emulate by casting via the engine as P2 and advancing
  if (o.spell) { g.active = 1; g.phase = 'main'; g.players[1].hand = [byId.get(o.spell)!]; refreshAuras(g); const a = legalActions(g).find(x => x.t === 'cast' && x.hand === 0 && (!x.target || x.target.slot === 0)); if (!a) return null; let x = act(g, a); x = act(x, { t: 'next' }); x = act(x, { t: 'next' }); x.phase = 'battle'; if (x.active !== 0) return null; Object.assign(g, x); }
  const defNow = g.players[1].field[0]!; refreshAuras(g); const hpB = defNow.hp, defEff = effDef(defNow);
  const a = legalActions(g).find(x => x.t === 'attack' && x.from === 0 && x.to === 0); if (!a) return null;
  const x = act(g, a), d2 = x.players[1].field[0], atkAlive = !!x.players[0].field[0];
  return { dmgTaken: hpB - (d2?.hp ?? 0), survived: !!d2, defEff, burstAlive: atkAlive, burstHpLost: 500 - (x.players[0].field[0]?.hp ?? 0) };
}
const battery: any[] = [];
for (const X of burst) for (const opt of defOptions) {
  let n = 0, surv = 0, dmgSum = 0, base = 0;
  for (const c of CHARS) { const r = defend(c, X, opt), r0 = defend(c, X, defOptions[0]); if (!r || !r0) continue; n++; if (r.survived) surv++; dmgSum += r.dmgTaken; base += r0.dmgTaken; }
  if (n) battery.push({ burst: X, option: opt.id, kind: opt.kind, defenders: n, survivePct: +(100 * surv / n).toFixed(1), avgDmgTaken: +(dmgSum / n).toFixed(1), avgDmgPrevented: +((base - dmgSum) / n).toFixed(1) });
}
res.battery = battery;
// healing vs incoming damage: heal amounts from data
res.heals = { SPL_002_base: 30, signature: SIG.filter(c => c.support!.ops.some(o => o.op === 'heal')).map(c => `${c.id}:${c.support!.ops.find(o => o.op === 'heal')!.amount}`), charTurnEndHeals: CHARS.flatMap(c => (c.effects ?? []).filter(e => e.kind === 'heal').map(e => `${c.id}:${e.trigger}:${e.amount}`)) };
writeFileSync('/tmp/sim/comboB.json', JSON.stringify(res, null, 1));
console.log(JSON.stringify({ B1top: res.B1top, B1topNoLv70: res.B1topNoLv70, B1over100: res.B1over100, triples: { A: res.triples.setA_top.slice(0, 6), Aover: res.triples.setA_over100_nonLv70, AB: res.triples.setAB_top.slice(0, 6), ABover: res.triples.setAB_over100_nonLv70_n, ABoverEx: res.triples.setAB_over100_nonLv70.slice(0, 6) }, directTop: res.directTop, blocked: res.directBlockedByOneUnit, field: res.field, hp: res.hp }, null, 1));
console.log(JSON.stringify(res.battery.filter((b: any) => b.burst === 100), null, 0));
```

### `storycap.ts`

```ts
// Story stacking sensitivity (read-only): hill-climb the best 7-unit field by total ATK under different caps on the Story-derived aura (auraAtk/auraDef).
import { mkGame, put, units, effAtk, refreshAuras, CHARS, STORY, byId } from './lib.ts';
import { writeFileSync } from 'node:fs';
const score = (ids: string[], story: boolean, cap: number) => { const g = mkGame({ story: story ? STORY : [] }); ids.forEach((id, i) => put(g, 0, i, byId.get(id)!)); refreshAuras(g);
  return units(g, 0).reduce((s, u) => s + Math.max(0, u.atk + u.bonusAtk + Math.min(u.auraAtk ?? 0, cap)), 0); };
function climb(k: number, story: boolean, cap: number, ok: (c: any) => boolean) { const pool = CHARS.filter(ok).map(c => c.id); let cur = pool.slice(0, k), best = score(cur, story, cap), imp = true;
  while (imp) { imp = false; for (let i = 0; i < k; i++) for (const id of pool) { if (cur.filter(x => x === id).length >= 3) continue; const t = [...cur]; t[i] = id; const s = score(t, story, cap); if (s > best) { best = s; cur = t; imp = true; } } } return { ids: cur, total: best }; }
const out: any = {};
for (const [name, ok] of [['all', () => true], ['noLv70', (c: any) => c.level !== 70], ['lv15', (c: any) => c.level === 15]] as const)
  for (const [lab, story, cap] of [['storyOff', false, 0], ['uncapped', true, 1e9], ['cap+10', true, 10], ['cap+20', true, 20], ['cap+30', true, 30]] as const)
    out[`${name}/${lab}`] = climb(7, story, cap, ok as any).total;
// max Story ATK aura on a single unit (all 7 slots free for partners)
let mx = { id: '', aura: 0 };
for (const c of CHARS) { const g = mkGame({ story: STORY }); put(g, 0, 0, c); const partners = CHARS.filter(p => p.level === 15 && p.chain !== c.chain); const picks: any[] = [];
  for (let s = 1; s < 7; s++) { let b = partners[0], bv = -1; for (const p of partners) { put(g, 0, s, p); refreshAuras(g); const v = g.players[0].field[0]!.auraAtk ?? 0; if (v > bv) { bv = v; b = p; } } put(g, 0, s, b); picks.push(b.id); }
  refreshAuras(g); const a = g.players[0].field[0]!.auraAtk ?? 0; if (a > mx.aura) mx = { id: c.id, aura: a }; }
out.maxSingleUnitStoryAtkAura = mx;
console.log(JSON.stringify(out, null, 1)); writeFileSync('/tmp/sim/storycap.json', JSON.stringify(out, null, 1));
```
