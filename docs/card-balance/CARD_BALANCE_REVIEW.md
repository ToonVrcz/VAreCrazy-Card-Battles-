# Card Balance Review (Issue #2)

> **STATUS: PROPOSED — NOT APPROVED.** Nothing in this document is implemented. HP and ATK are never changed. Toon reviews and approves before any implementation.

Source: `card-data-export/cards.json` (70 verbatim seed records, identical to production for level/HP/ATK/DEF/text — see `card-data-export/EXPORT_REPORT.md`) and the engine in `src/engine/`. Branch `docs/card-balance-review`.

## 1. Summary

- Cards reviewed: **70/70** (48 characters: 39 Lv15 + 7 Lv40 + 2 Lv70; 2 support; 10 spells; 10 traps).
- Proposed changes: **30** cards (15 DEF only, 11 effect only, 4 DEF + effect). Everything else is explicitly "unchanged". **HP/ATK: 0 changes.**
- Tier counts (relative to the level mean): current S:9 A:5 B:14 C:10 D:10  ->  proposed S:7 A:6 B:22 C:9 D:4.
- Engine proposals that are NOT data changes (new engine work): ENGINE-PROP-01..05, see `ENGINE_COMPATIBILITY.md` and `CARD_CHANGELOG.md`.
- Honest limit: HP/ATK are locked, so the S-tier Lv15 cards (MON-015, PIKACHU-015, DNMAN-015, LINLADA-015, MELON-015, SMILE-015, CUTIE-015) stay S after the effect trims. Their power comes from the stat line. Only the owner can decide to change it.
- No playtest data exists (production `pvp_matches` was empty): every tier is a **model estimate**, not a measured win rate.

## 2. Rubric and how progression is evaluated

Power of one character = `effective HP x effective ATK x (1 + effect bonus)` (script: `scripts/card-balance-model.ts`). Tier = ratio to the mean of the same level: S >= 1.25, A >= 1.10, B >= 0.90, C >= 0.75, D < 0.75.

| Assumption | Value | Meaning |
|---|---|---|
| Average incoming ATK by level | Lv15: 33, Lv40: 55, Lv70: 90 | DEF converts to effective HP as HP x A/(A-DEF) |
| Extra card | +20% | one draw = about one unit of tempo |
| Loot (discard 1 draw 1) | +8% | selection only |
| Draw-on-kill probability | 0.4 | |
| "Target HP lower than self" true | 0.5 | |
| Horizon | 3 turns | repeated per-turn effects |
| Attack bonus | half of the bonus counts as effective ATK | the bonus applies only when attacking |

Checked per card: redundancy (identical effect on another card of the same level), power, survivability, card advantage, removal, healing, control, combos, element/class synergy, counterplay. Spells/traps are judged on source behaviour, not on the model.

**Progression Lv15 -> Lv40 -> Lv70.** Means: Lv15 AP 2431, Lv40 11100, Lv70 53895. A form must cost 1 Evolution card plus 1 sacrifice (Lv40) or 2 (Lv70) face-up characters, so a Lv40 form should be clearly stronger than a Lv15 of the same chain, not merely equal. Chains below that bar (relative tier at Lv40 D): FOLLOW-YOU-040, TEE-040, LALAPING-040. Chains above (S): BADGUY-040, 1GOKU-040. The Lv70 sample has only 2 cards, so no relative balance is possible.

**Evolution/Fusion** are reviewed in the EVO-001 and FUS-001 entries and in `ENGINE_COMPATIBILITY.md` (discrepancy with the Issue text: Evolution needs 1 Evolution card plus 1/2/3 sacrifices, not 1/2/3 Evolution cards).

## 3. Redundancy groups (same level, identical ability wording)

- 1GOKU-015, BAM-015, BAMMIE-015, BOBO-015, DNMAN-015, LINLADA-015, MELON-015, MIKI-015, NORMAN-015, PKXCY-015, THAI26-015
- BACKJI-015, BADGUY-015
- CHAEM-015, FOLLOW-YOU-015, MON-015, PK-015
- CUTIE-015, PIKACHU-015, ZEESKY-015
- GOD-WA-015, JAOJAY-015, NONG-TAENGMO-015, WENDYWENDIE-015
- LALAPING-015, SATOSHI-015, SMILE-015
- LEON-S-KENNEDY-015, OUFILLING-015
- LORDNAM-015, LUCKY-015

Identical wording is not removed here: it is reported. Differences in stats/element/class are the only differentiation.

## 4. Per-card review (all 70)

Tier: current -> proposed (relative to Lv mean; characters only). "Compat" = whether the proposal is expressible with the current engine.

### 1GOKU-015 — Fighter

- **Type/Level/Class/Element:** character / 15 / Fighter / fire
- **Current:** HP 84 / ATK 20 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 0.86x (tier C) -> 0.95x (tier B); model parts: attack ATK+10 = +5.0 eff
- **Issue:** ATK 20 / HP 84 with +10 on attack. Evolves to a strong 1GOKU-040.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 3. Resulting data: HP 84 / ATK 20 / DEF 3; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** Lv15 is below average while Lv40 is above; closes a little of the gap.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** BAM-015, BAMMIE-015, BOBO-015, DNMAN-015, LINLADA-015, MELON-015, MIKI-015, NORMAN-015, PKXCY-015, THAI26-015

### 1GOKU-040 — Warlord

- **Type/Level/Class/Element:** character / 40 / Warlord / fire
- **Current:** HP 152 / ATK 55 / DEF 0; `on_attack` เมื่อโจมตี ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)<br>`on_destroyed` เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 20
- **Role:** Chip-damage / removal
- **Estimated power:** 1.32x (tier S) -> 1.10x (tier A); model parts: attack ATK+20 = +10.0 eff; 20 dmg = +48%
- **Issue:** ATK 55 / HP 152 with +20 on attack plus 20 damage when destroyed.
- **Recommendation (PROPOSED / NOT APPROVED):** Death damage 20 -> 10. Resulting data: HP 152 / ATK 55 / DEF 0; `on_attack` เมื่อโจมตี ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)<br>`on_destroyed` เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10
- **Reason:** Two strong effects on a strong body; trim the secondary one.
- **Risk:** Drops from S to A, borderline with B (about 1.10x).
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Note:** Reached only through Evolution (cannot be in the main deck).

### BABY-015 — Acolyte

- **Type/Level/Class/Element:** character / 15 / Acolyte / holy
- **Current:** HP 70 / ATK 10 / DEF 0; `on_summon` เมื่อถูกเรียก ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ
- **Role:** Healer / support
- **Estimated power:** 0.33x (tier D) -> 0.41x (tier D); model parts: heal 20 = +14%
- **Issue:** Lowest power of all cards (ATK 10 / HP 70, summon heal 20).
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 5 and summon heal 20 -> 30. Resulting data: HP 70 / ATK 10 / DEF 5; `on_summon` เมื่อถูกเรียก ฟื้น HP 30 ให้ตัวละครฝ่ายเรา 1 ใบ
- **Reason:** A support card has to be a good heal; ATK is locked.
- **Risk:** Heal 30 is the same size as SPL-002; still a once-per-summon effect, so low exploit risk, but recursion (SPL-006) can reuse it.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)

