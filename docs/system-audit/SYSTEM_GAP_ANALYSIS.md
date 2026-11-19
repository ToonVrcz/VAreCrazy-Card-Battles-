# System Gap Analysis

> **AUDIT ONLY.** No code, data, rule, migration, deploy or Production change. Findings carry: file path, function/component, evidence, current behaviour, problem, severity, proposed solution. **UNVERIFIED** = not provable from the repo. Companion documents: `CMS_ADMIN_AUDIT.md`, `CARD_DATA_AUDIT.md`, `ENGINE_RULE_AUDIT.md`, `EFFECT_COMPATIBILITY_MATRIX.md`, `CARD_BALANCE_REVIEW_V2.md`.
> Severity: **P0** exploitable/data-loss now; **P1** serious, fix before wider release; **P2** should fix; **P3** minor/hygiene.

## 1. The eight questions from the brief

| # | Question | Answer |
|---|---|---|
| 1 | What exists? | Web game `/play` (bot + online rooms, lobby, spectators, timers, decks, evolution deck, shop, wallet, history), Admin CMS (cards, effects with Registry editor, publishing workflow, users/roles, frames, game systems, economy), server-authoritative engine, 28 test files. |
| 2 | What is complete? | Card CRUD + publish workflow, structured Effect Editor with parity tests, battle engine core (summon/attack/DEF/elements/evolution/fusion/traps/spells), rooms + timers, shop/economy with pair-limit anti-farming (on this branch), XSS guards on the play screen. |
| 3 | What is broken or inconsistent? | See section 2 (items G-1..G-9). |
| 4 | In Admin but not in the engine? | gender, affiliation + synergies, story links (8 live links with stat effects), class, 26 `game_rules`, fusion recipes (0 rows), combo, `on_cast`/`n_turns`/`sacrifice` options, spell/trap effect rows. |
| 5 | Hard-coded? | LP 100, hand/field/back sizes, sacrifice map, poison, element matrix (file), turn timer (90 s), economy constants, all 10 spells and 10 traps by card ID, `EVO-001`/`FUS-001` in the random deck builder. |
| 6 | What should be improved? | Section 2 + IMPLEMENTATION_PLAN. |
| 7 | What must be developed? | Optional: room LP setting, Combo, wiring (or retiring) gender/affiliation/story/class, data-driven spells/traps. |
| 8 | Does the architecture support new Card Types / Effects / Rules? | **Partly** (section 4). |

## 2. Gap findings

| ID | Sev | File / function | Evidence | Current behaviour | Problem | Proposed solution |
|---|---|---|---|---|---|---|
| G-1 | P2 | `src/server/rooms.ts` `create`; `game.ts:12` | grep all branches | Room owner sets name, public, turn time only. LP fixed 100 | Owner expects room LP (unverified claim E-1) | ENGINE work: `opts.lp`, room column/meta, lobby control, no rewards at non-default LP |
| G-2 | P2 | `GameData.setRule`, `game_rules` (26 rows) | nothing in `src/engine` reads them | Rules panel edits are cosmetic (except `deck_size`/`max_copies` in the Admin checker) | Owner believes rules are live | Badge each rule "read by engine: yes/no"; or wire the engine (new work) |
| G-3 | P2 | `GameData.validateDeck` vs `deck-view.ts validateDeck` | both read | Two deck validators with different rules (per-chain vs per-card copies; forms in main deck) | Admin says valid, game rejects (or vice versa); DB rule `evolution_in_main_deck=true` is wrong for the game | One shared validator |
| G-4 | P2 | story links / affiliation / gender (`gamedata.ts`, `/api/bonus`) | `rooms.ts`/`game.ts` never reference them | 8 story links (e.g. DNMAN vs 1GOKU HP -5, BACKJI+NONG DEF +5), 27 synergies, gender bonus are shown by the calculator only | Content exists, gameplay does not honour it | Decide: implement in `createGame`/`refreshAuras` (new engine work, balance impact) or label "design only" |
| G-5 | P2 | `service.ts transition` vs migration 020 | gate code; 020 SQL | Publish gate blocks FOLLOW-YOU-040 (combo row); 020 sets status in SQL and bypasses the gate | After 020, a card exists as `published` that the Admin would refuse to publish | Fix/decide FOLLOW-YOU-040 first |
| G-6 | P2 | `rooms.ts loadPool` | `status <> 'archived'` | Draft cards are playable | Unpublished/test cards reach matches | Published-only (pending decision) |
| G-7 | P2 | `public/engine.js`, `admin-tools.js`, edge bundle | no CI, `tests/vercel-routes.test.ts` only checks routes | Three generated artifacts must be rebuilt by hand after engine/registry edits | Silent drift between source and shipped bundles; no `.github` workflow | CI job or a test comparing a fresh build with the committed files |
| G-8 | P2 | Production-only data (D-7) | production snapshot | Fusion partners, story links, affiliations, frames live only in the DB | Cannot rebuild Production from the repo | Seed/export those tables |
| G-9 | P3 | `service.ts saveCard` | read | No range checks for level/HP/ATK/DEF; `card_type` not tied to fields | Bad Admin input accepted | Range validation |

## 3. Security and data integrity (brief section I)

