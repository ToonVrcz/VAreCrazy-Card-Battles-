# Phase 1 Remediation Report

Branch `fix/phase1-remediation` (from `fix/phase1-security-integrity`). **Not deployed, not merged, no migration applied, no production write.**
Scope: only the items in the "Phase 1 Remediation" approval. No HP/ATK/DEF, card effect, gameplay rule, Starter Points or reward change. Migrations 018–020 untouched. Card IDs and player data untouched. Phase 2 not started.

## A. XSS
Fixed (all in `public/play.html`, `public/admin.html`, `public/card-renderer.js`; wrapped in `esc()`, which now also escapes `'`):
- `ON.deckName` (reachable from a shared deck code `VCZD1.` → `decodeDeck`) — **a real, exploitable hole found in the Final Review.**
- `d.flavor`, `d.chainName`, `d.type`, event-log lines (`NC.history(...).map(esc)`), ledger card name / reason / source, `KD[...]`, section headings, toast/error texts.
- Every attribute value: `img src`, `<image href>` (renderer: `card.img`, `card.frame`), `data-*` ids, `id=`, `value=`, `placeholder=`, `type=`; numeric attributes use `+n`.
- Admin: 40+ interpolations (taxonomy keys, user emails, rule notes, stat strings, form helper labels).
- `href`: no user-controlled `href` exists in the three files (the invite link is built from `location.origin` and an uppercase 5-char room code, and is shown as text).

Tests (written first):
- `tests/helpers/html-lint.ts` + `tests/xss-allowlist-lint.test.ts`: AST allowlist lint (parser: `rolldown/utils`). Every value interpolated into an HTML string must be `esc()`-wrapped or provably numeric/constant. Replaces the old deny-list regexes in `xss-guard.test.ts`. Negative fixtures prove it flags unsafe code. Allowlist = only the renderer's internal SVG helper parameters (listed with reasons in the test).
- `tests/xss-dom.test.ts`: Chromium via Playwright (skipped if unavailable) against an in-memory server. Hostile strings (`<img onerror>`, `"><svg onload>`, quote-breaking attributes, `<script>`) through room/host names, profile name, match history, ledger, server error messages, card name/text/flavor/img/chain name (detail, collection), imported deck code, online-room deck/player names, and in Admin: the card list and editor with a hostile card. Asserts: nothing executed, no `on*` attribute and no `<script>` anywhere in the DOM.
- The DOM test already paid for itself: while editing I accidentally removed an `esc()` in the card renderer (`pt(...esc(nm)...)`); the lint allowlist (parameter `t`) could not see it, the DOM test failed in Admin. Restored; the final diff of `card-renderer.js` is only the `esc` quote + two `href` escapes.
- Limit: the lint trusts a few server-validated fields as numeric (room `code`, `uid`, etc., see `NUM_PROPS`); the DOM test is the backstop for the renderer.

## B. Database security
- New `db/migrations/022_profile_create_log_rls.{up,down}.sql` and `023_admin_login_failures_rls.{up,down}.sql` (018 and 021 unchanged). Enable RLS, no policies, `REVOKE ALL` (table + sequence) from `anon`/`authenticated` when those roles exist; no-op if the base table is absent; idempotent. **Not applied.** Apply order: 018 → 021 → 022 → 023 (022 needs 021, 023 needs 018).
- Production check (read-only `pg_roles`): `postgres` and `service_role` have `BYPASSRLS=true`; `anon`/`authenticated` do not. The edge function connects through `SUPABASE_DB_URL` as the database owner role, so it keeps full read/write; the other RLS tables (011/013/014) already work the same way. `UNVERIFIED`: the exact login role in `SUPABASE_DB_URL` (secret not readable by me); if it were something other than `postgres`/`service_role`, check after applying.
- `tests/rls-phase1.test.ts` (PGlite with Supabase-like roles and default grants): RLS on, zero policies, anon/authenticated have no table or sequence privilege and get `permission denied` on SELECT/INSERT, owner and BYPASSRLS `service_role` still read/write, plain Postgres without those roles migrates, down scripts work, no-op without base tables.
- Gap noted: older tables are protected by RLS enabled in their migrations; the repo has no migration that revokes grants for them. Production already shows all 30 public tables with RLS on and no policies.

