# Review Round 2 — Clarifications (READ-ONLY, nothing changed)

> No code, card data, DB, migration, deploy or merge was touched. Production was **read only** (SELECT / list). The sandbox cannot reach the live site (HTTP 000), so live endpoint checks are **UNVERIFIED**.
> Date 2026-11-19. Branch `docs/system-audit-v1` @ `38206fb`, `origin/main` @ `a7b3c97`.

## 0. Corrections to the first audit

| Earlier statement | Correction |
|---|---|
| Migration 020 was discussed as part of this branch | 020 is **not** on `docs/system-audit-v1`. It lives only on `fix/f04-publish-migration` (`3a3e920`). This branch has 018 and 019 only. |
| "No `.github`, no CI" (G-7) | True on this branch and `main`. `feature/hardening-1` adds `.github/workflows/deploy-edge.yml` (manual deploy, **not** CI, not tested) and `scripts/build-edge.sh`. There is still no test CI. |
| Three LP numbers (100 / 8000 / 8000) | `feature/hardening-1` already removes the legacy 8000 helpers from `combat.ts`. Not yet on this branch. |
| G-6 / D2 "pool is published-only" | `loadPool` is `status <> 'archived'` (rooms.ts:30,32). Header of migration 020 assumes a published-only pool, which is **not** the current code. See D2. |

## 1. Branch vs main vs Production

Production facts read: edge function `api` **v13**, stub importing `edge-bundle.js` at commit `515c6f4` = branch `tmp-edge-bundle-l3` ("phase3 room system") = the `main` code (`a7b3c97`). That bundle contains no `admin_login_failures` and no pair-limit code (grep count 0). Production migrations applied: up to `017_room_lobby` (no 018/019/020). Production cards: 11 published, 58 draft, 1 in_review. Players 21, `pvp_matches` 0, rooms 5, admin users 2.

`docs/system-audit-v1` is 11 commits ahead of `main` (the 9 fix/feature commits below + 2 docs/export commits; the audit docs themselves are 1 more). **None of it is deployed.**

| Item | Commit | Where it runs | On main? | In Production? | Needs to ship |
|---|---|---|---|---|---|
| F-01 stored XSS: escape player names in `play.html` | `426aebe` | Vercel static (`public/play.html`) | No | **No** | merge to main (auto Vercel deploy) |
| F-02 evolution sacrifice slots must be integers | `5a48213` | `engine.js` (Vercel) **and** edge bundle | No | **No** | merge + rebuild edge bundle + edge deploy |
| F-07 action payload type checks (`__proto__`) | `73d01b1` | `engine.js` + edge bundle | No | **No** | same as F-02 |
| F-03 PvP reward rules (pair limit 3/day, min turns, no pay on resign/timeout/same profile) | `a8d055e` | edge bundle (`rooms.ts`, `economy.ts`) | No | **No** | edge deploy. Uses `pvp_matches` (migration 014, applied). Isolated in a SAVEPOINT. |
| F-05 admin login throttle | `a095877` | edge bundle (`service.ts`) | No | **No** | migration 018 + edge deploy. Code tolerates a missing table (42P01 → unthrottled), so edge-before-018 does not lock admins out. |
| F-06 `/admin-tools.js` route in `vercel.json` | `4d996f4` | Vercel | No | **No** | merge to main |
| CMS Effect Registry + split editor | `a9e4ee5` | `admin.html`, `admin-tools.js`, edge (`service.ts`) | No | **No** | **019 must be applied before the edge deploy** (see §2) |
| Data export, balance and audit docs | `31c1a0e`, `3cd5b98`, `0ffcf76`, `38206fb` | docs only | No | n/a | none |
| F-04 publish migration 020 | `3a3e920` | DB only | No (other branch) | **No** | explicit "Deploy" + order below |

Not fixed anywhere (still open, **P1 S-1**): unlimited guest profile creation with 500 starter points; the F-03 pair limit does not stop fresh profile pairs.