| ID | Sev | Area | File / function | Evidence | Current behaviour | Problem | Proposed solution |
|---|---|---|---|---|---|---|---|
| S-1 | **P1** | Reward exploit | `economy.ts createProfile`; `api.ts` `POST /api/play/profile`; `rooms.ts eligible` | no rate limit anywhere (`src/edge/index.ts`) | Anyone can create unlimited guest profiles; each gets 500 points (= one Lv40 card); rewards 200/match after 6 turns; the 3-matches-per-day limit is **per profile pair** | Fresh pairs bypass the limit; points are free | Throttle profile creation per IP/day (needs an IP source in the edge function), lower/remove the starter grant, or require a verification step. Approval needed (touches the economy). |
| S-2 | P2 | Reward exploit | `rooms.ts settle/eligible` | read | Pair limit and 6-turn minimum exist **on this branch**; `main` / Production still lack them (CLAUDE.md status of main) | Production exposure until the branch is deployed | Deploy order in IMPLEMENTATION_PLAN |
| S-3 | P2 | Admin authorization | `api.ts` admin block, `service.ts can/need` | read | Every route after `svc.auth` requires a role permission; public routes are limited to `/api/play/*` and `/api/login`; sessions 12 h, scrypt, 5 fails/10 min | No finding; note `/api/audit` is readable by `viewer` and shows actor e-mails (P3) | Optional: restrict audit log to `users` |
| S-4 | P2 | Input validation | `service.ts saveCard`, `uploadMedia` | read | Texts limited/normalised; effects <= 10; upload type from the client's Content-Type, 5 MB cap, random name; no magic-byte check | A non-image can be stored with an image MIME (admin-only route) | Magic-byte sniff (P3) |
| S-5 | P2 | XSS | `public/play.html` `esc()`; `tests/xss-guard.test.ts`; `admin.html` (35 `esc(` uses); `card-renderer.js` `esc` | 6 regression checks on play.html; renderer escapes `& < > "` | Player-controlled text (room/player/deck names) is escaped at the 6 known sites | **UNVERIFIED** that every innerHTML interpolation in `admin.html`/`play.html` is escaped (no automated scan beyond those 6) | Add an automated lint/test that flags `${...}` in `innerHTML` templates without `esc()` |
| S-6 | P3 | Battle state manipulation | `rooms.ts act`, `game.ts validateAction`, `deck-view.ts viewFor` | read | Clients send actions only; server replays the engine; view is redacted (hands, decks, face-down traps, seed, stats) | No finding. Bot mode runs client-side but pays nothing (`award` only in `rooms.settle`) | none |
| S-7 | P3 | Room tokens | `rooms.ts seatOf`, `newToken` | read | 128-bit random token per seat, required for act/ready/start/kick/leave | Token lives in the browser; no rotation | none |
| S-8 | P3 | CORS | `src/edge/index.ts:24` | `access-control-allow-origin: *` | Bearer tokens are in headers (not cookies) | Low risk | Restrict to the site origin when convenient |
| S-9 | P3 | Data integrity | `GameData.setRule` | read | Any JSON for any existing rule key, audited | No schema per rule; garbage accepted | Per-key validators |
| S-10 | P2 | PvP exploits | `game.ts` | probes | SPL-007 same-turn steal; SPL-003/004 stacking; no spell cap (E-3..E-5) | Game-balance exploits | ENGINE-PROP-01..03 |
| S-11 | P3 | Card manipulation | `importCards` | read | Import needs `import`, refuses non-Draft cards, transactional, dry-run | No finding | none |
| S-12 | P3 | Production DB writes from tooling | session history | - | Earlier in this project a migration was applied to Production only when the owner said "Deploy"; migrations 018-020 are **not** applied | Process control, not code | Keep the "Deploy" gate |

No P0 was found in the code on this branch. Earlier audit items F-08..F-20 (P2/P3) from the repository-wide audit are **not re-verified here** (UNVERIFIED in this pass).

## 4. Architecture: can it take new Card Types, Effects, Rules?

| Extension | What must change today | Verdict |
|---|---|---|
| **New card type** | DB CHECK constraint (`cards_card_type_check`; `item` already allowed but unused), `game.ts` `step`/`legalActions`/`validateAction`, `deck-view.ts`, `play.html`, Admin type list, renderer frame mapping, rebuild 3 bundles | Doable but touches ~8 places; no plug-in point |
| **New effect (character)** | `effects.ts` grammar + `effect-registry.ts` entry + `runEffects` branch + `effect-text.ts` warnings + parity test + rebuild `engine.js`, `admin-tools.js`, edge bundle | Good: Registry + parser + tests give a safe path |
| **New spell/trap** | New `case` in `game.ts` and `TRAP` map, UI target picker in `play.html`/`legalActions`, rebuild | **Poor**: not data-driven; every behaviour is code |
| **New game rule** (LP, hand size, slots, multipliers) | Edit constants in `game.ts`/`elements.json`; DB `game_rules` is ignored | **Poor**: rules table is not a configuration source |
| **New master-data effect (gender/affiliation/story)** | Needs an engine hook in `createGame`/`refreshAuras` and a decision on balance | Not built |

Overall: the **effect** system is well-fenced; spells/traps/rules are the main extensibility debt.

## 5. Consolidated severity list

- **P0:** none found.
- **P1:** S-1 unlimited profile creation / starter points.
- **P2:** G-1, G-2, G-3, G-4, G-5, G-6, G-7, G-8, S-2, S-4, S-5 (unverified completeness), S-10, E-3/E-4/E-8 (see ENGINE_RULE_AUDIT), W-1, W-2, W-3 (CMS audit), D-1, D-2, D-4, D-7, X-1, X-2.
- **P3:** the rest.

## 6. Unknown / unverified

Room-level LP (E-1); Production gender data; whether the deployed edge function equals this branch; full XSS coverage of `admin.html`/`play.html`; whether `npm test` is fully green after the latest test edits; F-08..F-20 status.
