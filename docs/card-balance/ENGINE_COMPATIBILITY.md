# Engine Compatibility (Issue #2)

> **STATUS: PROPOSED — NOT APPROVED.** Nothing in this document is implemented. HP and ATK are never changed. Toon reviews and approves before any implementation.

Every statement was checked against `src/engine/*.ts` and/or by running the real engine (`scripts/card-balance-verify.ts`, raw output below). Items marked **UNCONFIRMED** could not be verified from the repository.

## 1. Combat and DEF formula (source: `src/engine/game.ts` line 58-60, `combat.ts`)

- Unit attack: `hit = max(1, floor(max(1, effATK - effDEF) x elementMultiplier))`, where `effATK = max(0, atk + bonusAtk + auraAtk)` and `effDEF = max(0, def + bonusDef)`.
- Counter-attack uses the same formula. Direct attack on the player ignores DEF and deals the full effATK; it is possible only when the enemy has no units on the field.
- DEF below ATK reduces damage 1:1; DEF >= ATK leaves the floor of 1. Probe results (neutral): ATK 30 vs DEF 0 = 30; DEF 10 = 20; DEF 29 = 1; DEF 30 = 1; DEF 99 = 1; fire vs nature (x1.5) = 45; nature vs fire (x0.75) = 22; ATK 10 vs DEF 5 with x1.5 = 7.
- Element multiplier: 1.5 strong, 0.75 weak, from `db/seed/elements.json`; the engine reads the file constants, not the DB `game_rules`.
- **Legacy formula:** `combat.ts` (`max(0, ATK-DEF) x element`, minimum 0) is used only by combat unit tests. The live game uses `game.ts`.
- **UNCONFIRMED / discrepancy:** DB `game_rules.starting_lp` = 8000 (proposed value) but the engine uses `RULES.lp` = 100. The value Toon intends is unknown. All DEF proposals assume the engine formula above and LP 100.

## 2. Fixed rules (probe + source)

- Hand max 5, start hand 5, 7 field slots, 5 back-row slots. First player cannot attack on turn 1. A unit cannot attack on the turn it arrives (evolved units too: "ตัวที่เพิ่งถูกเรียกโจมตีไม่ได้").
- One Lv15 summon per turn; Lv40+ cannot be summoned from hand ("เรียกได้เฉพาะตัวละคร Lv.15").
- Poison 5 damage x 3 turns (spell SPL-009).

## 3. Evolution (verified)

- Consumes **1 Evolution card** per step; sacrifice of face-up characters required: Lv40 1, Lv70 2, Lv99 3. Zero sacrifice is rejected (true). One evolution per turn (1). Poison and lock reset on the new form (poison 0, lockedUntil 0). Damage taken is kept, except where an effect heals (LALAPING-070 probe: 320/320).
- **Discrepancy with Issue #2:** the Issue says 1/2/3 face-up EVO. The engine needs 1 EVO card and 1/2/3 sacrifices. The EVO-001 card text agrees with the engine. DB rule `evolution_sacrifice` {15:1,40:2,70:3} (source-level keys) equals the engine map {40:1,70:2,99:3} (target-level keys); the engine does not read it.
- EVO-001 is allowed in the main deck (DB rule `evolution_in_main_deck` = true, confirmed); TAN-015's search relies on it.

## 4. Fusion (verified; partner data UNCONFIRMED from repo)

- Probe: BACKJI-015 + NONG-TAENGMO-015 = 136 HP / 49 ATK / DEF 0; 1 effect set runs (top card only); counts as the turn's Lv15 summon (true).
- Partner pairs (7) exist only in production (`card-data-export/production-snapshot/production-only-data.json`); the engine receives them via `fusionPairs`. DB `fusion_stack_stats` bonus {20,10,0} and `gender_pair_bonus` +5 ATK are not used by the engine. Story links, affiliations and gender bonuses are used by the CMS calculator only (`/api/bonus`).

## 5. Effect parser (what a character ability can be)

Only wordings accepted by `parseEffect` (`src/engine/effects.ts`) run; everything else is shown as "not active".

| Supported | Values |
|---|---|
| Triggers | on_attack, on_summon, on_evolve, on_destroyed, to_graveyard, turn_start, turn_end, passive |
| Targets | self, all own units, 1 own unit, 1 enemy unit, Main Deck (search only) |
| Actions | ATK +N / -N (turn or permanent, optional cap), HP -N, heal N, heal full, draw N (optional discard-1 cost), passive HP +N, untargetable on summon, search Evolution |
| Conditions | target destroyed by the attack; target HP lower than self (on_attack only) |
| Limits | none, once per turn, once per game (per unit instance; resets on re-summon) |
| NOT supported | combo trigger, on_cast for characters, sacrifice cost, n-turn durations, any other wording |

The Effect Registry (`src/engine/effect-registry.ts`) must stay in parity with the parser (CMS source). Proposals in this review use only existing wordings and were validated by calling `parseEffect` in the generator.

## 6. Spells and traps (card-ID driven)

Spell and trap behaviour and numbers are hard-coded by card ID in `game.ts` (`TRAP` event map at line 77; spell cases SPL-001..010). Changing a number in the card data does NOT change the game: **any numeric change to a spell or trap is new engine work.** That is why every spell/trap here is "no data change".

- SPL-003 x3 on one unit: bonusDef 45; SPL-004 x3: bonusAtk 45 (total ATK 75). No cap in the engine.
- SPL-007: the stolen unit can attack the same turn (true; its ATK 100).
- SPL-008 blocks the next enemy turn only (ถูกห้ามโจมตีในเทิร์นนี้).
- No per-turn spell limit: 3 casts in one turn (deck 21 after SPL-005 draws).
- TRP-006 fires at the end of the active player's turn, 15 damage to the highest ATK unit (15 lost in the probe). One trap fires per event.
- Recursion: CHAEM-015 on_summon draw fired again after revive+summon.
- Aura stacking is additive (probe: aura ATK +10, aura HP +20).

