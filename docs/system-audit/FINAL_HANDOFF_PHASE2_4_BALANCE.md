# Final Handoff — Phase 1 Closure + Phase 2–4 Game Balance (Audit / Proposal / Implementation Prep)

> **สถานะ: เอกสารเท่านั้น / PROPOSED — ยังไม่อนุมัติ.** ไม่มีการแก้ Card Data, HP, ATK, กติกา, DB, ไม่ merge / deploy / apply migration / เขียน Production.
> ตัวเลขทั้งหมดมาจาก repo (`db/seed/*.json`, `src/engine/*`, probe เดิม `docs/card-balance/engine-probe-output.json`) และโมเดลประเมิน `scripts/card-balance-model.ts` (**Theoretical Estimate — ไม่มี playtest/win-rate จริง**; Production `pvp_matches` ว่างตอนตรวจล่าสุด). Tier ≠ win rate.
> ผู้อ่านหลัก: Toon (ไทย) — ตัวเลข/ชื่อการ์ดคงรูปเดิม

## 1. Phase 1 Remediation Status

| งาน | สถานะ |
|---|---|
| XSS: `esc()` ทุกจุดใน `play.html`/`admin.html`/`card-renderer.js` + AST allowlist lint (ทำงานแบบ allowlist, ไม่เชื่อชื่อ property) + DOM tests (Playwright/Chrome) | เสร็จ ผ่านรีวิว 2 รอบ |
| DB security: migration 022 (`profile_create_log` RLS), 023 (`admin_login_failures` RLS) | เขียนแล้ว **ยังไม่ apply** |
| IP guard: เลิกเชื่อ proxy headers; เหลือเพดานรวม 300 โปรไฟล์/10 นาที | เสร็จ (per-IP ต้องวัด header บน Production ก่อน → Decision) |
| CSP **Report-Only** ใน `vercel.json` (ยังต้องมี `'unsafe-inline'`) | เสร็จ |
| ห้าม: HP/ATK/DEF, ผลการ์ด, กติกา, Starter Points/รางวัล, migration 018–020 | ไม่ถูกแตะ |

Residual (ไม่ทำเพิ่มตามขอบเขต): lint เป็น accident guard ไม่ใช่การพิสูจน์ปลอดภัย (DOM tests เป็น backstop); CSP ยังไม่ enforce; per-IP limit ยังไม่เปิด.

## 2. Commit Information

| Branch | Commit | หมายเหตุ |
|---|---|---|
| `fix/phase1-remediation` | `5b85f89` (local) | เพิ่ม report addendum บนสถานะที่ทดสอบแล้ว — **ยังไม่ push** (origin = `fdc350c`) |
| `fix/phase1-remediation` | `fdc350c` | อยู่บน GitHub แล้ว (push ตามคำสั่ง "Push เลย") |
| `docs/phase2-balance-audit` | แตกจาก `5b85f89` | เอกสารฉบับนี้ (docs-only) |

## 3. Test Results

- `npm test` ครั้งเต็มล่าสุดบน Phase 1: **484/484 ผ่าน** (ก่อน `5b85f89`; commit นั้นเพิ่มแค่เอกสาร).
- Phase 2–4 เป็น docs-only: ไม่มีโค้ด/ข้อมูลเปลี่ยน → ชุดทดสอบไม่ควรเปลี่ยนผล. มีการรันซ้ำบนเบรนช์นี้ — ผลบันทึกท้ายไฟล์ (หัวข้อ "ผลรันซ้ำ").
- สคริปต์วิเคราะห์ของ Phase 2 รันกับ `parseEffect`/`model` จริง: effect ที่ parse ได้ **55/56 แถว**; ที่ไม่ได้: `FOLLOW-YOU-040` trigger `combo` (ยังไม่ implement — E-8).

## 4. Deployment Readiness

**ยังไม่พร้อม Deploy โดยตั้งใจ (รอ "Deploy" จาก Toon).** ลำดับเมื่ออนุมัติ: (1) apply migration ที่ค้าง **018–023 ตามลำดับ** (ตรวจ 018–020 กับ `feature/hardening-1`/`feature/cms-effects-c` ก่อน) → (2) rebuild + deploy edge function (เพราะ `api.ts` เปลี่ยน; bundle ต้อง build ใหม่) → (3) merge → push `main` → (4) ตรวจ live: `/play`, `/`, CSP Report-Only header, สมัครโปรไฟล์ (เพดานรวม), RLS (anon อ่าน `profile_create_log`/`admin_login_failures` ไม่ได้). Rollback: Vercel rollback + rebuild edge จาก commit เก่า (เก็บ `tmp-edge-bundle*`). ไม่มีค่าใช้จ่ายเพิ่ม.

---

## 5. Full Game Balance Audit (Phase 2)

### 5.1 ขอบเขตข้อมูลจริง (จาก `db/seed`)

| รายการ | จำนวน | หมายเหตุ |
|---|---|---|
| Character | **48** (39 Lv15, 7 Lv40, 2 Lv70, **0 Lv99**) | 39 สาย (chain); **มีวิวัฒนาการแค่ 7 สาย** (1goku, badguy, follow-you, lalaping, norman, satoshi, tee) |
| Spell | 10 (SPL-001..010) | ค่าตัวเลข hard-code ตาม ID ใน `game.ts` |
| Trap | 10 (TRP-001..010) | event map ใน `game.ts` |
| Support | 2 (EVO-001, FUS-001) | |
| Fusion pair | **1** (backji + nong-taengmo; +20 HP, +10 ATK) | |
| Element | 12 แถวในเมทริกซ์ แต่ **มีตัวละครจริง 10 ธาตุ** | `alchemy`, `wind` ไม่มีตัวละคร |
| DEF | **0 ทุกใบ** | มิติใหม่ที่ยังไม่ถูกใช้ |

ค่าเฉลี่ย: Lv15 HP 85.4 / ATK 25.1 · Lv40 HP 152 / ATK 52 · Lv70 HP 305 / ATK 90. ฐานกติกา: LP 100, ดาเมจ `floor(max(1, ATK−DEF)×ธาตุ)`, โจมตี LP ได้เมื่อศัตรูไม่มีหน่วย (ไม่สนใจ DEF/ธาตุ).

### 5.2 ผลหลัก (data-driven)

