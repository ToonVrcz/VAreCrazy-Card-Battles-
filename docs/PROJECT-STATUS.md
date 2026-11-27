# VAreCrazy Card Battle — สถานะโปรเจกต์ (อัปเดต 2026-11-27)

ไม่มีรหัสผ่านหรือคีย์ลับในไฟล์นี้ (และห้ามใส่) · รายละเอียดเชิงเทคนิคและคำสั่งอยู่ใน `CLAUDE.md`

## 1. โปรเจกต์คืออะไร
- เกมการ์ดบนเว็บ `/play` (2 ผู้เล่น) + Admin CMS ที่ `/` เพื่อต่อกับ varecrazy.com/th ในอนาคต
- เจ้าของ: คุณ Toon (ตอบภาษาไทย สั้น ๆ ใช้งานจากมือถือ)
- เว็บจริง: https://varecrazy-card-battles.vercel.app (เกม `/play`, Admin `/`; `/play.html` ไม่ถูก route)
- Stack: TypeScript + Supabase (DB + edge function `api`) + Vercel · GitHub `ToonVrcz/VAreCrazy-Card-Battles-`

## 2. กฎเหล็ก
1. ห้าม deploy จนกว่า Toon จะพิมพ์ "Deploy" (push เข้า `main` = Vercel deploy อัตโนมัติ)
2. ลำดับ Deploy: apply migration → deploy edge function → merge `main` → ตรวจของจริง
3. ห้ามเปิดเผยรหัสแอดมิน · ห้าม force-kill สิ่งที่เจ้าของรันเอง · ห้ามเพิ่มค่าใช้จ่ายโดยไม่ถาม
4. Universe (`xaphdev/VAreCrazy_Project`) ยังไม่เชื่อมต่อ จนกว่าเกมจะเสร็จ (มีแค่ตัวเชื่อมที่เตรียมไว้)

## 3. สถานะ deploy ปัจจุบัน
| ส่วน | ค่า |
|---|---|
| main | `9a29b44` |
| Edge function `api` | v21 (stub → `edge-bundle.js` บน `tmp-edge-bundle-s7`) · rollback: s6 (v20), s5, s4, s3 — ห้ามลบ |
| Migration ที่ใช้แล้ว | ถึง 033 (020 ตั้งใจข้าม) · migration ถัดไป = 034 |
| การ์ด | 109 ใบเผยแพร่ครบ (ตัวละคร 48, เวท 35, กับดัก 24, อีโว 1, ฟิวชัน 1) |

## 4. สิ่งที่เล่นได้จริง
- เล่นกับบอท, ห้องออนไลน์/PvP (ใช้ได้ ยืนยัน 2026-11-27), เด็คหลายชุด, เด็คอีโว (สูงสุด 15), ร้านค้า, รางวัล, จับเวลาเทิร์น, ยอมแพ้
- กติกา: LP 100, มือ 5, สนามตัวละคร 7 ช่อง + แถวหลังเวท/กับดัก 5 ช่อง, ธาตุ ×1.5/×0.75 + UI เขียว/แดง, direct attack สูงสุด 60 LP
- Story (29 แถว), Fusion, Signature 39 ใบ, ความสามารถตัวละคร (55/56 ตามเอกสาร)
- **Game Synergy (B7)**: ตัวกลุ่มเกมเดียวกัน ≥2 ใบในสนาม → Max HP +3 / DEF +1–2 (Among Us DEF +1) เพดานต่อใบ HP +10 / DEF +4 แก้ค่าได้ใน Admin (เฉพาะเกมใหม่) · Lv40+ สืบทอดกลุ่มจาก Lv15 ของสายเดียวกัน
- Balance DEF Lv15 ใหม่ (migration 031) เกมยาวขึ้นราว 2.6 เท่า (ประมาณ 15 นาทีกับบอท / 25 นาที PvP) ตกลงยอมรับแล้ว
- Admin CMS: การ์ด, เอฟเฟกต์, Story, Signature, กฎ, ราคา, Synergy

## 5. ค้าง / ยังไม่ทำ
- ภาพการ์ด 18 ใบ (EVO-002..010, FUS-002..010): Toon อัปโหลดเองใน CMS · Signature 39 ใบยังเป็น placeholder
- ราคาร้านค้า Lv99: ยังไม่ตั้ง (ยังไม่มีการ์ด Lv99) ตั้งได้ใน Admin
- ปุ่มแจ้งปัญหา: ซ่อนอยู่จนกว่าจะตั้ง `FEEDBACK_URL` ใน `public/play.html` (ลิงก์ Google Form จาก Toon)
- ทดสอบมือถือ Android/iOS จริง · ทดสอบกันฟาร์ม PvP ด้วยหลายแมตช์จริง
- ยังไม่มีพรีวิวเกมทดสอบใน CMS · Admin Rule Builder ยังเป็นข้อความอิสระ
- Balance B1/B2/B4/B6 ไม่ทำ (เลือกเฉพาะ B3 = direct cap 60) · กับดักสวนกับดัก ยังไม่ทำ
- OG-1 (ทดสอบถอดรหัสแบ็กอัป): ข้ามไว้
- งาน UX/UI ของ Toon: สเปก/ต้นแบบอยู่ใน branch `ux/*`, `prototype/*`, `docs/ux-ui-*` (ยังไม่เข้า main)

## 6. Branch
- `tmp-edge-bundle-*` = จุดอ้างอิง rollback ห้ามลบ
- branch ที่ merge เข้า main แล้ว ลบได้ทาง GitHub
- branch เอกสาร/วิเคราะห์ (`analysis/*`, `audit/*`, `balance/*`, `docs/*`, `ai/coordination`) ไม่กระทบเกม
- `feature/hardening-1`, `fix/f04-publish-migration`: ไม่ใช้
