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
- `db/migrations/NNN_*.up.sql|down.sql` — 001..014 are on `main`; 014 (`pvp_match_history`) and the level-frames migration (file `015_level_frames`, applied to production under the name `014_level_frames`) are applied to production. New migrations start at 016.
- `vercel.json` — rewrites: `/` → admin, `/play` → play.html, `/api/*` → Supabase function, `/media/*` → Supabase storage.
- `tests/` — vitest + PGlite (in-memory Postgres).

## Commands
- Tests: `npm test` (~150 tests; the full run can exceed 2 min, so run it in the background with output to a file).
- Rebuild browser engine after changing anything under `src/engine` or `src/play-entry.ts`:
  `npx esbuild src/play-entry.ts --bundle --format=iife --global-name=VCZE --minify --charset=utf8 --outfile=public/engine.js`
  (verified byte-identical to the committed file)
- Edge function bundle (do this, then deploy the whole file as `index.ts`):
  `npx esbuild src/edge/index.ts --bundle --format=esm --platform=node --external:@electric-sql/pglite --external:postgres --minify --charset=utf8 --outfile=/tmp/edge.js && sed -i 's#from"postgres"#from"npm:postgres@3"#g' /tmp/edge.js`
  The bundle is ~76 KB. Pasting it by hand is error-prone; last time a stub `index.ts` that imports the bundle from a commit-pinned raw GitHub URL (temporary branch, repo is public) worked, then the branch was deleted.
- Rollback: Vercel dashboard rollback for web; for the edge function rebuild the bundle from an older commit and redeploy.

## Game design (decided by Toon)
2 players; LP 100; hand max 5; 7 field slots + 5 back-row slots (spell/trap); main deck 40 cards (max 3 copies, at least 3 Lv.15 characters); phases main → battle → end; first player cannot attack on turn 1; damage = ATK − DEF (min 1) with counter-attack, element multiplier 1.5 / 0.75; Lv.15 summon is free (1 per turn); evolution 1 per turn needs 1 Evolution card + sacrifice (Lv40: 1, Lv70: 2, Lv99: 3), keeps damage taken; Fusion stacks two cards in one slot.
- **Evolution deck** (separate, max 15): holds Lv.40/70/99 forms, which cannot be in the main deck. The form is chosen from it when using the Evolution card.
- Economy: guest profile (secret key in the browser, hashed in DB), starter 500 points; PvP match (≥ 6 turns) = 200 points; every 10th match = +10 Vrcoin; shop: Lv.40 = 500 points, Lv.70 = 100 Vrcoin (Lv.99 price not set); max 3 copies per card. Prices editable in Admin.
- Online: per-seat tokens, 90 s turn timer (auto end turn; 3 timeouts = loss), absent > 2 min = loss, resign button.
- Rules in the Admin rules table are mostly Claude proposals Toon accepted ("ตกลง"); element matrix is a proposal.

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
