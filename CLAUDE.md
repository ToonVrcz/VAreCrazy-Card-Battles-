# VAreCrazy Card Battle — notes for Claude Code

Owner: Toon. **Reply in Thai, keep it short** (he mostly works from a phone). Ask only when truly blocked.

## Hard rules
- **Never deploy until Toon says "Deploy".** Pushing to `main` auto-deploys the web on Vercel. Work on a branch, run tests, and wait.
- Deploy = (1) apply new DB migrations to Supabase, (2) deploy the edge function, (3) merge to `main` + push, (4) verify live endpoints.
- Do not print or repeat the admin password. Do not force-kill anything he runs himself.
- The Universe repo (`xaphdev/VAreCrazy_Project`) is read-only and **not connected yet**; `src/universe/` + `docs/UNIVERSE-INTEGRATION.md` are the prepared adapter only.
- Stack: TypeScript + Supabase + Vercel. Avoid anything that adds paid cost without asking.

## What this is
A web card game (`/play`) plus Admin CMS (`/`) to be plugged into varecrazy.com/th later.
- Live: https://varecrazy-card-battles.vercel.app (game at `/play`, Admin at `/`). Note: `/play.html` is NOT routed (404); always use `/play`.
- Supabase project id: `jcjqooeckoapoikcwpet`, edge function name `api` (verify_jwt = false). Vercel project `varecrazy-card-battles-`.
- GitHub: `ToonVrcz/VAreCrazy-Card-Battles-`.

## Layout
- `src/engine/` — pure game engine (game.ts, bot.ts, deck-view.ts, turn-timer.ts, cards...). Server-authoritative; no I/O.
- `src/server/` — api.ts (routes), rooms.ts (online rooms, polling 1.5s, timers processed lazily on poll/act), economy.ts (players/wallet/shop), admin services.
- `src/edge/index.ts` — Supabase edge entry (Deno). `src/universe/` — Universe module contract + adapter (unused).
- `public/play.html`, `public/admin.html` — vanilla JS pages. `public/engine.js` is a **generated** browser bundle.
- `db/migrations/NNN_*.up.sql|down.sql` — 001..014 are on `main`; 025-029 are applied to production (see Status 2026-11-25). 014 (`pvp_match_history`) and the level-frames migration (file `015_level_frames`, applied to production under the name `014_level_frames`) are applied to production. 016 (`card_effect_texts`: clear WHEN/WHO/WHAT texts for traps and spells) is applied to production. New migrations start at 030.
- `vercel.json` — rewrites: `/` → admin, `/play` → play.html, `/api/*` → Supabase function, `/media/*` → Supabase storage.
- `tests/` — vitest + PGlite (in-memory Postgres).

## Commands
- Tests: `npm test` (~150 tests; the full run can exceed 2 min, so run it in the background with output to a file).
- Rebuild browser engine after changing anything under `src/engine` or `src/play-entry.ts`:
  `npx esbuild src/play-entry.ts --bundle --format=iife --global-name=VCZE --minify --charset=utf8 --outfile=public/engine.js`
  (verified byte-identical to the committed file)
- Admin Effect editor tools (generated; rebuild after changing `src/engine/effect-registry.ts` or `effect-text.ts`):
  `npx esbuild src/admin-entry.ts --bundle --format=iife --global-name=VCZX --minify --charset=utf8 --outfile=public/admin-tools.js`
  Local browser check: `PORT=8799 node scripts/cms-effects-e2e.cjs` (in-memory DB, no production).
- Edge function bundle (do this, then deploy the whole file as `index.ts`):
  `npx esbuild src/edge/index.ts --bundle --format=esm --platform=node --external:@electric-sql/pglite --external:postgres --minify --charset=utf8 --outfile=/tmp/edge.js && sed -i 's#from"postgres"#from"npm:postgres@3"#g' /tmp/edge.js`
  The bundle is ~76 KB. Pasting it by hand is error-prone; last time a stub `index.ts` that imports the bundle from a commit-pinned raw GitHub URL (temporary branch, repo is public) worked, then the branch was deleted.
- Rollback: Vercel dashboard rollback for web; for the edge function rebuild the bundle from an older commit and redeploy.