1. **Power ถูกกำหนดโดย HP×ATK เกือบทั้งหมด.** ช่วง Power× ของ Lv15: 0.33 (BABY) – 1.68 (MON) = **ต่างกัน ~5 เท่า**; โบนัสจากเอฟเฟกต์ส่วนใหญ่ +1% – +20% (มัธยฐาน ≈ +8%). เอฟเฟกต์ไม่สามารถปิดช่องว่างได้ ถ้า HP/ATK ล็อก.
2. **การกระจาย tier Lv15** (โมเดล): S 7 · A 4 · B 11 · C 10 · D 7 → หางหนักทั้งสองด้าน (14 ใบอยู่ S/A หรือ D ที่ต่างกันเกิน ±25%).
3. **ความเร็วฆ่า LP** (ATK→จำนวนครั้งโจมตีตรง): ATK 40 = 3 ครั้ง, ATK 10 = 10 ครั้ง. จึงมี "ใบที่ชนะด้วยจังหวะ" (CUTIE/DNMAN/LINLADA/MELON/PIKACHU/MON/JAOJAY ฆ่า LP ใน 3 ครั้ง) กับใบที่ไม่เคยเป็นภัยต่อ LP (BABY/WENDYWENDIE ATK 10).
4. **เมทริกซ์ธาตุไม่สมดุลเชิงโครงสร้าง** (นับ Lv15 pool: ชนะ/แพ้):

| ธาตุ | ตัว Lv15 | ชนะ (จำนวนตัวในพูล) | แพ้ให้ | Net |
|---|---|---|---|---|
| lightning | 4 | 7 (water) | 1 (earth) | **+6** |
| poison | 5 | 3 (nature) | **0** (ตัวแพ้พิษคือ wind/ไม่มีตัวละคร) | **+3** |
| water | 7 | 5 (fire) | 4 (lightning) | +1 |
| earth | 1 | 4 (lightning) | 3 (nature) | +1 |
| holy / dark | 4 / 4 | 4 / 4 | 4 / 4 | 0 (คู่ปรับกันเอง) |
| neutral / physical | 2 / 4 | 0 | 0 | 0 (ไม่มี matchup) |
| fire | 5 | 3 (nature) | 7 (water) | **−4** |
| nature | 3 | 1 (earth) | **10** (fire 5 + poison 5) | **−9** |

   - `fire > alchemy` และ `wind > poison` เป็นแถวตายในพูลปัจจุบัน → fire มีเป้าหมายแค่ nature (3 ตัว), poison ไม่มีตัวชนะ.
   - Lightning ชนะ water ซึ่งเป็นธาตุที่ใหญ่ที่สุด (7) → น้ำ (SMILE/BOBO/BAMMIE…) แพ้เชิงโครงสร้าง ขณะที่ DNMAN/PIKACHU เป็น S อยู่แล้ว: **ความแรงซ้อนทับ** (S + ธาตุได้เปรียบ).
   - Multiplier 1.5/0.75: การ์ดธาตุ net บวก ได้ดาเมจเพิ่ม ~+50% ต่อการปะทะ; DEF 3 ลดได้ ~3–4.5 → **ธาตุมีน้ำหนักมากกว่า DEF ที่เสนอ** (ผลของ DEF ถูกกลบถ้าเจอธาตุเสียเปรียบ).
5. **Fusion:** pair เดียว ได้ 136 HP / 49 ATK (backji บน) หรือ 138 / 52 (nong บน) โดยใช้ FUS + 2 Lv15 (3 ใบ) นับเป็นการเรียก 1 ครั้ง — เท่า Lv40 (152/55) แต่ **ไม่ต้องใช้ evolution deck/สังเวย/เสียเทิร์นวิวัฒนาการ** และเรียกลงสนามได้ทันที. คุ้มกว่าการ์ดเดี่ยวทุกใบของ Lv15 → ถ้า pair เพิ่ม (ข้อเสนอในเกม) ต้องระวังเป็นทางลัดข้าม Evolution. ปัจจุบันเสี่ยงต่ำเพราะมี pair เดียว (เฉพาะเด็คที่มี BACKJI+NONG+FUS).
6. **Evolution:** ต้นทุน = EVO + ตัวสังเวย (Lv40:1, Lv70:2, Lv99:3) + ใบร่างใหม่ → ได้ HP ≈ +67, ATK ≈ +27 (เฉลี่ย Lv15→Lv40) แต่ **ตัว Lv15 เดิมลงสุสาน** และตัวสังเวยก็ลงสุสาน → `SPL-006` เรียกกลับ Lv15 ได้ (E-6) ทำให้ต้นทุนจริงต่ำกว่าที่ออกแบบ. ปัญหาเชิงความครอบคลุม: **32 จาก 39 สายไม่มีทางโต**; Lv99 ไม่มีใบเลย (กฎสังเวย 3 ใบ + ราคา Lv99 ไม่ได้ใช้).
7. **ร่างวิวัฒนาการบางตัวแย่กว่าตัวก่อนหน้าเมื่อเทียบเลเวล:** FOLLOW-YOU-040 (D 0.74), LALAPING-040 (D 0.73), TEE-040 (D 0.73) — จ่ายราคา Lv40 (500 แต้ม + สังเวย) แล้วยังอยู่ D; ขณะ 1GOKU-040/BADGUY-040 เป็น S. DEF ของร่างเก่าหาย (DEF regression, V2 §3) แต่ DEF = 0 ทุกใบอยู่แล้ว.
8. **การ์ดดึงไพ่:** MON-015 (S 1.68, ATK 40 + จั่ว 1 ฟรี) คือค่าเกินของโมเดลสูงสุด: บอดี้ ATK 40 + การ์ดฟรี. CHAEM/PK/FOLLOW-YOU-015 จั่ว 1 ฟรี ตามเพดานเรียก 1 ใบ/เทิร์น.
9. **Effect ที่แทบไม่มีค่า:** LORDNAM/LUCKY (ไม่ถูกเลือกเป็นเป้าเอฟเฟกต์ในเทิร์นที่เรียก ≈ +2%), LEON/OUFILLING (`to_graveyard` ATK+5 ชั่วเทิร์น ≈ +1%), TEE-015 (บัฟชั่วคราว +10 ≈ +3%), SOMYES (ATK−10 ชั่วเทิร์น ≈ +4%). ถือเป็น "ช่องว่างค่า" ที่แก้ด้วย Effect ได้จริง (ไม่ต้องแตะ HP/ATK).

### 5.3 Spells (ครบ 10) — ตามเอนจินจริง

