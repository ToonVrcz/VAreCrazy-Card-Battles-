# VAreCrazy Card Battles — Bot AI & Combo Balance Simulation Handoff
**Date:** 2026-11-26  
**Owner / final approver:** Toon  
**Design and balance review:** Ball  
**Implementation / independent review:** Claude  
**Target repository:** `ToonVrcz/VAreCrazy-Card-Battles-`  
**Base code to inspect:** `main`  
**Working branch:** `audit/story-bot-player-feedback-2026-11-26`  
**Status:** SIMULATION / READ-ONLY INVESTIGATION ONLY — NO GAMEPLAY CODE CHANGES AUTHORIZED

---

## 1. Owner's explicit authorization

Toon approves investigation of BOTH:
1. Bot AI decision quality.
2. Combo damage and defensive balance.

The approved work is limited to source inspection, test design, deterministic simulations, offline analysis, and a written report.

**The following are explicitly NOT authorized in this task:**
- Do not edit game engine code, Bot AI code, card definitions, effects, Story values, game rules, or tests in the game source.
- Do not change any card's base HP or ATK.
- Do not change gameplay rules, turn structure, evolution requirements, combat formula, or legal-action behavior.
- Do not write to Supabase or any production database.
- Do not create or apply migrations, alter seeds, update CMS data, merge branches, deploy, or modify production configuration.
- Do not silently implement a proposed balance fix. Stop at findings and recommendations.

If a test harness requires source changes, do not add them to the game code. Prefer a temporary local script, isolated scratch workspace, or existing test runner without committing changes. If that is not possible, explain the blocker and propose a safe alternative.

## 2. Known player feedback

A player reported:
- A combo involving three cards caused more than 100 damage.
- No character seemed able to withstand the burst.
- Defensive play, healing, and damage reduction did not feel effective.
- Bot sometimes did not attack an evolved character and instead passed until it lost by deck-out.

The exact three cards are unknown. Do not invent or assume their identities. Try to discover reproducible high-damage sequences from the available card data, but clearly label them as simulated examples rather than the player's confirmed match.

## 3. Confirmed baseline findings from Ball's read-only audit

### 3.1 Story
File: `src/engine/game.ts`, function `refreshAuras()`.

- Story rows activate when the required partner chain is present on the same player's field.
- Each qualifying row contributes its modifiers to matching source-chain units.
- Distinct Story rows can stack on the same unit.
- The function recomputes aura totals from the current field; repeated refresh does not itself accumulate duplicate bonuses.
- Base ATK/DEF are not overwritten by Story; combat reads effective aura values.
- No explicit per-unit cap or diminishing-return rule was found in this path.
- Existing Story runtime tests assert that distinct rows can stack.
- Current repository seed `db/seed/story-links.json` contains 29 rows. This is a repository seed count only, not a verified live Production DB count.

Do not treat stacking as a bug automatically. It is current behavior and any cap would be a design change requiring Owner approval.

### 3.2 Bot
File: `src/engine/bot.ts`, function `botPick()`.

- Bot estimates character battle damage with ATK minus DEF and a minimum of 1.
- Engine combat uses `hit()` and `elementMultiplier()`; Bot's attack scoring does not include the elemental multiplier.
- Bot rewards lethal attacks with a score, but non-lethal attacks that are expected to result in the Bot unit dying receive score 0.
- If no attack has a positive score, Bot returns `{ t: 'next' }`.
- The evaluator is greedy and does not search attack sequences or explicitly value evolved targets by level/threat.
- Engine legality blocks a unit summoned/evolved this turn from attacking. Do not change this rule.

### 3.3 Combat
File: `src/engine/combat.ts` and attack path in `src/engine/game.ts`.

- Character-vs-character damage is calculated using effective ATK, effective DEF and the element multiplier, with the engine's rounding/clamping behavior.
- Direct LP attacks are different from character combat and should be reported separately.
- Combat traps, damage reduction and counterattacks can change the final result; do not approximate them away when validating a reported sequence.

## 4. Required workstream A — Bot AI simulation

Inspect the current `main` implementation and design deterministic scenarios for at least:

1. Element advantage, neutral, and disadvantage where Bot must rank legal attacks.
2. A weak Bot unit that can trade to destroy a Lv.40 or Lv.70 enemy.
3. A stronger enemy evolution that should be attacked when it is tactically correct.
4. An attack that appears attractive but leads to a losing counterattack.
5. Multiple attackers where attack order changes the result.
6. A legal favorable attack exists but Bot currently chooses `next`.
7. Bot can avoid deck-out by taking an available favorable action.
8. A newly evolved/summoned unit that is legally unable to attack this turn — verify Bot respects the existing rule.

For each scenario record:
- Initial state (turn, phase, active player, LP, hand/deck counts).
- Exact card IDs, levels, HP, effective ATK/DEF, elements and field slots.
- Legal actions returned by the engine.
- Current Bot choice.
- Engine-resolved result for each relevant legal attack.
- Best tactical choice and why.
- Whether the result is a Bot decision weakness or an engine legality rule.

Metrics across a reproducible batch:
- Bot win rate by matchup/deck archetype.
- Passes while a favorable legal attack exists.
- Missed lethal opportunities.
- Missed opportunities to destroy evolved targets.
- Unfavorable trades and units lost.
- Bot deck-outs while a beneficial legal attack was available.
- Average number of attacks and turns to finish.

