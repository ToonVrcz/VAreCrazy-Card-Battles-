# VAreCrazy Card Battles — Deep Balance Audit (Phase 2)
**Branch:** balance/audit-2026-11
**Status:** Analysis and proposals only. No gameplay/card data/code changes.
**Absolute constraint:** HP and ATK are locked. This report does not propose changing either stat.

## 1. Preliminary Power Bands (effect-based, not stat-based)
### High-impact / priority playtest
- SPL-005 (draw 2): immediate card advantage with no listed condition or cost. Test how often it is available and whether hand-cap 5 reduces its value.
- SPL-007 (cross-side swap): potentially changes board ownership and removes a strong opposing unit while gaining one. Text/runtime agree, but effect metadata disagrees.
- SPL-008 (attack lock): can suppress an opponent's battle phase for the intended duration. Runtime uses a turn counter; duration must be tested.
- SPL-009 (poison): repeated delayed damage; test whether it can be refreshed and how its tick count is consumed.
- TRP-001 / TRP-009 (attack cancellation / cancellation plus return): very high tempo impact. TRP-009's hand-full fallback to graveyard is a meaningful but potentially inconsistent penalty.
- TRP-005 (evolution cancel): can deny a resource-heavy progression action. Test rollback and whether sacrifices are restored.
- TRP-008 (survive destruction at 1 HP): can convert lethal damage into a survival and should be tested against multiple damage events.
### Strong utility / advantage
- Summon draw characters: reliable immediate advantage, subject to hand cap and once-per-game limits.
- Search Evolution (TAN-015): strategically valuable when Evolution is required for progression; measure search timing and deck availability.
- Evolution healing/full heal and ally HP/ATK effects: progression and board sustain can compound; audit target and timing.
- Fusion: currently only one pair exists; the system's bonus and component handling should be tested rather than ranked from one pair.
### Conditional / situational
- Attack-draw effects requiring target destruction: depend on combat matchup and target selection.
- Conditional Assassin attack effects: depend on target HP relation; test how effects resolve relative to attack damage and destruction.
- Temporary attack buffs: useful but broadly repetitive; differentiation can be achieved through conditions, target choices, costs, and limits without changing ATK values.

## 2. Synergy Map
- Summon-draw → Evolution/Fusion access: reliable draw effects may increase access to progression resources. Test deck construction and hand-cap effects.
- Evolution search (TAN-015) → high-level Evolution deck: direct progression consistency; verify search source, legal target, and empty-deck behavior.
- Evolution effects → healing / damage / buffs: high-level forms may create immediate tempo on top of progression. Verify effect activation and whether the evolved unit retains accumulated damage as defined by combat.ts.
- Attack-destroy draw → conditional Assassin / Thief package: cards that reward destruction may support aggressive target selection. Test whether the reward fires once, after destruction, and only when the attacking unit remains eligible.
- Graveyard triggers → destruction/save traps: multiple graveyard-related effects can interact. Verify order: destruction prevention, graveyard movement, to_graveyard effects, and on_destroyed effects.
- Fusion → summon-trigger trap: runtime currently routes Fusion through on_summon trap handling. Confirm this is intended and duration is correct.
- Protection on summon → spell/trap targeting: protection is implemented as untargetable for the current turn; test all target-selecting spell IDs and attacks separately.

## 3. Engine Capability / Data Mismatch Findings
- `combo` is present in card data but absent from `EffectTrigger` and parser trigger list. The FOLLOW-YOU-040 combo effect is therefore not generically parsed. Mark Unsupported at generic-parser level until runtime behavior is separately verified.
- Parser supports a narrow exact-text grammar; CMS free text can create rows that do not execute. The source explicitly says unsupported rows are filtered and UI marks them inactive.
- Generic effect parser supports ATK, damage, heal, draw, max HP, protect, and Evolution search patterns with strict trigger/target/duration/condition constraints. It does not imply arbitrary effect text support.
- `passive` parser permits self/allies targets. Passive ATK and HP effects are parsed only for specific exact duration/action patterns.
- Trap and Spell resolution is hardcoded by card ID. Seed effect metadata should not be treated as authoritative execution behavior for these card types.
- Fusion bonus values are loaded from fusion-pairs.json and returned by pair lookup. Only one pair is currently present.
- `combat.ts` reads element strengths from elements.json. Strong multiplier is 1.5 and weak multiplier is 0.75; if neither element lists the other, multiplier is 1.0.

## 4. Risk-ranked Testing
### P0 — Correctness before balance
1. SPL-003 / SPL-004: duration cleanup vs rules text.
2. SPL-007: effect metadata vs rules text/runtime target sides.
3. Combo trigger: data exists but generic parser does not list it.
4. Evolution cancellation: confirm full rollback and resource handling.
5. TRP-004: summon/fusion applicability and exact lock duration.
6. TRP-009: full-hand return fallback.
### P1 — Competitive impact
7. SPL-005 draw 2 under hand cap.
8. SPL-007 ownership swap and legal target/protection rules.
9. SPL-008 attack-lock turn boundary.
10. SPL-009 poison refresh/stack/tick timing.
11. TRP-001 and TRP-009 response priority when multiple traps are available.
12. TRP-008 save behavior with repeated/simultaneous damage.
### P2 — Meta and deck diversity
13. Summon-draw card density and early-game consistency.
14. Attack-buff effect repetition and condition differentiation.
15. Element matchup coverage and intended matrix asymmetry.
16. Evolution/Fusion frequency, cost, and board-slot tradeoffs.

## 5. Balance Recommendations (no stat changes)
- Do not tune card strength until runtime correctness and effect activation are verified.
- Use playtest metrics: win rate, card usage, cast rate, trap activation rate, draw advantage, evolution/fusion frequency, turns to victory, and average LP damage.
- If a card is too dominant, potential adjustment levers are: condition, target eligibility, cost, duration, once-per-turn/game limit, response window, or deck-building restriction.
- If a card is underused, investigate whether its effect is unsupported, difficult to activate, poorly described, or strategically redundant before considering any change.
- Keep all HP and ATK values unchanged.

## 6. Status
- This is a source-based analysis, not a simulated meta or statistical win-rate report.
- No card data or code changed.
- Owner approval is required before any proposed balance change is implemented.