| ID | ผล | การประเมิน |
|---|---|---|
| SPL-001 | ดาเมจ 20 (คิดธาตุ → สูงสุด 30) ใส่ 1 หน่วย | ปกติ. ≈ 24–35% ของ HP Lv15 เฉลี่ย; ฆ่าหน่วยที่ลดเลือดแล้ว/ JAOJAY HP 60 โดนธาตุ ×1.5 = 30 ไม่ตาย. **คุ้ม**; ถือเป็นอาวุธเคลียร์บอร์ดก่อนตีตรง (E-9). |
| SPL-002 | ฟื้น 30 | อ่อนกว่า unit effect (BABY ฟื้น 20 ฟรีตอนเรียก). วางไว้ใน stall deck. |
| SPL-003 | DEF +15 | **ข้อความว่า "จนจบเทิร์น" แต่เอนจินให้ถาวร และซ้อนได้ไม่จำกัด** (probe: 3 ครั้ง = DEF +45) — E-4. |
| SPL-004 | ATK +15 | เช่นเดียวกัน (ATK +45 = 75 รวม) — E-4. |
| SPL-005 | จั่ว 2 | ไม่มีเพดานต่อเทิร์น → +1 การ์ดสุทธิไม่มีต้นทุนบอร์ด; ใบที่ดีที่สุดโดยทั่วไป (E-5). |
| SPL-006 | Lv15 จากสุสานขึ้นมือ | ผูกกับ loop evolve/sacrifice/bounce (E-6). |
| SPL-007 | สลับตำแหน่งหน่วยฝ่ายเรา 2 ตัว (ข้ามฝั่งได้) | **รุนแรงที่สุด**: ขโมยหน่วยศัตรูโจมตีได้ทันที (probe: ขโมย FOLLOW-YOU-070 ATK 100, `stolenCanAttackSameTurn = true`) — E-3. |
| SPL-008 | ศัตรู 1 ตัวโจมตีไม่ได้ 1 เทิร์น | ดี (tempo) แต่สมเหตุสมผล. |
| SPL-009 | พิษ 5×3 เทิร์น = 15 | ต่ำ ถ้าเป็น chip. ไม่โต้ตอบกับ DEF (ดาเมจพิษตรง). |
| SPL-010 | ทำลาย trap หน้าคว่ำ 1 ใบ | สถานการณ์เดียว; ตอบ TRP ที่แรง. |

### 5.4 Traps (ครบ 10)

| ID | ผล | การประเมิน |
|---|---|---|
| TRP-001 | ยกเลิกการโจมตี | แรง/เรียบง่าย; ใช้ได้ครั้งเดียว. ป้องกัน lethal. |
| TRP-002 | สะท้อนครึ่ง | ใช้ได้ดีกับ ATK สูง (DNMAN 40+10). |
| TRP-003 | ครึ่งหนึ่งของดาเมจ LP ตรง | จำเป็นเพราะ LP 100 ตายเร็ว. |
| TRP-004 | ตัวที่เรียกโจมตีไม่ได้ 1 เทิร์น | ตรงกับกฎ "เรียกแล้วโจมตีไม่ได้" → **ซ้ำซ้อนในเทิร์นที่เรียก แต่ล็อกเทิร์นถัดไป**; ผลจริงเบา. |
| TRP-005 | ยกเลิกวิวัฒนาการ (EVO ทิ้ง) | **เป็นการ counter ที่ลงโทษหนักมาก** (เสีย EVO; ตัวสังเวยไม่เสีย ตามเอนจิน) — เฉพาะเด็ควิวัฒนาการ. |
| TRP-006 | ตัว ATK สูงสุดโดน 15 ตอนจบเทิร์นศัตรู | ดี กับบอร์ดเดี่ยว. |
| TRP-007 | ทุกตัวศัตรูโดน 5 ตอนเริ่มเทิร์น | ใช้ครั้งเดียว (ทุก trap ลงสุสานหลังทำงาน — `fire()` ใน `game.ts`) ทำ 5 ดาเมจกับทุกหน่วยศัตรูครั้งเดียว: คุ้มกับบอร์ดกว้าง (สูงสุด 7 ช่อง ≈ 35 ดาเมจรวม) แต่ต่ำกับบอร์ดแคบ. |
| TRP-008 | รอดด้วย HP 1 | คู่กับตัวฮีลเป็น stall (E-… §7). |
| TRP-009 | ส่งตัวโจมตีกลับมือ | tempo แรง; ผลข้างเคียง: รีเซ็ตเอฟเฟกต์ `on_summon` (E-6). |
| TRP-010 | จั่ว 1 เมื่อการ์ดลงสุสาน | สังเวยวิวัฒนาการเป็นเชื้อเพลิง (ทุกการสังเวยจั่ว). |

### 5.5 เอฟเฟกต์/คอมโบ/ซินเนอร์จี (จากข้อมูล)

| ครอบครัว | การ์ด | ข้อสังเกต |
|---|---|---|
| ATK +10 on_attack (1/เทิร์น) | 1GOKU, BAM, BAMMIE, BOBO, DNMAN, LINLADA, MELON, MIKI, NORMAN, PKXCY, THAI26 (11 ใบ Lv15) | บัฟ +10 ที่เหมือนกัน → ความต่างทั้งหมดมาจาก HP/ATK; ใบ ATK สูง (DNMAN, LINLADA, MELON) ได้ +10 บนฐานที่ใหญ่กว่า (+25–29%). |
| จั่วเมื่อเรียก | CHAEM, FOLLOW-YOU-015, MON, PK (ฟรี) / THOMAS (loot) | 4 ใบฟรี + มี SPL-005 → เด็คจั่วหนัก. |
| จั่วเมื่อฆ่า | GOD-WA, JAOJAY, NONG, WENDYWENDIE | เงื่อนไขอ่อนเมื่อ ATK ต่ำ (WENDY ATK 10 ฆ่าไม่ได้) → ตายตัว. |
| ฮีล | BABY, LALAPING, SATOSHI, SMILE, THAI32 | SMILE = ฮีล + ATK 35 (S); ที่เหลือ D/C. |
| ชิปดาเมจ on_summon | CUTIE, PIKACHU, ZEESKY (10) | ดาเมจต่อหน่วยเท่านั้น; ไม่ถึง LP. |
| บัฟพวก | SKYMOON (+10 ถาวร), TEE (+10 ชั่วคราว), FOLLOW-YOU-070 (+5 ทุกตัว), LALAPING-070 (HP +10 ทุกตัว) | SKYMOON ถาวรซ้อนได้ (ตามเรียกซ้ำ). |
| Combo | FOLLOW-YOU-040 | **ไม่ทำงาน** (trigger `combo` ไม่มีใน parser). |