Things that live in **two places** and must be rebuilt together after any engine/registry change: `public/engine.js`, `public/admin-tools.js`, the edge bundle. F-02/F-07 touch `game.ts`, so engine.js **and** the edge bundle are both required for them to take effect.

## 2. Migrations 018 / 019 / 020

| | 018 `login_attempts` | 019 `effect_config` | 020 `publish_all_cards` |
|---|---|---|---|
| Change | creates table `admin_login_failures` + index | `ALTER TABLE card_effects ADD COLUMN config jsonb` (nullable) | `UPDATE cards SET status='published'` for 59 explicit IDs |
| Locks / data risk | new table, none on old data | brief ACCESS EXCLUSIVE lock on a small table; no rewrite for a nullable column; existing rows stay NULL | updates 59 rows; fires triggers (see below) |
| Required before which code | optional: code tolerates absence | **required**: `service.ts:214` selects `config`; without the column the Admin effect read errors (card editor/publish break) | none; independent of code |
| Down | `DROP TABLE` (loses throttle history only) | `DROP COLUMN` (**loses all CMS effect config saved after 019**) | restores draft/in_review, deletes version-1 snapshots (see risk) |
| Rollback safety | safe | safe only if Admin has not saved structured config yet | conditional (below) |

**Order: 018 → 019 → edge deploy → merge → verify.** 020 is separate and only runs on its own approval. 018 and 019 have no ordering dependency on each other; both before the edge deploy. If the edge ships before 019, the card editor breaks (P1 outage of Admin, game unaffected).

**020 verified against Production (read-only):** the 59 IDs are exactly the 58 draft + 1 in_review rows currently there (NONG-TAENGMO-015 is the in_review one). No stray card would be touched.

**020 risks / unknowns**
1. **FOLLOW-YOU-040 combo (D1):** direct SQL bypasses the publish gate; the card becomes `published` although the Admin gate would refuse it. The engine still does not run the combo.
2. **Triggers not exercised against Production data (UNVERIFIED):** `validate_card_publish` (image / chain / level order), version bump, `card_versions` snapshot. Spells, traps, EVO and FUS rows are included; whether the trigger accepts them is not proven here. If one row fails, the whole UPDATE aborts (atomic) — safe but blocking. Recommended **before** Deploy: run 020 on an in-memory copy built from the exported data (local only).
3. **No audit_log entry** is written by 020 (SQL, not the service): the publication is untraceable in the Admin history.
4. **Down is lossy:** it resets any of these cards that is `published` with `version_no = 1` back to draft and deletes their v1 snapshots. A card an editor changed after 020 but still at version 1 would be reverted.
5. **Gameplay effect today: none.** Drafts are already in the pool (`<> 'archived'`). 020 only changes visible status. It becomes mandatory **only if** D2 (published-only pool) is adopted, because Production has just 11 published cards: 1GOKU-015/040, BABY, BACKJI, BADGUY-015/040, BAM, BAMMIE, BOBO, CHAEM, CUTIE — no spells, traps, EVO or FUS. A published-only pool on today's data cannot build a valid 40-card deck (11 cards × 3 copies = 33).

## 3. `feature/hardening-1` (1 commit `7abd42a`, based on the same `a7b3c97`)

Files: `.github/workflows/deploy-edge.yml`, `scripts/build-edge.sh`, `docs/DEPLOY-EDGE.md`, `docs/PROJECT-STATUS.md`, `CLAUDE.md`, 018 migration, `src/engine/combat.ts`, `src/engine/game.ts`, `src/server/service.ts`, `scripts/playtest-e2e.cjs`, tests.

Dry merge into this branch (`git merge-tree`, nothing written): **2 conflicts** — `CLAUDE.md` (docs) and `src/server/service.ts` (login). Also: 018 files are identical in both (already cherry-picked as `a095877`).

