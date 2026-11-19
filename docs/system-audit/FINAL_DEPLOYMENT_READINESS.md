# Final Deployment Readiness — Runbook (VAreCrazy Card Battles)

> **เอกสารเท่านั้น — ยังไม่ Deploy / Merge / Apply Migration / Publish Card.**
> ข้อมูล Production ในเอกสารนี้อ่านด้วย SELECT / list เท่านั้น เมื่อ 2026-11-19 (UTC 15:30–15:40) และ **ต้องตรวจซ้ำก่อนลงมือจริง** (Phase A)
> เอกสารนี้ใช้ร่วมกับ `PRODUCTION_DEPLOYMENT_PLAN.md` (แผนภาพรวม) และ `CARD_PUBLISH_CHECKLIST.md` (รายการ publish) — ส่วนที่ขัดกัน **ให้ใช้เอกสารนี้**

## 0. สรุปคำตัดสิน

**สถานะ: NOT READY** — โค้ด/migration/แผนพร้อม แต่ยังมี BLOCKER ฝั่ง Owner/Process (หัวข้อ 8). เมื่อ BLOCKER ปิดครบและ Owner สั่ง "Deploy" จึงเริ่ม Phase B ได้.

| ชุดตรวจ | ผล |
|---|---|
| โค้ด | `feature/balance-round1` `0f53299` = main `a7b3c97` + 19 commit, fast-forward ได้, tests 492/492, Final Review 10/10 |
| Production ปัจจุบัน | Migration ถึง 017 · Edge `api` v13 · web `a7b3c97` · ไม่มีห้องที่กำลังเล่น |
| Backup | Snapshot DB เข้ารหัส GPG ส่งให้ Owner แล้ว (SHA256 `ced052c3…bd4c`) · **Storage 12 ไฟล์ไม่มี backup (ยอมรับความเสี่ยง)** · ไม่มี PITR |
| Rollback | มีครบทุกชั้น (หัวข้อ 6) · stub เดิม `515c6f4` เปิดได้จริง (ทดสอบแล้ว ดู 1.3) |

## 1. ผลตรวจ Deployment Plan + Checklist (Task 1)

### 1.1 ความครอบคลุม

| หัวข้อที่ขอ | ครอบคลุมใน Plan/Checklist | ผลตรวจ |
|---|---|---|
| 19 commits | Plan §1 | ✅ ตรงกับ `git log origin/main..feature/balance-round1` (นับได้ 19) |
| Migration 018–024 | Plan §3 | ⚠️ **ไม่มีไฟล์ 020 ในชุดนี้** — ดู 1.2 (ต้องไม่ apply 020) |
| CMS Effect Registry | Plan §1 (`a9e4ee5`, 019) | ✅ ต้อง apply 019 ก่อน edge |
| Security F-01..F-07 | Plan §1 (F-01,02,05,06,07 + F-03) | ⚠️ **F-04 ไม่อยู่ใน 19 commit** — ดู 1.2 |
| Admin login throttle | Plan §1 (018,023) | ✅ แต่ขาดขั้นทดสอบจริง → เพิ่มใน Phase F |
| PvP reward F-03 | Plan §1 | ✅ ขาดขั้นทดสอบแบบละเอียด → Phase F |
| Balance Round 1 | Plan §3 (024) | ✅ |
| Edge build/deploy | Plan §4, §8 | ⚠️ ขาดรายละเอียด `verify_jwt=false`, สคริปต์ stub, และการเช็ก bundle → Phase C |
| Vercel deployment | Plan §8 | ✅ ขาดวิธีเช็กสถานะ deployment → Phase E |
| Card publishing | Checklist §2 | ⚠️ **ลำดับขัดกับ Plan** (ดู 1.4 / R-H1) |
| D-9 | Plan §9 | ✅ เป็น commit/deploy แยกทีหลัง |
| Rollback | Plan §6 | ✅ เพิ่มตารางเรียงตามขั้น (หัวข้อ 6) |

### 1.2 สิ่งที่ Plan ไม่ได้ระบุ (พบจากการตรวจ)

1. **Migration 020 / F-04 ไม่อยู่ใน release นี้ และห้าม apply.** ไฟล์ `020_publish_all_cards.up.sql` อยู่เฉพาะบน `fix/f04-publish-migration` (commit `3a3e920`, ไม่ใช่ ancestor ของ `0f53299`). มัน `UPDATE cards SET status='published'` 59 ใบด้วยรายการ ID (ข้าม publish gate ของ service) ซึ่ง **ขัดกับ D-9 แบบ Wave ผ่าน CMS** และจะเกิด snapshot `card_versions` ด้วยค่าเก่า (ก่อน 024) ถ้ารันก่อน 024. เลขที่หายไปจึงเป็นเจตนา. **ข้อกำหนด:** ผู้รัน migration ต้องใช้ *รายการไฟล์ที่ระบุชัด* (018, 019, 021, 022, 023, 024) ห้าม "apply ทุกไฟล์ในโฟลเดอร์" และห้าม cherry-pick 020. Owner ต้องยืนยันว่า F-04 ถูกแทนที่ด้วย CMS publish (BLOCKER B-3).
2. **022 ต้องหลัง 021, 023 ต้องหลัง 018** — ถ้ากลับลำดับ ไฟล์จะ *สำเร็จแต่ไม่ทำอะไร* (`to_regclass(...) IS NULL → RETURN`) ทำให้ตารางไม่ถูกล็อก RLS โดยไม่มี error. ต้องตรวจ `relrowsecurity` ทุกครั้ง (Phase B).
3. **`apply_migration` ตั้งชื่อ/เวอร์ชันของ Supabase เอง** และ **ไม่อัปเดตตาราง `schema_migrations` ของแอป** (ตารางนั้นมีแค่ 001–008 และไม่ถูกใช้แล้ว). อย่าถือว่า "ตารางนั้นไม่เพิ่มแถว" เป็นความผิดพลาด. ใช้ `list_migrations` + ตรวจ schema จริงแทน. (ชื่อเดิมที่เคยไม่ตรงไฟล์: 015 ถูกบันทึกเป็น `014_level_frames`)
4. **Edge function ต้อง deploy ด้วย `verify_jwt=false`** (ค่าดีฟอลต์ของเครื่องมือเป็น true จะทำให้ทุก request 401). ดู Phase C.
5. **Edge ต้องก่อน Web** เสมอ: เว็บใหม่ (CMS Effect editor, `admin-tools.js`) พึ่ง API/019; Web ใหม่ + Edge เก่า = Admin ใช้ไม่ได้.
6. **024 ต้องก่อน Publish ใดๆ ที่ตั้งใจให้มีค่าสมดุลใหม่** (FOLLOW-YOU-040 ผ่าน publish gate ได้ก็ต่อเมื่อแถว combo หายแล้ว; และ `card_versions` จะได้ค่าใหม่).
7. **ความสด ของ Snapshot**: Snapshot ถ่ายที่ 2026-11-19T15:17Z; ผู้เล่น/ledger อาจเปลี่ยนก่อน Deploy → Phase A4 เช็กความต่างและถ่ายใหม่ถ้าไม่ตรง.
8. **รหัสผ่าน Archive ยังไม่ได้ส่งให้ Owner** (เก็บแยกไว้ใน sandbox, ไม่ได้อยู่ในแชต) → ถ้า sandbox ถูกล้าง Archive ที่ Owner ถืออยู่จะเปิดไม่ได้ (BLOCKER B-2).