## C. IP guard
- `x-forwarded-for` / `x-real-ip` are no longer read (`clientIp` removed from `src/server/api.ts`). `createProfile(name, ip?)` keeps the per-IP limit for a future trusted source; today `api.ts` passes none, so only the **global ceiling (300 profiles / 10 min)** is active. Starter Points (500) and all reward numbers unchanged.
- Tests (`phase1-integrity.test.ts`): spoofed/rotating headers neither block nor bypass anything and write no log rows; global ceiling still returns 429; starter = 500; per-IP capability intact.
- Options (none enabled):
  1. Trust only the proxy-appended entry: on Vercel, `x-vercel-forwarded-for` / `x-real-ip` are set by the platform and overwrite client-supplied values; but our edge function sits **behind a Vercel rewrite to Supabase**, so it may see Vercel's egress address, not the visitor's. Needs measuring.
  2. Supabase edge exposes `cf-connecting-ip`; behind Vercel it is probably Vercel's IP. Same measurement.
  3. Count from the right with a known hop count: rejected (guessing the chain).
  4. Per-IP limit at the Vercel layer (Firewall/WAF rate limit on `POST /api/play/profile`) — cannot be spoofed, no code change; may involve plan cost → ask Toon.
  5. Proof-of-work / BotID-style challenge: more work, paid for BotID.
- To measure in Production (needs a deploy of a temporary diagnostic, so not done): which header values the edge function actually receives for a request via `varecrazy-card-battles.vercel.app/api/...` (all `x-*forwarded*`, `x-real-ip`, `cf-connecting-ip`, `x-vercel-*`), whether two different real clients produce different values, and whether a client-sent `x-forwarded-for` survives. Until that is known the per-IP limit stays off.

## D. CSP (Report-Only)
- `vercel.json` gets `Content-Security-Policy-Report-Only` on all paths: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. **No enforcing header.** Not deployed.
- Derived from what the pages use: same-origin scripts (`/engine.js`, `/card-renderer.js`, `/admin-tools.js`), inline `<script>`/`style=`, same-origin `/api` and `/media` (rewrites), `blob:` for the admin download, no external hosts, fonts, frames or `eval`.
- `tests/csp-report-only.test.ts`: header is Report-Only, no enforcing one, no external origin; loads `/play` (lobby, shop, collection, bot game) and Admin (login, card list) with this exact policy and records `securitypolicyviolation`: **0 violations.**
- Impact / limits: `'unsafe-inline'` is required (inline scripts and styles), so this policy would **not** stop injected inline script; it would still block external script/image hosts, plugins, framing and `<base>` tampering. Real protection needs moving scripts out or nonces, a Phase 2 item. There is no report endpoint, so violations only show in the browser console for now. Before ever enforcing: add `report-uri`/`report-to`, watch production, check the future Universe embed (`frame-ancestors 'none'` would block it).

## Verification
Full `npm test`: 32 files, 374 tests, all pass (includes bundle-drift, RLS, lint, DOM and CSP tests; DOM/CSP browser tests run only where Playwright + Chrome exist, they ran here). Bundles (`engine.js`, `admin-tools.js`, edge bundle) unchanged: no source under `src/engine` or the effect registry changed; `src/server/api.ts` did change, so **the edge bundle must be rebuilt before any deploy** (Production edge = main build).

## Deploy order (for later, only when Toon says "Deploy")
Apply 018 → 021 → 022 → 023 (019/020 per earlier decisions) → rebuild and deploy edge function → merge → verify: profile creation, admin login, RLS (anon via PostgREST gets 401/empty on both tables), CSP header present in browser console without violations.

## UNVERIFIED
- Live site behaviour (sandbox cannot reach it); the `SUPABASE_DB_URL` role; what headers the edge function receives behind the Vercel rewrite; CSP on real devices/extensions.