| Piece | Conflict with this plan? | Note |
|---|---|---|
| Login throttle in `service.ts` | **Conflict, resolvable.** This branch already carries a newer version (`throttleSql`, tolerant of a missing 018). Keep this branch's version. | |
| Reflect-trap (TRP-002) log text in `game.ts` | No logic change, but it **changes engine source** → `engine.js` + edge bundle must be rebuilt | text only |
| `combat.ts`: removes legacy v0 helpers (LP 8000, min-0 damage) | Overlaps ENGINE audit E-9 (positive). It deletes exports used by `tests/combat.test.ts`, which the commit also rewrites. | check no other importer (`src/universe`?) — UNVERIFIED |
| `deploy-edge.yml` + `build-edge.sh` | Complements G-7/Phase 3 (reproducible edge build), but the workflow is **marked NOT TESTED** and needs a repo secret. Never runs on push. | adopting it is a process decision, not a code risk |
| `docs/PROJECT-STATUS.md`, `CLAUDE.md` | Doc conflicts only | |

Planned items it **overlaps**: Phase 3 tooling (build script), E-9. Items it **does not touch**: S-1, deck validators, SPL fixes, LP, DEF, Combo.

## 4. Regression test checklist

Legend: **E** = automated coverage appears to exist (a test file mentions the topic; depth **UNVERIFIED** — not re-run in this round), **N** = new test needed before/with the related change. Run each section against the engine rules `LP 100, hand 5, 7 field + 5 back, damage = max(1, floor(max(1, ATK−DEF) × element 1.5/0.75))`.

**A. Summon**
- A1 Lv.15 summon is free, 1 per turn; 2nd refused. (E game)
- A2 Occupied slot / out-of-range / non-integer slot refused (F-02/F-07). (E audit-fixes)
- A3 Lv.40+ cannot be summoned from hand directly. (E game)
- A4 Hand max 5; draw overflow goes to graveyard. (E game)
- A5 Summon sickness / same-turn attack rules unchanged. (E)

**B. Attack / Direct attack**
- B1 First player cannot attack on turn 1. (E)
- B2 Unit attack: damage and counter-attack both use the formula; min 1. (E combat, game)
- B3 Direct attack only when the enemy field is empty; full ATK, ignores DEF; LP 100 → game over at 0. (E)
- B4 Element multiplier 1.5 / 0.75 applied after DEF; floor. (E)
- B5 Target must be a valid enemy slot; `__proto__`/string keys rejected. (E audit-fixes)
- B6 Trap reactions (cancel, return, reflect, half-damage) during attack. (E game)

**C. DEF**
- C1 `ATK − DEF` uses effective values incl. buffs; buffs last until the unit leaves the field. (E gameplay-fixes)
- C2 DEF below ATK still deals min 1. (E)
- C3 DEF is carried through evolution (`bonusDef`) and **replaced** by the new form's base DEF — characterise current behavior before any DEF-chain change. (**N** characterization)
- C4 Fusion adds DEF of the stacked card. (**N**)

**D. Evolution**
- D1 EVO card + 1/2/3 sacrifices for Lv.40/70/99; wrong count refused. (E)
- D2 Sacrifice slots must be distinct integer field indexes. (E audit-fixes)
- D3 Damage taken is kept (`evolveHp`); HP never below 1. (E combat)
- D4 One evolution per turn; form chosen from the Evolution deck only; forms cannot be in the main deck. (E/ **N** for `buildDeck`)
- D5 Once-per-game effects after evolution (per-unit-instance semantics). (**N**)

**E. Fusion**
- E1 Fusion stacks two cards in one slot: top 100% + bottom 50% + pair bonus (max over rows). (E)
- E2 Pair table empty/missing → no bonus, no crash (repo has 0 pairs; Production 7). (**N**)
- E3 Unfusing on destruction returns/discards both cards correctly. (E TRP-009 path / **N**)

