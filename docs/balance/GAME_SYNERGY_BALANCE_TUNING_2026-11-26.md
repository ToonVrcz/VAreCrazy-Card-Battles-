# Balance tuning experiments with Game Synergy ON (sim only) — 2026-11-26

Branch `analysis/full-game-balance-game-synergy-2026-11-26` · engine main 9b5adfd · **ไม่มีการแก้ engine/DB/การ์ดจริง** (DEF ปรับในหน่วยความจำของซิมูเลชันเท่านั้น ผ่าน `TUNE` ใน `analysis/synergy-sim/lib.ts`) · HP/ATK พื้นฐานไม่ถูกแตะ · Game Synergy = **B7** (ตารางที่เสนอ, cap HP+10/DEF+4, +HP เพิ่มเฉพาะ max) เปิดทุกการทดลอง

## วิธี
ปรับ **DEF ตามบทบาท** (กฎทั่วไป ไม่ผูกกับเด็คใด): การ์ดที่ ATK ฐาน ≤20 ได้ DEF +a, ATK 21–30 ได้ DEF +b, ATK ≥31 ได้ DEF +c · 34 ค่าที่ทดสอบ (grid a∈{0,4,8,12}×b∈{0,3,6,9}, แล้ว a∈{8,10,12}×b∈{3,6}×c∈{0,4,8}) · 30 เกม/คู่, Starter, Story 29 แถว, LP 100, cap 60 · ความคลาดเคลื่อน ±5.7 pt

## ผล (ค่าที่ใกล้กรอบที่สุด)
| DEF+ (ATK≤20 / 21–30 / ≥31) | Aggro | Tank | Heal | Combo | Control | Random | ในกรอบ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 / 0 / 0 (ปัจจุบัน + B7) | 90.0 | 10.6 | 48.0 | 58.3 | 28.3 | 64.7 | 2/6 |
| 8 / 6 / 0 | 77.0 | 40.3 | 45.0 | 62.0 | 18.7 | 57.0 | 2/6 |
| 10 / 6 / 0 | 75.3 | 57.0 | 46.7 | 56.0 | 12.3 | 52.7 | 3/6 |
| **12 / 9 / 0 (ใกล้สุด)** | **62.3 ✅** | 60.7 (เกิน 55) | 43.0 (ต่ำกว่า 45) | **57.7 ✅** | **19.7 ❌** | 56.0 (เกิน 55) | 2/6 |
กรอบเป้าหมาย: Aggro 55–65, Tank 40–55, Heal 45–55, Combo 50–60, Control 45–55, Random 45–55
- ค่า c>0 (เพิ่ม DEF ให้การ์ด ATK สูง) แย่ลงทุกกรณี → ไม่แนะนำ
- **DEF แบบมีบทบาทดึง Aggro จาก 90% ลงมาอยู่ในกรอบได้ (62%)** โดยไม่แตะ ATK/HP — ยืนยันว่า DEF เป็นคันโยกที่ใช้ได้ถ้าก้อนใหญ่พอ (+12/+9 ไม่ใช่ +1–4)
- Tank/Heal เข้าใกล้กรอบ (Tank เกิน, Heal ต่ำนิด) ปรับละเอียดได้ ราว a=10–11 / b=8–9

## ปัญหาที่เหลือ: Control (19.7%)
DEF ช่วยไม่ได้ เพราะ **การ์ดของเด็ค Control เป็นการ์ดเงื่อนไขแคบ**: SPL-010 (ทำลายกับดักที่คว่ำ), TRP-005 (ยกเลิกวิวัฒนาการ), SPL-007 (สลับที่), TRP-004 (ห้ามโจมตีตัวที่เพิ่งลง) — ในแมตช์ Starter ที่ศัตรูแทบไม่วิวัฒนาการ/วางกับดัก การ์ดเหล่านี้มักตายค้างมือ ⇒ **ปัญหาเป็นดีไซน์การ์ด Control ไม่ใช่ค่าสถานะ** ต้องมีเครื่องมือที่ใช้ได้ทุกเกม (เช่น หน่วงการโจมตี, ฮีล/โล่ระยะสั้น) ซึ่งเป็นการเพิ่ม/แก้การ์ด ต้องขออนุมัติ

