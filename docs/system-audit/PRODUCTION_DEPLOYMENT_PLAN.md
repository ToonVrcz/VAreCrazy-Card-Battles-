# Production Deployment Plan — Balance Round 1 + Phase 1 hardening

> **แผนเท่านั้น — ยังไม่ Deploy.** ห้าม merge / push main / apply migration / เขียน Production จนกว่า Toon สั่ง "Deploy".
> ข้อมูล Production ในเอกสารนี้อ่านแบบ SELECT / list เท่านั้น ณ 2026-11-19 (ตรวจซ้ำก่อนลงมือจริง)

## 1. สิ่งที่จะถูกส่งขึ้นจริง (สำคัญ)

`feature/balance-round1` (`0f53299`) นำหน้า `main` (`a7b3c97`) **19 commit, ไม่ตามหลัง** → merge แบบ fast-forward ได้ แต่ **ไม่ได้ส่งแค่ Balance Round 1** — ส่งงานที่ค้างทั้งหมดพร้อมกัน:

| กลุ่ม | Commit สำคัญ | ผลต่อ Production |
|---|---|---|
| CMS Effect Registry | `a9e4ee5` (migration 019) | Admin แก้เอฟเฟกต์แบบโครงสร้าง; **โค้ดเขียนคอลัมน์ `card_effects.config` → ต้องมี 019 ก่อน** |
| Hardening F-01..F-07 | `426aebe`, `5a48213`, `73d01b1`, `4d996f4` | escape XSS, ตรวจ payload, route `/admin-tools.js` |
| Admin login throttle | `a095877` (018) | จำกัดการเดารหัส Admin; โค้ดทนต่อการไม่มีตาราง (log แล้วข้าม) |
| กฎรางวัล PvP F-03 | `a8d055e` | **คู่เดียวกันได้รางวัลสูงสุด 3 แมตช์/วัน (เวลา Asia/Bangkok)** — เปลี่ยนพฤติกรรมเศรษฐกิจจริง |
| Guest-profile flood guard | `37f10d9` (021) | เพดานรวม 300 โปรไฟล์/10 นาที (21 โปรไฟล์ตอนนี้); โค้ดทนต่อการไม่มี 021 |
| Phase 1 remediation | `c8dcb62`..`5b85f89` (022, 023) | XSS lint/DOM tests, RLS สองตาราง, CSP **Report-Only** |
| Balance Round 1 | `0f53299` (024) | ดู `BALANCE_ROUND1_IMPLEMENTATION.md` |
| เอกสาร/ส่งออกข้อมูล | หลาย commit | ไม่กระทบรันไทม์ |

**ข้อควรตัดสินใจ:** ต้องการ deploy ทั้งหมดรอบเดียว หรือแยก (เช่น เฉพาะ Phase 1 ก่อน)? การแยกต้องตัด commit ด้วย cherry-pick/เบรนช์ใหม่ และ migration 024 ผูกกับ seed/เอนจินของ Round 1 — **แนะนำรอบเดียว** เพราะทุกอย่างผ่าน 492/492 และไล่รีวิวแล้ว แต่ผู้เล่นจะเห็นกฎรางวัล F-03 พร้อมกัน

## 2. สถานะ Production ปัจจุบัน (อ่านอย่างเดียว)

| รายการ | ค่า |
|---|---|
| Migration ที่ apply แล้ว | ถึง **017** (`017_room_lobby`); 018–024 ยังไม่ apply (**ไม่มีไฟล์ 020** ในรีโป — เลขข้ามไป ไม่ใช่ข้อผิดพลาด; ตัวรัน migrate เรียงตามชื่อไฟล์) |
| Edge function `api` | **v13**, `verify_jwt=false`, stub 1 บรรทัดที่ import `edge-bundle.js` จาก commit ปักหมุด **`515c6f4`** (raw GitHub) |
| Vercel Production ล่าสุด | `dpl_H5uSkXzBkdzMK7fHkoGUj91a5aPe` = `main` `a7b3c97` "Merge Phase 3: room system" (READY, rollback candidate) |
| การ์ด | published 11 · draft 58 · in_review 1 (ทุกใบมีรูปและธาตุครบ) |
| ผู้เล่น / ห้อง | 21 โปรไฟล์ · 5 ห้อง · `card_versions` 14 แถว |

## 3. Migration 018–024

ทุกไฟล์เป็น additive/idempotent ยกเว้น 024 (UPDATE แบบ guard). ทดสอบ up/down ใน PGlite แล้ว (`npm test` 492/492).