### 1.3 ผลตรวจที่ทำเมื่อ 2026-11-19 (อ่านอย่างเดียว)

| รายการ | ผล |
|---|---|
| `origin/main` | `a7b3c97` (ไม่มี commit ใหม่) |
| Migrations ที่ apply | ถึง `017_room_lobby` (10 รายการใน Supabase; 018+ ไม่มี) |
| Edge `api` | v13, ACTIVE, `verify_jwt=false` |
| `play_rooms` | 5 ห้อง: 1 `lobby`, 4 `waiting`; **ไม่มี `playing`**, ไม่มี `state`; อัปเดตล่าสุด ≥ 6 วันก่อน |
| `pvp_matches` | 0 แถว (ยังไม่เคยมีแมตช์ PvP จบ) → F-03 ยังไม่เคยถูกทดสอบกับข้อมูลจริง |
| Stub rollback | raw URL ของ `515c6f41…/edge-bundle.js` ตอบ **200, 101,161 bytes** ทั้งชื่อ repo เดิมและ `VAreCrazy-Card-Battles-` (repo ย้ายแล้วยังใช้ได้) · commit นี้คือหัว branch `tmp-edge-bundle-l3` |
| Branch `tmp-edge-bundle*` | 9 branch ยังอยู่ (ห้ามลบ) |
| Storage | bucket เดียว `card-media` (public) มี 12 ไฟล์ `media/*.png` = 24,052,537 bytes (ไม่มี backup) |
| การ์ด | 70: published 11 / draft 58 / in_review 1; 33 ใบที่ 024 แก้ มี `def=0` และ `status` ตามเดิม (guard ตรง) |

### 1.4 ลำดับ Publish: Plan กับ Checklist/คำสั่งบอลขัดกัน

คำสั่งก่อนหน้า (Snapshot → Publish → Deploy) ให้ Publish ก่อน Deploy แต่ Plan §9 ระบุว่าต้อง apply 024 ก่อน publish. **ข้อเสนอ (ต้องให้ Owner ตัดสิน B-4): Deploy ทั้งชุด (Phase B–E) ก่อน แล้ว Publish ตามเวฟ (Phase G)** เหตุผล: (ก) การ publish ก่อน deploy ไม่ทำให้เกมเปลี่ยนเพราะ D-9 ยังไม่ active; (ข) publish ก่อนจะสร้าง `card_versions` ด้วยค่าเก่าของ 33 ใบ ที่ 024 จะเปลี่ยนโดยไม่ snapshot; (ค) FOLLOW-YOU-040 ติด gate จนกว่า 024; (ง) Admin ใหม่ (v14) มี publish gate/Effect Registry ที่ผ่านการเทสต์ ส่วน Admin เก่าไม่มี.

## 2. ลำดับและ Dependency ที่ยืนยันแล้ว (Task 2)

```
A Pre-flight (อ่านอย่างเดียว) ──► [Owner: "Deploy"]
B DB additive: 018 → 019 → 021 → 022 → 023
C Edge: build → tmp-edge-bundle-r1 → deploy v14
D DB ข้อมูล: 024
E Web: merge ff → push main → Vercel READY
F Post-deploy verification (รวม F-03 ด้วยผู้ทดสอบ 2 คน)
G Card publish ตามเวฟ (Toon ผ่าน CMS)  ──►  H D-9 (commit/deploy แยก, ภายหลัง)
```

| ขั้น | ต้องหลังอะไร | เหตุผล |
|---|---|---|
| 018→023 | 018 | 023 no-op ถ้าไม่มีตาราง |
| 021→022 | 021 | เช่นเดียวกัน |
| 019 | — | **จำเป็นก่อน Edge v14**: `service.ts` INSERT คอลัมน์ `config` |
| Edge v14 | 019 (และควรหลัง 018/021 แต่ทนได้) | โค้ดทนต่อการไม่มี 018/021 (log แล้วข้าม) แต่ไม่ทนต่อการไม่มี 019 |
| 024 | Edge v14 | ให้เอนจิน/ข้อความ SPL-003/004 ตรงกันเร็วที่สุด; ไม่พึ่ง 019 |
| Web | Edge v14 + 024 | หน้าเว็บใหม่เรียก API ใหม่ |
| Publish | 024 + Web | ค่าใหม่/Gate/ประวัติเวอร์ชัน |
| D-9 (โค้ด) | Publish ครบ Wave 0–1 | ไม่งั้นห้องเกมโหลดการ์ดไม่พอ |