**F. Spell** (SPL-001…010) — one scenario per spell, plus
- F1 Hand/graveyard targets valid; empty targets refused. (E)
- F2 SPL-007 same-turn attack characterisation (current: allowed) — **N** before any rule change.
- F3 SPL-003/004 stacking characterisation. **N**
- F4 No per-turn spell cap currently. **N** (document)

**G. Trap** (TRP-001…010)
- G1 Face-down hidden in `viewFor`/spectator view. (E)
- G2 Trigger chooses correctly with pending-interaction replay; no double trigger. (E)
- G3 Back-row 5 slots, set limits. (E)

**H. Combo** (not implemented)
- H1 FOLLOW-YOU-040/070 load, show "not active", never crash the engine. (E effect-registry/cms-effects)
- H2 Publish gate returns 422 for a character with a non-parsing row; Registry `combo` marked unsupported. (E)
- H3 After D1 is decided, gate vs migration 020 behavior is consistent. (**N**)

**I. Deck validation**
- I1 40 cards, max 3 copies, ≥3 Lv.15, Evolution deck ≤15, forms not in main. (E)
- I2 Admin checker (`GameData.validateDeck`) and game validator (`deck-view`) give the **same verdict** on a shared fixture set (per-chain vs per-card copies). (**N**, exposes G-3)
- I3 Draft/archived cards in a deck (D2 impact). (**N**)

**J. PvP rewards**
- J1 Match <6 turns pays nothing; ≥6 turns = 200 points; every 10th = +10 Vrcoin. (E)
- J2 Pair limit 3/day, unordered, resets at Bangkok midnight. (E reward-farming)
- J3 Resign / timeout / absent loser gets nothing; same profile on both seats pays nothing. (E)
- J4 Bot games pay nothing. (E)
- J5 History unreadable (014 missing) → game still finishes. (E pvp-history)
- J6 Fresh-profile rotation still farms (**known open S-1**, characterise, expect fail → defines S-1 fix).

**K. Platform / drift**
- K1 Rebuilt `engine.js`, `admin-tools.js`, edge bundle equal the committed files. (**N**)
- K2 `/play`, `/admin-tools.js`, `/api/*`, `/media/*` routes in `vercel.json`. (E vercel-routes)
- K3 Edge deployed **after** 019 (`config` column) and with 018 present or absent. (**N** PGlite: run login/effect read with and without each migration)
- K4 Full `npm test` green on the exact commit to deploy (last full result 303/304 then fixed; **not re-run for this report**).

## 5. Safety/integrity work vs rule/balance work

| Class | Items | Changes gameplay? |
|---|---|---|
| **Security, already written (on branch, undeployed)** | F-01 XSS, F-02, F-07 input validation, F-05 login throttle, F-06 route | No |
| **Security, not yet written** | S-1 throttle on profile creation (mechanism only); upload magic-byte check; range checks in `saveCard`; per-key rule validators; XSS lint; keep restricting `audit_log` | No (S-1 mechanism). S-1 **starter-points change is economy policy** → D5 |
| **Deploy/ops safety** | order 018 → 019 → edge; bundle sync test; adopt build script; export production-only tables to seed | No |
| **Data integrity (no rule change)** | one shared deck validator **only if it keeps today's game verdicts** (otherwise it changes which decks are legal); migration 020 audit trail | Borderline: needs I2 result first |
| **Rule / balance (owner decision)** | SPL-007, SPL-003/004, spell cap, LALAPING-070, once-per-game semantics, room LP option, DEF V2 chains, WENDYWENDIE draw, story/affiliation/gender in engine, starter points, published-only pool, publishing the 59 cards, PvP reward rules (already approved as F-03) | **Yes** |

Rule of thumb: anything that changes who wins a given board state, what a player earns, or which cards/decks are legal is a rule/balance change and needs an explicit approval, even if it "fixes an exploit".

## 6. D1–D7 impact

