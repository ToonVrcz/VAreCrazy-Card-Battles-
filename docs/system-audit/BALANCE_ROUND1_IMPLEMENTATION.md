# Balance Round 1 — Implementation Report

> Branch `feature/balance-round1` (จาก `docs/phase2-balance-audit`). **ยังไม่ merge / deploy / apply migration / เขียน Production.** HP และ ATK ไม่ถูกแก้ (มีเทสล็อกเทียบกับ `5b85f89`).
> ตัวเลข tier ยังเป็นค่าประเมินจากโมเดล ไม่ใช่ win rate.

## รายการที่ทำตามที่อนุมัติ

| Decision | สิ่งที่แก้ | ไฟล์ |
|---|---|---|
| D-2 | SPL-007: หน่วยที่ถูกสลับข้ามฝั่งโจมตีไม่ได้ในเทิร์นนั้น (ตั้ง `summonedTurn` = เทิร์นปัจจุบัน) | `src/engine/game.ts` |
| D-3 | SPL-003/004: บัฟจนจบเทิร์น + ใช้ได้ 1 ครั้งต่อสเปลต่อหน่วยต่อเทิร์น (ไม่ซ้อน +45); บัฟไม่ติดไปกับร่างวิวัฒนาการ; ข้อความการ์ดตรงกับเอนจิน | `game.ts`, `db/seed/spell-cards.json` |
| D-4 | WENDYWENDIE-015: on_attack เป็น loot (ทิ้ง 1 จั่ว 1) 1 ครั้ง/เทิร์น (ใช้ cost ที่ parser รองรับ) | `toon-cards.json` |
| D-7 | FOLLOW-YOU-040: ถอดแถว `combo` ออก + `has_combo=false` (เอฟเฟกต์ ATK +20 คงไว้) | `toon-cards.json` |
| D-8 | ตารางธาตุ (ไม่เพิ่มตัวละคร): fire > nature, poison · nature > earth, water · poison > lightning · earth > lightning · (water>fire, lightning>water คงเดิม) | `db/seed/elements.json` |
| Card Effect Balance | DEF และค่าเอฟเฟกต์ 33 ใบตามข้อเสนอ V1 + V2 (DEF ไม่ลดตามสาย; MON-015 เป็น loot) | `toon-cards.json` |
| Evolution Review | ไม่เพิ่มสาย/Lv99 (ตามคำตัดสิน); แก้เฉพาะ DEF ไม่ลดตามสาย ผ่านเทส | — |
| ข้อมูลโปรดักชัน | migration `024_balance_round1` (+ down) แบบ guard ค่าเก่า → ไม่ทับค่าที่แก้ใน Admin | `db/migrations/` |
| Bundles | rebuild `public/engine.js` (admin-tools.js ไม่เปลี่ยน — ไม่มี diff); **edge bundle ต้อง build ใหม่ตอน deploy** | — |

### ตารางธาตุ: net ต่อธาตุ (นับ Lv15 ในพูล: ชนะ − แพ้)

| ธาตุ | ก่อน | หลัง |
|---|---|---|
| nature | −9 | +3 |
| fire | −4 | +1 |
| water | +1 | −2 |
| lightning | +6 | +1 |
| poison | +3 (ไม่มีตัวแพ้) | −1 (แพ้ fire) |
| earth | +1 | +1 |
| holy / dark | 0 / 0 | 0 / 0 |
| neutral / physical | 0 | 0 (ไม่มี matchup ตามเจตนา) |

ช่วงใหม่ −2..+3. เทสบังคับให้ทุกธาตุที่มีตัวละครมี matchup และ |net| ≤ 3. **เมทริกซ์นี้เป็นข้อเสนอรูปธรรมของผม (บอลอนุมัติทิศทาง ไม่ได้ระบุเส้น)** — ถ้าอยากเปลี่ยนเส้นไหน แก้ที่ `elements.json` ที่เดียว.

### ผลเทส
`npm test` เต็ม: **34 ไฟล์ / 492 เทสผ่าน (492/492)**. ระหว่างทางเทสจับ 2 จุดที่แก้แล้ว: บอทเลือกร่ายบัฟซ้ำ (แก้ `legalActions`), และสคริปต์ `down` ของ 024 ล้มบน DB ว่าง (แก้ให้ INSERT ... SELECT FROM cards).

### เทสใหม่/แก้
- `tests/gameplay-fixes.test.ts`: แทนเทส "บัฟถาวร" เดิม (ขัดกับ D-3) ด้วย 3 เทสบัฟจบเทิร์น/จำกัด 1 ครั้ง/ไม่ติดร่างใหม่ + เทส SPL-007 ตีไม่ได้ทันที
- `tests/balance-round1-migration.test.ts`: up/down, guard ไม่ทับค่าที่ Admin แก้, HP/ATK ไม่ขยับ
- `tests/balance-round1-data.test.ts`: HP/ATK = ก่อนรอบนี้, ทุก effect parse ได้, DEF ไม่ลดตามสาย, เมทริกซ์ธาตุ

## ยังไม่ทำ / บล็อกเกอร์ (ต้องการ Owner)

1. **D-9 (ใช้เฉพาะ Published) ยังไม่ใส่โค้ด.** ตรวจ Production (SELECT เท่านั้น): `published` 11, `draft` 58, `in_review` 1. ห้องเกมโหลดทุกสถานะที่ไม่ใช่ `archived` ถ้าบังคับ published ก่อนจะ publish การ์ดที่ใช้เล่น เกมจะเล่นไม่ได้. ต้อง publish การ์ดใน Admin ก่อน แล้วค่อยแก้ `rooms.ts` (2 ตำแหน่ง `status<>'archived'` → `='published'`).
2. **Migration 018–023 + 024 ยังไม่ apply**; 024 ไม่พึ่ง 019 (ไม่แตะคอลัมน์ `config`). ลำดับ deploy: apply 018→024 → build+deploy edge → merge → ตรวจ live.
3. การ์ด published ใน Production ถูกแก้ด้วย SQL ตรง (ไม่ผ่านขั้น publish → ไม่เกิด snapshot ใหม่ใน `card_versions`). ถ้าต้องการประวัติเวอร์ชัน ให้ republish จาก Admin หลัง migrate.
4. ผลกระทบต่อสมดุลเป็นทฤษฎี: ใบ S ยังเป็น S เพราะ HP/ATK ล็อก (V2 §2). ควร playtest ก่อนรอบสอง.
5. Stall test (healer DEF 5 + TRP-008) ยังไม่ได้เขียน — เสนอเป็นงานรอบถัดไป.