ไม่พบ dependency วงกลม. Dependency ที่ Plan ไม่ได้เขียนอยู่ใน 1.2.

## 3. Final Deployment Checklist (Task 3) — ใช้ระหว่าง Deploy จริง

คำย่อ: **Verify** = ต้องเห็นผลนี้จึงไปต่อ · **Fail** = เงื่อนไขหยุด · **RB** = ย้อนกลับ · 🛑 = หยุดรอ Owner.
ทุก SQL ในส่วน Verify เป็น SELECT. `PID=jcjqooeckoapoikcwpet`.

### Phase A — Pre-flight (ไม่เขียนอะไร)

**A1 🛑 Owner สั่ง "Deploy"** — และ Gate ในหัวข้อ 7 เป็น ✅ ครบ. ถ้ายังมีข้อใด ❌ → ไม่เริ่ม.

**A2 ตรึงโค้ด**
- Action: `git fetch origin && git ls-remote origin refs/heads/main` ; `git rev-parse feature/balance-round1` ; `git status --short`
- Expected: main = `a7b3c97…`; branch tip = `0f53299…` (หรือ commit สุดท้ายที่ Owner อนุมัติ); working tree สะอาด
- Verify: `git merge-base --is-ancestor origin/main feature/balance-round1 && echo FF_OK`
- Fail: main ขยับ / tip ไม่ตรง → หยุด ตรวจว่า commit ใหม่คืออะไร
- RB: ไม่มี (ยังไม่เขียน)

**A3 เทสต์และ bundle ไม่ drift**
- Action: `npm test > /tmp/test.log 2>&1 &` (เกิน 2 นาที รันพื้นหลัง); `npx esbuild src/play-entry.ts --bundle --format=iife --global-name=VCZE --minify --charset=utf8 --outfile=/tmp/engine.js` ; `npx esbuild src/admin-entry.ts --bundle --format=iife --global-name=VCZX --minify --charset=utf8 --outfile=/tmp/admin-tools.js` ; `cmp /tmp/engine.js public/engine.js && cmp /tmp/admin-tools.js public/admin-tools.js`
- Expected: 492/492 pass; `cmp` ไม่มี output
- Fail: test แดง หรือ bundle ต่าง → หยุด (ห้ามแก้เองใน Deploy; รายงาน)
- RB: ไม่มี

**A4 ไม่มีผู้เล่นกำลังแข่ง + Snapshot ยังสด**
- Action (SELECT): `select code,status,updated_at from play_rooms where status='playing';` และเทียบจำนวนแถว/ค่าล่าสุดกับ Snapshot: `select (select count(*) from players),(select count(*) from economy_ledger),(select count(*) from pvp_matches),(select count(*) from cards),(select count(*) from card_effects),(select max(created_at) from economy_ledger),(select max(updated_at) from cards);`
- Expected: ไม่มีห้อง `playing`; ตัวเลขเท่าใน `BACKUP_MANIFEST.md` (players 21, ledger 24, pvp_matches 0, cards 70, card_effects 78)
- Fail: มีห้อง playing → รอ/ประกาศ; ตัวเลขต่าง (เช่น players > 21) → **ถ่าย Snapshot ใหม่** (ทำซ้ำขั้นตอน dump + เข้ารหัส + ส่ง Owner) ก่อนไปต่อ
- RB: ไม่มี

**A5 Guard ของ 024 ตรงกับข้อมูลจริง**
- Action (SELECT): `select character_id,def from cards where character_id in ('1GOKU-015','1GOKU-040','BABY-015','BACKJI-015','BADGUY-015','BADGUY-040','CUTIE-015','FOLLOW-YOU-040','FOLLOW-YOU-070','LALAPING-070','NORMAN-040','SATOSHI-040','TEE-040') order by 1;` และส่งออก `select c.character_id,e.sort_order,e.description from card_effects e join cards c on c.id=e.card_id order by 1,2;` เก็บเป็นไฟล์ (ใช้ย้อน 024 ด้วยมือ)
- Expected: ทุก `def=0`; ข้อความเอฟเฟกต์ตรงชุดที่ guard ของ 024 คาดไว้ (ถ้า Admin เคยแก้ ใบนั้นจะถูกข้ามโดยปริยาย — บันทึกไว้เป็นรายการ "ไม่ถูกเปลี่ยน")
- Fail: ใบสำคัญถูก Admin แก้ไปแล้ว → แจ้ง Owner ว่า 024 จะข้ามใบใดบ้างก่อนไปต่อ
- RB: ไม่มี

**A6 จดจุดย้อนกลับ**
- Action: บันทึกลงเอกสาร Deploy log: main `a7b3c97`; Vercel production deployment (ตรวจใหม่ด้วย `list_deployments` — ค่าใน Plan: `dpl_H5uSkXzBkdzMK7fHkoGUj91a5aPe`); Edge v13 stub → commit `515c6f41a82a407a0b34a7c1f9de5adddf9898e6`; `curl -sI` raw URL ของ stub ต้องได้ 200
- Fail: raw URL ไม่ 200 → **หยุด** (rollback edge ใช้ไม่ได้ ต้องเตรียมทางอื่นก่อน เช่น สร้าง tmp branch ใหม่จาก bundle เดิม)

### Phase B — DB additive (018, 019, 021, 022, 023)

ทำทีละไฟล์ด้วย `apply_migration` ใช้ชื่อไฟล์ (ไม่มีนามสกุล) และ SQL จากไฟล์ `.up.sql` ตรงตัว. **ห้ามรัน 020.**