## ข้อควรระวัง
- DEF ตามบทบาทนี้ **ไม่ใช่ค่าที่พร้อมใช้งานจริง**: ปรับให้เหมาะกับเด็คทดสอบ 5+1 ชุดและ Bot; ต้องตรวจกับเด็คสุ่ม/ผู้เล่นจริงก่อน (Random ขยับ 64.7 → 56 ถือเป็นสัญญาณที่ดีว่าไม่ overfit มาก)
- การเพิ่ม DEF ทั้งสายยืดเกม (เทิร์นเฉลี่ยเพิ่ม) และกระทบ Fusion/Story/Signature (ดาเมจ 120/180 ลดลงตาม DEF ของเป้าหมาย) — ยังไม่ได้วัดรอบสอง
- ต้องตัดสินใจ (Owner): เปลี่ยน DEF ฐานของการ์ดจริงตามกฎบทบาทหรือไม่ (ห้ามแตะเฉพาะ HP/ATK ตามที่สั่ง; DEF ไม่ได้ห้าม แต่เป็นการแก้ข้อมูลการ์ดจริง จึงยังไม่ทำ)

## ไฟล์/คำสั่ง
เพิ่ม: `analysis/synergy-sim/run-tune.sh`, `run-tune2.sh`, `grid.py`, `out/tune*.json|log`; แก้: `analysis/synergy-sim/lib.ts` (เพิ่ม `TUNE`, ใช้เฉพาะเมื่อตั้ง env) · คำสั่ง: `./run-tune.sh` แล้ว `./run-tune2.sh` แล้ว `python3 grid.py`

## Addendum — กฎใหม่ของ Owner: การ์ดในร้านค้าไม่เข้าร่วมการคำนวณสมดุล (2026-11-26 18:15)
- **ขอบเขต:** นับเป็น "การ์ดร้านค้า" = ตัวละคร Lv40/70/99 และ Signature spell/trap 39 ใบ (300 แต้ม) · **การ์ดฟรี** = ตัวละคร Lv15, Spell SPL-001..010, Trap TRP-001..010, EVO-001, FUS-001
- ผลที่ผ่านมาที่ใช้ Starter ล้วน (ชุดหลัก, ตารางข้างบน, tune/tune3) **ไม่มีการ์ดร้านค้าอยู่แล้ว**; ที่ปนคือเฉพาะ "Advanced round-robin" และ "mirror" ในรายงาน synergy → **ให้ถือว่าไม่ใช่ส่วนของการบาลานซ์** (ใช้เป็นข้อมูลอ้างอิงเรื่อง progression เท่านั้น)
- โค้ดล็อกไว้แล้ว: `run.ts` ตรวจและ **หยุดทันที** ถ้าเด็ค Starter มีการ์ดร้านค้า/ชุด Evolution (พิมพ์ `check: no shop cards in Starter decks`) · `TUNE` ปรับ DEF เฉพาะตัวละคร Lv15 (ไม่แตะ Lv40+)
- ค้นหาละเอียดใหม่ (การ์ดฟรีล้วน, Game Synergy B7 เปิด, 9 ค่า, `./run-tune3.sh`):