**D1 — FOLLOW-YOU-040 combo**
| Option | Pros | Cons / risk |
|---|---|---|
| A. Keep the combo, leave inactive, publish by SQL (020 as written) | card appears published immediately; no data edit | inconsistent state (gate would refuse it); Admin cannot re-publish after any edit; invisible "dead" ability in a live card |
| B. Rewrite the effect to a supported wording | gate passes, effect works | changes card behavior/balance (needs owner text) |
| C. Exclude FOLLOW-YOU-040 from 020 (58 cards) | no bypass | card stays draft; chain FOLLOW-YOU 015→040→070 incomplete for published logic |
| D. Remove the combo row, keep text in the player-facing description | gate passes, no behavior change | loses the design intent in the structured row |
Data needed: intended combo meaning; whether FOLLOW-YOU-070 (`has_combo` with no row) should match; whether a combo engine is planned.

**D2 — pool: published-only?**
Pros: unfinished cards cannot reach matches. Cons/risk: with today's data it breaks all deck building (only 11 published, none are spells/traps/EVO/FUS); needs 020 first; existing saved player decks containing drafts would become invalid. Data needed: whether testers should still play drafts; list of player decks that contain non-published cards (UNVERIFIED, not queried). Safe sequencing: 020 → verify → filter.

**D3 — room LP**
Not found in any source (UNVERIFIED claim). Owner said it exists; locate it first (another branch? Production-only DB? another repo?). If new: default 100 keeps old behavior; pros: custom matches; cons: touches engine + bundles + room schema, can distort rewards (needs "no rewards when LP ≠ 100"), balance of direct attacks changes with LP. Data: allowed range, who may change it and when, reward policy, whether spectators see it. **Not built, per instruction.**

**D4 — story links / affiliation / gender in engine**
Pros: uses content already authored (8 story links, 27 synergies, gender bonus). Cons: big balance impact (e.g., HP −5, DEF +5 effects), new engine hooks in `createGame`/`refreshAuras`, bundles, tests; Production-only data must be seeded first (G-8). Alternative: mark as "design only" (no risk). Data needed: owner-confirmed rules per link, whether bonuses stack with fusion/evolution, UI to show them.

**D5 — starter 500 points / S-1**
Options: keep + rate limit; reduce; give starter points after first real match; verification. Pros of limiting: stops free Lv.40 cards and reward farming. Cons: friction for new players; IP-based limits are weak behind shared networks/mobile NAT (edge function IP source UNVERIFIED); economy change needs approval. Data: 21 players today, 0 PvP matches (so no abuse evidence yet — S-1 is a latent risk, not an observed one); desired starter value; expected launch scale.

**D6 — Balance V2 DEF + WENDYWENDIE**
Pros: fixes DEF regression on evolution; keeps HP/ATK. Cons: changes card data (forbidden now); all values are Theoretical Estimates with no playtest data; WENDYWENDIE Option B (loot) is a design choice. Data needed: playtest results or owner approval of each chain; whether DEF may be changed at all this season (standing rule: never change HP/ATK; DEF changes need explicit approval).

**D7 — deploy order and `feature/hardening-1`**
Proposed order (on "Deploy" only): 018 → 019 → (020 only if D1/D2 decided and verified) → build edge bundle from the final commit → edge deploy → merge → Vercel auto-deploy → verify. Hardening-1: take this branch's login code, bring over `combat.ts`/`game.ts` text/build script as a separate small commit, rebuild bundles after. Pros: single clean main; cons: touches engine source → one more bundle rebuild and re-test. Data needed: whether the manual deploy workflow is wanted (needs a GitHub secret and a test run), rollback reference (keep `tmp-edge-bundle-l3`, the current Production bundle).

## 7. Still UNVERIFIED after this round

Live endpoints and Vercel deployment list (sandbox network / API 403); that `validate_card_publish` accepts all 59 rows; list of saved player decks containing draft cards; depth of the "E" test coverage; whether `src/universe` imports the removed `combat.ts` helpers; the room-LP feature; full `npm test` on the current HEAD.
