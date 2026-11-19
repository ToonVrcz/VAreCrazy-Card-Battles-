# Test Plan (Issue #2)

> **STATUS: PROPOSED — NOT APPROVED.** Nothing in this document is implemented. HP and ATK are never changed. Toon reviews and approves before any implementation.

Tests are for the implementation step AFTER approval. Style: vitest in `tests/`, the engine run through `createGame` / `act` like `scripts/card-balance-verify.ts`. Run the full suite in the background (≈ 4 min).

## A. One test per changed data row

For each row in `CARD_CHANGELOG.md`:

1. Load the card with the proposed row; assert `parseEffect(row)` is not null and equals the expected Effect (trigger, kind, amount, limit, cond, cost).
2. Run the effect in a game and assert the exact result (see the table).
3. Assert HP and ATK are identical to `card-data-export/cards.json`.

| Card | Assert |
|---|---|
| 1GOKU-015 | DEF 3: an attacker with ATK X deals max(1, X-3) (before element) |
| 1GOKU-040 | effect[1] "HP −10" |
| BABY-015 | DEF 5: an attacker with ATK X deals max(1, X-5) (before element); effect[0] "ฟื้น HP 30" |
| BACKJI-015 | DEF 3: an attacker with ATK X deals max(1, X-3) (before element) |
| BADGUY-015 | DEF 4: an attacker with ATK X deals max(1, X-4) (before element) |
| BADGUY-040 | effect[0] "ATK +20"; effect[1] "HP −15" |
| CUTIE-015 | effect[0] "HP −5" |
| DNMAN-015 | effect[0] "ATK +5" |
| FOLLOW-YOU-015 | DEF 2: an attacker with ATK X deals max(1, X-2) (before element) |
| FOLLOW-YOU-040 | effect[0] "ATK +20" |
| LALAPING-015 | DEF 4: an attacker with ATK X deals max(1, X-4) (before element) |
| LALAPING-040 | DEF 6: an attacker with ATK X deals max(1, X-6) (before element) |
| LEON-S-KENNEDY-015 | DEF 3: an attacker with ATK X deals max(1, X-3) (before element) |
| LINLADA-015 | effect[0] "ATK +5" |
| LORDNAM-015 | DEF 2: an attacker with ATK X deals max(1, X-2) (before element) |
| LUCKY-015 | DEF 4: an attacker with ATK X deals max(1, X-4) (before element) |
| MELON-015 | effect[0] "ATK +5" |
| MON-015 | effect[0] "จั่ว 1 ใบ" with discard cost |
| NORMAN-015 | DEF 3: an attacker with ATK X deals max(1, X-3) (before element) |
| OUFILLING-015 | DEF 4: an attacker with ATK X deals max(1, X-4) (before element) |
| PIKACHU-015 | effect[0] "HP −5" |
| SATOSHI-015 | DEF 5: an attacker with ATK X deals max(1, X-5) (before element); effect[0] "ฟื้น HP 15" |
| SATOSHI-040 | effect[0] "ฟื้น HP 15"; effect[1] "ฟื้น HP 20" |
| SMILE-015 | effect[0] "ฟื้น HP 5" |
| TAN-015 | DEF 3: an attacker with ATK X deals max(1, X-3) (before element) |
| TEE-015 | DEF 4: an attacker with ATK X deals max(1, X-4) (before element); effect[0] "ATK +15" |
| TEE-040 | DEF 6: an attacker with ATK X deals max(1, X-6) (before element) |
| THAI32-015 | DEF 3: an attacker with ATK X deals max(1, X-3) (before element) |
| WENDYWENDIE-015 | DEF 5: an attacker with ATK X deals max(1, X-5) (before element); effect[0] "จั่ว 1 ใบ", no kill condition |
| ZEESKY-015 | DEF 3: an attacker with ATK X deals max(1, X-3) (before element) |

## B. Edge cases (characters)

- DEF >= attacker ATK: damage is exactly 1; element x1.5 and x0.75 with DEF (floor after multiplier).
- DEF with counter-attack: the defender's DEF reduces the counter as well; both directions.
- DEF after evolution: DEF is read from the new form's card, `bonusDef` (spells) carries over.
- MON-015 loot with an empty hand (cost cannot be paid) and with a full hand.
- WENDYWENDIE-015 draw on attack with an empty deck (deck-out must follow the existing rule) and with a full hand (draw is lost, as today).
- Damage 5 effects at exactly the target's HP; heal caps at max HP; once-per-game limit resets on re-summon (SPL-006).
- Parity: after any change run the Effect Registry parity tests (`tests/` for effect-registry / consistency checks) and `scripts/cms-effects-e2e.cjs`.

## C. Combos, Evolution, Fusion

- Evolution: 1 EVO card consumed; sacrifice 1/2/3; zero sacrifice rejected; once per turn; damage kept; TRP-005 cancels with no sacrifice; changed Lv40 forms keep their (new) effects after evolving; DEF of the new form applies at once.
- Fusion: every pair that includes a changed card (BACKJI-015, NONG-TAENGMO-015 and the 7 production pairs): stats = top 100 % + bottom 50 %, top effects only, DEF of the top card (confirm).
- Combos listed in the review: LALAPING-040 heal-all + LALAPING-070 aura HP; FOLLOW-YOU-070 aura ATK + attack bonuses; TEE-015 +15 on a unit with SPL-004; SATOSHI-015 heal 15 + SPL-002.

## D. Spells and traps (regression + proposals)

- T-ENG-01..03 (ENGINE-PROP-01): stolen unit cannot attack in the arrival turn; can attack next turn; own unit sent to the enemy side also cannot attack on the enemy's turn it arrives.
- T-ENG-04..06 (ENGINE-PROP-02): third SPL-003 on one unit rejected or capped; same for SPL-004; buff persists through evolution as today.
- T-ENG-07 (ENGINE-PROP-03, only if approved): third spell in a turn rejected.
- T-ENG-08 (ENGINE-PROP-04, only if approved): combo trigger.
- T-ENG-09 (ENGINE-PROP-05): the chosen canonical duration for SPL-003/004.
- Regression for all 10 spells and 10 traps exactly as today (numbers unchanged): SPL-001 20 dmg, SPL-002 heal 30 cap, SPL-005 draw 2, SPL-006 Lv15 only and hand not full, SPL-008 blocks one enemy turn, SPL-009 5x3, SPL-010 trap destroyed; TRP-001..010 each fires on its own event, a trap set this turn cannot fire, one trap per event.

## E. Exploit and loop tests

- Draw loop: SPL-006 + a draw-on-summon card (CHAEM-015, MON-015 as loot) + SPL-005: assert the loop is bounded by hand size and deck size and ends in deck-out, never in an infinite loop.
- Heal loop: LALAPING-040 + SATOSHI-015 + SPL-002 against a poisoned unit; heal never exceeds max HP.
- Permanent buffs: I-M-GRAPE-015 cap +15, SKYMOON-015 permanent +10 stacking on one unit across turns; SPL-004 stacking (with and without ENGINE-PROP-02).
- Multi-target damage: TRP-007 plus chip effects on a 7-unit board.
- Attack prevention: SPL-008 + TRP-001 + TRP-004 chain over 3 turns; the active player must always be able to end the turn.
- Turn-timer interaction: none of the above may stall the 90 s timer or the 3-timeout loss rule.
- Determinism: same seed and same actions give the same log before and after the change for every UNCHANGED card.

## F. Regression gate

`npm test` all green; `npx esbuild ... public/engine.js` rebuild reproducible; `public/admin-tools.js` rebuilt if the registry or text rules change; no Production data touched.