| ขั้น | Action | Expected / Verify (SELECT) | Fail | RB |
|---|---|---|---|---|
| B1 | apply `018_login_attempts` | `select to_regclass('public.admin_login_failures');` ≠ null | error / ตารางไม่เกิด | `018…down.sql` (DROP TABLE) |
| B2 | apply `019_effect_config` | `select column_name,is_nullable from information_schema.columns where table_name='card_effects' and column_name='config';` = 1 แถว nullable YES; `select count(*) from card_effects where config is not null;` = 0 | error | `019…down.sql` เฉพาะเมื่อ `config IS NULL` ทุกแถว |
| B3 | apply `021_profile_create_log` | `to_regclass('public.profile_create_log')` ≠ null | error | `021…down.sql` |
| B4 | apply `022_profile_create_log_rls` | `select relrowsecurity from pg_class where oid='public.profile_create_log'::regclass;` = true; `select has_table_privilege('anon','public.profile_create_log','select');` = false | relrowsecurity=false (= no-op เพราะลำดับผิด) | `022…down.sql` |
| B5 | apply `023_admin_login_failures_rls` | เช่นเดียวกันกับ `admin_login_failures` | เช่นเดียวกัน | `023…down.sql` |

- หลังแต่ละขั้น: `list_migrations` ต้องเห็นรายการใหม่ 1 รายการ; ตรวจว่า `select count(*) from players` ยัง 21 (ไม่กระทบข้อมูล).
- ผลต่อผู้เล่น: ไม่มี (Edge v13 ไม่ใช้ตาราง/คอลัมน์ใหม่). ถ้าล้มกลางทาง → หยุด, rollback เฉพาะที่ apply ไปแล้วตามคอลัมน์ RB (ไม่ต้องย้อนทั้งหมด เพราะ additive).
- 🛑 **หยุดรอ Owner** ก่อนเข้า Phase C: "B1–B5 ผ่านครบ?"

### Phase C — Edge Function v14

**C1 Build จาก commit ที่อนุมัติเท่านั้น**
- Action: `git worktree add /tmp/r1 0f53299 && cd /tmp/r1 && npm ci` แล้ว
  `npx esbuild src/edge/index.ts --bundle --format=esm --platform=node --external:@electric-sql/pglite --external:postgres --minify --charset=utf8 --outfile=/tmp/edge.js && sed -i 's#from"postgres"#from"npm:postgres@3"#g' /tmp/edge.js`
- Expected: ไฟล์ ~76–110 KB (v13 bundle = 101,161 bytes) ; `grep -c 'npm:postgres@3' /tmp/edge.js` ≥ 1; `grep -c 'from"postgres"' /tmp/edge.js` = 0
- Verify ความลับ: `grep -Ei 'service_role|eyJ|password|SUPABASE_SERVICE' /tmp/edge.js | head` ต้องไม่มีค่าจริง (ชื่อตัวแปร env ได้ แต่ไม่มีค่า)
- Fail: build error / ขนาดผิดปกติ (< 50 KB) → หยุด
- RB: ไม่มี (ยังไม่ deploy)

**C2 เผยแพร่ bundle เป็น commit ปักหมุด**
- Action: สร้าง branch ชั่วคราว `tmp-edge-bundle-r1` จาก orphan/สะอาดที่มีไฟล์เดียว `edge-bundle.js` (เนื้อหา = `/tmp/edge.js`) → commit → push เฉพาะ branch นี้ (ไม่ push main) → `git rev-parse tmp-edge-bundle-r1`
- Expected: ได้ SHA 40 ตัว; `curl -sSL -o /dev/null -w "%{http_code} %{size_download}\n" https://raw.githubusercontent.com/ToonVrcz/VAreCrazy-Card-Battles-/<SHA>/edge-bundle.js` = `200` และขนาดเท่าไฟล์
- Fail: ไม่ 200 / ขนาดไม่เท่า → หยุด
- RB: ลบไม่ได้ต้องห้าม (ห้ามลบ tmp-edge-bundle*) — ปล่อย branch ไว้

**C3 🛑 Owner อนุมัติ deploy Edge** (แสดง SHA + ขนาด + ผล C1/C2)

**C4 Deploy**
- Action: `deploy_edge_function` ชื่อ `api`, entrypoint `index.ts`, **`verify_jwt=false`**, เนื้อไฟล์ = 1 บรรทัด `import "https://raw.githubusercontent.com/ToonVrcz/VAreCrazy-Card-Battles-/<SHA ใหม่>/edge-bundle.js";`
- Expected: version = 14, status ACTIVE, `verify_jwt=false` (ตรวจด้วย `list_edge_functions`)
- Verify (ภายใน 2 นาที):
  1. `curl -s -o /dev/null -w "%{http_code}" https://varecrazy-card-battles.vercel.app/api/play/shop` = 200 (ยังผ่าน Vercel เดิม → Edge ใหม่)
  2. `curl -s -o /dev/null -w "%{http_code}" -X POST https://varecrazy-card-battles.vercel.app/api/login -H 'content-type: application/json' -d '{"email":"x@invalid","password":"x"}'` = 401/400 (ไม่ใช่ 500/404/401-JWT-error)
  3. `query_logs` (edge) 5 นาที: ไม่มี 5xx/exception ตอนเริ่ม (cold start import ได้)
- Fail: 401 แบบ JWT / 500 / log มี import error → **Rollback ทันที**
- RB (ย้อน Edge): `deploy_edge_function` ด้วย stub เดิม `…/515c6f41a82a407a0b34a7c1f9de5adddf9898e6/edge-bundle.js`, `verify_jwt=false` → ได้ v15 ที่ทำงานเหมือน v13; ยืนยันด้วยข้อ 1–2 อีกครั้ง. DB ยังอยู่ที่ Phase B (additive ไม่เป็นปัญหา).