| # | ทำอะไร | ความเสี่ยง | โค้ดทนถ้ายังไม่มี? | จำเป็นไหม | Down |
|---|---|---|---|---|---|
| 018 | ตาราง `admin_login_failures` | ต่ำ (ตารางใหม่) | ใช่ (ข้าม throttle) | ควรมี (ความปลอดภัย Admin) | DROP TABLE |
| 019 | `card_effects.config jsonb NULL` | ต่ำ (คอลัมน์ nullable) | **ไม่** — บันทึกเอฟเฟกต์ใน Admin/นำเข้าการ์ดจะล้ม | **จำเป็นก่อน edge ใหม่** | DROP COLUMN (ทิ้งข้อมูล config — ตรวจว่า `config IS NULL` ทุกแถวก่อน rollback) |
| 021 | ตาราง `profile_create_log` | ต่ำ | ใช่ (per-IP ปิดอยู่แล้วตามโค้ด) | ไม่จำเป็นเชิงฟังก์ชัน; 022 ต้องการ | DROP TABLE |
| 022 | RLS + revoke บน `profile_create_log` | ต่ำ: บทบาท edge (`postgres`/`service_role`) BYPASSRLS | — | ควร (ปิดช่อง Data API) | คืน grant/ปิด RLS |
| 023 | RLS + revoke บน `admin_login_failures` | ต่ำ (เช่นเดียวกัน) | — | ควร | คืน grant/ปิด RLS |
| 024 | DEF + เอฟเฟกต์ 33 ใบ, ถอด combo ของ FOLLOW-YOU-040, ข้อความ SPL-003/004 | กลาง: แก้ข้อมูลการ์ดจริง; **ไม่แตะ HP/ATK**; guard ค่าเก่า → ไม่ทับที่ Admin แก้; **การ์ด published จะเปลี่ยนโดยไม่เกิด snapshot ใน `card_versions`** | — | จำเป็นสำหรับ Round 1 | up/down ย้อนกลับเฉพาะแถวที่ตรง guard |

ลำดับ apply: **018 → 019 → 021 → 022 → 023 → (edge) → 024** (เหตุผลในหัวข้อ 4). ใช้ `apply_migration` ทีละไฟล์ ตั้งชื่อตามไฟล์; หลังแต่ละไฟล์ตรวจด้วย `list_migrations`/SELECT.

## 4. แยก Database กับ Application

| ชั้น | เปลี่ยนอะไร | วิธี |
|---|---|---|
| **DB (ก)** additive | 018, 019, 021, 022, 023 | apply ก่อน — โค้ดเก่า v13 ไม่ได้ใช้ ไม่กระทบผู้เล่น |
| **Edge function** | build ใหม่ (`game.ts`, `api.ts`, `economy.ts`, `rooms.ts`, `service.ts` เปลี่ยน) | build bundle ตาม CLAUDE.md → commit-pinned stub (วิธีเดิม) → deploy |
| **DB (ข)** ข้อมูล | 024 | apply **หลัง** edge ใหม่ เพื่อให้เอนจินกับข้อความการ์ด SPL-003/004 ตรงกันเร็วที่สุด |
| **Web (Vercel)** | `play.html`, `admin.html`, `card-renderer.js`, `engine.js`, `admin-tools.js`, `vercel.json` (CSP Report-Only) | merge → push `main` → Vercel auto-deploy |

หน้าต่างเวลาที่สถานะผสมกัน (สั้น, ผู้เล่น 21 คน): ระหว่าง edge ใหม่กับ 024 เอนจินใหม่อ่านค่าการ์ดเก่า (ใช้ได้ ไม่ crash); ระหว่าง 024 กับ Vercel เว็บเก่าแสดงข้อมูลการ์ดใหม่ (แสดงผลได้ ไม่พึ่งฟิลด์ใหม่).

## 5. Backup ก่อนเริ่ม