ซินเนอร์จีที่มีผลจริง: **SPL-006 + on_summon** (เรียกซ้ำเพื่อจั่ว/ชิป), **วิวัฒนาการ + TRP-010** (สังเวยจั่ว), **LEON/OUFILLING + การสังเวย** (ATK+5 ต่อการ์ดลงสุสาน, 1 ครั้ง/เทิร์น — คุ้มค่า ~1% ตามโมเดล), **SKYMOON + อยู่นาน**.

### 5.6 Deck building / Meta ที่คาดการณ์

- เด็ค 40 ใบ, ≥3 Lv15, สูงสุด 3 ใบต่อการ์ด: ผู้เล่นจะเลือก **S-tier 3 ใบ × 7 ชื่อ = 21 ใบ** ครบเด็คได้ (CUTIE, DNMAN, LINLADA, MELON, MON, PIKACHU, SMILE) ทำให้ meta แคบ "aggro lightning/fire + chip".
- ต้นทุนไม่ต่างกันระหว่างใบ S กับ D ใน Lv15 (เรียกฟรีทั้งหมด) → **ไม่มีต้นทุนที่ถ่วงใบแรง** — เป็นสาเหตุหลักที่ meta แคบ (เมื่อ HP/ATK ล็อก ต้องใช้ Cost/กติกา).
- เด็ควิวัฒนาการแยก (≤15): มีผลเฉพาะ 7 สาย → ผู้เล่น 32 สายเล่นแต่ Lv15.
- ร้านค้า: Lv40 = 500 แต้ม (≈ 2–3 แมตช์ PvP ที่ได้ 200 แต้ม) ส่วน Lv40 ที่เป็น D ยังราคาเดียวกัน → ราคาไม่ผูกกับพลัง.

### 5.7 Exploits / ช่องโหว่ (verified หรือชี้ที่มา)

| ID | ช่องโหว่ | หลักฐาน | ความรุนแรง |
|---|---|---|---|
| X-1 | SPL-007 ขโมยหน่วยศัตรูที่โจมตีได้ทันที | probe `spl007` | **สูง** |
| X-2 | SPL-003/004 ซ้อนไม่จำกัด + ข้อความไม่ตรง (ถาวร) | probe `spl003x3`/`spl004x3` | สูง |
| X-3 | Evolution/ sacrifice → SPL-006 recycle; `once_per_game` รีเซ็ตตาม instance | probe `recursion`; E-6 | กลาง |
| X-4 | LALAPING-070 `on_evolve` ฟื้นเต็ม = ล้างดาเมจที่ "ติดตัว" (probe 20/160 → 320/320) | probe `lalaping070`; E-7 | กลาง |
| X-5 | SPL-005 ไม่จำกัดต่อเทิร์น (จั่ว 2 ซ้ำ) | probe `spellVolume` | กลาง |
| X-6 | Fusion pair ใหม่ = ทางลัดข้าม Evolution | §5.2 ข้อ 5 | ต่ำ (ตอนนี้) |
| X-7 | หน่วยที่ถูกบังคับไม่มีเพดาน LP-race: board ว่าง → ตีตรงเต็ม ATK | E-9 | กลาง |
| X-8 | การ์ด draft โหลดในห้องได้ (`status <> 'archived'`) | E-12 | ต่ำ |
| X-9 | ฟาร์มแต้ม PvP 2 บัญชี (ยังไม่บังคับใช้ anti-farming) | CLAUDE.md / `docs/PVP-ANTI-FARMING.md` | กลาง (เศรษฐกิจ ไม่ใช่เอนจิน) |

---

## 6. Card Balance Findings

ตารางเต็ม **ทุกตัวละคร (48)** อยู่ใน Appendix A. สรุป tier (Lv15): S = CUTIE, DNMAN, LINLADA, MELON, MON, PIKACHU, SMILE · A = BAM, BAMMIE, BOBO, GOD-WA · D = BABY, LALAPING-015, OUFILLING, SATOSHI-015, TEE-015, WENDYWENDIE (BADGUY-015 0.72 ก็ D). Lv40: S = 1GOKU-040, BADGUY-040; A = SATOSHI-040; B = NORMAN-040; D = FOLLOW-YOU-040, LALAPING-040, TEE-040. Lv70: FOLLOW-YOU-070 B, LALAPING-070 B (ทั้งสองมี effect ราคา ~+72%/+109% ในโมเดล แต่ Power× ≈ 1.0 เพราะ 2 ใบ).

Spells/Traps/EVO/FUS: ดู §5.3–5.4.

## 7. System-Level Findings

| ID | ระบบ | ปัญหา |
|---|---|---|
| S-1 | Stat model | HP×ATK กำหนด power ≈ 90%; เอฟเฟกต์ ≈ ±10% → การปรับสมดุลด้วย DEF/Effect ทำได้ จำกัด |
| S-2 | Element | nature −9, lightning +6, poison +3 (ไม่มีตัวแพ้), 2 ธาตุตาย, neutral/physical ไม่มี matchup |
| S-3 | Cost | Lv15 เรียกฟรีทุกใบ → ไม่มีต้นทุนถ่วงใบแรง |
| S-4 | Evolution | 7/39 สาย, ไม่มี Lv99, รีไซเคิลผ่านสุสาน, ร่างบางใบ D |
| S-5 | Fusion | pair เดียว; ราคาเทียบ Lv40 ต่ำกว่า |
| S-6 | LP-race | LP 100 + ตีตรงข้าม DEF → DEF ช่วยแค่ตอนยังมีบอร์ด; "LP ต่อห้อง" ยังไม่ implement (E-1) |
| S-7 | Stall | ฮีลทุกเทิร์น + TRP-008 + DEF (ถ้าเพิ่ม) → ต้องทดสอบ stall ก่อนเพิ่ม DEF ให้ healer |
| S-8 | Combo | ไม่ implement (E-8) |
| S-9 | Data drift | LP 3 ค่า (100/8000/8000), sacrifice map 3 รูปแบบ, `buildDeck()` ใส่ Lv40/70 ใน main ของบอท (E-2, E-10, E-11) |
| S-10 | Text vs engine | SPL-003/004 ข้อความ ≠ เอนจิน (D-4) |

---

