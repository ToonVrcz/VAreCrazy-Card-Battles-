# VAreCrazy Card Battles — Master Project Handoff for Claude

**Prepared:** 2026-11-25  
**Repository:** `ToonVrcz/VAreCrazy-Card-Battles-`  
**Target branch:** `balance/full-70-card-handoff`  
**Owner / final decision-maker:** Toon  
**Design, balance and analysis:** Ball (ChatGPT)  
**System architecture and implementation review:** Claude  
**Document status:** CONSOLIDATED HANDOFF — REVIEW FIRST; implementation authority remains limited by the approvals below.

> This document consolidates the known project decisions, prior design work, audit requests and linked handoff documents. It is not permission to change production data, game rules, schema, APIs, or deploy. Where status is uncertain, Claude must inspect the current repository and live environment and report evidence instead of assuming.

---

## 1. Claude's role and working protocol

Claude is asked to take ownership of technical continuation: inspect the current codebase, CMS/Admin, engine, tests, data model and existing branches; identify what is complete, incomplete, duplicated or blocked; then prepare a safe implementation plan.

Ball remains responsible for card-game design, balance analysis, effect proposals and rules analysis. Toon is the final decision-maker.

### Required workflow
1. Read this master handoff and all linked documents in Section 2.
2. Inspect the current target branch, default/main branch, relevant feature branches and recent commits. Do not blindly apply stale proposals.
3. Inspect current code and live data before recommending or implementing anything.
4. Reconcile the documents with current code and database state. Report conflicts and changed facts.
5. Separate every item into: **Existing / Verified**, **Proposed**, **Owner-approved design**, **Implemented**, **Needs owner decision**, or **Blocked**.
6. Provide a written audit and an implementation plan, including files, handlers, schema impact, tests, risks and rollback plan.
7. Stop for Toon approval wherever this handoff says approval is required.
8. Work only in a dedicated non-production branch after approval. Do not merge, deploy or write production data without separate explicit permission.

Do not treat a previous design approval as approval for implementation, DB writes, migrations, merge or deployment.

---

## 2. Existing project handoff documents — read in full

These documents contain detailed tables and must not be replaced by this summary:

1. `docs/balance/VARECRAZY_FULL_70_CARD_BALANCE_HANDOFF_2026-11-25.md`
   - Full 70-card snapshot, proposed DEF values and effect balance review.
2. `docs/balance/VARECRAZY_STORY_DEBUFF_MIXED_PROPOSALS_ADDENDUM_2026-11-25.md`
   - Immutable baseline of 8 existing Story rows, plus 8 positive, 8 negative and 5 mixed Story proposals.
3. `docs/market/VARECRAZY_LV15_SIGNATURE_SPELL_TRAP_39_CARDS_2026-11-25.md`
   - Full catalogue of 39 dedicated Spell/Trap designs, one per Lv.15 character, priced at 300 Point.

These are additive documents. Do not rewrite or delete them. The master document is an index and coordination brief.

---

## 3. Project snapshot and game structure

The 2026-11-25 handoff recorded this database snapshot (Claude must re-check current state):
- 39 Character cards at Lv.15
- 7 Character cards at Lv.40
- 2 Character cards at Lv.70
- 10 Spell cards
- 10 Trap cards
- 1 Evolution card
- 1 Fusion card
- Total: 70 cards

The existing game design notes:
- Main Deck: 40 cards per player.
- Starting hand: 5 cards.
- One normal character summon per turn.
- Seven character slots on the field.
- LP (Life Points) system.
- Evolution Deck is separate from Main Deck.
- Evolution cards are intended to be face-up on the board; required face-up Evolution count: Lv.40 = 1, Lv.70 = 2, Lv.99 = 3.
- An unresolved rules question remains: whether face-up Evolution cards are consumed or remain after evolution. Do not decide this without Toon.
- Evolution ritual notes: use an Evolution card from hand, send two character cards on the field to the Graveyard, then place the evolved card. Check current implementation and current GDD before making any change.

Known special card interactions from prior design:
- SPL-007: exchange one friendly character with one opposing character (cross-side exchange), atomic; validate both destinations before changing either side.
- TRP-005: cancel an enemy evolution; discard the Evolution card; evolved form reverts; sacrifice materials are not consumed. Validate against current rules and implementation.
These descriptions are design context; Claude must verify actual current engine behavior before changing it.

