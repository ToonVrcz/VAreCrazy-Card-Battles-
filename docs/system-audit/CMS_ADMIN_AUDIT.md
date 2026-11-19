# CMS Admin Audit

> **AUDIT ONLY.** No code, data, rule, migration, deploy or Production change was made. Baseline: branch `docs/system-audit-v1` (from `docs/card-balance-review` <- `fix/audit-p0-p1`), working tree clean at start. Note: this baseline is **ahead of `main`/Production** (it contains the P0/P1 fixes and the unmerged feature branches' merged parts); statements about "Production" come from `card-data-export/production-snapshot/` (read-only SELECT of 2026-11-19).
> Labels: **VERIFIED** = read in source or run; **UNVERIFIED** = not provable from the repo.

## 1. What the Admin is

`public/admin.html` (258 lines, vanilla JS) + `src/server/api.ts` router + `service.ts` / `gamedata.ts` / `economy.ts`. Nav buttons (`admin.html` line 203): Cards, Users (needs `users`), Card frames, Game systems, Shop/players (needs `users`), My account. Roles (`service.ts` line 15-22): `super_admin`, `card_editor`, `reviewer`, `publisher`, `viewer`. Sessions: scrypt password hash, 12 h session, 5 failed logins / 10 min throttle (`LOGIN_MAX_FAILS`, migration 018).

## 2. Master-data systems requested in the brief

| System | Exists? | Admin UI | DB | Linked to cards | Used by the battle engine? | Validation | Limits / findings |
|---|---|---|---|---|---|---|---|
| **Fusion** (per-card partner chains + stat bonus) | Yes | Card editor, "Fusion" block (`admin.html` 179-182) | `card_fusion_partners` (7 rows in Production, **only 1 pair in repo seed** `db/seed/fusion-pairs.json`) | by card -> `partner_chain_id` | **YES**: `rooms.ts loadPool` -> `createGame({fusionPairs})` -> `fusionBonus()` (`game.ts` 105) | `setCardMeta` (`gamedata.ts` 110) | Stored one-directional per card; engine matches either order. Partner data is runtime-only (not in the repo): **cannot be re-created from the repo**. |
| **Fusion recipes** (GDD v0.3 recipe system) | Yes (API only: `/api/fusion`, `/api/fusion/check`) | No UI found for recipes (UNVERIFIED: only API) | `fusion_recipes` (**0 rows** in Production) | `result_card_id`, `required_chain_keys`, `must_match` | **NO** (only `gamedata.ts` + tests) | `validateFusion` | A second, unused fusion model. Dead feature / documentation drift. |
| **Gender** | Yes | Card editor select + add (`admin.html` 169-170, 189) | `taxonomy_values('gender')`, `cards.gender_id` | by card | **NO** | key regex `^[a-z0-9_-]{2,40}$` | Seed has no gender for any card (48/48 absent in `cards.json`); DB rule `gender_pair_bonus +5 ATK` is **proposed** and unused. Production gender data not in repo export (UNVERIFIED). |
| **Affiliation** (game affiliation + synergies) | Yes | Card editor checkboxes + add (`admin.html` 172-173); synergies in "Game systems" | `taxonomy_values('affiliation')`, `card_affiliations` (21), `affiliation_synergies` (27) | by card | **NO** (calculator `/api/bonus` only, `synergyBonus` `gamedata.ts` 76) | stat in hp/atk/def, integer != 0, min_members >= 2 | Synergy values never enter a battle. |
| **Frame** | Yes | "Card frames" page | `card_frames` (3), `media_assets` | per type / per level 40-70-99 / per card | **UI only** (`/api/play/frames` -> `card-renderer.js`) | image type/size | Cosmetic; works. |
| **Element** | Partially | select on card editor only; **no editor** for the element list or matrix | `taxonomy_values('element')` + **`db/seed/elements.json` (the matrix)** | by card | **YES**, but from the **file** `elements.json` bundled in the engine (`combat.ts` 3-17), not from the DB | none for the matrix | Production taxonomy has `alchemy` and `wind` which the 48 repo cards do not use; the multiplier in DB `game_rules.element_multiplier` is **not read** by the engine. Changing the matrix = code change + rebuilt `public/engine.js` and edge bundle. |
| **Story links** | Yes | Card editor "Story" block (`admin.html` 174-178) | `card_story_links` (8 rows); legacy `stories` / `story_members` (**0 rows**) | card <-> partner chain + stat + amount | **NO** (`storyLinkBonus`, `/api/bonus` calculator only) | `upsertStory` | Production has 8 links with real stat effects (e.g. `1GOKU-015` + `dnman`: HP -5). **They do nothing in a match.** |
| **Class** | Partially | select on card editor; no editor for the list | `taxonomy_values('class')`, `cards.class_id` | by card | **NO** (display only) | none | 48 characters use 33 distinct class labels; `cards.name` holds the class name (see CARD_DATA_AUDIT). |
| **Evolution chain** | Yes | text fields `chain_key`/`chain_name`/`evolves_from` on the card editor; `/api/chains` read-only list | `evolution_chains` (39), `cards.chain_id`, `cards.evolves_from` | by card | **YES**: engine matches `chain` and level (`game.ts` 289-295) | DB trigger `PUBLISH_RULE` (migration 001 lines 126-144): image required, same chain, level order, chain completeness at publish | No chain editor screen; chains are created by typing a key on a card. |
| **Combo** | Flag only | checkbox `has_combo` (`admin.html` 72) and a "combo" trigger option | `cards.has_combo`; effect trigger `combo` allowed by `TRIGGERS` (`service.ts` 35) | by card | **NO**: `parseEffect` returns null for `combo` | trigger in list | `has_combo` true on `FOLLOW-YOU-040` and `-070` but only `-040` has a combo row; `-070` has none (data inconsistency). |

## 3. Card management, Effect Builder, Rules, Publishing

- **Card CRUD** (`saveCard`, `service.ts` 267): needs `write`; edit only in `draft` (409 otherwise); character_id/name/type required; numeric coercion `n()`; text limits via `cleanText` (LIMITS in `effect-text.ts`: description 180, rules 240, flavor 200 code points); max 10 effects. **Gap:** no range check for `level`, `hp`, `atk`, `def` (negative or huge values are accepted; the DB has only constraints I did not find for them -> UNVERIFIED), no check that `card_type` fits level/HP presence.
- **Delete** (`deleteCard`): Draft only, refuses if another card evolves from it or a fusion recipe uses it. Good.
- **Effect Builder** (`admin.html` 86-145 + `public/admin-tools.js` generated from `effect-registry.ts`): structured editor (A. system config chosen from lists, B. player text with counters, warn-only consistency check) and a legacy free-text "Rule Builder". `cleanEffects` (`service.ts` 227): for the structured payload the **server re-derives** the legacy columns from the Registry (`validateSystem`, `toLegacy`), so the client cannot smuggle values. For legacy free-text payloads it only checks trigger/duration/limit enums -> **any wording can be saved**; the engine ignores unknown wordings.
  - **Gap (Admin can create, engine cannot run):** triggers `combo` and `on_cast`; duration `n_turns`; any free-text `action_text`/`target_text`/`condition_text`/`cost_text` not matching `parseEffect`; see EFFECT_COMPATIBILITY_MATRIX.
- **Publishing workflow** (`transition`, `service.ts` 328): `draft -> in_review -> approved -> published -> archived`, each step needs `submit`/`review`/`publish`. **Publish gate:** a *character* cannot leave `draft` while any of its effect rows fails `parseEffect` (HTTP 422). Spells, traps, evolution and fusion cards are exempt (they run by card ID). DB trigger adds image/chain rules.
  - **Finding W-1 (P2):** `FOLLOW-YOU-040` has a `combo` row the engine cannot run, so **it can never pass the Admin publish gate**. Migration `020_publish_all_cards` (branch `fix/f04-publish-migration`, not applied) updates status in SQL and therefore **bypasses the gate** for it. Decision needed before 020 is deployed.
- **Rules** (`GameData.setRule`, `gamedata.ts` 16): needs `users`; value is any JSON; status confirmed/proposed; audit-logged. **Finding W-2 (P2):** the engine reads **none** of the 26 `game_rules` (LP, hand size, slots, element multiplier, fusion stack %, gender bonus, sacrifice map are all hard-coded or file-based). The Admin shows them as the "rules" but editing them changes nothing in a match. Only `deck_size` / `max_copies` are read, by the Admin deck checker (W-3). No per-key schema validation exists, so a wrong JSON shape is accepted silently.
- **Finding W-3 (P2):** two deck validators disagree. Admin `/api/deck/check` (`gamedata.ts` 333) counts copies **per evolution chain**, takes size/copies from DB rules, and accepts Lv40/70 forms in the main deck. The game (`deck-view.ts` 50-63) counts **per card ID**, **rejects** Lv40+ in the main deck, and requires at least 3 Lv15 characters. DB rule `evolution_in_main_deck = true` ("confirmed") contradicts the engine.
- **Import/Export** (`/api/import`, `/api/export.*`): `import` permission; dry run exists; `importCards` is transactional. Export needs `read`.
- **Media upload** (`uploadMedia`, `service.ts` 349): `write`; type from the **client-supplied Content-Type** (JPG/PNG/WEBP), 5 MB limit, random file name; **no magic-byte check** (P3).
- **Users/Roles:** last-super-admin protection (`activeSupers`), password reset, own password change keeps the current token. Audit log table `audit_log` readable by any role with `read` (shows actor e-mail).
- **Economy panel** (`/api/admin/economy*`, needs `users`): grant points/Vrcoin, shop prices. Audited? `adminGrant` writes a ledger row (UNVERIFIED whether also `audit_log`).

## 4. Verified working vs. not

| Works end to end (Admin -> DB -> engine) | Admin-only / calculator-only (no battle effect) | Inconsistent |
|---|---|---|
| card stats HP/ATK/DEF, level, chain, element (matrix from file), supported effect rows, fusion partner bonuses, shop prices/economy, frames (UI) | gender, affiliation + synergies, story links, class, `game_rules` values, fusion recipes, combo flag | two deck validators, `game_rules` vs engine constants, `has_combo` on FOLLOW-YOU-070, one-direction partner storage |

## 5. Proposed solutions (NOT started, awaiting approval)

1. Decide the fate of the unused systems (wire into the engine, or label them "design only" in the Admin to stop false expectations).
2. Make the Admin rules panel show which rules the engine really reads (read-only badge) or make the engine read them (new engine work).
3. Single deck validator shared by Admin and game (`deck-view.ts`).
4. Range checks for level/HP/ATK/DEF in `saveCard`; magic-byte check for uploads.
5. Fix W-1 before applying migration 020 (see IMPLEMENTATION_PLAN).
