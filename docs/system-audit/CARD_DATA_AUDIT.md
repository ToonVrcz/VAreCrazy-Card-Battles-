# Card Data Audit

> **AUDIT ONLY.** No card data was changed. Source: `card-data-export/` (70 verbatim seed records, rebuilt in PGlite from the migrations, compared with a read-only Production SELECT of 2026-11-19: level/HP/ATK/DEF/texts and 78 effect rows = **0 differences**) plus a fresh check run for this audit (`/tmp` script, results below).

## 1. Inventory

| Item | Value |
|---|---|
| Cards | 70 = 48 characters (39 Lv15, 7 Lv40, 2 Lv70) + EVO-001 + FUS-001 + 10 spells + 10 traps |
| Duplicate `character_id` | 0 |
| Effect rows | 78 (1 or 2 per character; 1 per support/spell/trap) |
| Images | every card has `image_path`; every file exists in the repo (0 missing) |
| Elements | 10 used: holy 7, water 7, poison 7, fire 6, dark 6, physical 5, lightning 4, nature 3, neutral 2, earth 1. All exist in `db/seed/elements.json`. Production taxonomy also has `alchemy`, `wind` (unused by cards). |
| Classes | 33 distinct labels over 48 characters |
| Evolution chains | 39 chains; 7 have Lv40: `1goku`, `badguy`, `follow-you`, `lalaping`, `norman`, `satoshi`, `tee`; 2 have Lv70: `follow-you`, `lalaping`. No chain has a Lv40 without a Lv15 or a Lv70 without a Lv40. `evolution_forms_without_parent` = [] |
| DEF | **0 on all 48 characters** (so DEF is currently inert in every real match, only spells add DEF) |

## 2. Findings

| ID | Severity | Finding | Evidence | Proposed solution |
|---|---|---|---|---|
| D-1 | P2 | **`cards.name` holds the class label, not a unique card name** (e.g. 4 cards named "Fighter", 4 "Thief", 4 "Merchant"/"Assassin"...). The real identity is `chain_name` + `character_id`. Any UI/log that prints `name` is ambiguous (the engine log/event text prints `card.name`). | seed `toon-cards.json` `name` = class; 9 duplicate-name groups | Show `chain_name` (+ level) in logs/events; no data change needed. |
| D-2 | P2 | **FOLLOW-YOU-040 has an inactive `combo` row**; `has_combo` is true on FOLLOW-YOU-040 **and -070**, but only -040 has a combo row. -070 has the flag and no ability. | `cards.json`; `parseEffect` rejects `combo` | Owner decides: keep as display text, remove, or build the Combo trigger (engine work). |
| D-3 | P3 | 22 non-character cards have effect rows that `parseEffect` returns null for (EVO-001 `on_evolve`, FUS-001 `passive`, 10x `on_cast`, 10 trap rows). This is **expected**: they run by card ID in `game.ts`. The Admin publish gate exempts them. But the rows are descriptive only; their numbers can disagree with the code (see ENGINE_RULE_AUDIT "SPL-003/004 duration"). | `_integrity.json`, probe | Keep, but add a parity test (card-ID behaviour vs description). |
| D-4 | P2 | **SPL-003 / SPL-004 text disagreement**: effect row says "จนจบเทิร์น" (until end of turn); `rules_text` says until the unit leaves the field; the engine keeps the bonus until it leaves (`bonusDef`/`bonusAtk` are never reset at end of turn). | `spell-cards.json`; `game.ts` 330-331 | Owner picks the canonical behaviour. |
| D-5 | P3 | `rules_text` is empty for all 48 characters (they only have effect descriptions + flavor); spells/traps/EVO/FUS have it. Not an error, but the card renderer for characters depends on effect text only. | `noRulesText = 48` | none |
| D-6 | P3 | **Gender is absent from the repo seed for all 48 characters** (and `race`); gender exists only as a Production DB column. The repo cannot reproduce the Production gender data. | `cards.json` has no `gender` key | Add gender/affiliation/story/fusion partner data to an export file (read-only) so the repo is a complete source of truth. |
| D-7 | P2 | **Production-only data not in the repo:** 7 fusion partner rows, 8 story links, 21 affiliation memberships, 27 synergies, 3 frames, 26 `game_rules` (6 not created by migrations). Repo `fusion-pairs.json` has 1 pair (BACKJI<->NONG-TAENGMO). Re-creating the database from the repo loses fusion for 6 pairs. | `production-snapshot/production-only-data.json` | Export these tables as seed files (data export only). |
| D-8 | P2 | **Fusion partner direction:** rows are stored per card (e.g. `1GOKU-015 -> lalaping`, `BABY-015 -> thai26`) and are not mirrored, except BACKJI<->NONG-TAENGMO. The engine accepts either order (`game.ts` 105-109) so a pair works from both sides, but the Admin shows only one side per card. | production rows | Display both sides in the Admin (read-only). |
| D-9 | P3 | Fusion bonus is `max()` over matching rows, per stat independently (`game.ts` 108-109): two rows for the same pair do not add, they take the highest. | `fusionBonus` | Document. |
| D-10 | P3 | Production publish status: **11 published, 58 draft, 1 in_review** of 70 (`production-card-status.json`). `loadPool` loads `status <> 'archived'`, so Draft cards are playable today. Published-only is not enforced (decision "ยังเอาไว้" pending). | `rooms.ts loadPool` | Decide after migration 020. |
| D-11 | P3 | Rarity of data checks: `level`, `hp`, `atk`, `def` have **no range validation** in `saveCard` (see CMS audit). All 70 current values are sane (HP 60-310, ATK 10-100, DEF 0). | `cards.json` | Add range checks. |

## 3. Relationships checked

- Evolution: every `evolves_from` target exists and is in the same chain; level order 15 < 40 < 70 holds (`PUBLISH_RULE` trigger also enforces at publish).
- Chains with Lv40/70 and their Lv15 are present for all 7 chains. **No Lv99 card exists** (the engine supports a Lv99 step with 3 sacrifices, but there is no card for it).
- Fusion partners reference existing chains (7/7 in the Production snapshot).
- Story links reference existing chains (8/8 snapshot).
- Image files: 70/70 present.
- Duplicate effects: groups of cards with identical ability wording and level (redundancy) are listed in `docs/card-balance/CARD_BALANCE_REVIEW.md` section 3.

## 4. UNVERIFIED

- Production gender values (not exported).
- Whether Production `card_effects.config` rows exist for any card (export says the column exists; seed rows have none).
- Whether the card text printed in the live UI exactly equals this export for every card (compared at the data level only).