---

## 4. Card balance — Ball's assigned work

Ball is responsible for analysis and balance proposals for all character and support cards.

### Fixed constraints
- Do not change base HP or base ATK of any character.
- For the balance proposal, use DEF and Effect values/conditions/limits/text as the available balance levers.
- Do not alter existing Story or Fusion HP/ATK bonuses.
- Do not change game rules, turn structure, deck size, summon limits, evolution sacrifice rules, board slots, DB schema, API contracts or engine architecture without explicit owner approval.
- The detailed proposed DEF and effect changes are in the Full 70-Card Balance Handoff. Claude must compare them with current main and any landed changes, and apply only deltas that remain valid after approval.
- These are design recommendations, not proven win-rate results; no playtest telemetry was supplied in that handoff.

### Claude's task
Audit every card's actual current values and effects. Identify current-vs-proposed differences, supported effect handlers, timing/once-per-turn enforcement, caps, event idempotency, target validation, hand limits and interactions. Return a per-card implementation/readiness report. Do not silently alter card stats or effects.

---

## 5. Story / Debuff / Mixed Story system

### Immutable existing data
The Story addendum records 8 existing live DB rows as an observed baseline. The exact values, row IDs and descriptions must be preserved. Especially important: BACKJI-015 / NONG-TAENGMO-015 has two directional rows with different stats. Never merge, normalize, deduplicate, rename, edit or delete either row.

The Story addendum lists:
- 8 new positive Story proposals
- 8 negative/Debuff proposals
- 5 mixed Story proposals

All new entries are proposals only. They are not confirmed DB rows and must not be written to Supabase without explicit approval.

### Proposed runtime behavior requiring review
- Story applies only while both linked characters are simultaneously on the field.
- It stops immediately when either linked character leaves the field.
- Modifiers affect effective in-game stats only; never mutate stored/base card stats.
- Positive and negative modifiers are supported conceptually; Mixed Story may apply multiple modifiers.
- Avoid duplicate stacking; recalculate from current field state.
- Do not invent HP, healing, death, clamping, control-change, Fusion or Evolution semantics.
- Determine whether pair matching is directional in the current model and inspect whether schema supports multiple modifiers per Story.

Claude must read the Story addendum, snapshot current live rows including IDs and all fields, compare with the recorded baseline, identify duplicate pairs in either direction, inspect schema/runtime/CMS, then propose the smallest safe design. No DB write, migration or implementation until approved.

---

## 6. Signature Spell / Trap cards for 39 Lv.15 characters

Toon approved the **design proposal** of exactly one dedicated Spell or Trap per each of the 39 Lv.15 characters:
- 39 additional cards: 25 Spell and 14 Trap (as recorded in the catalogue).
- 300 Point per card; 11,700 Point total gross catalogue value if all 39 are purchased once.
- Each is tied to its named character and requires that character to be on its owner's field.
- These cards are additive; they do not replace existing cards.
- Existing base stats, existing card effects, Story and Fusion records remain unchanged.

Approval is design-only. Claude must inspect schema, CMS, effect configuration/resolver, target selection, Trap timing, duration handling, Graveyard transitions, deck/hand limits and market/shop flow. Map all 39 proposed effects to existing handlers. Mark unsupported effects BLOCKED and ask Toon for an alternative; do not invent engine capabilities. No DB writes, migrations, market implementation, merge or deployment are authorized by this design approval.

Read the complete card list and special notes in the Signature Spell/Trap document.

---

## 7. Element System — audit before designing new rules

### Preliminary findings already observed
Files previously inspected on branch `balance/full-70-card-handoff`:
- `db/seed/elements.json`
- `card-data-export/source-seed-verbatim/elements.json`
- `card-data-export/card-schema.json`
- `src/server/gamedata.ts`

The seed file contains 12 elements:
- fire (ไฟ)
- water (น้ำ)
- lightning (สายฟ้า)
- earth (ดิน)
- nature (ธรรมชาติ)
- poison (พิษ)
- alchemy (เล่นแร่แปรธาตุ)
- dark (มืด)
- holy (แสง)
- physical (กายภาพ)
- neutral (กลาง)
- wind (ลม)