Do not claim a Bot improvement based only on random game completion. Existing bot-vs-bot completion tests do not establish decision quality.

## 5. Required workstream B — combo damage and defensive simulation

Build a reproducible scenario matrix from the current repository card data. Include:

1. Character effects only.
2. Story disabled as a control.
3. Current Story stacking with all qualifying rows.
4. Signature spells and traps, with linked-character requirements satisfied.
5. Passive effects plus Story plus Signature buffs.
6. Fusion interactions where supported by current engine data.
7. Element advantage, neutral, and disadvantage.
8. Target DEF variations using existing cards only.
9. Defensive responses: DEF buffs, healing, damage reduction, attack cancellation, attack redirection, negate/protection, and survival effects where supported.
10. Multi-hit / multi-attacker turns and damage split across character HP versus player LP.

For every high-damage sequence report:
- Exact card IDs and names, with source file and status where available.
- Required field setup and chain partners.
- Hand cards consumed and setup turns needed.
- Order of actions and triggers.
- Effective ATK before and after each buff.
- Target effective DEF and element matchup.
- Damage per attack/effect and cumulative damage.
- Whether damage is battle damage, spell/effect damage, or direct LP damage.
- Which defensive options were legal and whether they prevented, reduced, or merely healed damage.
- Whether the sequence is possible in one turn under the current rules.
- Whether the source cards are published, draft, or status unknown in the repository data.

Do not mix draft-only Signature cards with published cards in the primary production-like results. Provide separate result groups:
- **Set A:** cards confirmed as available/published from the inspected source data.
- **Set B:** draft or unverified cards, as experimental-only scenarios.

If current repository data cannot establish live card publication state, say so explicitly. Do not represent seed status as proof of Production availability.

### Damage metrics
- Maximum damage in one attack.
- Maximum combined character damage in one turn.
- Maximum direct LP damage in one turn.
- Number of attacks/effects required to defeat a character at each existing level where data permits.
- Percentage of tested defensive setups surviving the combo.
- Healing amount versus incoming damage.
- Damage prevented by DEF, reduction, cancellation, redirect, and negate — reported separately.

### Story experiments
Compare current Story behavior against isolated simulation-only alternatives, without changing the rules or source:
- Current stacking.
- One qualifying Story row per source unit.
- Experimental cap to Story ATK contribution (test several clearly stated hypothetical cap values).
- Separate ATK and DEF Story caps.
- HP Story effects measured separately.

These are sensitivity experiments only. Do not recommend a cap until results show its effect on game outcomes and Owner has reviewed it. Existing tests intentionally permit distinct Story rows to stack.

## 6. Technical requirements and safe workflow

- Work from a clean checkout of current `main` for the authoritative baseline.
- Read the current audit at `docs/balance/PLAYER_FEEDBACK_STORY_BOT_AUDIT_2026-11-26.md`.
- Inspect relevant source and tests rather than relying only on this handoff.
- Reuse the real engine's combat resolution for outcome verification wherever possible; do not maintain a second approximate damage formula as the source of truth.
- If using a custom simulation harness, document where it lives, how it runs, assumptions, random seed, and reproducibility.
- Use fixed seeds for deterministic tests and include commands to reproduce each important finding.
- Preserve the current rules and card values exactly.
- Do not commit source-code changes. A report-only commit is acceptable on the working branch.
- Do not merge or deploy.

## 7. Deliverables required from Claude

Create a report-only Markdown file, preferably:
`docs/balance/BOT_AI_COMBO_SIMULATION_RESULTS_2026-11-26.md`

The report must contain:

1. Executive summary and scope.
2. Environment, base commit SHA, commands run, test counts and limitations.
3. Bot scenario table with current choice versus tactically best legal choice.
4. Combo scenario table with exact card IDs and calculations.
5. Defensive-response comparison.
6. Story stacking sensitivity table.
7. Reproducible cases and scripts/commands.
8. Findings ranked by severity and confidence.
9. Proposed fixes separated into:
   - Bot decision logic recommendations.
   - Balance/effect/DEF recommendations (do not change base HP/ATK).
   - Instrumentation / combat-log recommendations.
10. Explicit list of files changed. Expected: report only; no gameplay source changes.
11. Clear statement that no DB, Production, merge, or deployment action was taken.

For each proposed fix, explain expected benefit, trade-offs, risk of unintended consequences, and tests required. Do not implement any fix in this task.

## 8. Stop and approval gates

Stop and return the results report to Toon for review.

Only after Toon reviews the report may a separate request authorize implementation. Any later code work must use a separate implementation branch and must not change base HP/ATK, rules, or Production without separate explicit approval.

**If you discover a critical issue during the audit, document it and notify Toon; do not hotfix it under this authorization.**

---

## 9. Claude task prompt (copy/paste)

Claude, please inspect this repository and execute the read-only investigation described in this document. Your scope is BOTH Bot AI and combo/damage/defensive balance. Reproduce findings with deterministic scenarios using the real engine where possible. Do not guess the player's unknown three-card combo. Do not modify game source, Bot code, card values, Story seed, rules, tests, database, or Production. Do not change base HP/ATK or gameplay rules. Do not merge or deploy. You may commit only the final Markdown results report to this audit branch. Return the report link, base commit SHA, commands/tests run, simulation results, limitations, and a list of changed files. Stop for Toon’s approval before proposing or implementing any code changes.