**C5 ทดสอบหน้าที่สำคัญของ Edge ใหม่ (ยังไม่แตะ 024)**: login Admin ด้วยบัญชีจริง (Owner กรอกเอง — ห้ามเก็บ/พิมพ์รหัสผ่านในล็อก), สร้างโปรไฟล์ผู้เล่นทดสอบ 1 ราย (อาจนับเป็นโปรไฟล์จริง 1 ราย 500 แต้มสตาร์ต — **Owner ต้องรับรู้**), เปิดแก้เอฟเฟกต์ในแอดมิน (Effect Registry) แต่ไม่บันทึก.
- 🛑 **หยุดรอ Owner** ก่อนเข้า Phase D

### Phase D — Migration 024 (แก้ข้อมูลการ์ด)

- Action: apply `024_balance_round1` ด้วย SQL จากไฟล์ตรงตัว
- Expected / Verify (SELECT): (1) HP/ATK ทุกใบเท่าเดิม — เทียบกับไฟล์ที่เก็บใน A5 และ `docs/card-balance/CARD_REVISION_PROPOSAL.json`; (2) `def` ของ 33 ใบ = ตารางใน `BALANCE_ROUND1_IMPLEMENTATION.md` (Lv15: 1GOKU 3, BADGUY 1, …); chain DEF: lalaping 4/6/6, follow-you 2/2/2, satoshi 5/5, tee 4/6, norman 3/3, 1goku 3/3, badguy 1/1; (3) `select count(*) from card_effects e join cards c on c.id=e.card_id where c.character_id='FOLLOW-YOU-040' and e.trigger='combo';` = 0 และ `has_combo=false`; (4) `select rules_text from cards where character_id in ('SPL-003','SPL-004');` มีข้อความ "ใช้ได้ 1 ครั้งต่อตัวต่อเทิร์น"; (5) `select count(*) from cards;` = 70, สถานะไม่เปลี่ยน (11/58/1); (6) รายการ "ใบที่ถูกข้ามเพราะ Admin เคยแก้" ตรงกับที่จดใน A5
- Fail: HP/ATK เปลี่ยนแม้ 1 ใบ, จำนวนการ์ด/สถานะเปลี่ยน, ใบที่ควรเปลี่ยนไม่เปลี่ยนโดยไม่มีเหตุใน A5 → **หยุด**
- RB: `024_balance_round1.down.sql` (guard ตามค่าใหม่; แถวที่ Admin แก้ภายหลังไม่ถูกแตะ) หรือกู้จากไฟล์ A5 ด้วยมือ (UPDATE ต้องได้ Owner อนุมัติ). หมายเหตุ: ค่าเปลี่ยนในการ์ด published ไม่สร้าง `card_versions`.
- 🛑 **หยุดรอ Owner** ก่อน merge

### Phase E — Web (Merge + Vercel)

**E1 🛑 Owner อนุมัติ merge/push main**
**E2 Action:** `git checkout main && git merge --ff-only feature/balance-round1 && git push origin main`
- Expected: push สำเร็จเป็น fast-forward (`a7b3c97..0f53299`); ไม่มี merge commit
- Fail: ไม่ ff (main ขยับ) → หยุด
- RB: ก่อนผู้ใช้เห็น: Vercel Dashboard → deployment เดิม → Promote/Rollback ไป `dpl_H5uSkXzBkdzMK7fHkoGUj91a5aPe` (ตรวจ ID ใหม่ใน A6); โค้ดใน git: `git revert -m`/revert commit range แล้ว push เป็น PR/commit ใหม่ (ห้าม force-push main)

**E3 Verify Vercel:** `list_deployments` ล่าสุด = `READY`, commit `0f53299`, target production; `get_runtime_logs`/build log ไม่มี error
- Fail: BUILD_ERROR/CANCELED → ไม่ต้องย้อน (ของเก่ายังให้บริการ) → แจ้ง Owner
**E4 Verify live** (ดู Phase F ข้อ F1–F3 ก่อนประกาศ)

### Phase F — Post-Deployment Verification (Task 4)

ผู้ทำ: ผม (อ่านอย่างเดียว/HTTP GET) + Owner/บอล (การกระทำที่เขียนข้อมูลบน Production). Fail ข้อ F1–F5 = พิจารณา Rollback ตามหัวข้อ 6 ทันที.

