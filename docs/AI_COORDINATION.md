# AI Coordination Protocol — VAreCrazy Card Battles

**Repository:** `ToonVrcz/VAreCrazy-Card-Battles-`  
**Owner:** Project Owner (user)  
**AI roles:** Claude = System Architect/CMS Developer; ChatGPT (Ball) = Game Balance Analyst  
**Status:** Coordination protocol; does not authorize gameplay or production changes.

## 1. Shared Principles
- GitHub is the shared source of truth for project artifacts, findings, decisions, and handoffs.
- Use the same repository state and explicitly name the branch/commit being reviewed.
- Separate verified facts, assumptions, proposals, and Owner decisions.
- If information is missing or uncertain, mark it **UNKNOWN / NEEDS VERIFICATION**; do not guess.
- AI findings are recommendations, not approved design decisions.
- Preserve existing game behavior and card data unless the Owner explicitly approves a change.

## 2. Roles

### Claude — System Architect & CMS Admin
Owns technical audits and CMS/System design:
- Engine, Parser, Runtime, API, and database capability audit.
- Trigger/effect support status: Supported, Experimental, Deprecated, Unsupported, or Needs Verification.
- CMS UX/workflow, Effect Registry, configuration schema, validation, extensibility, and technical design proposals.
- Clearly classify proposed work as CMS-only, Server/API, Engine, or Database.
- Follow the CMS handoff document and current phase. Do not implement Phase C until the Owner approves Phase B.

### ChatGPT (Ball) — Game Balance Analyst
Owns gameplay/card balance analysis:
- Analyze all card types and the whole game ecosystem, not cards in isolation.
- Assess effects, conditions, costs, restrictions, targets, duration, usage limits, DEF, synergies, combos, Fusion, Evolution, elements, classes, affiliations, deck consistency, counterplay, and strategic utility.
- Identify overpowered/underpowered cards, exploitable loops, excessive consistency, weak restrictions, and problematic interactions.
- Produce structured Balance Audit and Balance Proposals with evidence and reasoning.

**Balance constraint:** Existing HP and ATK values must not be changed as part of this audit. They may be flagged as observations only; any stat-change proposal requires separate Owner approval. Balance proposals should focus on mechanics such as effects, DEF, costs, conditions, restrictions, targets, duration, limits, and interactions.

Ball must not duplicate Claude's CMS architecture work or assume an effect works merely because its card text describes it. Use Claude's verified capability findings; distinguish intended design from actual implementation.

### Owner
- Makes final decisions on rules, card balance, architecture, scope, implementation, and release.
- Approval must be explicit before gameplay/card data, Engine, schema, production, or deployment changes.

## 3. Shared Work Artifacts
Suggested paths:
- `docs/AI_COORDINATION.md` — this protocol.
- `docs/CMS_SYSTEM_AUDIT.md` — Claude's verified technical audit.
- `docs/CMS_DESIGN_PROPOSAL.md` — Claude's Phase B design proposal.
- `docs/BALANCE_ANALYSIS.md` — Ball's card/system balance audit.
- `docs/BALANCE_PROPOSALS.md` — proposed card balance adjustments.
- `docs/GAME_RULES_REFERENCE.md` — Owner-approved rules reference.
- `docs/AI_RESPONSES/` — structured cross-AI responses, if needed.

Do not overwrite another AI's artifact without coordinating. Append dated sections or create a new response file when appropriate.

## 4. Handoff Format
Every handoff should include:
- **From / To**
- **Date**
- **Branch and commit reviewed**
- **Status:** INFORMATION / REVIEW_REQUIRED / BLOCKED / OWNER_DECISION_REQUIRED / APPROVED
- **Subject**
- **Verified findings**
- **Assumptions / unknowns**
- **Questions or requested actions**
- **Files/sections referenced**

Use exact file paths and card IDs when available. Avoid vague references such as “the effect above.”

## 5. Workflow
1. Claude completes the CMS/System Audit and Phase B Design Proposal.
2. Ball reviews the repository card data and rules, using verified Engine findings where relevant, and prepares a Balance Audit.
3. Findings and conflicts are documented in GitHub artifacts or Issues.
4. The Owner reviews and approves/rejects proposals.
5. Only approved proposals move to implementation.
6. Tests and review are completed before any release.
7. Deployment or merge to `main` requires explicit Owner authorization.

## 6. Safety / Change Boundaries
Unless explicitly authorized by the Owner:
- Do not deploy.
- Do not merge or push changes to `main`.
- Do not modify production data, economy, database schema/migrations, gameplay rules, card stats, or card data.
- Do not implement unapproved CMS Phase C or balance proposals.
- Do not treat an AI suggestion, comment, or report as Owner approval.

## 7. Technical Capability Evidence
Claude's system findings should cite the relevant source files, functions, tests, or runtime call sites. Ball's balance findings should cite card IDs/data and applicable rules. If the evidence is unavailable, mark the conclusion as provisional.

## 8. Decision Log
Owner-approved decisions should be recorded with:
- Decision
- Date
- Scope
- Rationale
- Approved by Owner
- Related issue/PR/file

This protocol coordinates AI work; it does not change the game's rules or authorize implementation.
