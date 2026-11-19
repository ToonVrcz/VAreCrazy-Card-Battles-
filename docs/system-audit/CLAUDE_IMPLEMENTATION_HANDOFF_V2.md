# Claude Implementation Handoff V2

> For a future Claude Code session **after** Toon approves. Until then: audit only.

## Standing rules
- Reply to Toon in Thai, short. Never deploy/merge/write Production until he says "Deploy". Never print the admin password. Never force-kill his processes. Keep `tmp-edge-bundle*` branches. No paid cost without asking. Never change HP/ATK. Keep backward compatibility. Report before fixing; wait for approval.
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01UmYwZeAkuV8t2qAdPt48bn`.

## Facts to rely on
- Engine: `src/engine/game.ts`; LP 100 (`RULES`), `combat.ts` (8000) is legacy/tests only. DB `game_rules` are not read by the engine.
- Damage: `max(1, floor(max(1, ATK−DEF) × elementMult))`; direct attack ignores DEF, only vs an empty field.
- Effects: only `parseEffect` wordings run; publish gate blocks non-parsing characters.
- Room-owner LP adjustment: **not in the source** (UNVERIFIED). Ask Toon where it exists (Production? another branch?) before building.
- Generated bundles: `public/engine.js`, `public/admin-tools.js`, edge bundle — rebuild with the commands in CLAUDE.md after touching `src/engine`, `effect-registry.ts`, `effect-text.ts`.

## How to work an approved item
1. Branch from the current audit branch. 2. Write a failing test. 3. Implement minimal change. 4. Rebuild affected bundles. 5. Run targeted tests, then full `npm test` in background to a file. 6. Report in Thai with commit hash. 7. Wait.

## Order (see IMPLEMENTATION_PLAN.md)
Phase 0 decisions → Phase 1 safety → Phase 2 engine → Phase 3 tooling → Phase 4 content → Phase 5 deploy (only on "Deploy").

## Open decisions for Toon
D1 FOLLOW-YOU-040 combo · D2 published-only pool · D3 room LP · D4 story/affiliation/gender · D5 starter points · D6 balance V2 DEF + WENDYWENDIE · D7 deploy order & `feature/hardening-1`.

## Unverified items
Room LP; Production gender data; deployed edge == branch; full XSS coverage; full `npm test` green after latest edits; earlier F-08..F-20 status.