| # | รายการ | วิธี | ผ่านเมื่อ |
|---|---|---|---|
| F1 | Website | `curl -I https://varecrazy-card-battles.vercel.app/play` และ `/` ; `/play.html` ต้อง 404 (ตามเอกสาร) | 200 ทั้งสอง; `/admin-tools.js` 200; header `Content-Security-Policy-Report-Only` มี; **ไม่มี** header CSP แบบ enforce |
| F2 | Vercel status | `list_deployments` | production = READY commit `0f53299` |
| F3 | Edge status | `list_edge_functions` | v14 (หรือใหม่กว่า), ACTIVE, verify_jwt=false; `query_logs` 30 นาที ไม่มี 5xx |
| F4 | Database migration status | `list_migrations` + SELECT | เห็น 018,019,021,022,023,024 (ไม่มี 020); `relrowsecurity` ของ 2 ตารางเป็น true; `config` คอลัมน์มี |
| F5 | Admin login | Owner login ด้วยบัญชีจริงบน `/` | เข้าได้, เห็นรายการการ์ด 70 |
| F6 | Login throttle | Owner ใช้อีเมลทดสอบที่ *ไม่มีอยู่จริง* ใส่รหัสผิดซ้ำจน throttle (ดูเพดานในโค้ด `service.ts`); `select count(*) from admin_login_failures;` | ได้ข้อความ throttle; แถวเพิ่ม; **บัญชีจริงไม่ถูกล็อก**; ล้างตัวเองภายหลังตามกติกา |
| F7 | CMS card management | เปิดการ์ด draft 1 ใบ, แก้ข้อความโน้ตแล้วย้อนกลับ (ไม่ publish) หรือเปิดดูอย่างเดียว | เปิด/ดูได้ ไม่มี error |
| F8 | Effect Registry | เปิดตัวแก้เอฟเฟกต์ของการ์ดที่มีเอฟเฟกต์ แสดงช่อง system config / player text + consistency check | ขึ้นปกติ; บันทึก (ถ้า Owner ตกลงทดสอบ) ได้โดยไม่ error 5xx (พิสูจน์ 019) |
| F9 | Card data | SELECT เทียบ Phase D; เปิดการ์ดใน `/play` (ดู DEF ใหม่) | ตรงตาราง Round 1; HP/ATK เดิม |
| F10 | Game engine (บอท) | เล่น 1 เกมกับบอทบน `/play` (เด็คอย่างน้อย 3 ใบ Lv15) | เล่นจบได้ ไม่มี error ใน console; SPL-003/004 บัฟจบเทิร์น |
| F11 | Evolution | วิวัฒนาการ 1 ครั้งในเกมบอท (ต้องมี EVO + การ์ดใน evolution deck) | ทำได้ ตามกติกา; ถ้าไม่มี EVO ที่ publish → บันทึกเป็น "ยังทดสอบไม่ได้จน Wave 0" |
| F12 | Spell / Trap | ใช้สเปล SPL-003/004/007 และแทรปอย่างน้อย 1 ใบ | พฤติกรรมตามรายงาน Round 1 (SPL-007 สลับแล้วตีไม่ได้ทันที) |
| F13 | PvP | Owner + ผู้ทดสอบ 2 คน ตาม `docs/PLAYTEST.md` "Production PvP verification" (≥6 เทิร์น แล้วยอมแพ้) | `pvp_matches` ใหม่ 1 แถว, `pvp_match_players` 2 แถว, ledger ตรงกฎ |
| F14 | Reward system | SELECT `economy_ledger where kind='match'` หลัง F13 | คนละ 200 แต้ม/แมตช์ที่ ≥6 เทิร์น; แมตช์ที่สั้นกว่า 6 เทิร์นไม่ได้; ทุก 10 แมตช์ +10 Vrcoin (ยังไม่ถึงจึงไม่เห็น) |
| F15 | **F-03 reward farming** | คู่เดียวกัน (A,B) เล่นต่อเนื่อง 4 แมตช์ในวัน Bangkok เดียวกัน แล้วให้ A เล่นกับ C 1 แมตช์ | แมตช์ที่ 1–3 ของคู่ A–B ได้รางวัล; **แมตช์ที่ 4 ไม่ได้ (`rewards_paid=false`/ledger ไม่เพิ่ม)**; A–C ได้ปกติ; ไม่มีรางวัลตกผิดคน (เทียบ `player_id` ใน ledger กับ `pvp_match_players`); ใช้บัญชีทดสอบเท่านั้น |
| F16 | Points / Economy | `select id,points,vrcoin from players order by created_at;` เทียบ Snapshot | ทุกคนเดิมไม่เปลี่ยน ยกเว้นบัญชีทดสอบ F13–F15 และโปรไฟล์ใหม่จริง; ซื้อการ์ด Lv.40 ด้วย 500 แต้มได้ 1 ครั้งบนบัญชีทดสอบ |
| F17 | Guest-profile guard | สร้างโปรไฟล์ใหม่ 1 ราย | สำเร็จ; ได้ 500 แต้ม; `profile_create_log` เพิ่ม 1 แถว (per-IP ยังปิดตามโค้ด) |

หมายเหตุสำคัญ: F13–F15 **เขียนข้อมูลบน Production** (แมตช์/ledger จริง) — ให้ Owner/ผู้ทดสอบทำ ผมไม่สร้างแมตช์ทดสอบจากเครื่องมือเอง (ตาม `docs/PLAYTEST.md`). ควรจดบัญชีทดสอบไว้เพื่อแยกออกจากสถิติจริง.

### Phase G — Card publishing (Toon ผ่าน CMS) — หลัง Deploy เท่านั้น

| เวฟ | ใบ | ก่อน/หลังเวฟ |
|---|---|---|
| 0 | EVO-001, FUS-001, SPL-001..010, TRP-001..010 (22 ใบ) | ตรวจ `parse ได้ทุกเอฟเฟกต์` + gate ผ่าน → เล่นบอท 1 เกม |
| 1 | ตัวละคร Lv15 39 ใบ (รวม NONG-TAENGMO-015 ที่ in_review; FOLLOW-YOU-040 ผ่าน gate หลัง 024) | หลังเวฟ: `select status,count(*) from cards group by 1;` |
| 2 | Lv40 7 + Lv70 2 | หลังสายวิวัฒนาการผ่าน playtest ออนไลน์ |
- ตรวจหลัง **ทุกเวฟ** (SELECT): ไม่มีการ์ดที่ถูกใช้ในเด็คของผู้เล่น/ห้องเปิดอยู่ถูกเปลี่ยนเป็นสถานะที่ทำให้ห้องล้ม; `card_versions` มีแถวใหม่เท่าจำนวนที่ publish และ snapshot มีค่าตาม Round 1; ไม่มีใบ published ที่ขาดรูป/ธาตุ.
- EVO-002..010 / FUS-002..010 (18 ใบ): **ห้าม publish จนกว่าจะมีไฟล์รูปต้นฉบับ** (ดู R-N2).
- Fail: gate ไม่ผ่าน → ห้ามข้าม ให้บันทึกข้อความเตือนแล้วแก้ที่ข้อมูลการ์ด ไม่ใช่ใช้ SQL ตรง.
- RB: สลับสถานะกลับ draft ผ่าน CMS ได้ (การ์ดที่ถูกใช้ในเด็คผู้เล่นให้ตรวจก่อน); ข้อมูล `card_versions` ที่เกิดแล้วไม่ถูกลบ.

### Phase H — D-9 (แยกเป็น release ใหม่)
`rooms.ts` สองจุด `status<>'archived'` → `status='published'` เป็น commit เดียว ผ่านเทสต์ + deploy แยก + Owner อนุมัติ. เงื่อนไขก่อน: Wave 0–1 ครบ และ SELECT ยืนยันว่าไม่มีเด็คที่ผู้เล่นถืออ้างการ์ดที่ไม่ published. RB: revert commit นั้น (หรือ Vercel rollback; ถ้า edge ต้องย้อน stub).

