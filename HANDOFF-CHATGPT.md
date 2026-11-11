# VAreCrazy Card Battle — Handoff Summary (for ChatGPT)

Date: 2026-11-11 · Owner: Toon (works mostly from a phone → keep replies short, **reply in Thai**).

## 1. Project in one paragraph
A web card game (`/play`) plus an Admin CMS (`/`), planned to be plugged into varecrazy.com/th later.
Stack: **TypeScript + Supabase (Postgres + Edge Function) + Vercel**. Avoid anything that adds paid cost without asking.

## 2. Hard rules (must follow)
- **Never deploy until Toon says "Deploy".** Pushing to `main` auto-deploys the web on Vercel. Work on a branch, run tests, wait.
- Deploy sequence: (1) apply new DB migrations to Supabase, (2) deploy the edge function, (3) merge to `main` + push, (4) verify live endpoints.
- Never print/repeat the admin password. Never force-kill processes Toon runs himself.
- The Universe repo (`xaphdev/VAreCrazy_Project`) is **read-only and not connected yet**. `src/universe/` + `docs/UNIVERSE-INTEGRATION.md` are only a prepared adapter.

## 3. Links / IDs
- Live: https://varecrazy-card-battles.vercel.app — game at `/play`, Admin at `/`. (`/play.html` is NOT routed → 404; always use `/play`.)
- GitHub: `ToonVrcz/VAreCrazy-Card-Battles-`
- Supabase project id: `jcjqooeckoapoikcwpet`; edge function name `api` (verify_jwt = false)
- Vercel project: `varecrazy-card-battles-`

## 4. Repo layout
- `src/engine/` — pure, server-authoritative game engine (game.ts, bot.ts, deck-view.ts, turn-timer.ts, cards…). No I/O.
- `src/server/` — api.ts (routes), rooms.ts (online rooms, 1.5 s polling, timers processed lazily on poll/act), economy.ts (players/wallet/shop), admin services.
- `src/edge/index.ts` — Supabase edge entry (Deno). `src/universe/` — Universe contract + adapter (unused).
- `public/play.html`, `public/admin.html` — vanilla JS pages. `public/engine.js` is a **generated** browser bundle.
- `db/migrations/NNN_*.up.sql|down.sql` — 001…013, all applied to production. `db/seed/*.json` — cards, elements, fusion pairs.
- `assets/` — card art (.jpg), card back, frames.
- `vercel.json` — rewrites: `/` → admin, `/play` → play.html, `/api/*` → Supabase function, `/media/*` → Supabase storage.
- `tests/` — vitest + PGlite (in-memory Postgres).

## 5. Commands
- Tests: `npm test` (~120 tests; full run can exceed 2 min → run in background, output to a file).
- Rebuild browser engine after changing `src/engine` or `src/play-entry.ts`:
  `npx esbuild src/play-entry.ts --bundle --format=iife --global-name=VCZE --minify --charset=utf8 --outfile=public/engine.js`
  (verified byte-identical to the committed file)
- Edge function bundle (then deploy the whole file as `index.ts`):
  `npx esbuild src/edge/index.ts --bundle --format=esm --platform=node --external:@electric-sql/pglite --external:postgres --minify --charset=utf8 --outfile=/tmp/edge.js && sed -i 's#from"postgres"#from"npm:postgres@3"#g' /tmp/edge.js`
  Bundle ≈ 76 KB. Pasting by hand is error-prone; what worked before: a stub `index.ts` importing the bundle from a commit-pinned raw GitHub URL (temporary branch, repo is public), then deleting that branch.
- Rollback: Vercel dashboard rollback for web; for the edge function rebuild the bundle from an older commit and redeploy.

## 6. Game design (decided by Toon)
- 2 players · LP 100 · hand max 5 · 7 field slots + 5 back-row slots (spell/trap).
- Main deck 40 cards (max 3 copies, at least 3 Lv.15 characters).
- Phases: main → battle → end. First player cannot attack on turn 1.
- Damage = ATK − DEF (min 1), with counter-attack. Element multiplier 1.5 / 0.75.
- Lv.15 summon is free (1 per turn).
- Evolution: 1 per turn; needs 1 Evolution card + sacrifice (Lv40: 1, Lv70: 2, Lv99: 3); keeps damage taken.
- Fusion: stacks two cards in one slot.
- **Evolution deck** (separate, max 15): holds Lv.40/70/99 forms, which cannot be in the main deck; the form is picked from it when using the Evolution card.
- Rules in the Admin rules table are mostly Claude proposals Toon accepted ("ตกลง"); the element matrix is a proposal.

## 7. Economy
- Guest profile (secret key in browser, hashed in DB); starter 500 points.
- PvP match (≥ 6 turns) = 200 points; every 10th match = +10 Vrcoin.
- Shop: Lv.40 = 500 points; Lv.70 = 100 Vrcoin; Lv.99 price not set. Max 3 copies per card. Prices editable in Admin.

## 8. Online play
Per-seat tokens · 90 s turn timer (auto end turn; 3 timeouts = loss) · absent > 2 min = loss · resign button.

## 9. Status (2026-11-11)
**Live:** bot play, online rooms, custom multi-deck manager, evolution deck, shop, rewards, timers/resign, Admin economy panel.

**Branch `fix/play-links` (pushed, NOT deployed, not merged):**
- commit `bb4c850` — fixes online invite link and "play again" (`/play.html` → `/play`)
- commit `36b467e` — adds `CLAUDE.md` handoff notes
- Next step when Toon says "Deploy": merge into `main` (see deploy sequence in §2).

**Open / known issues:**
- Temporary GitHub branch `tmp-edge-bundle` should be deleted (Toon must do it in GitHub).
- Unverified: mobile testing; an earlier blank `/play` report (suspected cache/extension); Vercel plan cost.
- Anti-farming for PvP points is weak (two accounts can farm).

**Ideas not done:** trap-vs-trap chain, real card art, Universe bridge (EXP / wallet / quests) and the actual connection.

## 10. History of this handoff
Work was done in Cowork, then moved to Claude Code (cloud session). Claude Code cloned the repo on branch `fix/play-links`; no deploy has been made and `main` is untouched.
