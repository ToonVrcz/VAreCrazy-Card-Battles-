# VAreCrazy Card Battles — Story / Synergy System Addendum
**Date:** 2026-11-25  
**Parent handoff:** `docs/balance/VARECRAZY_FULL_70_CARD_BALANCE_HANDOFF_2026-11-25.md`  
**Branch:** `balance/full-70-card-handoff`  
**Status:** DESIGN PROPOSALS ONLY — NOT APPROVED FOR DB / PRODUCTION WRITE  
**Owner:** Toon (final approval)  
**Design analyst:** Ball  
**Implementation review:** Claude

## 1. Purpose and precedence
This is an additive supplement to the Full 70-Card Balance Handoff. It does not replace, rewrite, or amend any existing Story/Fusion record, rule, card stat, or parent handoff content.

The existing live database records are authoritative and must be preserved exactly. This document contains new proposals only. Claude must inspect current code, schema, and live Story data before proposing implementation. Do not write proposals into Supabase or production, run migrations, deploy, merge, or alter existing records without explicit approval from Toon.

## 2. Existing Story data — immutable baseline
The 8 existing Story rows previously read from the live database are:
1. 1GOKU-015 + DNMAN-015 — “โดนกล่าวหา ว่าโกง ตอนเล่นเกม” — HP -5.
2. BABY-015 + BAM-015 — “เพื่อนรัก” — ATK +5.
3. BACKJI-015 + NONG-TAENGMO-015 — “รันแกงซ์ FiveM” — DEF +5.
4. BADGUY-015 + SMILE-015 — “ความขัดแย้งในตลาด” — ATK -5.
5. BAM-015 + SATOSHI-015 — “เจอหน้ากันไม่ได้” — DEF -5.
6. BAMMIE-015 + JAOJAY-015 — “คู่รัก” — HP +10.
7. CHAEM-015 + TEE-015 — “แอบรักข้างเดียว” — DEF -5.
8. NONG-TAENGMO-015 + BACKJI-015 — “รันแกงซ์ FiveM” — ATK +5 (description currently blank).

Important: BACKJI/NONG-TAENGMO has two directional existing rows with different stats. Do not merge, normalize, deduplicate, rename, edit descriptions, or delete either row. Preserve all existing row IDs and values.

## 3. Proposed Story runtime behavior
Proposed rule for a Story link:
- The effect is active only while both linked character cards are simultaneously on the field.
- When either linked character leaves the field, that Story effect stops applying immediately.
- Apply the modifier to the relevant in-game effective stat only; never mutate the card's stored/base HP, ATK, or DEF.
- A negative value is a Story Debuff; a positive value is a Story Buff.
- A Mixed Story may apply more than one stat modifier at the same time (for example ATK +10 and DEF -5).
- Recommended default: do not stack duplicate applications of the same Story row. Recalculate from the current field state so leaving/re-entering cannot permanently accumulate modifiers.
- Recalculate and clamp effective values using the existing engine's established HP/ATK/DEF rules. Do not invent new death, healing, or negative-stat semantics.
- The pair can be in either field order unless the current data model explicitly defines direction. Claude must inspect current matching behavior and report whether rows are directional before changing it.

These are proposed semantics for review, not permission to change core rules or engine behavior. If existing engine behavior conflicts, document the conflict and propose the smallest safe implementation.

## 4. New positive Story proposals — 8
These are proposals only. Additive candidates:
| # | Character A | Character B | Story name | Proposed effect |
|---|---|---|---|---|
| 1 | BABY-015 | BAMMIE-015 | เพื่อนเก่าที่กลับมา | ATK +5 |
| 2 | LALAPING-015 | THOMAS-015 | ผู้ช่วยชีวิต | HP +10 |
| 3 | LORDNAM-015 | LUCKY-015 | สัญญาแห่งโชคชะตา | DEF +5 |
| 4 | BOBO-015 | LINLADA-015 | คู่หูนักสู้ | ATK +5 |
| 5 | CHAEM-015 | PK-015 | นักวางแผน | HP +5 |
| 6 | GOD-WA-015 | JAOJAY-015 | คู่หูนักอัญเชิญ | ATK +5 |
| 7 | LEON-S-KENNEDY-015 | OUFILLING-015 | คู่หูผู้พิทักษ์ | DEF +5 |
| 8 | MELON-015 | THAI32-015 | สหายร่วมสนาม | HP +5 |