## 4. จุดที่ต้องหยุดรอ Owner (รวม)

A1 (สั่ง Deploy) · หลัง B5 · C3 (ก่อน deploy edge) · หลัง C5 · หลัง D (ก่อน merge) · E1 (ก่อน push main) · หลัง Phase F (ยืนยันผลก่อนเปิด Publish) · ก่อนเริ่ม Phase G/H แต่ละเวฟ.

## 5. Post-deploy: ช่วงติดตาม
30 นาทีแรก: `query_logs` ทุก 5–10 นาที หา 5xx/`42P01`/`42703` (ตาราง/คอลัมน์หาย); 24 ชั่วโมงแรก: ตรวจ `economy_ledger` ผิดปกติ (รางวัลซ้ำ/ผิดคน), `admin_login_failures` มีรูปแบบถูกเดา, จำนวนโปรไฟล์ใหม่ต่อชั่วโมงเทียบเพดาน.

## 6. Rollback (ตามชั้น และความสัมพันธ์ DB ↔ App)

| สถานการณ์ | ย้อนอะไร | วิธี | ผลข้างเคียง |
|---|---|---|---|
| Edge พัง (C4) | Edge | deploy stub เดิม `515c6f4` (`verify_jwt=false`) | Web ยังเป็นของเก่า ใช้ได้; DB Phase B อยู่ (ปลอดภัย) |
| 024 ผิด (D) | ข้อมูลการ์ด | `024…down.sql` หรือกู้จากไฟล์ A5 | แถวที่ Admin แก้ภายหลังไม่ถูกแตะ; `card_versions` ไม่ถูกแตะ |
| Web พัง (E/F) | Web | Vercel rollback ไป deployment เดิม / revert commit | Edge v14 + DB ใหม่ ยังทำงานกับเว็บเก่าได้ (API เพิ่มเติม ไม่ทำลายของเดิม) — **ยกเว้น** ฟีเจอร์ที่เว็บเก่าไม่รู้จัก (ไม่พัง) |
| F-03 ผิดพลาด (รางวัลผิด) | Edge | stub เดิม (กฎเก่า = ไม่จำกัดคู่) | **แถว ledger/แต้มที่จ่ายไปแล้วไม่ย้อนอัตโนมัติ** — ต้องแก้ด้วย SQL ที่ Owner อนุมัติจาก Snapshot/`economy_ledger` |
| ต้องล้างทั้งชุด | Web → Edge → 024 → 023..018 | ตามลำดับนี้ | **019 down เฉพาะเมื่อไม่มี `config` ที่ Admin บันทึกไว้** (มิฉะนั้นข้อมูล config หาย); ปกติปล่อย 018–023 ไว้ได้ (additive) |
| ข้อมูลเสียหายเกินย้อนด้วย down | กู้จาก Snapshot (GPG) | restore ตารางเฉพาะที่เสียหาย **ได้รับอนุมัติ Owner ทุกครั้ง** | **Snapshot ยังไม่ผ่าน Restore Test** (R-H2); ข้อมูลหลังเวลา Snapshot (เช่น ผู้เล่น/แมตช์ใหม่) หายถ้ากู้ทับ |

หลักการ: ย้อนจากชั้นนอกเข้าใน (Web → Edge → ข้อมูล → โครงสร้าง); ไม่ย้อนโครงสร้างถ้าไม่จำเป็น; ห้ามลบ branch `tmp-edge-bundle*`; ห้าม force-push `main`.

## 7. Pre-Deployment Gate (ต้องครบทุกข้อก่อน A1)

| Gate | สถานะ ณ 2026-11-19 |
|---|---|
| Deployment Plan บน GitHub | ✅ `docs/deployment-plan` (`2b57197`) — รวมเข้าเอกสารนี้ |
| Card Publish Checklist บน GitHub | ✅ `docs/card-publish-checklist` (`8c71a1e`) |
| Final Deployment Readiness (เอกสารนี้) | ✅ เมื่อ push |
| Snapshot สำเร็จ + ตรวจแล้ว | ✅ (ตรวจจำนวนแถว/โครงสร้าง/อ่านหลังเข้ารหัสได้; **ยังไม่ Restore Test จริง**) |
| สำเนานอก Supabase/นอก sandbox ที่ Owner ถือ | ⚠️ ส่งไฟล์ให้ Owner แล้ว แต่ **ยังไม่ได้ส่งรหัสผ่าน** (B-2) |
| Migration 018–024 ตรวจแล้ว | ✅ (ไม่รวม 020) ตรวจซ้ำใน A5 |
| ลำดับ Deploy ยืนยัน | ✅ หัวข้อ 2 |
| ไม่มีผู้เล่นกำลังแข่ง | ✅ ตอนนี้ (ตรวจซ้ำ A4) |
| Owner ตัดสิน B-1..B-4 | ❌ รออยู่ |
| Owner อนุมัติ "Deploy" | ❌ ยังไม่สั่ง |

## 8. Risk Register (Task 5)