## Game design (decided by Toon)
2 players; LP 100; hand max 5; 7 field slots + 5 back-row slots (spell/trap); main deck 40 cards (max 3 copies, at least 3 Lv.15 characters); phases main → battle → end; first player cannot attack on turn 1; damage = ATK − DEF (min 1) with counter-attack, **direct attack on the player is capped at 60 LP per hit (owner decision 2026-11-26, `RULES.directCap`; deployed 2026-11-26)**, element multiplier 1.5 / 0.75; Lv.15 summon is free (1 per turn); evolution 1 per turn needs 1 Evolution card + sacrifice (Lv40: 1, Lv70: 2, Lv99: 3), keeps damage taken; Fusion stacks two cards in one slot.
- **Evolution deck** (separate, max 15): holds Lv.40/70/99 forms, which cannot be in the main deck. The form is chosen from it when using the Evolution card.
- Economy: guest profile (secret key in the browser, hashed in DB), starter 500 points; PvP match (≥ 6 turns) = 200 points; every 10th match = +10 Vrcoin; shop: Lv.40 = 500 points, Lv.70 = 100 Vrcoin (Lv.99 price not set); max 3 copies per card. Prices editable in Admin.
- Online: per-seat tokens, 90 s turn timer (auto end turn; 3 timeouts = loss), absent > 2 min = loss, resign button.
- Rules in the Admin rules table are mostly Claude proposals Toon accepted ("ตกลง"); element matrix is a proposal.

