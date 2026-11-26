# Balance Audit — Story × Starter Collection (read-only)

วันที่ 2026-11-26 · ฐานโค้ด: `main` = 9b5adfd (verified `git ls-remote`; bot-ai 89b843f, audit 57e693b ยังอยู่) · **ไม่มีการแก้การ์ด/กฎ/engine/DB/API/production ใดๆ** (รายงานนี้เป็นไฟล์เดียวบน branch docs-only)

## 0. การแก้ไขข้อผิดพลาด (ต้องเปิดเผย)
1. รายงานซิมูเลชันก่อนหน้า (`BOT_AI_COMBO_SIMULATION_RESULTS_2026-11-26.md`) เขียนว่าใช้ Story 29 แถว แต่จริงใช้ **8 แถว (baseline)** และ Fusion **1 คู่** (ฐาน seed ของ repo) ส่วน production มี Story 29 แถว / Fusion 37 คู่ → **ข้อสรุป "Story ไม่ใช่ปัญหา" จากรายงานนั้นใช้ไม่ได้**
2. ระหว่าง Audit นี้ ผมเผลอรันชุดแรกบน checkout เก่า (f999d09: ไม่มี Bot AI รอบ 2 / `directCap`) — **ทิ้งผลชุดนั้นทั้งหมดแล้ว** และรันใหม่บน 9b5adfd (production ปัจจุบัน) ตัวเลขทุกตัวด้านล่างมาจากชุดหลังนี้
3. ข้อมูลที่ใช้: Story 29 แถว + Fusion 37 คู่ + stat 48 ตัวจาก production (อ่านอย่างเดียวผ่าน SELECT) · harness อยู่นอก repo (`/tmp/sim`) ใช้ engine จริง + Bot จริง

## 1. Technical Audit
**ลำดับคำนวณ** (`game.ts`): `refreshAuras` (Story + passive + Signature timed buff รวมใน aura map เดียว ทุก action) → effAtk/effDef → `hit = max(1, floor(max(1, effAtk−effDef) × elementMult))` → counter-attack → direct attack (เฉพาะสนามศัตรูว่าง) จำกัด `RULES.directCap` = 60

**Story**
- ไม่ stack ต่อสำเนา (คำนวณใหม่ทุก action) · โบนัสสูงสุดต่อยูนิต **+10 ATK / +5 DEF / +20 HP** → Story เดี่ยวๆ เล็ก ค่าเฉลี่ยบนกระดานสุ่ม ≈ 0
- **ปัญหาจริง 1 — Fusion × Story self-fire:** ยูนิต Fusion ถือ chain ของทั้งสองใบ → แถว Story ระหว่าง 2 ครึ่งของมันเอง ยิงใส่ตัวมันเอง (บางคู่ 2 ครั้ง) นี่คือสาเหตุที่ตรงกับฟีดแบ็ค "Thief + แอส 2 คู่ ≈ 55 ดาเมจ": **BACKJI + NONG-TAENGMO fusion = ATK 54–57, DEF 7, HP ≈137** (ทำซ้ำได้)
- **ปัญหาจริง 2 — กระดาน 7 ยูนิตจูนแล้ว** Story เพิ่มได้ถึง ≈ +40 ATK รวมทั้งกระดาน (ไม่ใช่ต่อใบ)
- **Quirk:** Story HP-aura ให้ +HP ทุกครั้งที่คู่เข้าสนาม (ออกแล้วเข้าใหม่ = ฮีลซ้ำ; ออกแล้ว clamp)
- "armor 11" **ทำซ้ำไม่ได้**: DEF สูงสุดของคู่ที่ตรวจ = 7 (BACKJI+NONG) / 10 (LEON+WENDYWENDIE) · ตีความ "แอส" = Assassin (สมมติฐาน) → ต้องการ hit_detail log หรือชื่อการ์ดที่แน่นอนเพื่อยืนยัน