## 8. Balance Proposal (Phase 3) — **ไม่แก้ข้อมูลจริง**

ข้อกำหนด: ไม่แตะ HP/ATK; ใช้เฉพาะ DEF, Effect (ถ้อยคำที่ parser รองรับ), Condition, Cost, Mechanic ที่กติกาปัจจุบันรองรับ. ทุกข้อ "ผลต่อเกม" เป็นการประมาณเชิงทฤษฎี.

### 8.1 Critical Imbalance

| # | ผู้ได้รับผล | ปัญหา | เหตุผล | วิธีแก้ | ผลต่อเกม | Priority |
|---|---|---|---|---|---|---|
| C-1 | SPL-007 | ขโมยหน่วยและโจมตีทันที | `stolenCanAttackSameTurn=true` | หน่วยที่ถูกสลับข้ามฝั่งต้อง "เพิ่งมาถึง" (ตั้ง `summonedTurn` = เทิร์นปัจจุบัน หรือ `attacked=true`) | ปิดการ swing ตัวใหญ่แบบทันที; ยังขโมยบอร์ดได้ | **P1** |
| C-2 | SPL-003 / SPL-004 | ซ้อนไม่จำกัด + ข้อความไม่ตรง | probe: DEF +45 / ATK +45 | จำกัด 1 ครั้ง/หน่วย/เทิร์น (หรือเพดานรวม +15) และทำให้ข้อความ = เอนจิน; ตัดสินใจ "ถาวร vs จนจบเทิร์น" | ปิด one-turn-kill (75 ATK) และ "ไม่ตาย" (DEF 45) | **P1** |
| C-3 | ระบบธาตุ | nature −9 / lightning +6 / poison ไร้ตัวแพ้ / 2 ธาตุตาย | §5.2 ข้อ 4 | (a) ตัวเลือกที่แนะนำ: เพิ่มตัวละครธาตุ wind/alchemy (ข้อมูลใหม่ ต้องอนุมัติ) **หรือ** (b) ย้ายแถวตายออก; แล้วให้ nature ชนะอย่างน้อย poison/water (Rule แก้ `elements.json`) | ลดอคติเลือกธาตุ; ต้อง re-run balance | **P2** |

### 8.2 Strong Cards

| # | การ์ด | ปัญหา | เหตุผล | วิธีแก้ (V2 ที่ยังใช้ได้) | ผล | Priority |
|---|---|---|---|---|---|---|
| ST-1 | MON-015 (1.68) | ATK 40 + จั่วฟรี | บอดี้แรง + ได้ไพ่ | เปลี่ยนเป็น loot (ทิ้ง 1 จั่ว 1) ซึ่ง parser รองรับ (THOMAS) | ลด Power ≈ −10% (1.68→1.51) | P2 |
| ST-2 | PIKACHU / CUTIE | ชิป 10 ตอนเรียก | แรงเพราะบอดี้ | ลดเป็น 5 | เล็ก (1.51→1.45) | P3 |
| ST-3 | DNMAN / LINLADA / MELON | +10 on_attack บนฐาน ATK สูง | S 1.48 | ลดเป็น +5 | 1.48→1.39 (ยังคง S) | P3 |
| ST-4 | SMILE-015 | ฮีล + ATK 35 | S 1.47 | ฮีล 10→5 | 1.38 | P3 |
| ST-5 | 1GOKU-040 / BADGUY-040 | S ในหมวด Lv40 | ชิปตอนตาย 20 + บัฟ | 1GOKU-040 ตอนตาย 20→10; BADGUY-040 บัฟ 25→20, ตอนตาย 20→15 | S→A | P3 |
| ST-6 | S-tier 7 ใบ × 3 | ไม่มีต้นทุนถ่วง | S-3 | (**Decision D-5**) จำกัดสำเนาตาม tier (เช่น S = 2 ใบ) ผ่านกติกา deck | ทำให้เด็คหลากหลายขึ้น; เป็นกติกาใหม่ | P2 |

หมายเหตุ: การลดค่าเอฟเฟกต์ไม่ปิดช่องว่างทั้งหมด (HP/ATK ล็อก) — เป็นข้อจำกัดที่ต้องบอก Owner.

### 8.3 Weak Cards

| # | การ์ด | ปัญหา | วิธีแก้ | ผล | Priority |
|---|---|---|---|---|---|
| W-1 | BABY-015 (0.33) | ATK 10 + ฮีล 20 ครั้งเดียว | DEF 5 + ฮีล 30 | 0.33→0.41 (ยังเป็น D; ต้องการบทบาท support ชัด) | P3 |
| W-2 | SATOSHI-015 (0.56) | HP 60 + ฮีล 10 | DEF 5 + ฮีล 15 | →0.70 | P3 |
| W-3 | WENDYWENDIE-015 (0.42) | ATK 10 ฆ่าไม่ได้ → จั่วไม่ทำงาน | DEF 5 + เปลี่ยนเป็น `on_attack` loot 1 ครั้ง/เทิร์น (ปลอดภัยกว่าจั่วฟรี; **Decision D-4**) | →0.55 | P3 |
| W-4 | TEE-015 (0.61) | บัฟชั่วคราวต่ำ | DEF 4 + ATK +15 | →0.70 | P3 |
| W-5 | LALAPING-015/040, OUFILLING, THAI32, LORDNAM, LUCKY, LEON, TAN, ZEESKY ฯลฯ | C/D | DEF 2–4 ตาม V2 | +0.07–0.10 แต่ไม่ถึง B | P3 |
| W-6 | FOLLOW-YOU-040 | D 0.74 + combo ไม่ทำงาน | ATK bonus +10→+20 + ตัดสินใจเรื่อง combo (D-3) | →0.81 | P2 |
| W-7 | LALAPING-040 / TEE-040 | D เมื่อเทียบ Lv40 | DEF 6 (ผ่านเกณฑ์ chain) | →0.82 | P3 |

### 8.4 Cards Requiring Rework