### BACKJI-015 — Assassin

- **Type/Level/Class/Element:** character / 15 / Assassin / water
- **Current:** HP 76 / ATK 24 / DEF 0; `on_attack` เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +15 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 0.87x (tier C) -> 0.95x (tier B); model parts: attack ATK+15 (cond) = +3.8 eff
- **Issue:** Conditional +15 attack bonus (HP of target lower than self). ATK 24 / HP 76.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 3. Resulting data: HP 76 / ATK 24 / DEF 3; `on_attack` เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +15 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** Fragile assassin; small DEF.
- **Risk:** Fusion partner of NONG-TAENGMO (production data): fused unit uses the top card only, so DEF applies to the top card.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** BADGUY-015

### BADGUY-015 — Assassin

- **Type/Level/Class/Element:** character / 15 / Assassin / poison
- **Current:** HP 94 / ATK 15 / DEF 0; `on_attack` เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +15 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 0.72x (tier D) -> 0.82x (tier C); model parts: attack ATK+15 (cond) = +3.8 eff
- **Issue:** Same conditional bonus as BACKJI-015 with ATK 15 / HP 94: the bonus is too weak to matter.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 4. Resulting data: HP 94 / ATK 15 / DEF 4; `on_attack` เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +15 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** A tank-leaning assassin that needs survivability.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** BACKJI-015

### BADGUY-040 — Assassin

- **Type/Level/Class/Element:** character / 40 / Assassin / poison
- **Current:** HP 153 / ATK 60 / DEF 0; `on_attack` เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +25 จนจบเทิร์น (1 ครั้ง/เทิร์น)<br>`on_destroyed` เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 20
- **Role:** Chip-damage / removal
- **Estimated power:** 1.35x (tier S) -> 1.22x (tier A); model parts: attack ATK+25 (cond) = +6.3 eff; 20 dmg = +48%
- **Issue:** ATK 60 is the highest Lv40; with +25 it reaches 85 and leaves 20 damage when destroyed.
- **Recommendation (PROPOSED / NOT APPROVED):** Attack bonus +25 -> +20 and death damage 20 -> 15. Resulting data: HP 153 / ATK 60 / DEF 0; `on_attack` เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)<br>`on_destroyed` เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 15
- **Reason:** Strongest Lv40; trim the effects only.
- **Risk:** Drops from S to A (about 1.22x).
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Note:** Reached only through Evolution (cannot be in the main deck).

### BAM-015 — Swordswoman

- **Type/Level/Class/Element:** character / 15 / Swordswoman / fire
- **Current:** HP 95 / ATK 25 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 1.17x (tier A) -> 1.17x (tier A); model parts: attack ATK+10 = +5.0 eff
- **Issue:** Estimated power is 1.17x the Lv average (tier A); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** 1GOKU-015, BAMMIE-015, BOBO-015, DNMAN-015, LINLADA-015, MELON-015, MIKI-015, NORMAN-015, PKXCY-015, THAI26-015

### BAMMIE-015 — Swordswoman

- **Type/Level/Class/Element:** character / 15 / Swordswoman / water
- **Current:** HP 95 / ATK 25 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 1.17x (tier A) -> 1.17x (tier A); model parts: attack ATK+10 = +5.0 eff
- **Issue:** Estimated power is 1.17x the Lv average (tier A); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** 1GOKU-015, BAM-015, BOBO-015, DNMAN-015, LINLADA-015, MELON-015, MIKI-015, NORMAN-015, PKXCY-015, THAI26-015

### BOBO-015 — Swordsman

- **Type/Level/Class/Element:** character / 15 / Swordsman / water
- **Current:** HP 80 / ATK 30 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 1.15x (tier A) -> 1.15x (tier A); model parts: attack ATK+10 = +5.0 eff
- **Issue:** Estimated power is 1.15x the Lv average (tier A); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** 1GOKU-015, BAM-015, BAMMIE-015, DNMAN-015, LINLADA-015, MELON-015, MIKI-015, NORMAN-015, PKXCY-015, THAI26-015

### CHAEM-015 — Merchant

- **Type/Level/Class/Element:** character / 15 / Merchant / neutral
- **Current:** HP 85 / ATK 24 / DEF 0; `on_summon` เมื่อถูกเรียก จั่วการ์ด 1 ใบ
- **Role:** Card-advantage engine
- **Estimated power:** 1.01x (tier B) -> 1.01x (tier B); model parts: draw 1 = +20%
- **Issue:** Estimated power is 1.01x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** FOLLOW-YOU-015, MON-015, PK-015

### CUTIE-015 — Mage

- **Type/Level/Class/Element:** character / 15 / Mage / nature
- **Current:** HP 90 / ATK 35 / DEF 0; `on_summon` เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10
- **Role:** Chip-damage / removal
- **Estimated power:** 1.40x (tier S) -> 1.35x (tier S); model parts: 10 dmg = +8%
- **Issue:** ATK 35 / HP 90 plus a free 10 damage on summon.
- **Recommendation (PROPOSED / NOT APPROVED):** Summon damage 10 -> 5. Resulting data: HP 90 / ATK 35 / DEF 0; `on_summon` เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 5
- **Reason:** Same reason as PIKACHU-015; keeps the 3 chip-damage Mages consistent.
- **Risk:** Remains S-tier because of stats.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** PIKACHU-015, ZEESKY-015

### DNMAN-015 — Crusader

- **Type/Level/Class/Element:** character / 15 / Crusader / lightning
- **Current:** HP 80 / ATK 40 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Frontline attacker
- **Estimated power:** 1.48x (tier S) -> 1.40x (tier S); model parts: attack ATK+10 = +5.0 eff
- **Issue:** ATK 40 plus a +10 attack bonus = 50 ATK at Lv15; far above the Lv15 average incoming ATK.
- **Recommendation (PROPOSED / NOT APPROVED):** Attack bonus +10 -> +5. Resulting data: HP 80 / ATK 40 / DEF 0; `on_attack` เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** The stat line is locked, so the effect is the only lever.
- **Risk:** Still S-tier. Do not combine with SPL-004 stacking without the cap proposal (ENGINE-PROP-02).
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** 1GOKU-015, BAM-015, BAMMIE-015, BOBO-015, LINLADA-015, MELON-015, MIKI-015, NORMAN-015, PKXCY-015, THAI26-015

### FOLLOW-YOU-015 — Demon Summoner

- **Type/Level/Class/Element:** character / 15 / Demon Summoner / dark
- **Current:** HP 90 / ATK 20 / DEF 0; `on_summon` เมื่อถูกเรียก จั่วการ์ด 1 ใบ
- **Role:** Card-advantage engine
- **Estimated power:** 0.89x (tier C) -> 0.95x (tier B); model parts: draw 1 = +20%
- **Issue:** Draw 1 on summon like MON/PK/CHAEM but ATK 20 / HP 90.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 2. Resulting data: HP 90 / ATK 20 / DEF 2; `on_summon` เมื่อถูกเรียก จั่วการ์ด 1 ใบ
- **Reason:** Lowest-stats of the four draw-on-summon cards.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** CHAEM-015, MON-015, PK-015

### FOLLOW-YOU-040 — Master Summoner

