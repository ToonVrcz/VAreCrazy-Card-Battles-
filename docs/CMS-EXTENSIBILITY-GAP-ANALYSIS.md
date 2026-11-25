# CMS / Admin extensibility — gap analysis and proposal (2026-11-25)

Scope: Master Handoff §8. **Analysis and proposal only — nothing here is implemented or approved.** Toon decides which parts to build.

## 1. What exists today (verified in code)
| Area | State | Where |
|---|---|---|
| Card types | `character, evolution, spell, trap, item, fusion` fixed by a DB CHECK | `db/migrations/006_game_systems.up.sql` |
| Workflow | draft → in_review → approved → published, bulk publish, audit log, export/import (JSON/CSV) | `service.ts` (`audit`, import/export), `public/admin.html` |
| Effect editor | Registry-driven (supported / experimental / deprecated / unsupported), split system config vs player text, warn-only consistency check | `src/engine/effect-registry.ts`, `effect-text.ts`, `public/admin-tools.js` |
| Effect → engine | Free-text Admin wording is parsed by regex into engine effects; anything not understood is shown as "not active" | `src/engine/effects.ts` `parseEffect` |
| Story / Fusion / Affiliation | CRUD APIs; Story now has `modifiers[]` and `story_type` in the DB and API | `api.ts` `/api/stories`, `/api/fusion`, `gamedata.ts` |
| Signature Spell/Trap | Data-driven config in `cards.support` (JSON), engine reads it generically | `game.ts` (`castSupport`, `runOps`, `fire`) |
| Rules | `game_rules` table is **informational**; the engine reads constants `RULES` | `game.ts` |
| Elements | Matchup table lives in `db/seed/elements.json`, bundled into the engine; CMS can only assign an element to a card | `combat.ts`, `service.ts` |

## 2. Gaps (ranked)
1. **No single source of truth for behaviour.** Three mechanisms coexist: regex-parsed Admin text (characters), hard-coded ids for the 20 legacy Spell/Trap cards (`TRAP` map, `SPL-00x` switch), and `cards.support` JSON (Signature). A new card type or rule means touching several places.
2. **`cards.support` has no CMS editor and no validation.** Only a DB CHECK that it is an object. Unknown ops/triggers are silently ignored by the engine; a typo would publish a card that does nothing. Names, text, image and price are editable, numbers are not.
3. **Rules and elements are not editable from the CMS.** `game_rules` rows do not drive the engine; the element table needs a code change and a rebuilt bundle (`engine.js` + edge bundle).
4. **Story: no Mixed-story UI.** API accepts several modifiers, the form does not. 21 proposed Story rows are waiting for approval.
5. **Preview.** There is no "try this card in a test game" from the CMS; verification is by unit tests only.
6. **Fusion element matching.** `must_match` is validated in `fusion_recipes`, but the game uses `card_fusion_partners`; recipes are not enforced at play time.
7. **Generated files can drift** (`public/engine.js`, `admin-tools.js`, edge bundle). Drift tests exist for the first two; the edge bundle is a manual deploy step.

## 3. Proposed design (smallest steps first)
**Step A — Support config validator + editor (small, high value).** Move the allowed ops, triggers, `who`, `until` values into one registry (same pattern as `effect-registry.ts`), validate on save (server) and offer them as dropdowns (Admin). Reject unknown values; the engine and CMS share the list, enforced by a parity test.

**Step B — One effect model.** Make Signature `ops` the target model; add adapters so legacy `SPL/TRP` ids and parsed character effects are described by the same registry (no behaviour change, tests prove parity). Do this gradually, card by card.

**Step C — Rules and elements as data.** Load `RULES` values and the element matrix from the DB at game creation (with the current constants as fallback), so Admin edits take effect without a rebuild. Needs a decision: edits apply to new games only.

**Step D — Mixed-story form** (API already supports it).

**Step E — Test-game preview** in the CMS using the in-memory engine (no production writes).

## 4. Decisions needed from Toon
- Build Step A first? (recommended; no schema change)
- Should Admin edits to rules/elements apply live to new games (Step C), or stay code-reviewed?
- Approve the 21 Story proposals (all, some, none)?

## 5. Risks
Steps B and C touch the engine: each needs the full test suite, a rebuilt `engine.js`, a rebuilt edge bundle and a "Deploy". No existing Story/Fusion/stat data would be modified by any step.
