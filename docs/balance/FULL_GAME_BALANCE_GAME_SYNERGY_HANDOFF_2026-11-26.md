# Full Game Balance & Game Synergy Simulation Handoff
**Date:** 2026-11-26  
**Repository:** `ToonVrcz/VAreCrazy-Card-Battles-`  
**Branch:** `analysis/full-game-balance-game-synergy-2026-11-26`  
**Status:** Analysis / simulation request only — NOT approved for production implementation.

## 1. Purpose

Evaluate the whole card-battle ecosystem after adding the proposed **Game Synergy** mechanic, considering its interaction with:

- Story
- Fusion
- Signature
- Spell and Trap cards
- Elemental damage
- Evolution / higher-level cards
- Existing archetypes: Aggro, Tank, Heal, Combo, Control, Random

The goal is to improve matchup health without changing any card's base HP or ATK. Game Synergy is intended to add defensive durability only.

## 2. Non-negotiable owner constraints

1. **Do not change base HP or base ATK values.**
2. Game Synergy must not grant ATK.
3. Do not modify production card data, database records, CMS data, game rules, or live Game Engine behavior as part of this task.
4. Do not merge, deploy, or modify the production branch.
5. Work in an isolated simulation/test branch. Any implementation required for simulation must be clearly isolated and must not change production behavior.
6. Treat all proposed values below as hypotheses to test, not approved final balance values.
7. Preserve the existing rule that Starter decks (Lv15, Spell, Trap, Evolution, Fusion) should remain capable of competing. Higher-level cards and Signature are progression, not an automatic win.
8. Report evidence, assumptions, reproducible commands, and limitations. Bot results are directional and must not be represented as human-player results.

## 3. Current evidence baseline

Latest corrected Starter bot baseline (30 games per matchup; LP 100; 29 Story rows in the corrected dataset):

| Archetype | Baseline win rate |
|---|---:|
| Aggro | 92.3% |
| Combo | 58.7% |
| Random | 59.7% |
| Heal | 48.7% |
| Control | 29.3% |
| Tank | 11.4% |

After the P1 Fusion self-Story fix, Combo was reported at **57.7%**; other archetypes were unchanged.

Important caveats:
- These are bot-vs-bot Starter simulations, not human match data.
- The sample size is limited; use these results as directional evidence only.
- The earlier simulation using only 8 Story rows and 1 Fusion pair was incomplete and must not be used as the production baseline.
- An earlier harness accidentally duplicated Story rows (50 instead of 29); corrected figures must use the 29-row dataset.
- Advanced-deck comparisons were contaminated by incomplete higher-level archetype coverage and are not definitive.

### Story / Fusion findings already reported

- Story-off Combo: 50.3%; Story-on Combo before P1: 58.7%.
- Post-P1 Story-on Combo: 57.7%. This suggests Story still has a material effect and warrants further analysis.
- Story can provide up to approximately +10 ATK / +5 DEF / +20 HP to a unit under the reported current configuration; total board ATK uplift can be substantial.
- Story HP aura may be reapplied after a unit leaves and re-enters the field, potentially creating repeat healing. Verify whether this is still present and quantify it.
- The P1 fix prevents a Fusion unit from satisfying its own Story partner condition through its two constituent chains. It does not prevent a separate unit from providing a valid Story partner.
- Fusion requires a distinct Fusion card plus two eligible character cards; the Fusion card is consumed/sent to the graveyard. Preserve this rule.

### Damage findings already reported

- FOLLOW-YOU Lv70 base ATK 105; with Story + SPL-004 reported as 120.
- 1GOKU Lv40 / FOLLOW-YOU Lv70 with Signature ATK spell/trap reported as 120, and up to 180 with elemental multiplier.
- TEE Lv40 Signature reported as 100 / 150 with element.
- Lv15 BOBO/DNMAN + Signature + SPL-004 reported as 90 / 135 with element.
- Direct attack cap is currently 60 with LP 100. Keep this cap during this balance study; removing it risks very fast lethal damage.
- Increasing LP from 100 to 150/200/250 reportedly adds only about one turn per +50 LP and does not solve win-rate imbalance by itself.

These figures are previously reported audit observations. Reproduce them against the exact current branch before treating them as confirmed.

## 4. Proposed Game Synergy — simulation hypothesis

CMS currently stores affiliations / games played together, but the Game Engine does not yet apply these as a Game Synergy aura.

Proposed starting values:

| Game Synergy group | HP bonus | ATK bonus | DEF bonus |
|---|---:|---:|---:|
| Among Us | +3 | 0 | +2 |
| FiveM | +3 | 0 | +1 |
| Goose Goose Duck | +3 | 0 | +2 |
| R.O.V | +3 | 0 | +2 |
| Ragnarok | +3 | 0 | +1 |
| Roblox | +3 | 0 | +1 |
| WarZ | +3 | 0 | +2 |
| Board Games | +3 | 0 | +1 |
| Ghost Stories | +3 | 0 | +2 |