- **Type/Level/Class/Element:** character / 40 / Master Summoner / dark
- **Current:** HP 150 / ATK 50 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)<br>`combo` พลังแฝง: เมื่อใช้ร่วมกับการ์ดที่มี Combo ใบอื่น ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Frontline attacker
- **Estimated power:** 0.74x (tier D) -> 0.81x (tier C); model parts: attack ATK+10 = +5.0 eff
- **Issue:** Weakest Lv40 (ATK 50 / HP 150). Its second ability is a "combo" row that the engine cannot run (not active).
- **Recommendation (PROPOSED / NOT APPROVED):** Attack bonus +10 -> +20 (the value the other Lv40 attackers use). The combo row is NOT touched: decision pending (see CLAUDE_IMPLEMENTATION_HANDOFF Open Decisions). Resulting data: HP 150 / ATK 50 / DEF 0; `on_attack` เมื่อโจมตี ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)<br>`combo` พลังแฝง: เมื่อใช้ร่วมกับการ์ดที่มี Combo ใบอื่น ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** Compensates for the dead second ability with a supported number.
- **Risk:** If Toon later activates combo (new engine work), the +20 may overshoot.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Note:** Ability rows not executed by the engine today: combo.
- **Note:** Reached only through Evolution (cannot be in the main deck).

### FOLLOW-YOU-070 — Grand Summoner

- **Type/Level/Class/Element:** character / 70 / Grand Summoner / dark
- **Current:** HP 300 / ATK 100 / DEF 0; `on_evolve` เมื่อวิวัฒนาการเป็นร่างนี้ ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 30<br>`passive` ต่อเนื่อง: ตัวละครฝ่ายเราทุกใบ ATK +5
- **Role:** Chip-damage / removal
- **Estimated power:** 1.01x (tier B) -> 1.01x (tier B); model parts: 30 dmg = +72%; passive ATK+5
- **Issue:** ATK 100 / HP 300, +5 ATK aura for all allies and 30 damage when it evolves in. B tier.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the Lv70 band; only 2 Lv70 cards exist, so there is nothing to balance against.
- **Risk:** Aura ATK stacks with attack buffs; see exploit tests.
- **Compatibility:** no change needed
- **Note:** Reached only through Evolution (cannot be in the main deck).

### GOD-WA-015 — Thief

- **Type/Level/Class/Element:** character / 15 / Thief / poison
- **Current:** HP 90 / ATK 30 / DEF 0; `on_attack` เมื่อโจมตีและทำให้เป้าหมายถูกทำลาย จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น)
- **Role:** Thief (draw on kill)
- **Estimated power:** 1.20x (tier A) -> 1.20x (tier A); model parts: draw 1 on kill = +8%
- **Issue:** Estimated power is 1.20x the Lv average (tier A); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** JAOJAY-015, NONG-TAENGMO-015, WENDYWENDIE-015

### I-M-GRAPE-015 — Druid

- **Type/Level/Class/Element:** character / 15 / Druid / fire
- **Current:** HP 80 / ATK 21 / DEF 0; `turn_start` เริ่มเทิร์น ATK +5 ถาวร (สูงสุด +15)
- **Role:** Buffer / ramp
- **Estimated power:** 0.94x (tier B) -> 0.94x (tier B); model parts: ramp ATK +5/turn up to 15 = +7.5 eff
- **Issue:** Estimated power is 0.94x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed

### JAOJAY-015 — Thief

- **Type/Level/Class/Element:** character / 15 / Thief / water
- **Current:** HP 60 / ATK 40 / DEF 0; `on_attack` เมื่อโจมตีและทำให้เป้าหมายถูกทำลาย จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น)
- **Role:** Thief (draw on kill)
- **Estimated power:** 1.07x (tier B) -> 1.07x (tier B); model parts: draw 1 on kill = +8%
- **Issue:** Estimated power is 1.07x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** GOD-WA-015, NONG-TAENGMO-015, WENDYWENDIE-015

### LALAPING-015 — Priest

- **Type/Level/Class/Element:** character / 15 / Priest / holy
- **Current:** HP 80 / ATK 20 / DEF 0; `turn_end` จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)
- **Role:** Healer / support
- **Estimated power:** 0.75x (tier D) -> 0.85x (tier C); model parts: heal 10/turn = +13%
- **Issue:** Heal 10 per turn with ATK 20 / HP 80; below average.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 4. Resulting data: HP 80 / ATK 20 / DEF 4; `turn_end` จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)
- **Reason:** Small survivability for a defensive card; effect stays the same as the other healers.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** SATOSHI-015, SMILE-015

### LALAPING-040 — Bishop

- **Type/Level/Class/Element:** character / 40 / Bishop / holy
- **Current:** HP 160 / ATK 40 / DEF 0; `turn_end` จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเราทุกใบ
- **Role:** Hybrid attacker/healer
- **Estimated power:** 0.73x (tier D) -> 0.82x (tier C); model parts: heal 10/turn all = +26%
- **Issue:** Heals every ally by 10 each turn (strong) but ATK 40 / HP 160.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 6. Resulting data: HP 160 / ATK 40 / DEF 6; `turn_end` จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเราทุกใบ
- **Reason:** Support unit that has to survive to heal; effect already powerful.
- **Risk:** Stacks with LALAPING-070 aura HP +10 and healing loops: see exploit tests.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Note:** Reached only through Evolution (cannot be in the main deck).

### LALAPING-070 — Saint Bishop

- **Type/Level/Class/Element:** character / 70 / Saint Bishop / holy
- **Current:** HP 310 / ATK 80 / DEF 0; `on_evolve` เมื่อวิวัฒนาการเป็นร่างนี้ ฟื้น HP เต็มให้ตัวละครฝ่ายเรา 1 ใบ<br>`passive` ต่อเนื่อง: ตัวละครฝ่ายเราทุกใบ HP +10
- **Role:** Hybrid attacker/healer
- **Estimated power:** 0.99x (tier B) -> 0.99x (tier B); model parts: heal full = +109%; passive HP+10
- **Issue:** ATK 80 / HP 310, aura +10 HP to all allies and a full heal on evolution. B tier.
- **Recommendation (PROPOSED / NOT APPROVED):** No change (engine note: the full heal also undoes the "keeps damage taken" evolution rule: 320/320 in the probe).
- **Reason:** The full heal is part of the effect text; changing it is a design decision for Toon.
- **Risk:** Evolution of a damaged unit becomes a full heal; keep in the exploit tests.
- **Compatibility:** no change needed
- **Note:** Reached only through Evolution (cannot be in the main deck).

### LEON-S-KENNEDY-015 — Necromancer

- **Type/Level/Class/Element:** character / 15 / Necromancer / dark
- **Current:** HP 85 / ATK 25 / DEF 0; `to_graveyard` เมื่อตัวละครฝ่ายเราลงสุสาน ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Buffer / ramp
- **Estimated power:** 0.88x (tier C) -> 0.97x (tier B); model parts: graveyard ATK+5 = +1%
- **Issue:** Same effect as OUFILLING-015; HP 85 / ATK 25 is a little stronger.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 3. Resulting data: HP 85 / ATK 25 / DEF 3; `to_graveyard` เมื่อตัวละครฝ่ายเราลงสุสาน ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** Keeps LEON slightly above OUFILLING while both rise from C.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** OUFILLING-015