| # | การ์ด | ปัญหา | วิธีแก้ | Priority |
|---|---|---|---|---|
| R-1 | LORDNAM / LUCKY | เอฟเฟกต์ ≈ +2% (ป้องกันเอฟเฟกต์แต่โมเดลน้อย) | เปลี่ยนเป็น "ไม่ถูกเลือกเป็นเป้าของเอฟเฟกต์ศัตรูจนถึงเริ่มเทิร์นถัดไป" (ถ้อยคำใหม่ — ต้อง register ใน `effects.ts`) หรือให้ DEF 4 | P3 |
| R-2 | LEON / OUFILLING | ATK+5 ชั่วเทิร์น ≈ +1% | เป็นดึงไพ่/ฮีลเล็กเมื่อการ์ดลงสุสาน (1/เทิร์น) — ผูกกับ TRP-010 จึงทดสอบ loop | P3 |
| R-3 | BABY/SATOSHI/LALAPING (ฮีลเกือบทั้งหมด) | บทบาทเดียวกัน อ่อน | ให้ one-per-game "ฟื้นเต็ม" ที่ผูกกับตัวเอง หรือยก DEF/HP-aura (ผ่านเอฟเฟกต์) | P3 |
| R-4 | LALAPING-070 | `on_evolve` ฟื้นเต็มล้างโทษ "ติดดาเมจ" | ฟื้น 50% ของ HP หรือ 100 | P3 |

### 8.5 System-Level Issues (ข้อเสนอ)

| # | ระบบ | วิธีแก้ | ผล | Priority |
|---|---|---|---|---|
| SY-1 | Cost ถ่วงใบแรง (S-3) | ตัวเลือก: copy-limit ตาม tier (D-5) หรือ "Cost ผ่านการทิ้งการ์ด" บน S-tier ผ่านเอฟเฟกต์ loot | เด็คหลากหลายขึ้น | P2 |
| SY-2 | Evolution coverage | (D-6) เพิ่มสายวิวัฒนาการ (ข้อมูลการ์ด) หรือยอมรับว่ามีไม่ครบ; กำหนดราคา Lv99/ตัดกฎ Lv99 | ลดความเหลื่อมล้ำ 32 สาย | P2 |
| SY-3 | Evolution recycle | ตั้ง SPL-006 ห้ามเรียกการ์ดที่ถูก "วิวัฒนาการ/สังเวย" ในเทิร์นเดียวกัน หรือยอมรับ | ปิด loop ต้นทุน | P3 |
| SY-4 | LP-race | ตัดสินใจ LP ต่อห้อง (D-1) ก่อน balance ตัวเลขตรง | กำหนดฐานการคำนวณ | **P1 (decision)** |
| SY-5 | Stall | เพิ่มเทสต์ stall ก่อนใช้ DEF 5 กับ healer | กันเกมไม่จบ | P2 |
| SY-6 | Data drift | รวมค่า LP/sacrifice เป็นที่เดียว; ปรับ `buildDeck()` | ลดความสับสน | P3 |
| SY-7 | Draft ในห้อง | กรอง `published` เท่านั้น (D-8) | กันใช้การ์ดไม่พร้อม | P3 |

### 8.6 Combo Issues

| # | ประเด็น | วิธีแก้ | Priority |
|---|---|---|---|
| CB-1 | `combo` ไม่ implement; FOLLOW-YOU-040 ถูก publish gate บล็อก | (D-3) implement trigger `combo` (ต้องนิยามกติกา "ใช้ร่วมกับ") หรือถอดออก | P2 |
| CB-2 | SPL-006 + on_summon loop | ยอมรับ (ถูกจำกัดโดยเรียก 1/เทิร์น) + เทสต์ | P3 |
| CB-3 | TRP-010 + สังเวย | ยอมรับ; ตรวจว่าหนึ่ง TRP ใช้ครั้งเดียว | P3 |
| CB-4 | SPL-003/004 ซ้อน | = C-2 | P1 |

---

## 9. Implementation Plan + Test Plan (Phase 4 — เตรียมเท่านั้น)

**ความเป็นไปได้ในระบบปัจจุบัน (ตรวจกับ `parseEffect` และ `game.ts`):**

| งาน | ไฟล์ | ชนิด | ทำได้ไหม |
|---|---|---|---|
| ปรับค่า DEF ของการ์ด | `db/seed/toon-cards.json` + **migration ข้อมูล (เลข ≥ 024; 018–023 ยังไม่ apply)** | ข้อมูล | ได้ (DEF ถูกใช้ในสูตรแล้ว) |
| ปรับตัวเลข/ถ้อยคำเอฟเฟกต์เดิม | seed + registry (`effect-registry.ts`, `effect-text.ts`), ตรวจด้วย `parseEffect` | ข้อมูล | ได้ถ้าใช้ถ้อยคำที่รองรับ |
| loot แทน draw (MON, WENDY) | seed | ข้อมูล | ได้ (THOMAS ใช้อยู่) |
| ถ้อยคำใหม่ (LORDNAM/LUCKY/LEON/OUFILLING) | `effects.ts` parser + registry + `effect-text.ts` | โค้ดเอนจิน | ได้ ต้องเขียนเทส |
| แก้ SPL-007 | `game.ts` (`cast`) | เอนจิน | ได้ (ตั้ง flag หลังสลับข้ามฝั่ง) |
| จำกัด SPL-003/004 + แก้ข้อความ | `game.ts` + `spell-cards.json` + migration ข้อมูล | เอนจิน+ข้อมูล | ได้ |
| combo | `effects.ts` + `game.ts` | เอนจิน | ต้องกำหนดกติกาก่อน |
| เมทริกซ์ธาตุ | `db/seed/elements.json` (bundled → rebuild bundle) | กติกา | ได้; ต้องอนุมัติ |
| จำกัดสำเนาตาม tier | `gamedata.ts` (validate deck) + rule | กติกาใหม่ | ได้; ต้องอนุมัติ |

**ลำดับ (แต่ละขั้นอนุมัติแยก):** (0) ตัดสินใจ D-1…D-8 → (1) C-1 SPL-007, C-2 SPL-003/004 (เอนจิน+เทส) → (2) DEF + ค่าเอฟเฟกต์ที่ parse ได้ (ข้อมูลล้วน, V2) → (3) ถ้อยคำใหม่/rework → (4) ธาตุ + copy-limit (ถ้าอนุมัติ) → (5) rebuild `public/engine.js`, `public/admin-tools.js`, edge bundle; drift tests → (6) deploy ตามลำดับ CLAUDE.md.