### BLOCKER (ต้องปิดก่อน A1)
| ID | ความเสี่ยง | ทางปิด |
|---|---|---|
| B-1 | ผู้สั่ง Deploy ยังไม่อนุมัติ + ยังไม่มีการรีวิวขั้นสุดท้ายของเอกสารนี้ | บอล/Owner รีวิว แล้ว Owner สั่ง "Deploy" |
| B-2 | **รหัสผ่าน Archive ยังไม่ถึง Owner** — Owner ถือไฟล์ที่เปิดไม่ได้; ไฟล์รหัสอยู่ใน sandbox ที่อาจถูกล้าง | Owner เลือกช่องทางรับรหัส หรือกำหนดรหัสเอง แล้ว Claude เข้ารหัสใหม่ + ส่งใหม่; Owner ยืนยันว่าเก็บสำเนาไว้นอก sandbox และ **ลองถอดรหัสสำเร็จ** (จุดนี้เป็นการ Restore Test ขั้นต่ำ) |
| B-3 | **Migration 020 / F-04** ค้างบน `fix/f04-publish-migration` (publish 59 ใบด้วย SQL ข้าม gate) ขัดกับ D-9 แบบ Wave | Owner ยืนยันเป็นลายลักษณ์อักษรว่า "ไม่ใช้ 020 ใน release นี้; ใช้ CMS publish แทน"; ผู้ deploy ใช้รายชื่อไฟล์ migration ที่ระบุชัด |
| B-4 | ลำดับ Publish vs Deploy ขัดกัน (1.4) | Owner ตัดสิน: ข้อเสนอ = Deploy ก่อนแล้ว Publish (Phase G) |

### HIGH
| ID | ความเสี่ยง | เหตุผล / การควบคุม |
|---|---|---|
| H-1 | **PvP Reward F-03 เปลี่ยน Economy และ ยังไม่เคยทดสอบกับข้อมูลจริง** (`pvp_matches`=0) | พฤติกรรมผ่านเทสต์ 492 ใบ + PGlite แต่ไม่มีแมตช์จริงเลย; ควบคุมด้วย F13–F15; ย้อนกลับด้วย Edge stub แต่ ledger ที่จ่ายแล้วย้อนอัตโนมัติไม่ได้ |
| H-2 | **Snapshot ยังไม่ผ่าน Restore Test จริง** | ตรวจได้เพียงอ่านไฟล์/จำนวนแถว; ไม่เคยลองกู้ข้อมูลเข้า DB; ความเสี่ยงเกิดเมื่อต้องกู้จริง (FK/ลำดับตาราง/ชนิดข้อมูล jsonb) — แนะนำทดสอบ restore ใน PGlite/Postgres ภายในเครื่องก่อน (ไม่แตะ Production) ถ้าต้องการยกระดับ |
| H-3 | **Migration 024 แก้ข้อมูลการ์ด** (33 ใบ) และการ์ด published เปลี่ยนโดยไม่เกิด `card_versions` | guard ค่าเก่า + A5 + Phase D verify + `024.down.sql`; ประวัติเวอร์ชันของ 11 ใบ published อาจไม่สะท้อนค่าใหม่จนกว่าจะ republish |
| H-4 | **Rollback DB ↔ App ต้องสัมพันธ์กัน**: 019 down ทิ้งข้อมูล config; ถ้า Web/Edge ย้อน แต่ 024 ค้าง การ์ดแสดงค่าใหม่กับเอนจินเก่า (ใช้ได้ แต่สมดุลไม่ตรงข้อความ SPL-003/004) | ใช้ตารางหัวข้อ 6; ตัดสินใจย้อน 024 เมื่อย้อน Edge ที่เกี่ยวกับเอนจิน |
| H-5 | **ความสดของ Snapshot**: ผู้เล่นใหม่/ข้อมูลเปลี่ยนก่อน Deploy | A4 บังคับเทียบและถ่ายใหม่ถ้าต่าง |
| H-6 | 19 commit เป็นชุดเดียว (รวม F-03, throttle, CSP Report-Only) — ปัญหาจุดเดียวอาจกระทบหลายระบบ | Phase แยก + จุดหยุด; Edge/DB/Web ย้อนแยกกันได้ |

### ACCEPTED RISK (Owner ยอมรับแล้ว)
| ID | ความเสี่ยง | หมายเหตุ |
|---|---|---|
| A-1 | **Supabase Free: ไม่มี PITR / backup อัตโนมัติ** | ใช้ Snapshot เองแทน; Owner ควรเปิด Dashboard → Backups ยืนยันอีกครั้ง (ผมตรวจหน้านั้นไม่ได้) |
| A-2 | **รูปใน Storage 12 ไฟล์ (`media/*.png`, 24,052,537 bytes) ไม่มี backup** | Owner ยอมรับสำหรับรอบนี้; Deploy นี้ไม่ได้เขียน/ลบ Storage — ความเสี่ยงคือความเสียหายอื่นๆ ที่ไม่เกี่ยวกับการ Deploy; แนะนำ Owner ดาวน์โหลดจาก Dashboard เมื่อสะดวก |

### NON-BLOCKING
| ID | ความเสี่ยง | หมายเหตุ |
|---|---|---|
| N-1 | CSP ยัง Report-Only; per-IP flood guard ยังไม่เปิด | ตามแผน; ปรับหลังวัด header จริง |
| N-2 | **การ์ด Assets 18 ไฟล์ไม่มีต้นฉบับ** (EVO-002..010, FUS-002..010: ไม่มีใน git และไม่มีใน Storage) | ไม่อยู่ในเวฟที่ publish (Wave 0 มีแค่ EVO-001/FUS-001); ต้องหาไฟล์ต้นฉบับก่อน publish 18 ใบนี้ในอนาคต |
| N-3 | ไม่มีข้อมูล Playtest สำหรับ Balance | Round 2 ใช้ข้อมูลจริง |
| N-4 | ตารางแอป `schema_migrations` ไม่ตรงกับ migration จริง (001–008) | ไม่ใช้งานแล้ว; ใช้ `list_migrations` |
| N-5 | SPL-005/006 ข้อสังเกตเกมเพลย์ | เปิดได้ตามรายงาน |

## 9. ข้อมูลอ้างอิง
Branch โค้ด `feature/balance-round1` (`0f53299`) · Plan `docs/deployment-plan` (`2b57197`) · Checklist `docs/card-publish-checklist` (`8c71a1e`) · Backup `BACKUP_MANIFEST.md` (นอก repo; ไฟล์ Snapshot ห้าม commit) · Project `jcjqooeckoapoikcwpet` · Vercel project `varecrazy-card-battles-` · Edge `api`.