### LINLADA-015 — Spearwoman

- **Type/Level/Class/Element:** character / 15 / Spearwoman / fire
- **Current:** HP 90 / ATK 35 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Frontline attacker
- **Estimated power:** 1.48x (tier S) -> 1.39x (tier S); model parts: attack ATK+10 = +5.0 eff
- **Issue:** ATK 35 / HP 90 plus +10 on attack: second-best attacker body.
- **Recommendation (PROPOSED / NOT APPROVED):** Attack bonus +10 -> +5. Resulting data: HP 90 / ATK 35 / DEF 0; `on_attack` เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** Same lever as DNMAN-015.
- **Risk:** Still S-tier.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** 1GOKU-015, BAM-015, BAMMIE-015, BOBO-015, DNMAN-015, MELON-015, MIKI-015, NORMAN-015, PKXCY-015, THAI26-015

### LORDNAM-015 — Ninja

- **Type/Level/Class/Element:** character / 15 / Ninja / dark
- **Current:** HP 85 / ATK 25 / DEF 0; `on_summon` ในเทิร์นที่ถูกเรียก จะไม่ถูกเลือกเป็นเป้าหมายของเอฟเฟกต์ฝ่ายตรงข้าม
- **Role:** Evasive ninja
- **Estimated power:** 0.89x (tier C) -> 0.95x (tier B); model parts: untargetable on summon = +2%
- **Issue:** Untargetable on the turn it is summoned (a tiny effect). Mid/low C tier.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 2. Resulting data: HP 85 / ATK 25 / DEF 2; `on_summon` ในเทิร์นที่ถูกเรียก จะไม่ถูกเลือกเป็นเป้าหมายของเอฟเฟกต์ฝ่ายตรงข้าม
- **Reason:** Minimal buff to stay ahead of LUCKY-015.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** LUCKY-015

### LUCKY-015 — Ninja

- **Type/Level/Class/Element:** character / 15 / Ninja / water
- **Current:** HP 76 / ATK 24 / DEF 0; `on_summon` ในเทิร์นที่ถูกเรียก จะไม่ถูกเลือกเป็นเป้าหมายของเอฟเฟกต์ฝ่ายตรงข้าม
- **Role:** Evasive ninja
- **Estimated power:** 0.77x (tier C) -> 0.87x (tier C); model parts: untargetable on summon = +2%
- **Issue:** Same untargetable-on-summon effect as LORDNAM-015 with weaker stats (HP 76 / ATK 24).
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 4. Resulting data: HP 76 / ATK 24 / DEF 4; `on_summon` ในเทิร์นที่ถูกเรียก จะไม่ถูกเลือกเป็นเป้าหมายของเอฟเฟกต์ฝ่ายตรงข้าม
- **Reason:** Closes the gap with LORDNAM-015, which has the same effect.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** LORDNAM-015

### MELON-015 — Warrior

- **Type/Level/Class/Element:** character / 15 / Warrior / earth
- **Current:** HP 90 / ATK 35 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Frontline attacker
- **Estimated power:** 1.48x (tier S) -> 1.39x (tier S); model parts: attack ATK+10 = +5.0 eff
- **Issue:** ATK 35 / HP 90 plus +10 on attack, identical to LINLADA-015 except element.
- **Recommendation (PROPOSED / NOT APPROVED):** Attack bonus +10 -> +5. Resulting data: HP 90 / ATK 35 / DEF 0; `on_attack` เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** Same lever as DNMAN-015.
- **Risk:** Still S-tier.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** 1GOKU-015, BAM-015, BAMMIE-015, BOBO-015, DNMAN-015, LINLADA-015, MIKI-015, NORMAN-015, PKXCY-015, THAI26-015

### MIKI-015 — Fighter

- **Type/Level/Class/Element:** character / 15 / Fighter / physical
- **Current:** HP 85 / ATK 24 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 1.01x (tier B) -> 1.01x (tier B); model parts: attack ATK+10 = +5.0 eff
- **Issue:** Estimated power is 1.01x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** 1GOKU-015, BAM-015, BAMMIE-015, BOBO-015, DNMAN-015, LINLADA-015, MELON-015, NORMAN-015, PKXCY-015, THAI26-015

### MON-015 — Merchant

- **Type/Level/Class/Element:** character / 15 / Merchant / poison
- **Current:** HP 85 / ATK 40 / DEF 0; `on_summon` เมื่อถูกเรียก จั่วการ์ด 1 ใบ
- **Role:** Card-advantage engine
- **Estimated power:** 1.68x (tier S) -> 1.51x (tier S); model parts: draw 1 = +20%
- **Issue:** Highest estimated power of all Lv15 (ATK 40 at HP 85 plus a FREE card on summon). Same draw as PK/CHAEM/FOLLOW-YOU-015 but with +15 ATK.
- **Recommendation (PROPOSED / NOT APPROVED):** Make the draw a loot (discard 1 to draw 1), the wording THOMAS-015 already uses. Resulting data: HP 85 / ATK 40 / DEF 0; `on_summon` เมื่อถูกเรียก ทิ้งการ์ดจากมือ 1 ใบ เพื่อจั่วการ์ด 1 ใบ
- **Reason:** Removes the pure card-advantage part; the ATK 40 body stays. Uses the one cost the parser knows.
- **Risk:** Still S-tier after the change (stats are locked). Empty-hand summon: cost cannot be paid so no draw (engine behaviour to confirm in tests).
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** CHAEM-015, FOLLOW-YOU-015, PK-015

### NONG-TAENGMO-015 — Thief

- **Type/Level/Class/Element:** character / 15 / Thief / nature
- **Current:** HP 80 / ATK 30 / DEF 0; `on_attack` เมื่อโจมตีและทำให้เป้าหมายถูกทำลาย จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น)
- **Role:** Thief (draw on kill)
- **Estimated power:** 1.07x (tier B) -> 1.07x (tier B); model parts: draw 1 on kill = +8%
- **Issue:** Estimated power is 1.07x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** GOD-WA-015, JAOJAY-015, WENDYWENDIE-015

### NORMAN-015 — Bear Warrior

- **Type/Level/Class/Element:** character / 15 / Bear Warrior / physical
- **Current:** HP 94 / ATK 18 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 0.89x (tier C) -> 0.98x (tier B); model parts: attack ATK+10 = +5.0 eff
- **Issue:** ATK 18 / HP 94 with a +10 attack bonus; slightly below average.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 3. Resulting data: HP 94 / ATK 18 / DEF 3; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** Bear Warrior is a tank role.
- **Risk:** Evolves to NORMAN-040 (B tier), no change needed there.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** 1GOKU-015, BAM-015, BAMMIE-015, BOBO-015, DNMAN-015, LINLADA-015, MELON-015, MIKI-015, PKXCY-015, THAI26-015

### NORMAN-040 — Master Bear Warrior