The seed data records advantage/disadvantage multipliers:
- Strong / advantage: ×1.5
- Weak / disadvantage: ×0.75

The `cards` schema has nullable `element_id`. Fusion validation in `src/server/gamedata.ts` has a `must_match: 'element'` condition.

**Important discrepancy:** `db/seed/elements.json` and `card-data-export/source-seed-verbatim/elements.json` contain different strong matchup mappings. Do not overwrite either file or choose a source of truth without investigation and owner decision.

### Not yet confirmed
- Whether every character card has an element assigned.
- Whether all Spell/Trap cards have element assignments or need them.
- Whether combat damage calculation actually applies ×1.5 / ×0.75.
- Whether combat UI displays green advantage values and red disadvantage values.
- Whether CMS supports full element management.
- Whether Fusion element matching is active in the live path and tested.

### Required audit
Inspect:
- `db/seed/elements.json`
- `card-data-export/source-seed-verbatim/elements.json`
- `src/engine/cards.ts`
- `src/server/gamedata.ts`
- `card-data-export/card-schema.json`
- combat damage calculation and combat UI components
- CMS element management
- current card records and Fusion validation/tests

Return a status table:
- Element Data — Complete / Incomplete
- Card Element Assignment — Complete / Incomplete
- Element Advantage Calculation — Implemented / Not Implemented
- Combat Damage Multiplier — Implemented / Not Implemented
- Advantage UI (green) — Implemented / Not Implemented
- Disadvantage UI (red) — Implemented / Not Implemented
- CMS Element Management — Complete / Incomplete
- Fusion Element Matching — Implemented / Not Implemented

For every status, cite exact file paths, functions/components and tests. This is an audit only. Do not change element data, multipliers, card assignments, combat rules or UI. After the audit, Toon and Ball will design and approve the final Element rules together.

---

## 8. CMS Admin and extensibility

The project is expected to add new card formats and new rules in the future. CMS/Admin therefore needs to be assessed for maintainability and extensibility, not just current card entry.

Claude should inspect:
- Card type/category handling and whether new card types can be added safely.
- Level, element, stats, effect configuration and effect descriptions.
- Story and Fusion relationship management.
- Evolution chain and Evolution card management.
- Spell/Trap activation conditions and effect configuration.
- Validation, preview, draft/review/published workflow and audit history.
- Whether CMS forms and server validation share a reliable source of truth.
- How future rules/effect handlers can be added without hard-coded assumptions spread across UI/API/engine.

Do not redesign schema, APIs or architecture unilaterally. First return a gap analysis and a proposed extensibility design for Toon to approve.

---

## 9. Security and game-engine audit context

A previous audit report recorded 20 issues: P0 ×1, P1 ×5, P2 ×4, P3 ×10. It also recorded:
- XSS risk
- Evolution Sacrifice Bypass
- PvP Reward Farming
- Array.prototype mutation
- Tests at that time: `npm test` 232/232 passed and CMS E2E 14/14 passed

A separate PvP reward review identified possible abuse:
- Guest profile creation without adequate rate limiting.
- Reward awarding logic reportedly gave both players 200 points regardless of winner.
- Two-account farming risk.
- Missing opponent tracking.

These are historical audit findings, not a statement that the current branch still contains these vulnerabilities. Claude must inspect current code, relevant fixes and test history. Check the existing branch `fix/audit-p0-p1` and any later commits before proposing duplicate fixes. Do not assume vulnerabilities are still open or resolved without evidence.

Claude must report current status, exploit paths, regression tests and remaining severity. Do not alter reward economics or production data without approval.

---

## 10. Existing data preservation — absolute requirements

The following live data must be treated as immutable unless Toon gives explicit, specific authorization:
- All existing Story rows and their IDs, directions, names, stats, amounts and descriptions.
- All existing Fusion partner records and bonuses.
- Existing card Base HP / ATK (and no DEF changes except an explicitly approved balance implementation).
- Existing Evolution rules and chains.
- Existing card records, effects and published state outside explicitly approved additive changes.

Prior observed snapshot:
- 8 Story rows and 37 Fusion records were read from live DB on 2026-11-25.
- Exported `card-relations.json` was empty at that time and may not represent live relations. Live DB was considered authoritative for existing Story/Fusion records.
Claude must take a fresh before-snapshot and compare it before any future approved write.