**Test Plan:**
- Unit (vitest): `tests/game.test.ts` (SPL-007 swap แล้วโจมตีไม่ได้ในเทิร์นเดียวกัน; SPL-003/004 ซ้อน 3 ครั้งไม่เกินเพดาน), `tests/gameplay-fixes.test.ts`, `tests/support-cards.test.ts`, `tests/toon-cards.test.ts` (DEF/ค่าเอฟเฟกต์ใหม่ตรง seed), `tests/effect-registry.test.ts` + `tests/effect-text.test.ts` (ถ้อยคำใหม่), `tests/cards.test.ts`.
- Property/probe: รัน `scripts/card-balance-verify.ts` ซ้ำเทียบ `engine-probe-output.json`; ตรวจ monotonic DEF ตาม chain (V2); ตรวจ `parseEffect` ครบทุกแถวใหม่.
- Stall test: healer DEF 5 + TRP-008 vs aggro 5 ตา.
- Regression: drift tests ของ bundle; `npm test` เต็ม (≥484 ผ่าน); e2e `scripts/playtest-e2e.cjs` (local).
- Playtest จริงก่อนปรับตัวเลขรอบสอง: เก็บ `pvp_matches` ตาม Phase 1 anti-farming data เพื่อแทนโมเดลสมมติ.
- เกณฑ์ผ่าน: ไม่มี tier Lv15 ที่เกิน ±40% จากค่าเฉลี่ยที่แก้ได้ด้วยเอฟเฟกต์ (เป้าหมาย S ≤ 1.40, D ≥ 0.60) และไม่มีผลรวม DEF-loop.

---

## 10. Decision Required from Owner

| # | คำถาม | ตัวเลือก (แนะนำ) |
|---|---|---|
| D-1 | LP ต่อห้อง: จะ implement ไหม (ปัจจุบันตายตัว 100) | A เก็บ 100 ตายตัว (แนะนำ) / B ทำแบบปรับได้ → ต้อง re-balance |
| D-2 | SPL-007: แก้ให้ขโมยแล้วโจมตีทันทีไม่ได้ไหม | A ใช่ (แนะนำ) / B คงไว้ |
| D-3 | SPL-003/004: ถาวร หรือ "จนจบเทิร์น" ตามข้อความ + เพดานซ้อน | A จนจบเทิร์น 1 ครั้ง/หน่วย (แนะนำ) / B ถาวรแต่แก้ข้อความ |
| D-4 | WENDYWENDIE: จั่วต่อโจมตีทุกครั้ง หรือ loot | A loot 1/เทิร์น (แนะนำ) / B จั่วฟรี 1/เทิร์น |
| D-5 | จำกัดสำเนาตาม tier (S = 2 ใบ) เป็นกติกาใหม่ไหม | A ไม่ (ลองแค่ปรับเอฟเฟกต์ก่อน, แนะนำ) / B ใช่ |
| D-6 | Evolution: เพิ่มสาย/ตัด Lv99/กำหนดราคา Lv99 | ต้องการทิศทาง |
| D-7 | Combo: implement หรือถอดออก (FOLLOW-YOU-040) | ถอดออกก่อน (แนะนำ) / implement |
| D-8 | ธาตุ: เพิ่มตัวละคร wind/alchemy หรือเอาแถวตายออก + ปรับ nature | ต้องการทิศทาง |
| D-9 | Draft ในห้อง: ปิดไหม | ปิด (แนะนำ) |
| D-10 | Phase 1: อนุมัติ push `5b85f89` / merge / apply 018–023 / Deploy เมื่อไหร่; per-IP limit ต้องวัด header บน Production ก่อน | รอคำสั่ง |

## 11. Remaining Risks

1. Tier/Power× เป็นโมเดลสมมติ (ไม่มี win rate) — ต้อง playtest/`pvp_matches` ยืนยัน.
2. HP/ATK ล็อก → S/D tier ไม่หายด้วย DEF/Effect; ถ้า Owner ไม่เปิดให้แก้ ช่องว่าง ~±30% คงอยู่.
3. DEF เพิ่มได้เสี่ยง stall (healer + TRP-008).
4. ธาตุมีน้ำหนักกว่า DEF; แก้ธาตุเปลี่ยนทุกตัวเลข.
5. Phase 1: lint ไม่ใช่การพิสูจน์; CSP ยัง Report-Only; migration 018–023 ไม่ได้ apply; per-IP ยังไม่ทำงาน.
6. ตัวเลข spell/trap hard-code ตาม ID → rebalance ต้องแก้เอนจิน + rebuild bundle ทั้งสาม.
7. `5b85f89` ยังไม่ push (ความเสี่ยงสูญหายในเครื่องนี้เท่านั้น).

---

## Appendix A — ตัวละครทั้ง 48 ใบ (ข้อมูลจาก seed + โมเดลเดิม)

ที่มา: `db/seed/toon-cards.json`, `scripts/card-balance-model.ts` (รันผ่าน `parseEffect` จริง). Power× เทียบค่าเฉลี่ยเลเวลเดียวกัน.