- **Type/Level/Class/Element:** character / 40 / Master Bear Warrior / physical
- **Current:** HP 150 / ATK 50 / DEF 0; `on_attack` เมื่อโจมตี ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น)<br>`turn_start` เริ่มเทิร์น ฟื้น HP 10 ให้ตัวเอง
- **Role:** Hybrid attacker/healer
- **Estimated power:** 0.92x (tier B) -> 0.92x (tier B); model parts: attack ATK+20 = +10.0 eff; heal 10/turn = +13%
- **Issue:** ATK 50 / HP 150, +20 on attack and a self heal of 10 per turn; around the Lv40 average.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Balanced.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Note:** Reached only through Evolution (cannot be in the main deck).

### OUFILLING-015 — Necromancer

- **Type/Level/Class/Element:** character / 15 / Necromancer / dark
- **Current:** HP 90 / ATK 20 / DEF 0; `to_graveyard` เมื่อตัวละครฝ่ายเราลงสุสาน ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Buffer / ramp
- **Estimated power:** 0.75x (tier D) -> 0.85x (tier C); model parts: graveyard ATK+5 = +1%
- **Issue:** ATK +5 for one turn when an ally goes to the graveyard (rare, weak). Same effect as LEON-S-KENNEDY-015.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 4. Resulting data: HP 90 / ATK 20 / DEF 4; `to_graveyard` เมื่อตัวละครฝ่ายเราลงสุสาน ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Reason:** Weak effect; survivability is the only lever without changing the design.
- **Risk:** Low. The effect itself remains redundant with LEON (see redundancy list).
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** LEON-S-KENNEDY-015

### PIKACHU-015 — Mage

- **Type/Level/Class/Element:** character / 15 / Mage / lightning
- **Current:** HP 85 / ATK 40 / DEF 0; `on_summon` เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10
- **Role:** Chip-damage / removal
- **Estimated power:** 1.51x (tier S) -> 1.45x (tier S); model parts: 10 dmg = +8%
- **Issue:** ATK 40 plus a free 10 damage on summon; best body together with MON-015.
- **Recommendation (PROPOSED / NOT APPROVED):** Summon damage 10 -> 5. Resulting data: HP 85 / ATK 40 / DEF 0; `on_summon` เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 5
- **Reason:** Trims the free value; the strong body is untouched.
- **Risk:** Still S-tier. 5 damage no longer finishes 10-HP units alone (low impact).
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** CUTIE-015, ZEESKY-015

### PK-015 — Merchant

- **Type/Level/Class/Element:** character / 15 / Merchant / neutral
- **Current:** HP 85 / ATK 25 / DEF 0; `on_summon` เมื่อถูกเรียก จั่วการ์ด 1 ใบ
- **Role:** Card-advantage engine
- **Estimated power:** 1.05x (tier B) -> 1.05x (tier B); model parts: draw 1 = +20%
- **Issue:** Estimated power is 1.05x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** CHAEM-015, FOLLOW-YOU-015, MON-015

### PKXCY-015 — Fighter

- **Type/Level/Class/Element:** character / 15 / Fighter / physical
- **Current:** HP 85 / ATK 24 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 1.01x (tier B) -> 1.01x (tier B); model parts: attack ATK+10 = +5.0 eff
- **Issue:** Estimated power is 1.01x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** 1GOKU-015, BAM-015, BAMMIE-015, BOBO-015, DNMAN-015, LINLADA-015, MELON-015, MIKI-015, NORMAN-015, THAI26-015

### SATOSHI-015 — Healer

- **Type/Level/Class/Element:** character / 15 / Healer / holy
- **Current:** HP 60 / ATK 20 / DEF 0; `turn_end` จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)
- **Role:** Healer / support
- **Estimated power:** 0.56x (tier D) -> 0.70x (tier D); model parts: heal 10/turn = +13%
- **Issue:** HP 60 / ATK 20 is the thinnest body and the heal is only 10.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 5 and end-turn heal 10 -> 15. Resulting data: HP 60 / ATK 20 / DEF 5; `turn_end` จบเทิร์น ฟื้น HP 15 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)
- **Reason:** A pure healer should out-heal its siblings (LALAPING-015, SMILE-015 after nerf).
- **Risk:** Heal 15 per turn can offset 15 ATK per turn: re-test stall decks.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** LALAPING-015, SMILE-015

### SATOSHI-040 — Grand Healer

- **Type/Level/Class/Element:** character / 40 / Grand Healer / holy
- **Current:** HP 130 / ATK 70 / DEF 0; `turn_end` จบเทิร์น ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)<br>`on_destroyed` เมื่อถูกทำลาย ฟื้น HP 30 ให้ตัวละครฝ่ายเรา 1 ใบ
- **Role:** Hybrid attacker/healer
- **Estimated power:** 1.21x (tier A) -> 1.10x (tier B); model parts: heal 20/turn = +26%; heal 30 = +21%
- **Issue:** ATK 70 (highest healer) plus heal 20 per turn and heal 30 on death.
- **Recommendation (PROPOSED / NOT APPROVED):** End heal 20 -> 15 and death heal 30 -> 20. Resulting data: HP 130 / ATK 70 / DEF 0; `turn_end` จบเทิร์น ฟื้น HP 15 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)<br>`on_destroyed` เมื่อถูกทำลาย ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ
- **Reason:** A healer with the second-highest Lv40 ATK should not also out-heal.
- **Risk:** Drops from A to B (about 1.10x, borderline).
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Note:** Reached only through Evolution (cannot be in the main deck).

### SKYMOON-015 — Blacksmith

- **Type/Level/Class/Element:** character / 15 / Blacksmith / nature
- **Current:** HP 100 / ATK 18 / DEF 0; `on_summon` เมื่อถูกเรียก ATK +10 ถาวร ให้ตัวละครฝ่ายเรา 1 ใบ
- **Role:** Buffer / ramp
- **Estimated power:** 0.93x (tier B) -> 0.93x (tier B); model parts: ally ATK+10 perm = +25%
- **Issue:** Estimated power is 0.93x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed

### SMILE-015 — Cleric

- **Type/Level/Class/Element:** character / 15 / Cleric / water
- **Current:** HP 90 / ATK 35 / DEF 0; `turn_end` จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)
- **Role:** Hybrid attacker/healer
- **Estimated power:** 1.47x (tier S) -> 1.38x (tier S); model parts: heal 10/turn = +13%
- **Issue:** A healer with ATK 35 / HP 90 (the other Lv15 healers have ATK 20 or less).
- **Recommendation (PROPOSED / NOT APPROVED):** End-of-turn heal 10 -> 5. Resulting data: HP 90 / ATK 35 / DEF 0; `turn_end` จบเทิร์น ฟื้น HP 5 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น)
- **Reason:** Attacker body plus support heal is double-dipping; keep heal as the weaker half.
- **Risk:** Heal 5 is small; recheck it is still worth running vs LALAPING-015.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** LALAPING-015, SATOSHI-015

### SOMYES-015 — Archer

- **Type/Level/Class/Element:** character / 15 / Archer / lightning
- **Current:** HP 95 / ATK 25 / DEF 0; `on_summon` เมื่อถูกเรียก เลือกตัวละครฝ่ายตรงข้าม 1 ใบ ATK −10 จนจบเทิร์น
- **Role:** Buffer / ramp
- **Estimated power:** 1.02x (tier B) -> 1.02x (tier B); model parts: enemy ATK-10 = +4.0%
- **Issue:** Estimated power is 1.02x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed

