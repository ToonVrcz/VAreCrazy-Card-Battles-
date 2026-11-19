# Phase 1 — Security & Data Integrity (branch `fix/phase1-security-integrity`)

Approved scope only. Nothing deployed or merged; no Production write; migrations 018–020 untouched; no HP/ATK/DEF, effect, rule, economy, Combo or Room-LP change; card IDs and player data unchanged.

## Item status

| # | Item | Already in code? | Done in Phase 1 | Behavior change |
|---|---|---|---|---|
| 1 | Stored XSS | F-01 (`426aebe`) escaped room/player/deck names | Found 19 more unescaped interpolations in `public/play.html` (card names/text, shop names, server messages, invite link, fused names, profile-name attribute); all now go through `esc()`. Guard test added. | None for real data: no card name/rules text in the exported data contains `< > & " '`, verified by a test. |
| 2 | Input validation | F-02 (sacrifice slots), F-07 (payload types) on this branch | Already complete; covered by existing `audit-fixes` tests. Card numbers: see 5. | None |
| 3 | Guest-profile farming guard | No | Per-IP limit (10/hour, hashed IP) + global ceiling (300 per 10 min). New table via **migration 021** (not applied). Starter 500 points unchanged. | New HTTP 429 only when limits are exceeded. Without IP or without table: unchanged. |
| 4 | Upload magic bytes | No | JPEG/PNG/WEBP signatures checked; non-images rejected (400); a real image with a wrong label is stored under its real type. | Rejects only non-images. |
| 5 | Card numeric ranges | DB CHECKs only | `saveCard` (and therefore CSV import) validates whole numbers: level 1–99, HP/ATK/DEF 0–99999, shop prices 0–1,000,000, with a clear 400. | Real data max: HP 310, ATK 100, Lv 70, DEF 0 — all accepted. |
| 6 | Bundle drift tests | No | `tests/phase1-integrity.test.ts` rebuilds `engine.js` and `admin-tools.js` and compares byte-for-byte; edge bundle must build and contain the shipped guards. | None |

No engine or effect-registry source changed, so `public/engine.js` and `public/admin-tools.js` needed **no rebuild** (the drift test proves they still equal their source). The edge bundle is not committed; it must be rebuilt from the final commit at deploy time (the code changes in `service.ts`, `economy.ts`, `api.ts` ship through it).

## Not done (outside the approved list or needs a decision)
- Per-key validators for `setRule` (S-9) and audit-log visibility (S-7): not requested.
- S-1 is **mitigated, not closed**: a determined attacker with many IPs can still create profiles slowly (10/hour/IP). Closing it needs an economy decision (D5 kept starter points). Whether Supabase passes the client IP in `x-forwarded-for` behind the Vercel rewrite is **UNVERIFIED** (could not call the live site); without it the per-IP limit stays inactive and only the global ceiling applies. Verify after deploy.
- `admin.html` XSS: the same bare-interpolation scan found no candidates, but the scan is heuristic (UNVERIFIED completeness).

## Deploy notes (for later, on "Deploy" only)
Order stays 018 → 019 → **021** → edge deploy → merge → verify. 021 is optional: without it the per-IP guard is skipped (logged) and profile creation works. Rollback: `021_profile_create_log.down.sql` drops the table only.
