# Phase 1 — Final Verification (READ-ONLY)

Branch `fix/phase1-security-integrity` @ `37f10d9` (code unchanged by this review; only this report was added). No code change, no migration applied, no deploy, no merge. Production was read with SELECT / list calls only. The sandbox cannot reach the live site (HTTP 000), so anything that needs a live request is marked **PROD-ONLY**.

Legend: **SOURCE** = proven from the repo; **PROD** = can only be confirmed against Production; **UNVERIFIED** = not established.

## Summary of what this review found

| # | Finding | Severity | Where |
|---|---|---|---|
| R-1 | Per-IP guard trusts the **first** `x-forwarded-for` entry. Calling the Supabase function URL directly lets a client choose its own "IP", so the per-IP limit can be bypassed (and a victim's IP can be exhausted on purpose). | P2 | `api.ts clientIp` |
| R-2 | **Stored/shared XSS still present:** `ON.deckName` is rendered raw in the room lobby, and deck names come from a pasted friend's deck code (`decodeDeck`, only truncated to 24 chars). A 21-character payload fits. | **P2 (real, missed in Phase 1)** | `play.html` line 174 |
| R-3 | Other raw interpolations remain: `d.flavor` (card popup), event-log text (`NC.history`, contains card names), ledger `i.card`, image `src`/`href` values (`img()`, `card.img`, `card.frame`). Source is Admin-controlled data, not players. | P3 | `play.html` 119, 252, 279; `card-renderer.js` |
| R-4 | **Migrations 018 and 021 create tables without `ENABLE ROW LEVEL SECURITY`.** Every one of the 30 current Production tables has RLS on, and Production has no auto-RLS event trigger. As written, `admin_login_failures` (admin e-mails) and `profile_create_log` (IP hashes) would be created open to the Supabase REST API with the public key. | **P1 before apply** (PROD-ONLY to confirm exposure) | `018_*.up.sql`, `021_*.up.sql` |
| R-5 | Per-IP limit of 10/hour can reject legitimate users behind shared addresses (mobile carrier NAT, school/event Wi-Fi), because `play.html` creates a profile automatically on first load. | P3 (tuning) | `PROFILE_LIMITS`, `play.html refreshMe` |
| R-6 | Global ceiling (300 per 10 min) can be filled by an attacker, blocking **new** sign-ups for up to 10 minutes (existing players unaffected). | P3 | `economy.ts createProfile` |
| R-7 | No Content-Security-Policy anywhere (`vercel.json` has none), so a missed escape executes. Defence-in-depth gap. | P3 | `vercel.json` |

Everything else requested checks out (sections 1–5).

## 1. Guest Profile Guard

**IP read order (SOURCE).** `api.ts clientIp(headers)`: first comma-separated entry of `x-forwarded-for`, else `x-real-ip`, else `undefined`. Used only by `POST /api/play/profile`. The raw IP is hashed (`sha256('vcz-ip:' + ip)`) and only the hash is stored (test proves the raw value is absent).

**Spoofable header?** Yes, in one path (R-1):
- Normal path (browser → Vercel `/api/*` rewrite → Supabase): Vercel is documented to overwrite `x-forwarded-for` with the real client address, so the first entry is the real IP. **PROD-ONLY** to confirm what the function actually receives after Supabase's own proxy layer (could not call the live site; this is my recollection of the platform behavior, not a measurement).
- Direct path: the function URL `https://jcjqooeckoapoikcwpet.supabase.co/functions/v1/api/api/...` is written in the public `vercel.json`, and `verify_jwt=false`. A client calling it directly can send any `x-forwarded-for` value; the guard then keys on the attacker-chosen first entry. **SOURCE-proven weakness.** Effect: the per-IP limit is bypassable (rotate the header each call) and can be aimed at a victim's IP. The **global ceiling still applies** and does not depend on the header.
- Headers that must not be used instead: `cf-connecting-ip` / the socket address would be Vercel's server address for every user behind the rewrite (all users would share one 10/hour bucket).
- Options for the owner (no code now): (a) accept per-IP as a speed bump, rely on global ceiling; (b) have the function trust the **last-but-one** entry once the real proxy chain length is measured in Production; (c) have Vercel add a shared-secret header that the function requires for `/api/play/profile` (needs a Vercel config that supports it; **UNVERIFIED** that a rewrite can inject request headers); (d) move the limit to a Vercel/Cloudflare firewall rule.

**No IP and no migration 021 (SOURCE + tests).**
- No IP header: per-IP branch is skipped, only the global ceiling runs; creation works as before (test: 15 profiles without IP, each 500 points).
- Migration 021 absent: `guardSql` catches Postgres error `42P01` whose message mentions `profile_create_log`, logs, and continues; any other error is re-thrown. Verified by the test that drops the table. Caveat: the `42P01` check relies on the driver exposing `e.code`; PGlite does, and `postgres.js` (used in the edge function) does for server errors — **PROD-ONLY** to confirm on the first missing-table call, but 018's login throttle already depends on the same pattern.
- The extra global query reads `players` only (exists since 013).

**Global limit vs normal players.** 300 new profiles in 10 minutes = 30 per minute sustained. Production today: 21 players in total, 0 PvP matches, so ordinary traffic is far below it. It only affects **new** profile creation. Risk is the reverse (R-6): a script can deliberately fill it. PROD-ONLY: real launch traffic (a streamer raid could create bursts) is unknown; the constant is one line to change.

**Per-IP limit vs normal players (R-5).** `play.html refreshMe()` calls `POST /profile` automatically for any visitor with no stored key, so each new browser is one profile. Eleven new visitors on one address within an hour: the 11th gets 429; `refreshMe` catches it and the page runs as guest/offline (no wallet), so nothing breaks but the user cannot shop until later. Thai mobile carriers share addresses widely (UNVERIFIED how many users per address).

**Other properties (SOURCE).** Check-then-insert is not atomic: a concurrent burst can overshoot the limit by a few. Refused attempts create no row. Existing profiles and starter points are untouched (`ECONOMY` object unchanged; asserted by test).

**Provable from source vs needs Production**
| Provable from source | Needs Production |
|---|---|
| Header order; hashing; no raw IP stored; no-IP and no-021 behavior; 429 only on limit; starter 500 unchanged; direct-URL spoof possibility; global limit math | What `x-forwarded-for` really contains behind Vercel + Supabase; `e.code` on `postgres.js`; real traffic vs 300/10 min and 10/hour; carrier NAT sharing |

## 2. XSS review (every `innerHTML`)

Counts: `play.html` 39 `innerHTML` assignments, `admin.html` 17, `card-renderer.js` 0 (returns an SVG string consumed by those pages). No `insertAdjacentHTML`, `outerHTML` or `document.write`. Template expressions scanned (balanced `${…}` scanner): play 401, admin 375, renderer 34. Method: list every expression not already wrapped in `esc()`, then classify by data source. This is a **manual classification of a heuristic list**, not a proof.

**Escaped now:** player/room/deck names (F-01), card names and texts in popups, shop names, server messages, invite link, fused-card names, profile-name attribute.

**Not covered**
| Item | Source of data | Context | Verdict |
|---|---|---|---|
| `${ON.deckName}` play.html:174 | deck name; **can come from a pasted friend deck code** (`decodeDeck`: `String(o.n).slice(0,24)`) or the user's own deck | HTML text in room lobby | **R-2 exploitable** (e.g. `<svg onload=alert(1)>` = 21 chars). Not caught by the Phase 1 guard because the pattern list did not include `ON.deckName`. |
| `${d.flavor}` play.html:279 | card `flavor_text` (Admin/editor) | popup | R-3. A card_editor can inject script into every player's browser. One real card has a `"` in flavor text, so escaping would still be display-neutral. |
| `${NC.history(8).join('<br>')}` play.html:119 and notification text | event text built in `events.ts` from card names | log panel (`<br>` is intentional, text pieces are not escaped). The toast path (line 82) uses `textContent`, safe. | R-3 |
| `i.card` (ledger), `d.type`, `d.chainName`, `KD[i.kind]||i.kind` | server data / enums | text | R-3 (enums are low risk) |
| `img(c)`, `c.img`, `d.img`, `card.img`, `card.frame` in `src=""`/`href=""` | `media_assets.storage_path`, set from uploads (random name) **or** Admin import `image_path` (free text) | attribute | R-3: a quote in an imported path breaks out of the attribute. Admin-only input. |
| `admin.html` option values `value="${x.key}"` etc. | Admin-typed taxonomy/affiliation/story keys | attribute | P3, admin-to-admin only |
| `admin.html` `esc()` does not escape `'` | | | No single-quoted attribute use found (0 matches of `='${esc(`) |
| Admin `toast()` | uses `textContent` | | safe |
| Error messages (`toast`, `msg`) | server Thai strings | | escaped in play.html; admin uses `textContent` |
| Everything else flagged by the scan | numbers, enum literals, constants, ids (uuid/alnum), `FEEDBACK_URL` constant | | safe by type |

**Not covered by any test:** the Phase 1 guard is regex-based on `play.html` only. `admin.html` has no scan test; the card-renderer has none.

**Proposed DOM-based tests (not written).**
1. Load `play.html` in jsdom (or Playwright, the repo already has local browser e2e scripts), stub `fetch`, feed hostile strings (`<img src=x onerror=window.__x=1>`) through every source: room name, player name, deck name, **imported deck code name**, card name/text/flavor, ledger card, error message, event log; render each screen; assert `window.__x` is undefined and `document.querySelectorAll('img[onerror],svg[onload]')` is empty.
2. Same for `admin.html` with hostile card names, taxonomy keys, user e-mails, rule notes, audit entries.
3. A lint test over every `innerHTML` template that **fails on any expression not in an explicit allowlist** (numbers, constants, `esc(...)`), replacing the current deny-list regexes.
4. Property test for `decodeDeck`: random names with `<>&"'` must never reach the DOM unescaped.
5. Add a response header test for a Content-Security-Policy once one exists (R-7).

## 3. Bundle drift

**What the test does (SOURCE).** `tests/phase1-integrity.test.ts` rebuilds `public/engine.js` (`src/play-entry.ts`, iife `VCZE`) and `public/admin-tools.js` (`src/admin-entry.ts`, iife `VCZX`) with the same esbuild options as CLAUDE.md and requires **byte equality** with the committed files. For the edge bundle it only checks that the build succeeds, is larger than 50 KB, and contains `admin_login_failures`, `pvp-pair:`, `profile_create_log`. It does **not** compare the edge bundle with anything committed (none is committed on this branch) and does not apply the `sed` that rewrites the `postgres` import.

**Source Build Verification (done).** Both committed browser bundles equal a fresh build of this branch's source. Edge bundle builds.

**Production Bundle Verification (what I could and could not do).**
- Done, read-only: Production's edge function `api` is v13, a stub importing `edge-bundle.js` at commit `515c6f4` (branch `tmp-edge-bundle-l3`). I built `origin/main` in a temporary worktree (later removed) with the CLAUDE.md edge command + `sed`: the result is **byte-identical** (101,161 bytes) to `515c6f4:edge-bundle.js`. Also `origin/main`'s `public/engine.js` equals a fresh build of its source. So Production edge = main source, as far as the repo copy shows.
- **Cannot verify:** that GitHub raw serves the same bytes the function actually executes (the function fetches by URL at deploy time; the live code is the deployed v13 snapshot); what Vercel currently serves for `/engine.js` and `/admin-tools.js` (no live access; Vercel list API returned 403); that the Supabase-stored `ezbr` artifact (`c8e7049e…`) corresponds to that file.
- Not covered by the test: `public/play.html` and `public/admin.html` are hand-written, not generated, so they cannot "drift" but are also not tied to any build check.
- Gap: a future edge deploy bundle has no automated link between "commit X" and "what v14 runs". `feature/hardening-1` adds a manual deploy workflow that would give such a link (untested).

## 4. Migration 021

**Compatibility with 018/019 (SOURCE + test).** Independent tables/columns, no shared objects. Filenames sort 017 < 018 < 019 < 021; `migrateUp` applies in that order, `migrateDown` in reverse. `login-throttle.test.ts` proves a database at 017 upgrades through 018 and 019 (updated only to ignore 021), and 021 is additive. On Production, apply order stays 018 → 019 → 021; none depends on another. The code tolerates 018 or 021 being absent; **it does not tolerate 019 being absent** (card editor reads `config`), as established earlier.

**R-4 RLS (important).** Repo migrations 011, 013, 014 enable RLS on their tables; 018 and 021 do not, and neither does the 017 content (no table). All 30 Production public tables have `relrowsecurity = true` and no policies (deny-by-default for the REST API). Production has no event trigger that enables RLS automatically (only `pgrst_*` and `issue_*` triggers). Therefore applying 018/021 **as written** would create two public tables without RLS. With PostgREST watching DDL (`pgrst_ddl_watch` present) they become reachable with the public anon key, unless the project's Data API exposure is turned off (**PROD-ONLY**). `admin_login_failures` holds admin e-mail addresses; `profile_create_log` holds IP hashes. This is a pre-apply blocker, and it also affects 018 (which I may not edit): the fix would be a separate RLS migration or an RLS line added to 021 and a new "022" for `admin_login_failures`, with owner approval. After any apply, run the Supabase security advisor.

**Performance and accumulation (SOURCE).**
- Writes: one INSERT plus one `DELETE … WHERE at < now() - 1 day` per successful, IP-bearing creation. The DELETE cannot use the `(ip_hash, at)` index efficiently (leading column differs), so it scans the table; the table is bounded to one day of sign-ups, so the cost is small now (21 profiles ever) but grows with traffic.
- Reads: the per-IP count uses the `(ip_hash, at DESC)` index. The global count `players WHERE created_at > now() - 10 min` has **no index on `players.created_at`** → sequential scan of `players` on every creation (cheap at 21 rows; becomes noticeable at tens of thousands). An index would need a new migration.
- Accumulation: rows are pruned only when someone creates a profile; with no sign-ups nothing is pruned, but nothing accumulates either. Maximum steady size ≈ sign-ups per day. No unbounded growth path found. Bot flood is bounded by the global ceiling.
- Extra DB round-trips per sign-up: 2 reads + 2 writes (previously 1 transaction).

**Rollback (SOURCE).** `021_*.down.sql` = `DROP TABLE IF EXISTS profile_create_log`. Safe: the table holds only throttle data, nothing references it, and the code then falls back to "guard inactive" (logged error each creation). No player data, wallet or card data is involved. Rolling back the code without dropping the table is also safe (unused table).

## 5. Whole-diff check (`docs/system-audit-v1..HEAD`, 12 files, 264 insertions, 41 deletions)

| Requirement | Result | Evidence |
|---|---|---|
| No HP/ATK/DEF change | **Confirmed** | `git diff` touches no card data (`card-data-export/`, `db/seed/` unchanged, 0 bytes). The only HP/ATK/DEF text in the diff is the new input validation in `saveCard` and test fixtures. |
| No effect or rule change | **Confirmed** | `src/engine/` has 0 changed bytes; `effect-registry.ts`, `effect-text.ts`, `effects.ts` untouched; `public/engine.js` and `admin-tools.js` unchanged. |
| No starter points / reward change | **Confirmed** | `ECONOMY` object lines unchanged; the `economy.ts` diff adds `PROFILE_LIMITS` and rewrites only `createProfile`; award/settle code untouched; a test asserts 500 / 200 / 10 / 10. |
| No card ID or player data change | **Confirmed** | No data migration; 021 only creates a table; no `UPDATE/DELETE` against `cards` or `players`. `createProfile` still writes the same two rows (player + ledger). |
| Migrations 018–020 untouched | **Confirmed** | 0 diff bytes for 018, 019, 020 (020 is not on this branch). Added files: `021_*.up/down.sql` only. |

**Behavior changes that do exist (all intentional, listed in PHASE1_REPORT):** 429 on profile-creation limits; HTTP 400 for out-of-range card numbers (including values like 100000 or 12.5 that were previously passed to the DB); uploads that are not JPEG/PNG/WEBP are rejected and a real image with a wrong label is stored under its real type; `play.html` now escapes text (visually identical for current data, asserted for card names and rules text). Three older tests were edited (admin/frames fixtures to real image bytes; login-throttle migration-list filter); no source behavior was weakened to make them pass.

## 6. Recommended before Merge/Deploy (proposals only, nothing done)

1. Add `ON.deckName` (and `d.flavor`, event-log text, ledger card name) to escaping — closes R-2/R-3. Extend the guard to an allowlist lint + DOM tests (section 2).
2. Add `ENABLE ROW LEVEL SECURITY` for `profile_create_log` (021) and decide how to handle `admin_login_failures` (R-4) — blocker before applying either migration.
3. Decide R-1: measure the real `x-forwarded-for` chain in Production before trusting the per-IP key; decide the per-IP limit (R-5) and whether to add an index on `players.created_at`.
4. Add a CSP header (R-7) after the escape work, in report-only mode first.
5. Keep the deploy order 018 → 019 → 021 (with RLS) → edge → merge → verify.

## 7. Still UNVERIFIED

Live `x-forwarded-for` contents; `postgres.js` error code on a missing table; real traffic levels; whether the Supabase Data API exposes the `public` schema in this project; what Vercel currently serves for the bundles; admin.html completeness beyond the heuristic scan; full `npm test` was last run at 341/341 on commit `37f10d9` (not re-run for this review since no code changed).