**อะไรทำให้ดาเมจ >100** (ต่อยูนิต ไม่ใช่ direct; direct ถูก cap 60 แล้ว)
| ชุด | ATK สูงสุด (ไม่มีธาตุ) | ×1.5 ธาตุเปรียบ |
|---|---|---|
| Base only: FOLLOW-YOU Lv70 | 105 | – |
| + Story + SPL-004 (+15) | 120 | – |
| + Signature ATK spell/trap: 1GOKU Lv40 / FOLLOW-YOU Lv70 | 120 | **180** |
| TEE Lv40 | 100 | 150 |
| Lv15 (BOBO/DNMAN) + Signature+SPL-004 | 90 | 135 |
→ 3 การ์ด >100 ที่ยืนยันได้: **FOLLOW-YOU Lv70, 1GOKU Lv40 (+Signature), TEE Lv40 (+Signature)** ส่วนใหญ่มาจาก **Spell/Signature + ธาตุ ไม่ใช่ Story** (Story ≈ +5–10)

## 2. Card Balance Audit
- **Starter (Lv15 ฟรี, Spell/Trap, Evo, Fusion):** ATK Lv15 ประมาณ 30–45 (สูงสุด 45: DNMAN/BOBO), DEF ต่ำ → ตีกันเร็ว; Fusion (3 ใบ, นับเป็น summon เทิร์นนั้น) ให้ ATK ≈ top + 50% bottom + pairBonus
- **Advanced (Lv40/70/99 + Signature):** Lv40 = 60–75 base, Lv70 = 80–105 → ข้ามขั้น Lv15 ชัดเจน + Signature +15…+30 ATK ต่อใบ ผลซิมูเลชัน: เด็คสุ่มที่มี Evolution เพิ่มชนะจาก **58% → 87%** (Starter → Advanced) ⇒ สัญญาณ **Pay-to-Win ปานกลาง–สูง** แต่ ⚠ ผลกระทบปนเปื้อน: chain ของ Aggro/Control ไม่มีฟอร์ม Lv40+ ในพูลซิม (Aggro/Control/Combo extra = 0–1 ใบ) ต้องรันซ้ำแบบคุมตัวแปร (chain ที่มีฟอร์มครบ) ก่อนสรุปเชิงตัวเลข
- Spell/Trap: SPL-004 (+15 ATK) และ Signature ATK spells เป็นตัวเพิ่ม ATK หลัก · ยังไม่ได้ตรวจ spell/trap production กับ seed ครบ (เหลือ)

## 3. Archetype Matchup (Bot-vs-Bot, 5 เด็ค Starter-pool × 30 เกม/คู่ สลับผู้เล่นแรก, Story 29 แถว, LP100)
Win% ของ**แถว** vs **คอลัมน์** (Starter):
| | Aggro | Tank | Heal | Combo | Control | Random |
|---|---|---|---|---|---|---|
| Aggro | – | 100 | 96.7 | 78.3 | 95 | 83.3 |
| Tank | 0 | – | 6.7 | 10 | 30 | 8.3 |
| Heal | 3.3 | 93.3 | – | 25 | 76.7 | 35 |
| Combo | 21.7 | 90 | 75 | – | 70 | 51.7 |
| Control | 5 | 70 | 23.3 | 30 | – | 33.3 |
รวม: **Aggro 90.7% · Combo 61.7% · Random 57.7% · Heal 46.7% · Control 32.3% · Tank 11.0%** (เกม ≈ 19–28 เทิร์น)
- Story เปิด vs ปิด (Starter): Combo **50.3 → 61.7** (+11 pt, จาก Fusion self-fire) · Aggro 93.7→90.7 · Heal 52.3→46.7 · Tank/Control ≈ เท่าเดิม → **Story ส่งผลชัดเฉพาะ Combo/Fusion**
- Advanced (Story): Aggro 79 · Combo 43 · Heal 41 · Control 38 · Tank 11 · Random(มี Evolution ครบ) 87
- สรุป: **Aggro ครองเมตา, Tank แพ้เกือบทุกคู่ (DEF ต่ำ ไม่ทนดาเมจรวม), Heal ชนะ Tank/Control แต่แพ้ Aggro/Combo, Control ไม่มีกลไกหยุด Aggro** — ตรงกับฟีดแบ็คว่า "Heal รับ Combo ไม่ไหว" และ "Tank ลดดาเมจไม่ช่วย" ⚠ ข้อจำกัด: Bot ≠ มนุษย์ (Aggro เหมาะกับ Bot) ใช้เป็นสัญญาณทิศทาง ไม่ใช่ค่าสัมบูรณ์