### TAN-015 — Dev Sumoner

- **Type/Level/Class/Element:** character / 15 / Dev Sumoner / water
- **Current:** HP 90 / ATK 20 / DEF 0; `on_summon` เมื่อถูกเรียก ค้นการ์ด Evolution 1 ใบจาก Main Deck ขึ้นมือ
- **Role:** Evolution tutor
- **Estimated power:** 0.81x (tier C) -> 0.90x (tier C); model parts: search EVO = +10%
- **Issue:** Searches an Evolution card from the main deck on summon. Useful but ATK 20 / HP 90 is low.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 3. Resulting data: HP 90 / ATK 20 / DEF 3; `on_summon` เมื่อถูกเรียก ค้นการ์ด Evolution 1 ใบจาก Main Deck ขึ้นมือ
- **Reason:** Evolution search has real tempo value; the body is below average.
- **Risk:** EVO is in the main deck (confirmed), so the search never misses when one is left.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)

### TEE-015 — Alchemist

- **Type/Level/Class/Element:** character / 15 / Alchemist / poison
- **Current:** HP 80 / ATK 18 / DEF 0; `on_summon` เมื่อถูกเรียก ATK +10 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ
- **Role:** Buffer / ramp
- **Estimated power:** 0.61x (tier D) -> 0.70x (tier D); model parts: temp ally ATK+10 = +3.0%
- **Issue:** Weak: a one-turn ATK +10 on summon with ATK 18 / HP 80.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 4 and summon buff +10 -> +15 (still one turn). Resulting data: HP 80 / ATK 18 / DEF 4; `on_summon` เมื่อถูกเรียก ATK +15 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ
- **Reason:** Raises the temporary value without making it permanent.
- **Risk:** Alchemist chain TEE-040 is also weak; keep an eye on Lv40 pairing.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)

### TEE-040 — Alchemist

- **Type/Level/Class/Element:** character / 40 / Alchemist / poison
- **Current:** HP 170 / ATK 40 / DEF 0; `on_evolve` เมื่อวิวัฒนาการเป็นร่างนี้ ATK +20 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ<br>`turn_end` จบเทิร์น ฟื้น HP 10 ให้ตัวเอง
- **Role:** Hybrid attacker/healer
- **Estimated power:** 0.73x (tier D) -> 0.82x (tier C); model parts: temp ally ATK+20 = +6.0%; heal 10/turn = +13%
- **Issue:** ATK 40 / HP 170 with a one-turn ally buff and a self heal of 10 per turn; low power.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 6. Resulting data: HP 170 / ATK 40 / DEF 6; `on_evolve` เมื่อวิวัฒนาการเป็นร่างนี้ ATK +20 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ<br>`turn_end` จบเทิร์น ฟื้น HP 10 ให้ตัวเอง
- **Reason:** Tank-leaning Lv40.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Note:** Reached only through Evolution (cannot be in the main deck).

### THAI26-015 — Fighter

- **Type/Level/Class/Element:** character / 15 / Fighter / physical
- **Current:** HP 85 / ATK 24 / DEF 0; `on_attack` เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น)
- **Role:** Attacker
- **Estimated power:** 1.01x (tier B) -> 1.01x (tier B); model parts: attack ATK+10 = +5.0 eff
- **Issue:** Estimated power is 1.01x the Lv average (tier B); no redundancy or exploit concern beyond those listed in the review.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within the target band.
- **Risk:** None identified.
- **Compatibility:** no change needed
- **Same effect wording as:** 1GOKU-015, BAM-015, BAMMIE-015, BOBO-015, DNMAN-015, LINLADA-015, MELON-015, MIKI-015, NORMAN-015, PKXCY-015

### THAI32-015 — Paladin

- **Type/Level/Class/Element:** character / 15 / Paladin / holy
- **Current:** HP 100 / ATK 18 / DEF 0; `on_destroyed` เมื่อถูกทำลาย ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ
- **Role:** Healer / support
- **Estimated power:** 0.84x (tier C) -> 0.93x (tier B); model parts: heal 20 = +14%
- **Issue:** Heal 20 when destroyed (a deterrent), ATK 18 / HP 100.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 3. Resulting data: HP 100 / ATK 18 / DEF 3; `on_destroyed` เมื่อถูกทำลาย ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ
- **Reason:** Defensive card with the lowest ATK; small DEF suits its role.
- **Risk:** Low.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)

### THOMAS-015 — Rogue

- **Type/Level/Class/Element:** character / 15 / Rogue / fire
- **Current:** HP 95 / ATK 25 / DEF 0; `on_summon` เมื่อถูกเรียก ทิ้งการ์ดจากมือ 1 ใบ เพื่อจั่วการ์ด 1 ใบ
- **Role:** Card-advantage engine
- **Estimated power:** 1.06x (tier B) -> 1.06x (tier B); model parts: loot 1 = +8%
- **Issue:** Loot (discard 1 draw 1, once per game). Within the average band.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Balanced; also the wording reference for MON-015.
- **Risk:** None identified.
- **Compatibility:** no change needed

### WENDYWENDIE-015 — Thief

- **Type/Level/Class/Element:** character / 15 / Thief / poison
- **Current:** HP 95 / ATK 10 / DEF 0; `on_attack` เมื่อโจมตีและทำให้เป้าหมายถูกทำลาย จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น)
- **Role:** Thief (draw on kill)
- **Estimated power:** 0.42x (tier D) -> 0.55x (tier D); model parts: draw 1 on kill = +8%
- **Issue:** ATK 10 cannot realistically destroy a target, so "draw on destroy" almost never fires.
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 5 and draw on attack (no kill condition), once per turn. Resulting data: HP 95 / ATK 10 / DEF 5; `on_attack` เมื่อโจมตี จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น)
- **Reason:** Makes the thief archetype usable with a 10-ATK body.
- **Risk:** EXPLOIT WATCH: a draw every turn if it attacks; confirm with the deck-out and loop tests in TEST_PLAN. Still A-tier at most.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** GOD-WA-015, JAOJAY-015, NONG-TAENGMO-015

### ZEESKY-015 — Storm Priest

- **Type/Level/Class/Element:** character / 15 / Storm Priest / lightning
- **Current:** HP 78 / ATK 23 / DEF 0; `on_summon` เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10
- **Role:** Chip-damage / removal
- **Estimated power:** 0.80x (tier C) -> 0.88x (tier C); model parts: 10 dmg = +8%
- **Issue:** Same summon chip damage as PIKACHU/CUTIE with a weaker body (HP 78 / ATK 23).
- **Recommendation (PROPOSED / NOT APPROVED):** DEF 0 -> 3 (effect unchanged: it becomes the reference for the 10-damage Mage). Resulting data: HP 78 / ATK 23 / DEF 3; `on_summon` เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10
- **Reason:** Lowest-power chip-damage Mage; small DEF raises survivability only.
- **Risk:** DEF 3 trims attacks of ATK 18-24 by 3 (a 12-17 % cut): re-test low-ATK matchups.
- **Compatibility:** every changed effect row parses with parseEffect; DEF is read by the engine (effDef = def + bonusDef)
- **Same effect wording as:** CUTIE-015, PIKACHU-015