## 5. New negative Story / Debuff proposals — 8
Activation condition for each: both named characters are on the field.
| # | Character A | Character B | Story name | Proposed effect |
|---|---|---|---|---|
| 1 | CUTIE-015 | PIKACHU-015 | ศึกจอมเวท | ATK -5 |
| 2 | NORMAN-015 | THAI26-015 | ศึกนักรบต่างขั้ว | DEF -5 |
| 3 | WENDYWENDIE-015 | NONG-TAENGMO-015 | โจรแย่งผลงาน | ATK -5 |
| 4 | PKXCY-015 | MIKI-015 | ศักดิ์ศรีนักสู้ | DEF -5 |
| 5 | FOLLOW-YOU-015 | GOD-WA-015 | นักอัญเชิญกับหัวขโมย | ATK -5 |
| 6 | TAN-015 | MON-015 | ธุรกิจที่ไม่ลงตัว | HP -5 |
| 7 | ZEESKY-015 | SKYMOON-015 | พายุเหนือโรงตีเหล็ก | DEF -5 |
| 8 | BOBO-015 | BAM-015 | ศึกชิงความเป็นหนึ่ง | ATK -5 |

## 6. New mixed Story proposals — 5
A Mixed Story applies both listed modifiers concurrently while both characters are on the field.
| # | Character A | Character B | Story name | Proposed effects |
|---|---|---|---|---|
| 1 | BADGUY-015 | NORMAN-015 | คู่หูสายบุก | ATK +10; DEF -5 |
| 2 | CUTIE-015 | SOMYES-015 | เวทมนตร์และธนู | ATK +5; HP -5 |
| 3 | LALAPING-015 | SATOSHI-015 | ผู้รักษาสองขั้ว | HP +10; ATK -5 |
| 4 | BACKJI-015 | GOD-WA-015 | คู่หูนักลอบโจมตี | ATK +10; DEF -5 |
| 5 | THAI26-015 | BAMMIE-015 | นักดาบประสานพลัง | ATK +5; HP -5 |

## 7. Required Claude review / implementation sequence
1. Read the parent handoff and inspect the current branch, current main, all existing Story-related commits, Story UI/CMS, runtime engine handlers, and tests. Do not blindly implement this document.
2. Read the live Story rows from Supabase and export a before-snapshot including row IDs and every field. Compare against the 8-row baseline above; report any discrepancy before proceeding.
3. Inspect actual schema and engine representation. Current known table is `card_story_links` with fields `card_id`, `partner_chain_id`, `name`, `stat`, `amount`, `description`. Do not assume this table supports multiple effects per Story or a Story Type field.
4. Determine whether the current model is directional or pair-based, and whether the engine currently activates Story modifiers only when both characters are on the field.
5. Prepare an implementation design for supporting Positive / Negative / Mixed Story types and multiple modifiers per Story. If schema/API changes are required, provide a migration proposal and compatibility plan only. Do not apply it.
6. Check each proposed pair against live data for duplicates in either direction. Do not create a duplicate merely because its direction differs; report collisions and let Toon decide. Do not change any existing row.
7. Review balance impact and edge cases: HP modifier timing, current/max HP behavior, a character leaving/returning, control changes, Fusion/evolution interactions, multiple simultaneous Stories affecting one character, and duplicate event delivery. Do not invent rules where current GDD is silent.
8. Add tests only on a dedicated non-production branch after the implementation plan is approved. Until then, do not change schema, DB data, API contracts, core rules, or production code.
9. Report: files inspected, current behavior, schema limitations, duplicate-pair findings, proposed implementation plan, test plan, and all questions requiring Toon’s decision.

## 8. Hard constraints
- Additive only. Never overwrite, delete, merge, rename, or “clean up” existing Story/Fusion data.
- No Supabase writes, production migrations, deployment, merge, or release without explicit owner approval.
- Do not change character base HP/ATK or existing Fusion HP/ATK bonuses.
- Do not alter existing Story amounts or descriptions.
- Keep proposals clearly separated from live/approved data.
- If a requirement is ambiguous or needs a core-rule/schema change, stop and report BLOCKED rather than guessing.

**End of addendum.**