## 7. Other uncertainties

- **UNCONFIRMED:** the intended real-game LP (100 vs 8000), DB `game_rules` that are "proposed" are not read by the engine.
- **UNCONFIRMED:** the Lv99 forms: the engine has a Lv99 sacrifice count of 3, but no Lv99 card exists in the 70-card set.
- **UNCONFIRMED:** real-player win rates (no playtest data). All tiers are model estimates.
- **UNCONFIRMED:** that the production card_effects match the seed for traps/spells beyond the 78 rows compared (export report says 0 diffs for level/hp/atk/def/texts and effects).

## 8. Engine proposals (all NEW ENGINE WORK, NOT APPROVED)

- **ENGINE-PROP-01** SPL-007: stolen unit cannot attack the turn it arrives — PROPOSED / NOT APPROVED / NEW ENGINE WORK. In the SPL-007 case of src/engine/game.ts set summonedTurn = g.turn on both swapped units (the existing "just summoned cannot attack" rule then applies).
- **ENGINE-PROP-02** SPL-003 / SPL-004: cap stacking per unit — PROPOSED / NOT APPROVED / NEW ENGINE WORK. Allow one SPL-003 and one SPL-004 buff per unit, or cap total bonusDef / bonusAtk from spells at +30 (Toon decides the form). Needs a per-unit counter in Unit.
- **ENGINE-PROP-03** Optional: spells per turn limit (e.g. 2) — PROPOSED / NOT APPROVED / NEW ENGINE WORK / OPTIONAL. Add a per-turn spell counter on Player; reject the 3rd cast.
- **ENGINE-PROP-04** Optional: activate the "combo" trigger (FOLLOW-YOU-040) — PROPOSED / NOT APPROVED / NEW ENGINE WORK / OPTIONAL. Define "another Combo card on the field" in the parser/registry and the engine; today any combo row returns null from parseEffect and is not executed. Must stay in parity with src/engine/effect-registry.ts.
- **ENGINE-PROP-05** Text/data alignment: SPL-003 and SPL-004 duration — PROPOSED / NOT APPROVED / DATA CHANGE. Choose one canonical behaviour: "until the unit leaves the field" (what the engine does and rules_text says) or "until end of turn" (what the effect row says). Update the other text; if the engine is changed it is new engine work.

## 9. Raw probe output (`npx tsx scripts/card-balance-verify.ts`)

```json
{
  "damage": {
    "atk30_def0_neutral": 30,
    "atk30_def10": 20,
    "atk30_def29": 1,
    "atk30_def30": 1,
    "atk30_def99": 1,
    "atk30_def0_fire_vs_nature(x1.5)": 45,
    "atk30_def0_nature_vs_fire(x0.75)": 22,
    "atk10_def5_fire_vs_nature": 7
  },
  "spl003x3": {
    "bonusDef": 45,
    "atk": 30,
    "castsInOneTurn": 3
  },
  "spl004x3": {
    "bonusAtk": 45,
    "totalAtk": 75
  },
  "spl007": {
    "myFieldNow": "FOLLOW-YOU-070",
    "stolenAtk": 100,
    "stolenAttackedFlag": false,
    "stolenCanAttackSameTurn": true,
    "error": null
  },
  "evolution": {
    "evoCardsConsumed": 1,
    "sacrificeRequired": {
      "40": 1,
      "70": 2,
      "99": 3
    },
    "zeroSacrificeRejected": true,
    "newPoison": 0,
    "newLockedUntil": 0,
    "evolvedUnitCanAttackSameTurn": false,
    "attackError": "ตัวที่เพิ่งถูกเรียกโจมตีไม่ได้",
    "evolvePerTurnLimit": 1
  },
  "fusion": {
    "top": "BACKJI-015",
    "bottom": "NONG-TAENGMO-015",
    "hp": 136,
    "atk": 49,
    "def": 0,
    "effectsOfCard": 1,
    "fusedCards": [
      "BACKJI-015",
      "NONG-TAENGMO-015"
    ],
    "countsAsSummon": true
  },
  "spl008": {
    "enemyTurnNo": 2,
    "attackBlocked": true,
    "err": "ถูกห้ามโจมตีในเทิร์นนี้"
  },
  "auras": {
    "bobo15AuraAtk": 10,
    "bobo15AuraHp": 20
  },
  "spellVolume": {
    "castsInOneTurn": 3,
    "handAfter": 4,
    "handMax": 5,
    "deckAfter": 21
  },
  "trp006": {
    "firedAtEndOfActivePlayersTurn": true,
    "hpLost": 15
  },
  "recursion": {
    "handAfterRevive": 1,
    "handAfterResummon": 1,
    "deckAfter": 24,
    "note": "CHAEM-015 on_summon draw fired again after revive+summon"
  },
  "lalaping070": {
    "newHp": 320,
    "newMaxHp": 320,
    "note": "evolve from hp 20/160; aura +10 max HP; on_evolve heals ally1 (auto picks lowest HP ratio)"
  },
  "cardIdDriven": {
    "spells": [
      "SPL-001..010"
    ],
    "traps": [
      "TRP-001..010 (event map TRAP{})"
    ],
    "note": "numeric values of spells/traps live in game.ts, not in card data"
  },
  "startingLp": {
    "engine": 100,
    "handMax": 5,
    "startHand": 5,
    "fieldSlots": 7,
    "backSlots": 5
  },
  "summonLv40": "เรียกได้เฉพาะตัวละคร Lv.15"
}
```