**Never** merge, normalize, deduplicate, rename, “clean up”, overwrite or delete existing Story/Fusion relations as part of this work.

---

## 11. Branches, repo references and prior artifacts

Known references from the prior work:
- Working branch: `balance/full-70-card-handoff`
- Parent balance handoff commit: `7aec5f52cdcc99a7d6b3bd44134656f3c69e8917`
- Story addendum commit: `281739730dfd85bdba2bb60a9ed6d0f67fa262aa`
- Signature Spell/Trap document commit: `423e7883a662ff98ddba32b4114eecf5aee46698`
- Supabase project ref previously used for inspection: `jcjqooeckoapoikcwpet` (project `varecrazy-card-battle`, previously reported ACTIVE_HEALTHY).

Claude must verify these refs still exist and inspect the current branch head. Do not assume these SHAs are current HEAD.

---

## 12. Recommended work order

### Phase A — Repository and environment inventory (audit only)
- Inspect branches, commits, current main and current working branch.
- Inspect app architecture, engine, CMS, schema, tests and current deployment workflow.
- Produce a status matrix and list of discrepancies against these handoffs.

### Phase B — Data integrity snapshot (read-only)
- Snapshot current cards, Story rows, Fusion rows, Evolution relations and elements.
- Compare live data with the recorded 70-card snapshot and all immutable baselines.
- Identify missing, duplicate, changed or unexported records.
- Do not write or repair anything.

### Phase C — Feature audits (read-only)
- Full card balance and effect-handler mapping.
- Story positive/negative/mixed feasibility and duplicate-pair audit.
- 39 signature Spell/Trap handler/CMS/market feasibility.
- Element assignment, combat multiplier and green/red UI audit.
- CMS extensibility review.
- Security/PvP reward audit and verify prior P0/P1 remediation status.

### Phase D — Owner review
Return one consolidated report with:
- Verified existing behavior.
- Already implemented work.
- Outstanding issues.
- Proposed changes and expected impact.
- Files and database objects affected.
- Schema/API requirements.
- Tests and rollback plan.
- Risks and unresolved design questions.
- Explicit list of decisions needed from Toon.

**Stop here until Toon approves the specific implementation scope.**

### Phase E — Approved implementation only
After explicit approval for a named scope:
- Use a dedicated branch.
- Keep changes minimal and additive.
- Add/adjust tests.
- Preserve all immutable records.
- Do not touch production DB, merge or deploy unless separately authorized.
- Report commit SHA, changed files, tests, limitations and manual verification steps.

---

## 13. Approval matrix

| Work item | Current authorization |
|---|---|
| Read-only repository/code/database audit | Requested |
| Card balance analysis and proposals | Assigned to Ball; proposal in handoff |
| Implement DEF/effect balance changes | Requires Toon approval after Claude reconciliation |
| Story positive/negative/mixed design | Proposals only; requires review and approval |
| Write new Story rows to DB | Not authorized |
| Change existing Story/Fusion rows | Not authorized; preserve exactly |
| 39 signature Spell/Trap design | Owner-approved design |
| Implement signature cards / write DB | Not authorized |
| Element system audit | Requested |
| Redesign element rules or matchup chart | Not yet designed/approved |
| Change element assignments/multipliers/UI | Not authorized |
| CMS extensibility design | Audit and proposal requested |
| Schema/API/engine architecture changes | Requires separate approval |
| Security fixes | Historical findings; inspect current state, then request scope approval unless already explicitly authorized elsewhere |
| Production DB write / migration / merge / deployment | Not authorized by this handoff |

---

## 14. Message to Claude

Claude, please take this document as the central handoff and read all three linked documents in Section 2 in full. Begin with a read-only audit of the current repository, branches, code, tests and live data. Reconcile all previous proposals and audit findings against the actual current state. Do not assume that an old proposal is still needed or that an old vulnerability remains open.

Return a consolidated technical report and prioritized implementation plan. Do not modify code, schema, APIs, database records, production data or deployment state until Toon approves the exact scope. Preserve existing Story/Fusion records and all protected base stats exactly. If any requirement is ambiguous, mark it **BLOCKED — OWNER DECISION REQUIRED** rather than guessing.

**The goal is a safe, continuous handover: no lost design decisions, no duplicated work, no accidental rule changes, and no damage to existing game data.**