### EVO-001 — การ์ดวิวัฒนาการ

- **Type/Level/Class/Element:** evolution / n/a / - / -
- **Current:** ใช้วิวัฒนาการตัวละครได้ทุกใบ: ทิ้งการ์ดนี้จากมือ 1 ใบต่อ 1 ขั้น พร้อมสังเวยตัวละครหน้าเปิด 1/2/3 ใบ (Lv.15→40→70→99)
- **Role:** Evolution enabler
- **Issue:** Issue #2 says Evolution needs 1/2/3 Evolution cards. The ENGINE consumes exactly 1 Evolution card per step and requires 1/2/3 face-up characters to sacrifice (Lv40 / Lv70 / Lv99). The card text already says this correctly.
- **Recommendation (PROPOSED / NOT APPROVED):** No data change. Correct the Issue text, not the card.
- **Reason:** Source of truth is src/engine/game.ts (evolution probe: evoCardsConsumed = 1, zero sacrifice rejected).
- **Risk:** The DB rule game_rules.evolution_sacrifice {15:1,40:2,70:3} is keyed by SOURCE level while the engine keys by TARGET level (40:1,70:2,99:3): same numbers, different keys. Not read by the engine.
- **Compatibility:** Supported (hard-coded in the engine).

### FUS-001 — ฟิวชั่น

- **Type/Level/Class/Element:** fusion / n/a / - / -
- **Current:** ใช้กับตัวละคร 2 ใบบนมือที่ติ๊กเป็นคู่ Fusion กัน: วางซ้อนกันในช่องเดียว (ใบบน 100% ใบล่าง 50% + โบนัสคู่)
- **Role:** Fusion enabler
- **Issue:** Fusion needs partner pairs that exist only in production data (7 pairs, not in the repo seed). The engine takes them from the rooms layer (createGame fusionPairs). Fused unit: top card 100 % and bottom card 50 % stats (probe: BACKJI-015 + NONG-TAENGMO-015 = 136 HP / 49 ATK / DEF 0); counts as the one Lv15 summon of the turn; only the top card effects run.
- **Recommendation (PROPOSED / NOT APPROVED):** No data change.
- **Reason:** Verified from source and probe. DB bonus values {20,10,0} and gender +5 ATK in game_rules are NOT used by the engine.
- **Risk:** Partner data cannot be audited from the repo; production snapshot is in card-data-export/production-snapshot/.
- **Compatibility:** Supported; pair data is runtime-only.

### SPL-001 — ลูกไฟเริ่มต้น

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / เลือกตัวละครของศัตรู 1 ตัว: ได้รับความเสียหาย 20
- **Role:** Removal (damage 20)
- **Issue:** Direct 20 damage to one enemy unit, element multiplier applies, respects untargetable. Fair.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Within range of Lv15 HP 60-100.
- **Risk:** Repeatable: no per-turn spell cap exists (see ENGINE-PROP-03).
- **Compatibility:** Supported.

### SPL-002 — น้ำบำบัด

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / เลือกตัวละครของคุณ 1 ตัว: ฟื้น HP 30 (ไม่เกิน HP สูงสุด)
- **Role:** Healing (30)
- **Issue:** Heal 30 (capped by max HP) on one own unit.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Balanced.
- **Risk:** Combined with SMILE/SATOSHI heals in stall decks.
- **Compatibility:** Supported.