1. **ยืนยันก่อนว่า Supabase project มี backup/PITR ไหม** (ตรวจใน Dashboard; ผมตรวจจาก MCP ไม่ได้).
2. Snapshot แบบไม่เขียน Production: SELECT `cards`, `card_effects`, `card_versions`, `players`, `play_rooms`, `wallets/ledger` ที่เกี่ยวข้อง เก็บเป็นไฟล์ในเครื่อง (ไม่ใช่ใน repo เพราะมีข้อมูลผู้เล่น). ขั้นต่ำ: `cards`+`card_effects` ทั้งหมด (ใช้ย้อนกลับ 024 ถ้า guard ไม่ตรง).
3. (ทางเลือก ต้องอนุมัติเพราะเป็นการเขียน DDL) `CREATE TABLE _bak_024_cards AS SELECT ...` ก่อน 024.
4. บันทึกจุดย้อนกลับ: Vercel `dpl_H5uSkXzBkdzMK7fHkoGUj91a5aPe`, edge stub → commit `515c6f4`, `main` `a7b3c97`.
5. **ห้ามลบ** เบรนช์ `tmp-edge-bundle*` (ใช้เป็นจุดอ้างอิง rollback).

## 6. Rollback (เรียงจากชั้นนอกเข้า)

| ชั้น | วิธี |
|---|---|
| Web | Vercel Dashboard → rollback ไป `dpl_H5uSkXzBkdzMK7fHkoGUj91a5aPe` (หรือ revert merge) |
| Edge | deploy stub 1 บรรทัดเดิม: `import "https://raw.githubusercontent.com/ToonVrcz/varecrazy-card-battles-/515c6f41a82a407a0b34a7c1f9de5adddf9898e6/edge-bundle.js";` (ต้องแน่ใจว่า commit/branch นั้นยังอยู่) |
| 024 | รัน `024_balance_round1.down.sql` (guard ตามค่าใหม่; แถวที่ Admin แก้ภายหลังจะไม่ถูกแตะ) หรือกู้จาก snapshot |
| 023→022→021→019→018 | รัน `.down.sql` ย้อนลำดับ; **019 down เฉพาะเมื่อไม่มีแถว `config` ที่ Admin บันทึกไว้** (ไม่งั้นข้อมูลหาย) ปกติไม่ต้อง rollback 018–023 เพราะ additive — ปล่อยไว้ได้ |

ข้อจำกัด: ถ้า rollback web/edge แต่ทิ้ง DB ไว้ ระบบเก่าทำงานได้ (migration เป็น additive ยกเว้น 024 ที่แค่เปลี่ยนค่า).

## 7. ผลกระทบต่อผู้เล่นระหว่าง Deploy

- ไม่มีช่วงหยุดบริการเชิงโครงสร้าง; การ deploy edge เปลี่ยนเวอร์ชันทันที — **เกมที่เล่นอยู่ 5 ห้อง** ใช้เอนจินใหม่ต่อจากสถานะเดิม (ฟิลด์ใหม่ `splTurn/tempDef` เป็น optional; บัฟ SPL ที่ร่ายไปแล้วแบบถาวรยังคงอยู่จนตัวนั้นออกจากสนาม).
- แนะนำทำช่วงที่ไม่มีห้องกำลังเล่น (ตรวจ `play_rooms` ก่อน) หรือประกาศสั้น ๆ.
- ผู้เล่นจะเห็น: การ์ดมี DEF/ค่าเอฟเฟกต์ใหม่, SPL-003/004 จบเทิร์น, SPL-007 ขโมยแล้วตีไม่ได้ทันที, ธาตุเปลี่ยน, รางวัล PvP คู่เดิมสูงสุด 3 แมตช์/วัน, Admin login ถูกจำกัดครั้ง.
- บอทเกม (ฝั่งเบราว์เซอร์) ใช้ `engine.js` ใหม่ทันทีหลัง Vercel deploy (แคชเบราว์เซอร์อาจทำให้บางคนเห็นเวอร์ชันเก่าชั่วคราว).

## 8. ขั้นตอนลงมือ (เมื่อ Toon สั่ง "Deploy")

1. ตรวจซ้ำ: `main` ยัง `a7b3c97`, `npm test` 492/492 บน `0f53299` (หรือ commit สุดท้ายที่อนุมัติ), `public/*.js` ไม่ drift, ไม่มีห้องกำลังเล่น.
2. Backup (หัวข้อ 5).
3. apply 018 → 019 → 021 → 022 → 023 (ตรวจ `list_migrations` + เช็ก RLS: `relrowsecurity=true`, anon select ไม่ได้).
4. build edge bundle (คำสั่งใน CLAUDE.md) → commit บนเบรนช์ชั่วคราว `tmp-edge-bundle-r1` → deploy stub ปักหมุด commit ใหม่ → ตรวจ `/api` health + login Admin + สร้างโปรไฟล์.
5. apply 024 → SELECT ตรวจ: HP/ATK ไม่เปลี่ยน, DEF/เอฟเฟกต์ 33 ใบ, ข้อความ SPL-003/004.
6. merge fast-forward เข้า `main` → push → รอ Vercel READY.
7. ตรวจ live: `/play`, `/`, `/admin-tools.js` (200), header `Content-Security-Policy-Report-Only`, เปิดห้อง+เล่น 1 เกมกับบอท, ตรวจรางวัล PvP (ใช้ขั้นตอนใน `docs/PLAYTEST.md`), เลือกการ์ด 1 ใบดู DEF ใหม่.
8. ตรวจ log 30 นาที (`query_logs` edge) หา 5xx; ถ้าผิดปกติ → rollback ตามหัวข้อ 6.