| DEF+ (ATK≤20 / 21–30) | Aggro | Tank | Heal | Combo | Control | Random | ในกรอบ | เทิร์นเฉลี่ย Aggro/Tank |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **12 / 10** | **59.0 ✅** | **53.7 ✅** | **46.3 ✅** | 62.7 (เกิน 60) | 22.7 ❌ | **55.0 ✅** | **4/6** | 27 / 54.8 |
| 12 / 8 | 61.7 ✅ | 64.0 ❌ | 47.3 ✅ | 55.3 ✅ | 16.3 ❌ | 54.6 ✅ | 4/6 | 26 / 54.6 |
| 11 / 10 | 62.3 ✅ | 47.0 ✅ | 44.7 | 65.7 | 22.7 | 57.7 | 2/6 | 26.3 / 53.1 |
- **ดีที่สุด: DEF +12 (ATK≤20) / +10 (ATK 21–30)** → Aggro, Tank, Heal, Random เข้ากรอบ; Combo เกินเล็กน้อย (62.7), **Control ยังต่ำ (22.7)** (สาเหตุเป็นดีไซน์การ์ด Control ตามที่ระบุข้างบน)
- ⚠ **ต้นทุนสำคัญ:** เกมยาวขึ้นมาก — เฉลี่ย Aggro 19.5 → 27 เทิร์น, **Tank 28 → 55 เทิร์น** (เทิร์นละสูงสุด 90 วินาทีในโหมดออนไลน์) ⇒ DEF ก้อนใหญ่แก้ win-rate แต่ทำให้เกมช้าลงเกือบเท่าตัว ต้องมีกลไกควบคู่ (เช่น ลดดาเมจ direct cap / เพิ่มทางจบเกม) หรือเลือกค่าที่เบากว่า (เช่น 10/9: เทิร์น ≈ 25 แต่ Aggro 68.7)

---
## Addendum 2026-11-26 (evening): shortening games & a Control kit (simulation only)

Setup: Starter free cards only (shop cards excluded), DEF-by-role 12/10, Game Synergy B7, 30 games/pair (~300 games/archetype, 95% CI ≈ ±5.7 pt). No production change.

### 1) Shortening games
| Config | Aggro | Tank | Heal | Combo | Control | Random | Tank turns |
|---|---|---|---|---|---|---|---|
| LP 100 (ref) | 59.0 | 53.7 | 46.3 | 62.7 | 22.7 | 55.0 | 54.8 |
| LP 80 | 58.7 | 53.3 | 46.3 | 63.3 | 22.3 | 55.3 | 54.6 |
| LP 60 | 57.7 | 53.3 | 46.3 | 64.3 | 22.7 | 55.0 | 54.2 |
| LP 50 | 57.0 | 53.3 | 46.3 | 64.7 | 23.0 | 55.0 | 54.0 |
| directCap none / 80 | identical to ref (direct hits rarely exceed 60) |
| Deck 30 cards | 55.3 | 47.7 | 59.0 | 50.3 | 16.0 | 71.3 | 43.1 |

Finding: **LP is not the clock.** ~62% of Tank/Heal games end by deck-out (lpWinPct 35–38%), so lowering LP or the direct-attack cap changes nothing. The real clock is deck size/draw. A 30-card deck shortens games ~20% but reshuffles balance (Random 71%, Heal 59%) — would need re-tuning; it is also a deck-building rule change (owner decision).

### 2) Control kit (sim-only linked support cards from existing ops; replaces SPL-010, SPL-007, TRP-004, TRP-005)
| Kit | Control win % |
|---|---|
| none (ref, DEF 12/10) | 22.7 |
| v1 defence + heal + draw 2 | 9.7 (LP80) / not better |
| v2 defence traps + heal | 14.0 |
| v3 damage spell + ATK buff + trap | 17.7 |

Finding: **no kit helped; all were worse than the current Control.** Draw cards speed up the owner's own deck-out; defensive tools do not offset the ATK gap; support cards need a linked unit on the field, so they are often dead. Control's fix is not "more tools" — it needs its stats/identity changed (owner design), or the archetype band lowered.

### Recommendations (owner decision needed)
1. Keep DEF 12/10 by role as the main lever (4/6 archetypes in band), accept long games or consider a 30-card deck rule separately.
2. Do not add the tested Control kits. Options: raise Control Lv15 ATK/DEF directly, or accept a lower band (e.g. 30–45).
Scripts: `analysis/synergy-sim/run-ctl.sh`, `run-ctl2.sh`, `run-ctl3.sh` (env `CTL`, `CTL_V`, `DECK`, `LP`, `CAP`); outputs `analysis/synergy-sim/out/`.
