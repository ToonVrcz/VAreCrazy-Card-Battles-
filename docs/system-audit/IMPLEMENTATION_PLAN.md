# Implementation Plan (PROPOSAL — nothing here is approved or started)

> Workflow: Audit → Report → Review → Approval → Implementation. Every item needs Toon's approval. No HP/ATK change. Backward compatible. No deploy/merge/Production write until Toon says "Deploy". Findings IDs refer to `SYSTEM_GAP_ANALYSIS.md`, `ENGINE_RULE_AUDIT.md`, `CMS_ADMIN_AUDIT.md`, `CARD_DATA_AUDIT.md`, `EFFECT_COMPATIBILITY_MATRIX.md`.

## Phase 0 — Owner decisions (blockers)

| # | Decision | Blocks |
|---|---|---|
| D1 | FOLLOW-YOU-040: keep the combo row (publish gate blocks it) or remove/rewrite it? | Migration 020, W-1, G-5 |
| D2 | `loadPool`: published-only, or keep draft cards playable for testing? | G-6 |
| D3 | Room LP: is a room-owner LP setting wanted? (not found in the source, E-1 UNVERIFIED). If yes, allowed range, and rewards off at LP ≠ 100? | G-1 |
| D4 | Story links / affiliation / gender: implement in engine, or label "design only"? | G-4 |
| D5 | Starter 500 points: keep, reduce, or gate behind verification? | S-1 |
| D6 | WENDYWENDIE draw: Option B (loot)? V2 DEF table acceptable? | Balance V2 |
| D7 | Deploy order for 018 → 019 → 020, and the `feature/hardening-1` conflict | all deploys |

## Phase 1 — Safety and data integrity (small, low risk)

1. S-1: throttle guest profile creation (needs D5). Test: N profiles/IP/day.
2. Deck validator unification (G-3): one shared function used by Admin and game.
3. Range validation in `saveCard` (G-9); magic-byte check on uploads (S-4).
4. Per-key validators for `setRule` (S-9).

## Phase 2 — Engine rule fixes (needs approval each; rebuild engine.js + edge bundle)

1. SPL-007 same-turn attack (E-3). 2. SPL-003/004 stacking (E-4). 3. Optional spell-per-turn cap (E-5, only if D-approved). 4. Once-per-game loop and LALAPING-070 full heal review (E-6/E-7). 5. Room LP option (D3, default 100, unchanged behaviour). Each with a regression test and a before/after probe.

## Phase 3 — Tooling and drift control

1. Test that rebuilds `engine.js`, `admin-tools.js`, edge bundle in a temp dir and compares with the committed files (G-7).
2. CI workflow running `npm test` (free tier only; confirm no cost).
3. Automated innerHTML-escape lint (S-5).
4. Export Production-only tables to seed (G-8).

## Phase 4 — Content / master data

1. Resolve D1, then apply or revise migration 020 with the gate intact.
2. Apply V2 DEF chain (Balance V2) — DEF only, HP/ATK untouched, as a new migration after approval.
3. Engine hookup or "design only" labelling for G-4 (D4); label rules table with "read by engine" (G-2).
4. Data-driven spells/traps: **later**, large; only if the owner wants many new spells.

## Phase 5 — Deploy (only on "Deploy")

Order: apply migrations (018, 019, 020 as approved) → deploy edge function → merge to `main` → verify live endpoints. Rollback per CLAUDE.md.

## Verification for every phase

Targeted tests, full `npm test` in background to a file (last full run 303/304, then fixed; not re-run for this audit), bundle rebuild check, local e2e scripts.