| ID | Lv | ธาตุ | HP | ATK | DEF | โจมตี LP กี่ครั้ง (100) | Trigger | Power× | Tier | ธาตุ net (Lv15 pool) | ข้อสังเกต |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1GOKU-015 | 15 | fire | 84 | 20 | 0 | 5 | on_attack | 0.86 | C | -4 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| 1GOKU-040 | 40 | fire | 152 | 55 | 0 | 2 | on_attack+on_destroyed | 1.32 | S | -4 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| BABY-015 | 15 | holy | 70 | 10 | 0 | 10 | on_summon | 0.33 | D | 0 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| BACKJI-015 | 15 | water | 76 | 24 | 0 | 5 | on_attack | 0.87 | C | 1 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| BADGUY-015 | 15 | poison | 94 | 15 | 0 | 7 | on_attack | 0.72 | D | 3 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| BADGUY-040 | 40 | poison | 153 | 60 | 0 | 2 | on_attack+on_destroyed | 1.35 | S | 3 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| BAM-015 | 15 | fire | 95 | 25 | 0 | 4 | on_attack | 1.17 | A | -4 | แข็งแรง แต่อยู่ในกรอบ — เฝ้าดู |
| BAMMIE-015 | 15 | water | 95 | 25 | 0 | 4 | on_attack | 1.17 | A | 1 | แข็งแรง แต่อยู่ในกรอบ — เฝ้าดู |
| BOBO-015 | 15 | water | 80 | 30 | 0 | 4 | on_attack | 1.15 | A | 1 | แข็งแรง แต่อยู่ในกรอบ — เฝ้าดู |
| CHAEM-015 | 15 | neutral | 85 | 24 | 0 | 5 | on_summon | 1.01 | B | 0 | สมดุล |
| CUTIE-015 | 15 | nature | 90 | 35 | 0 | 3 | on_summon | 1.40 | S | -9 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| DNMAN-015 | 15 | lightning | 80 | 40 | 0 | 3 | on_attack | 1.48 | S | 6 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| FOLLOW-YOU-015 | 15 | dark | 90 | 20 | 0 | 5 | on_summon | 0.89 | C | 0 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| FOLLOW-YOU-040 | 40 | dark | 150 | 50 | 0 | 2 | on_attack+combo | 0.74 | D | 0 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| FOLLOW-YOU-070 | 70 | dark | 300 | 100 | 0 | 1 | on_evolve+passive | 1.01 | B | 0 | สมดุล |
| GOD-WA-015 | 15 | poison | 90 | 30 | 0 | 4 | on_attack | 1.20 | A | 3 | แข็งแรง แต่อยู่ในกรอบ — เฝ้าดู |
| I-M-GRAPE-015 | 15 | fire | 80 | 21 | 0 | 5 | turn_start | 0.94 | B | -4 | สมดุล |
| JAOJAY-015 | 15 | water | 60 | 40 | 0 | 3 | on_attack | 1.07 | B | 1 | สมดุล |
| LALAPING-015 | 15 | holy | 80 | 20 | 0 | 5 | turn_end | 0.75 | D | 0 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| LALAPING-040 | 40 | holy | 160 | 40 | 0 | 3 | turn_end | 0.73 | D | 0 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| LALAPING-070 | 70 | holy | 310 | 80 | 0 | 2 | on_evolve+passive | 0.99 | B | 0 | สมดุล |
| LEON-S-KENNEDY-015 | 15 | dark | 85 | 25 | 0 | 4 | to_graveyard | 0.88 | C | 0 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| LINLADA-015 | 15 | fire | 90 | 35 | 0 | 3 | on_attack | 1.48 | S | -4 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| LORDNAM-015 | 15 | dark | 85 | 25 | 0 | 4 | on_summon | 0.89 | C | 0 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| LUCKY-015 | 15 | water | 76 | 24 | 0 | 5 | on_summon | 0.77 | C | 1 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| MELON-015 | 15 | earth | 90 | 35 | 0 | 3 | on_attack | 1.48 | S | 1 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| MIKI-015 | 15 | physical | 85 | 24 | 0 | 5 | on_attack | 1.01 | B | 0 | สมดุล |
| MON-015 | 15 | poison | 85 | 40 | 0 | 3 | on_summon | 1.68 | S | 3 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| NONG-TAENGMO-015 | 15 | nature | 80 | 30 | 0 | 4 | on_attack | 1.07 | B | -9 | สมดุล |
| NORMAN-015 | 15 | physical | 94 | 18 | 0 | 6 | on_attack | 0.89 | C | 0 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| NORMAN-040 | 40 | physical | 150 | 50 | 0 | 2 | on_attack+turn_start | 0.92 | B | 0 | สมดุล |
| OUFILLING-015 | 15 | dark | 90 | 20 | 0 | 5 | to_graveyard | 0.75 | D | 0 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| PIKACHU-015 | 15 | lightning | 85 | 40 | 0 | 3 | on_summon | 1.51 | S | 6 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| PK-015 | 15 | neutral | 85 | 25 | 0 | 4 | on_summon | 1.05 | B | 0 | สมดุล |
| PKXCY-015 | 15 | physical | 85 | 24 | 0 | 5 | on_attack | 1.01 | B | 0 | สมดุล |
| SATOSHI-015 | 15 | holy | 60 | 20 | 0 | 5 | turn_end | 0.56 | D | 0 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| SATOSHI-040 | 40 | holy | 130 | 70 | 0 | 2 | turn_end+on_destroyed | 1.21 | A | 0 | แข็งแรง แต่อยู่ในกรอบ — เฝ้าดู |
| SKYMOON-015 | 15 | nature | 100 | 18 | 0 | 6 | on_summon | 0.93 | B | -9 | สมดุล |
| SMILE-015 | 15 | water | 90 | 35 | 0 | 3 | turn_end | 1.47 | S | 1 | แรงกว่าค่าเฉลี่ยเลเวล: โครงสร้างมาจาก HP×ATK (ล็อก) → แก้ด้วยการลดค่าเอฟเฟกต์รอง/เงื่อนไข ถ้าอนุมัติ |
| SOMYES-015 | 15 | lightning | 95 | 25 | 0 | 4 | on_summon | 1.02 | B | 6 | สมดุล |
| TAN-015 | 15 | water | 90 | 20 | 0 | 5 | on_summon | 0.81 | C | 1 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| TEE-015 | 15 | poison | 80 | 18 | 0 | 6 | on_summon | 0.61 | D | 3 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| TEE-040 | 40 | poison | 170 | 40 | 0 | 3 | on_evolve+turn_end | 0.73 | D | 3 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| THAI26-015 | 15 | physical | 85 | 24 | 0 | 5 | on_attack | 1.01 | B | 0 | สมดุล |
| THAI32-015 | 15 | holy | 100 | 18 | 0 | 6 | on_destroyed | 0.84 | C | 0 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |
| THOMAS-015 | 15 | fire | 95 | 25 | 0 | 4 | on_summon | 1.06 | B | -4 | สมดุล |
| WENDYWENDIE-015 | 15 | poison | 95 | 10 | 0 | 10 | on_attack | 0.42 | D | 3 | ต่ำ — DEF + ปรับเอฟเฟกต์ (V2) แต่ HP×ATK ยังเป็นเพดาน |
| ZEESKY-015 | 15 | lightning | 78 | 23 | 0 | 5 | on_summon | 0.80 | C | 6 | ต่ำกว่าเล็กน้อย — เพิ่ม DEF 2–4 (V2) |

## Appendix B — วิธีสร้างตัวเลข

`parseEffect` + `model()` + `tierOf()` จาก repo ถูกเรียกกับ seed โดยตรง (สคริปต์ชั่วคราว ไม่ได้ commit); เมทริกซ์ธาตุนับจากจำนวน Lv15 ในพูลต่อธาตุ; ผล probe เอนจินอ้างจาก `docs/card-balance/engine-probe-output.json` และ `docs/system-audit/ENGINE_RULE_AUDIT.md`.

## ผลรันซ้ำ (npm test บนเบรนช์ docs-only)

`npm test` บนเบรนช์ `docs/phase2-balance-audit`: **32 ไฟล์ / 484 เทสผ่าน (484/484)**, 336 วินาที.