## 9. D-9 (ใช้เฉพาะ Published) — จัดการผ่าน CMS Admin

ปัญหา: ห้องเกมโหลดทุกสถานะที่ไม่ใช่ `archived`; เปิด D-9 เมื่อ published = 11 จะทำให้ส่วนใหญ่เล่นไม่ได้. **ไม่ควร publish 58 ใบรวดเดียว.**

| กลุ่ม | จำนวน | หมายเหตุ |
|---|---|---|
| Published อยู่แล้ว | 11 ตัวละคร (1GOKU-015/040, BABY, BACKJI, BADGUY-015/040, BAM, BAMMIE, BOBO, CHAEM, CUTIE) | ได้ค่าใหม่จาก 024 โดยไม่ผ่าน snapshot → republish ถ้าต้องการประวัติ |
| In review | NONG-TAENGMO-015 | จำเป็นสำหรับคู่ Fusion (backji+nong) |
| Draft: ตัวละคร | 36 | รวม FOLLOW-YOU-040 — **publish gate เคยบล็อกเพราะ combo; หลัง 024 แถว combo หายแล้ว จึงผ่านได้ (ต้อง apply 024 ก่อน publish)** |
| Draft: สเปล / แทรป / EVO / FUS | 10 / 10 / 1 / 1 | **ต้องมีครบ ไม่งั้นสร้างเด็คตามกติกาไม่ได้** (EVO-001 จำเป็นสำหรับวิวัฒนาการ, FUS-001 สำหรับฟิวชั่น) |

เกณฑ์ตรวจก่อน publish ต่อใบ: (1) เอฟเฟกต์ parse ได้ (ไม่มีแถวที่แสดง "ไม่ทำงาน"), (2) ตัวเลข HP/ATK/DEF ตรงรายงาน Round 1, (3) ข้อความ/รูป/ธาตุครบ (ตรวจแล้ว: ไม่มีใบไหนขาดรูปหรือธาตุ), (4) ผ่าน publish gate ใน Admin. **ข้อเสนอลำดับ:** EVO/FUS + สเปล/แทรป 20 ใบ → ตัวละครที่ไม่มีข้อกังวล → ตัวละครที่ปรับสมดุลแล้ว (33 ใบ) หลังดูผล playtest. จากนั้นค่อยแก้ `rooms.ts` (2 จุด `status<>'archived'` → `='published'`) เป็น commit แยก + deploy แยก.

คำถามที่ Toon ต้องตอบ: ต้องการให้การ์ดใดบ้างเล่นได้ในเกมจริงรอบแรก? (ผมแนะนำทั้ง 48 ตัวละครหลังตรวจ เพราะเกมออกแบบรอบเด็ค 40 ใบ ≥3 Lv15)

## 10. ความเสี่ยงที่เหลือ

1. deploy นี้พา 19 commit (รวมเศรษฐกิจ F-03) — ต้องยอมรับเป็นชุดเดียว.
2. ไม่มีข้อมูล playtest; ค่าสมดุลเป็นการประเมิน (Round 2 ต้องใช้ข้อมูลจริง).
3. การ์ด published ถูกเปลี่ยนด้วย SQL ตรง (ไม่มี snapshot).
4. `edge-bundle.js` เป็น commit-pinned raw GitHub: repo ย้ายที่อยู่แล้ว (`ToonVrcz/VAreCrazy-Card-Battles-`) ลิงก์เดิมยัง redirect ได้ แต่ควรทดสอบ URL ใหม่/เดิมก่อนพึ่งเป็น rollback.
5. CSP ยัง Report-Only; per-IP flood limit ยังไม่เปิด (ต้องวัด header ก่อน).
6. ไม่ได้ยืนยัน backup/PITR ของ Supabase (ต้องดู Dashboard).