## 4. Balance Proposal (ข้อเสนอเท่านั้น — ยังไม่ทำ)
**Story stacking fix (ความเสี่ยงต่ำ ผลต่อเด็คอื่นน้อย):**
- S1: Fusion unit ไม่ให้แถว Story ระหว่างสองครึ่งของตัวเองยิงใส่ตัวมันเอง (หรือยิงได้ครั้งเดียว) → ลด Combo ≈ −10 pt, Aggro/Tank/Heal/Control แทบไม่เปลี่ยน (ข้อมูลข้างบน)
- S2: เพดานรวม Story ต่อยูนิต (เช่น +15 ATK / +8 DEF) ป้องกันกระดานจูน +40
- S3: HP-aura ฮีลเฉพาะครั้งแรกต่อเทิร์น/ต่อยูนิต
**DEF/Effect:** เพิ่ม DEF ของ Tank/Heal chain เล็กน้อย **ผ่าน effect/Story/Spell ไม่แก้ base HP/ATK** (ข้อห้ามของ Toon) เช่น Spell ลดดาเมจ −X ต่อโจมตี, trap ป้องกัน; ปรับ Signature ATK +15…+30 บน Lv40 → ลดเพดาน 120/180 (ปรับ Signature หรือจำกัดธาตุ×Signature)
**LP & Direct Attack (ศึกษา ไม่แก้ production):**
| LP | Aggro% | เกมเฉลี่ย (เทิร์น) |
|---|---|---|
| 100 | 90 | 19.8 |
| 150 | 91 | 20.9 |
| 200 | 91 | 21.8 |
| 250 | 91 | 22.9 |
- **เพิ่ม LP ไม่แก้สมดุล** (ลำดับเด็คเหมือนเดิม) แค่ยืดเกม ≈ +1 เทิร์นต่อ +50 LP
- **ยกเลิก cap 60 (ATK 120 ตี 120):** ผลต่อ win% = 0 ในเด็ค Starter (ไม่มี direct >60) แต่ **เสี่ยงกับ Lv70/Signature** (direct 120–180 = จบ LP100 ใน 1 ครั้ง, หลายยูนิต direct รวมกันเสี่ยงจบเกมเทิร์น 2–3) → คง cap 60 ไว้; ถ้าจะปรับให้ขยับ cap ตาม LP (เช่น 60% ของ LP เริ่มต้น) ไม่ใช่ยกเลิก

## 5. Implementation Plan
| ลำดับ | งาน | ไฟล์ | ความเสี่ยง | Test |
|---|---|---|---|---|
| P1 | S1 Fusion self-Story | `src/engine/game.ts` (`refreshAuras`) | ต่ำ | fusion BACKJI+NONG ATK ลดลง; unit ปกติไม่เปลี่ยน |
| P2 | S2 cap Story ต่อยูนิต | `game.ts`, rules | ต่ำ | 7 ยูนิตจูนไม่เกิน +15 ATK |
| P3 | S3 HP-aura re-arrival | `game.ts` | ต่ำ | ออก-เข้าไม่ฮีลซ้ำ |
| P4 | ปรับ Signature ATK / element×Signature | `db/seed/signature-cards.json` + migration ใหม่ (≥ 030) | กลาง (กระทบ Advanced) | ไม่มีใบ >100 ที่ไม่มีธาตุ |
| P5 | ของป้องกันสำหรับ Tank/Heal (Spell/Trap/Effect ใหม่) | seed + effects | กลาง | รันตาราง archetype ซ้ำ ต้อง Aggro ≤ 70%, Tank ≥ 30% |
ขอบเขตที่ต้องรันซ้ำก่อนลงมือ: (a) การทดลองคุมตัวแปร Starter vs Advanced, (b) hit_detail log จากเกมจริงที่ได้ "armor 11", (c) ตรวจ spell/trap production vs seed, (d) ชุดสุ่มเด็คจริงของผู้เล่น
**หลักการ Pay for Progression, not Pay to Win:** Starter Aggro ชนะ 91% ได้เพราะ Bot/Spell ไม่ใช่ของเสียเงิน → เร่งแก้ Tank/Heal/Control ให้แข่งได้ก่อน ค่อย nerf เพดาน Advanced