### SPL-003 — โล่มนตร์

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / เลือกตัวละครของคุณ 1 ตัว: DEF +15 อยู่จนกว่าตัวนั้นจะออกจากสนาม
- **Role:** Defense buff
- **Issue:** Probe: three casts on one unit gave DEF +45 (no cap). Also the effect row says "until end of turn" while rules_text and the engine make it last until the unit leaves the field.
- **Recommendation (PROPOSED / NOT APPROVED):** Data: align the effect description with rules_text (decision which is canonical is Toon's). Engine: ENGINE-PROP-02 cap stacking.
- **Reason:** DEF 45 makes a unit take 1 damage from almost everything (damage floor is 1).
- **Risk:** Unbreakable wall combined with LALAPING heals.
- **Compatibility:** Supported today; the cap is NEW ENGINE WORK.
- **Note:** Linked engine proposals: ENGINE-PROP-02

### SPL-004 — พลังผนึก

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / เลือกตัวละครของคุณ 1 ตัว: ATK +15 อยู่จนกว่าตัวนั้นจะออกจากสนาม
- **Role:** Attack buff
- **Issue:** Probe: three casts on one unit gave ATK +45 (total 75 from a 30-ATK unit). Same text/engine mismatch as SPL-003.
- **Recommendation (PROPOSED / NOT APPROVED):** Same as SPL-003.
- **Reason:** Uncapped permanent ATK.
- **Risk:** One-turn kill setups with the attack bonus effects.
- **Compatibility:** Supported today; cap is NEW ENGINE WORK.
- **Note:** Linked engine proposals: ENGINE-PROP-02

### SPL-005 — จั่วปริศนา

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / คุณจั่วการ์ด 2 ใบ
- **Role:** Card draw (2)
- **Issue:** Draw 2 with no cost and no per-turn limit; limited only by hand size 5 and the spells in hand.
- **Recommendation (PROPOSED / NOT APPROVED):** No data change; ENGINE-PROP-03 (spell cap per turn) pending decision.
- **Reason:** Probe: 3 spells cast in one turn.
- **Risk:** Draw loops with SPL-006 recursion; deck-out risk for the player that draws.
- **Compatibility:** Supported.
- **Note:** Linked engine proposals: ENGINE-PROP-03

### SPL-006 — เรียกคืนจากสุสาน

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / เลือกตัวละคร Lv.15 ในสุสานของคุณ 1 ใบ: นำกลับขึ้นมือ (มือต้องไม่เต็ม)
- **Role:** Recursion (Lv15 from graveyard)
- **Issue:** Returns a Lv15 character to hand; re-summon re-triggers on_summon (probe: CHAEM-015 draw fired again).
- **Recommendation (PROPOSED / NOT APPROVED):** No data change.
- **Reason:** Requires a free hand slot; Lv15 only.
- **Risk:** Loop: revive -> summon -> draw. Needs the once-per-game limit to be per unit instance, which resets on re-summon.
- **Compatibility:** Supported.

### SPL-007 — ลมพัดสลับ

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / เลือกตัวละครของคุณ 1 ตัว และตัวละครของศัตรู 1 ตัว: สลับที่กัน (ตัวของคุณไปอยู่ฝั่งศัตรู ตัวของศัตรูมาอยู่ฝั่งคุณ)
- **Role:** Steal / swap
- **Issue:** Probe: the swapped-in enemy unit can attack in the same turn (summonedTurn is not reset). A Lv70 can be traded for a Lv15 and attack at once.
- **Recommendation (PROPOSED / NOT APPROVED):** ENGINE-PROP-01: the stolen unit counts as summoned this turn (cannot attack).
- **Reason:** Matches the existing rule that a freshly arrived unit cannot attack.
- **Risk:** Without the fix this is the strongest card in the game; with the fix it is still a strong swap.
- **Compatibility:** Supported today; fix is NEW ENGINE WORK.
- **Note:** Linked engine proposals: ENGINE-PROP-01

### SPL-008 — พายุหยุดนิ่ง

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / ศัตรูโจมตีไม่ได้ในเทิร์นถัดไปของศัตรู
- **Role:** Control (no attack)
- **Issue:** Probe: blocks all enemy attacks for exactly the next enemy turn only (noAttackUntil = turn + 2). Fair. Does not stop direct damage from effects.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Single turn, no stacking beyond one turn.
- **Risk:** Two copies in a row could block two consecutive enemy turns only if cast on separate turns.
- **Compatibility:** Supported.

### SPL-009 — พิษร้ายค่อยๆกัด

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / เลือกตัวละครของศัตรู 1 ตัว: ติดพิษ ได้รับความเสียหาย 5 ต่อเทิร์นของศัตรู เป็นเวลา 3 เทิร์น
- **Role:** Damage over time (5 x 3)
- **Issue:** 5 damage per enemy turn for 3 turns = 15 total, easy to avoid with SPL-002.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Low impact.
- **Risk:** Poison resets to 3 turns when recast, not stacking.
- **Compatibility:** Supported.

### SPL-010 — ปัดป้องมนตร์

- **Type/Level/Class/Element:** spell / n/a / - / -
- **Current:** ใช้ในเฟสหลัก / เลือกกับดักที่คว่ำอยู่ของศัตรู 1 ใบ: ทำลายแล้วลงสุสาน
- **Role:** Trap removal
- **Issue:** Destroys one set enemy trap. Needed as counterplay to the 10 traps.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Fair counterplay.
- **Risk:** None identified.
- **Compatibility:** Supported.

### TRP-001 — หลุมพราง

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: ศัตรูประกาศโจมตี / ผล: ยกเลิกการโจมตีนั้น (ไม่มีความเสียหายเกิดขึ้น) / ใช้ได้ครั้งเดียวแล้วลงสุสาน ตั้งแล้วใช้ได้ตั้งแต่เทิร์นถัดไป
- **Role:** Negate attack
- **Issue:** Cancels one attack. Set trap becomes active from the next turn. Strong, hard counterplay except SPL-010.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** One use, then graveyard.
- **Risk:** Combined with SPL-008 can stall two turns.
- **Compatibility:** Supported.

### TRP-002 — กระจกสะท้อน

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: ศัตรูประกาศโจมตี / ผล: การโจมตียังเกิดขึ้น แต่ตัวที่โจมตี (ฝั่งศัตรู) ได้รับความเสียหายสะท้อนเท่ากับครึ่งหนึ่งของความเสียหายที่มันทำ (ปัดลง) / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Reflect (half damage)
- **Issue:** The attack still happens; the attacker takes half of its damage (floor).
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Fair.
- **Risk:** Low.
- **Compatibility:** Supported.

### TRP-003 — ประตูลับหลังบ้าน

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: ศัตรูโจมตี LP ของคุณโดยตรง / ผล: ความเสียหายต่อ LP ของคุณเหลือครึ่งหนึ่ง (ปัดลง) / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Direct-attack halving
- **Issue:** Halves direct LP damage. With LP 100 in the engine this matters more than the DB value 8000 implies.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Fair.
- **Risk:** LP mismatch (engine 100 vs DB 8000) must be settled by Toon before any LP balance work.
- **Compatibility:** Supported.

### TRP-004 — โซ่พันธนาการ

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: ศัตรูเรียกหรือฟิวชั่นตัวละครลงสนาม / ผล: ตัวละครตัวนั้นของศัตรูถูกห้ามโจมตีในเทิร์นถัดไปของศัตรู / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Summon lock
- **Issue:** The summoned or fused unit cannot attack on the next enemy turn.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Fair.
- **Risk:** Low.
- **Compatibility:** Supported.

### TRP-005 — ขัดขวางการเติบโต

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: ศัตรูวิวัฒนาการ / ผล: ยกเลิกการวิวัฒนาการนั้น การ์ดวิวัฒนาการที่ศัตรูใช้ลงสุสาน ร่างใหม่กลับไปอยู่ที่เดิม และไม่ต้องสังเวย / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Evolution counter
- **Issue:** Cancels an evolution: the Evolution card goes to the graveyard, the unit stays, no sacrifice. Very punishing for the evolver.
- **Recommendation (PROPOSED / NOT APPROVED):** No change (design decision: card text is explicit).
- **Reason:** Counterplay to the strongest mechanic in the game.
- **Risk:** The evolving player loses a card and a turn of the once-per-turn evolution.
- **Compatibility:** Supported.

### TRP-006 — ระเบิดเวลา

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: จบเทิร์นของศัตรู / ผล: ตัวละครของศัตรูที่มี ATK สูงสุดได้รับความเสียหาย 15 / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Timed damage 15
- **Issue:** Probe: fires at the end of the ACTIVE player's turn and deals 15 to the unit with the highest ATK.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Fair.
- **Risk:** Can finish a unit weakened by chip effects.
- **Compatibility:** Supported.

### TRP-007 — ม่านหมอกพิษ

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: เริ่มเทิร์นของศัตรู / ผล: ตัวละครทุกตัวของศัตรูได้รับความเสียหาย 5 / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Area damage 5
- **Issue:** 5 damage to every enemy unit at the start of the enemy turn.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Low impact per unit.
- **Risk:** Multi-target damage: strong vs token-like boards, but 7 field slots only.
- **Compatibility:** Supported.

### TRP-008 — ปลุกผู้พิทักษ์

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: ตัวละครของคุณจะถูกทำลาย / ผล: ตัวนั้นไม่ถูกทำลาย เหลือ HP 1 / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Survive (HP 1)
- **Issue:** Prevents destruction, unit stays at HP 1.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Fair.
- **Risk:** The unit at 1 HP still attacks; combine with healers.
- **Compatibility:** Supported.

### TRP-009 — พัดกลับบ้าน

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: ศัตรูประกาศโจมตี / ผล: ยกเลิกการโจมตี และตัวที่โจมตี (ฝั่งศัตรู) กลับขึ้นมือของศัตรู (ถ้ามือเต็มลงสุสานแทน) / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Bounce attacker
- **Issue:** Cancels the attack and returns the attacker (and fused cards) to its owner's hand; graveyard if the hand is full.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Resets Lv40/70 evolution investment.
- **Risk:** An evolved unit returns as the evolved card: its cost is lost for the owner (design decision).
- **Compatibility:** Supported.

### TRP-010 — เสียงเพรียกจากสุสาน

- **Type/Level/Class/Element:** trap / n/a / - / -
- **Current:** ทำงานเมื่อ: ตัวละครของคุณลงสุสาน / ผล: คุณจั่วการ์ด 1 ใบ / ใช้ได้ครั้งเดียวแล้วลงสุสาน
- **Role:** Draw on death
- **Issue:** Draw 1 when an own character goes to the graveyard.
- **Recommendation (PROPOSED / NOT APPROVED):** No change.
- **Reason:** Fair.
- **Risk:** Chain with sacrifices for evolution can draw more than 1 per turn only if several units die (one trap fires per event).
- **Compatibility:** Supported.