## Status (2026-11-27)
Deployed (main = 7d7f187; edge function `api` v20 via stub -> `edge-bundle.js` on `tmp-edge-bundle-s6` (commit cf515b7); rollback references, do not delete: `s5` (v19), `s4` (v18), `s3` (v17)). Migrations 031-033 applied to production (next new migration = 034).
- 031: Lv15 DEF rebalance (DEF by ATK tier +12/+10/+0 plus chain delta; sim 6/6 archetypes in band; games ~2.6x longer, owner accepted, no damage floor). 032: repair of double-encoded jsonb (`card_effects.config`, `play_rooms.tokens`).
- Root cause of the broken online rooms: the edge postgres.js driver double-encoded jsonb passed through `unsafe()` with a `$n::jsonb` cast; fixed by a custom `types` serializer in `src/edge/index.ts`. PvP rooms work again (owner confirmed 2026-11-27).
- P1 (a Fusion never triggers a Story row between its own two halves) and the element advantage/disadvantage UI on attack targets (green/red) are deployed.
- Game Synergy B7 deployed 2026-11-27 (main = 9a29b44, edge v21 via `tmp-edge-bundle-s7` commit b62efd9, migration 033 applied; rollback ref `s6` = v20). Data-driven: `src/server/play-config.ts` snapshots `g.cfg.synergy` (tiers + members + cap in `game_rules.synergy_cap`) at game creation; `refreshAuras` applies it (>=2 distinct units of a group on one side; max HP only, no instant heal; DEF; per-unit cap HP+10/DEF+4). Among Us = HP+3/DEF+1, others HP+3/DEF 1-2. Lv40+ inherit the chain's Lv15 groups (migration data + runtime fallback). Owner confirmed it shows in game.
- Branch `feature/bot-synergy` (NOT merged, NOT deployed): bot values Synergy when choosing which character to summon (`synergyGain` in `src/engine/bot.ts`). Docs refreshed (`docs/PROJECT-STATUS.md`).
- Not on main on purpose: `feature/hardening-1` (login throttle already shipped differently on main with its own migration 018; the branch's 018 would clash; at most cherry-pick the reflect-trap wording). OG-1 backup decrypt test skipped (owner: only if necessary). The 18 missing EVO/FUS images: owner uploads them in the CMS.

## Status (2026-11-26)
Deployed: main = see git log (Bot AI round 2: element-aware, focus-fire, lethal by value, Signature spells; `hit_detail` combat-log event; direct attack cap 60). Edge function `api` v18 via stub -> `edge-bundle.js` on `tmp-edge-bundle-s4` (commit 2279022); rollback references, do not delete: `tmp-edge-bundle-s3` (v17). No migrations. Balance B1/B2/B4/B6 not done (owner chose B3 only). Simulation report: `docs/balance/BOT_AI_COMBO_SIMULATION_RESULTS_2026-11-26.md` (audit branch).

## Status (2026-11-25, evening)
Deployed (main = 872a81e, edge function `api` v17 via stub -> `edge-bundle.js` on `tmp-edge-bundle-s3`; rollback references, do not delete: `tmp-edge-bundle-s2` (v16), `s1` (v15), `r1` (v14)). Migrations 025-030 applied (020 intentionally excluded; next new migration = 031).
- Evolution: Lv40 = 1 Lv15 sacrifice, Lv70 = 2 Lv40, Lv99 = 3 Lv70 (same level as the evolving unit). A used Evolution card goes to the graveyard (not removed from the game); it can be retrieved by any graveyard-retrieval effect whose wording allows it. SPL-006 only retrieves Lv.15 characters, so today no effect retrieves Evolution cards (owner rule 2026-11-25).
- Story runs in the game (directional, multi-modifier). 29 rows: 8 baseline (untouched) + 21 owner-designed (8 positive / 8 negative / 5 mixed, `db/seed/story-21.sql`, applied). The Admin per-card Story form edits several modifiers (Positive/Negative/Mixed).
- 39 Signature Spell/Trap cards (SPL-011..035, TRP-011..024): data-driven (`cards.support`), 300 Point, placeholder art (replace in the CMS). The CMS edits their config in a dropdown panel (`src/engine/support-registry.ts`, `PUT /api/cards/:id/support`, Draft only, audit-logged).
- Rules as data: each new game snapshots LP, hand max, evolution sacrifice, element multipliers and the element matrix (`game_rules`, key `element_matrix`) into `g.cfg` (`src/engine/config.ts`); edits apply to new games only. Slot counts stay fixed (7 + 5).
- All 109 cards are published (2026-11-25). Placeholder art is accepted for now; 18 original images (EVO-002..010, FUS-002..010) are still missing.
- PvP anti-farming IS enforced: the same two profiles earn from at most 3 matches per Bangkok day. Still untested with a real PvP match.
- Open: element advantage UI (green/red); friend's online-room join error needs the exact message; OG-1 backup decrypt test at Toon's home PC; test-game preview in the CMS; Phase H; branch `feature/hardening-1` has 1 commit not on main. Owner will try the Signature editor in production himself.

## Status (2026-11-19)
Branch `feature/cms-effects-c` (NOT merged, NOT deployed): CMS Effect Registry + split editor (system config vs player text, limits/counters, warn-only consistency check, publish gate). Migration `019_effect_config` (adds `card_effects.config jsonb`) is written, NOT applied to production. Deploy order when Toon says "Deploy": apply 019 → deploy edge → merge → verify. Coordinate with `feature/hardening-1` (touches service.ts; migration 018 unapplied).

## Status (2026-11-12)
Deployed 2026-11-12 (main = 34af1cf, edge function `api` v9 via stub -> `edge-bundle.js` on temporary branch `tmp-edge-bundle-g1`, do not delete: rollback reference; previous Vercel production deployment `dpl_4R3yC476BBXQG8byAxKDTyHLRxvJ`):
- Gameplay fixes: buffs last until the unit leaves the field, swap spell works across both sides, graveyard viewer (both sides) + choose the card to revive, green/red ATK/DEF, Evolution pile viewer, purchases auto-added to hand-built Evolution decks.
- Character abilities round F1 (31 of 56 Admin abilities run): `src/engine/effects.ts` parses the exact Admin wordings; everything else stays marked "not active". Remaining: F2 (target selection, 18) and F3 (special cases). See the Gameplay Review doc.
- Known/open: "attack the player and my own unit dies" (item 12) not reproduced yet; Admin Rule Builder still free text.

## Status (2026-11-11)
Live: bot play, online rooms, custom multi-deck manager, evolution deck, shop, rewards, timers/resign, Admin economy panel.
Known / open:
- Online invite link / game-over button now use `/play` (fixed in commit bb4c850, deployed). The game-over button is "กลับหน้าหลัก" (back to lobby), not a rematch.
- Temporary GitHub branch `tmp-edge-bundle` should be deleted (Toon to do it in GitHub).
- Unverified: mobile testing; an earlier blank `/play` page report (suspected cache/extension); Vercel plan cost.
- Anti-farming for PvP points is weak (two accounts can farm).
- PvP anti-farming **Phase 1 (data collection only) is deployed**; production `pvp_matches` was still empty when last checked (no finished PvP match yet): engine action stats + persistent match history (migration 014). Enforcement (pair limit, Match Quality, reward denial) is NOT active; rewards behave as before. Details, stat definitions, approved rules for later phases and deploy order: `docs/PVP-ANTI-FARMING.md`. Changing `src/engine` means rebuilding `public/engine.js` and the edge bundle.
- Playtest release work is on branch `feature/playtest-release` (not merged, not deployed): hides unimplemented character abilities (56 effects exist only as text), resume after refresh, back-to-lobby button, bug-report button that stays hidden until `FEEDBACK_URL` in `public/play.html` is set to the Owner's Google Form. See `docs/PLAYTEST.md` (also the production PvP verification procedure and `node scripts/playtest-e2e.cjs`, a local-only browser test).
- Ideas not done: trap-vs-trap chain, real card art, Universe bridge (EXP/wallet/quests) and actual connection.