### Proposed activation and stacking rules to test

- A synergy activates when at least **two distinct units** on the same player's field share the same Game Synergy group.
- Once active, apply the listed bonus to eligible units in that group (confirm exact intended recipient scope in the simulation report; test both “all units in that group” and “all friendly units” only if needed to resolve ambiguity).
- Additional copies beyond the minimum two do not multiply the bonus.
- If a player qualifies for multiple different groups, test additive stacking with a global cap of **Game Synergy HP +10 / DEF +4 per unit**.
- Game Synergy ATK is always 0.
- Remove the aura immediately when the activation condition is no longer met.
- Avoid repeated HP grants/healing caused by aura refresh or leaving/re-entering the field. Distinguish max-HP increase from current-HP restoration and report exactly how the current engine represents HP.

The table, activation rules, recipient scope, and caps are proposals for simulation only. Do not write them into production card data or rules without owner approval.

## 5. Target design goals (not test results)

Use these as provisional goals when evaluating the matchups:

| Archetype | Desired win-rate band |
|---|---:|
| Aggro | 55–65% |
| Tank | 40–55% |
| Heal | 45–55% |
| Combo | 50–60% |
| Control | 45–55% |
| Random | 45–55% |

Do not force every archetype into the target band by changing base HP/ATK. Identify the actual cause of each outlier and recommend the smallest reversible adjustment.

## 6. Requested simulation plan

Run the work in separate, reproducible stages:

### Stage A — Reproduce baseline
- Check out the exact current source and data revision.
- Verify the 29 Story rows and current Fusion pair dataset.
- Re-run baseline without Game Synergy.
- Report per-archetype win rate, match count, average turns, damage per turn, character deaths, and direct-attack/lethal frequency.
- Include seed, deck composition, bot policy, and commands.

### Stage B — Isolated Game Synergy tests
At minimum compare:
1. No Game Synergy (control group).
2. Proposed table with two-unit activation.
3. Proposed table with stacking cap.
4. Alternative activation recipient scope if ambiguity materially changes outcomes.
5. HP-only versus HP+DEF proposed values, keeping ATK at zero.

Do not change Story, Fusion, Signature, Spell/Trap, elements, LP, or direct attack cap between these runs.

### Stage C — Whole-system interaction tests
After Stage B, test interactions with:
- Story + Game Synergy
- Fusion + Story + Game Synergy
- Signature + Spell/Trap + elemental multipliers + Game Synergy
- Evolution / Lv40–99 progression against Starter decks
- Aggro vs Tank / Heal / Control and Combo vs Control

Keep the same decklists, seeds, bot policy, and sample counts between comparison groups.

### Stage D — Exploit and regression tests
Explicitly test:
- Aura activation/deactivation at exactly two units and when one unit leaves.
- Three or more matching units do not multiply bonuses unexpectedly.
- Multiple synergy groups do not exceed the proposed per-unit caps.
- Re-entry / aura refresh cannot repeatedly heal or inflate current HP.
- Fusion's consumed spell card and two character materials remain distinct cards and are consumed exactly once.
- Fusion cannot self-trigger Story through its own constituent chains.
- No negative interactions with 7 field slots, summon-per-turn rules, graveyard, or Evolution.
- No ATK bonus is introduced by Game Synergy, directly or indirectly.

## 7. Required report output

Create a Markdown report under `docs/balance/` containing:

1. Exact commit SHA, branch, data revision, test commands.
2. Dataset counts and any exclusions.
3. Baseline vs each Game Synergy variant in tables.
4. Matchup matrix and archetype win rates.
5. Average turns, damage/turn, deaths, direct attack/lethal frequency.
6. Story and Fusion interaction results.
7. Starter vs progression results, with caveats if deck coverage is incomplete.
8. Exploit/regression test results.
9. Whether each target band was met.
10. A short recommendation: reject / revise / continue testing, with reasons.
11. Exact list of files changed and confirmation that production data/engine were not changed.

## 8. Decision gates

- **This task authorizes analysis and isolated simulation only.**
- Do not implement the proposed Game Synergy in the live Game Engine or CMS.
- Do not change actual card stats, card effects, game rules, or production database.
- Do not merge or deploy.
- Stop and ask the owner before any production-facing implementation.
- When finished, return the report, test commands, branch name, commit SHA, and a concise list of decisions requiring owner approval.

## 9. Existing P1 context

Previously reported candidate branch:
- `fix/fusion-self-story-p1`
- Commit: `6189690e5cff5435ac83c359ce0c69d8eeb69bc8`
- Reported tests: 579/579 passing.
- This branch was not merged or deployed.

Audit branch:
- `audit/balance-story-starter-2026-11-26`
- Addendum commit: `8ce9c6a`

Verify these refs still exist and inspect their exact contents before relying on them. Do not merge either branch as part of this task.
