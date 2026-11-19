# Claude Implementation Handoff (Issue #2)

> **STATUS: PROPOSED — NOT APPROVED.** Nothing in this document is implemented. HP and ATK are never changed. Toon reviews and approves before any implementation.

**Do not start until Toon approves, per card or per group.** Approved items only. Nothing here may be deployed, merged to `main` or applied to Production until Toon says "Deploy".

## 0. Rules

- Never change HP or ATK. Keep card IDs, deck data and player data intact. Backward compatible: decks that contain these cards must still load.
- Work on a new branch from `main`; one commit per approved group; run `npm test` in the background.
- Source of truth for proposed values: `CARD_REVISION_PROPOSAL.json` (only entries Toon marks approved).

## 1. Data changes (30 cards, DEF/effects)

Cards: 1GOKU-015, 1GOKU-040, BABY-015, BACKJI-015, BADGUY-015, BADGUY-040, CUTIE-015, DNMAN-015, FOLLOW-YOU-015, FOLLOW-YOU-040, LALAPING-015, LALAPING-040, LEON-S-KENNEDY-015, LINLADA-015, LORDNAM-015, LUCKY-015, MELON-015, MON-015, NORMAN-015, OUFILLING-015, PIKACHU-015, SATOSHI-015, SATOSHI-040, SMILE-015, TAN-015, TEE-015, TEE-040, THAI32-015, WENDYWENDIE-015, ZEESKY-015.

How (suggested; both must keep the seed and production identical):

1. Edit the seed (`db/seed/toon-cards.json`) for the approved rows only: `def` and the effect row fields shown in the proposal.
2. Add a numbered migration (next free number after 020) that updates `cards.def` and `card_effects` for exactly those cards, plus a down migration restoring the old values. The migration is written but NOT applied.
3. Because `card_versions` snapshots exist for published cards, follow the same pattern as migration 020 (check how versions are recorded) so rollback is possible.
4. Rebuild `public/engine.js` only if `src/engine` changed (data-only changes need no rebuild; the engine reads `def` and effects from the card pool).
5. Update the effect text with the exact proposed wording (the parser accepts only those wordings).
6. Add the tests from `TEST_PLAN.md` section A and run the Effect Registry parity tests.

## 2. Engine work (only if approved)

### ENGINE-PROP-01 — SPL-007: stolen unit cannot attack the turn it arrives

- PROPOSED / NOT APPROVED / NEW ENGINE WORK
- In the SPL-007 case of src/engine/game.ts set summonedTurn = g.turn on both swapped units (the existing "just summoned cannot attack" rule then applies).
- Tests: T-ENG-01..03

### ENGINE-PROP-02 — SPL-003 / SPL-004: cap stacking per unit

- PROPOSED / NOT APPROVED / NEW ENGINE WORK
- Allow one SPL-003 and one SPL-004 buff per unit, or cap total bonusDef / bonusAtk from spells at +30 (Toon decides the form). Needs a per-unit counter in Unit.
- Tests: T-ENG-04..06

### ENGINE-PROP-03 — Optional: spells per turn limit (e.g. 2)

- PROPOSED / NOT APPROVED / NEW ENGINE WORK / OPTIONAL
- Add a per-turn spell counter on Player; reject the 3rd cast.
- Tests: T-ENG-07

### ENGINE-PROP-04 — Optional: activate the "combo" trigger (FOLLOW-YOU-040)

- PROPOSED / NOT APPROVED / NEW ENGINE WORK / OPTIONAL
- Define "another Combo card on the field" in the parser/registry and the engine; today any combo row returns null from parseEffect and is not executed. Must stay in parity with src/engine/effect-registry.ts.
- Tests: T-ENG-08

### ENGINE-PROP-05 — Text/data alignment: SPL-003 and SPL-004 duration

- PROPOSED / NOT APPROVED / DATA CHANGE
- Choose one canonical behaviour: "until the unit leaves the field" (what the engine does and rules_text says) or "until end of turn" (what the effect row says). Update the other text; if the engine is changed it is new engine work.
- Tests: T-ENG-09

## 3. Open decisions for Toon

1. FOLLOW-YOU-040: keep the inactive "combo" row (display only), delete it, or approve ENGINE-PROP-04?
2. SPL-003/004: which duration is canonical (until the unit leaves, or until end of turn), and which stacking cap (one per unit or +30 total)?
3. SPL-007: approve ENGINE-PROP-01?
4. Spell limit per turn (ENGINE-PROP-03): yes/no and the number.
5. Starting LP: 100 (engine) or 8000 (DB rule)? DEF and damage values assume 100.
6. The S-tier Lv15 cards remain S after effect trims because HP/ATK are locked; accept, or allow a separate HP/ATK review later?
7. Production-only Fusion partners (7) and affiliation/gender bonuses: confirm that they stay out of the battle engine.

## 4. Verification before reporting done

- 70/70 cards still load; HP/ATK equal to `card-data-export/cards.json`.
- Every changed row passes `parseEffect`; the Effect Registry parity tests pass.
- `npm test` all green; the existing 150+ tests are unchanged except where the changed numbers are asserted.
- Report to Toon in Thai and short: what changed, test results, branch name, commit hash. Then wait for "Deploy".
