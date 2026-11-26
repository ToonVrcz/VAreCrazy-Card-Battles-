# Game Synergy — Full-Game Balance Simulation Report

วันที่ 2026-11-26 · Branch `analysis/full-game-balance-game-synergy-2026-11-26` · งานนี้ **วิเคราะห์ + ซิมูเลชันเท่านั้น** (ไม่มีการแก้ engine/การ์ด/กฎ/DB/CMS, ไม่ merge, ไม่ deploy)

## 0. Executive summary (ภาษาง่าย)
1. **Game Synergy ตามค่าที่เสนอ (+3 HP, +1/+2 DEF, ATK 0) แทบไม่เปลี่ยนสมดุล** — Aggro ยังชนะ ≈ 90–93%, Tank ≈ 11–12%, Control ≈ 25–30% ในทุกแบบที่ทดสอบ (เกินความคลาดเคลื่อน ±5.7 pt แทบไม่มี ยกเว้นข้อ 2)
2. **ข้อยกเว้นเดียวที่เห็นผลจริง:** แบบ **ไม่มี cap** (B2) ทำให้ Tank ชนะ 11.7% → **19.1%** (N=900 เกม/ค่า, ≈ 3σ) เพราะตัวละคร Tank อยู่หลายกลุ่มเกมและบวก DEF ได้ถึง +7 แต่ **cap HP+10/DEF+4 (B3) ลบผลนี้หมด** (Tank 11.8%) และ B2 ทำให้ Control แย่ลง (30.7 → 24.7)
3. **ทำไมไม่พอ:** Aggro เฉลี่ย ATK 37.9 / Tank ATK 17.4 (ต่างกัน 2.2 เท่า) แต่ DEF ของการ์ด Lv15 อยู่ช่วง 0–5 และ synergy ให้ DEF ได้มากสุด +4 → ลดดาเมจต่อฮิตแค่ ≈ 4 จาก ≈ 34 (≈ 12%) เพื่อให้ Tank ทน Aggro ได้เท่าที่ Tank ตีกลับ ต้อง DEF ≈ 21
4. **Synergy ทำงานเกือบตลอดเวลา** (บูสต์ 87–96% ของยูนิตทุกเทิร์น) เพราะ Among Us มีสมาชิก 41 ใบ ⇒ มันกลายเป็น "ค่าพื้นฐานของเกม" ไม่ใช่เงื่อนไขที่ต้องสร้างเด็คเพื่อให้ได้ (ขัดกับเจตนา Synergy)
5. **พบช่องโหว่:** โหมดที่ +HP เพิ่มทั้ง max และ current (เหมือน Story HP-aura) ทำให้ออก-เข้าใหม่แล้วฮีลซ้ำ (45 HP / 5 รอบ) → ถ้าจะใช้ ต้องเป็น **max-HP only (B7)**
6. **ข้อสรุปคำแนะนำ: REVISE** — ไม่ควรติดตั้งค่าที่เสนอตามเดิมเพื่อหวังแก้ Aggro/Tank มันเป็นแค่ flavor; ถ้าต้องการให้เป็นเครื่องมือสมดุลต้องเปลี่ยนโครงสร้าง (ดูข้อ 9)

## 1. Provenance / reproducibility
| | |
|---|---|
| Engine/source | `main` = **9b5adfd** (production ปัจจุบัน) — ไม่มี P1 (P1 = `fix/fusion-self-story-p1` 6189690, ไม่ merge) |
| Branch / docs base | `analysis/full-game-balance-game-synergy-2026-11-26` (handoff ee3260c; audit 8ce9c6a อยู่ใน history) |
| Commit ของรายงานนี้ | commit ที่เพิ่มไฟล์นี้บน branch (ดู `git log -1 -- docs/balance/GAME_SYNERGY_SIMULATION_REPORT_2026-11-26.md`) |
| Bot | `src/engine/bot.ts` (Bot AI รอบ 2) ทั้งสองฝั่ง, seed เกม `7000+n` (ชุดหลัก) / `9000+…` (mirror) สลับผู้เล่นแรกทุกเกม |
| ข้อมูล | Story **29 แถว** (db/seed/story-links.json บน 9b5adfd, ตรวจซ้ำแล้วไม่ซ้ำ) · Fusion **37 คู่** (production, SELECT อ่านอย่างเดียว) · ตัวละคร 48 (stat ใน seed = production ตรวจแล้ว 48/48) · Signature 39 · Spell 10 / Trap 10 · EVO-001, FUS-001 · LP 100, direct cap 60 |
| Game affiliations | production `card_affiliations` snapshot (46 การ์ด: 38 Lv15, 7 Lv40, 1 Lv70 = FOLLOW-YOU-070) — **ไม่มีสมาชิก WarZ เลย** (ค่า WarZ ในตารางจึงไม่ถูกใช้) |
| ขนาดตัวอย่าง | ชุดหลัก 30 เกม/คู่ลำดับ (900 เกม/ค่า ต่อ archetype ≈ 300 เกมต่อ archetype); ชุดติดตามผล N=90 (2,700 เกม/ค่า); mirror 240 เกม/ค่า |
| ความคลาดเคลื่อน | binomial SE ≈ 2.9 pt (N=300 เกม/archetype), 95% ≈ ±5.7; ของ N=900 ≈ ±3.3. ผลต่าง < ~6 pt ในชุดหลักอย่าตีความว่าจริง |
| Baseline reproduce | base (ไม่มี synergy) ให้ Aggro 92.3 / Combo 58.7 / Random 59.7 / Heal 48.7 / Control 29.3 / Tank 11.4 — **ตรงกับ baseline ในเอกสาร handoff ทุกตัว** |

**คำสั่งทั้งหมด** (รันจาก `analysis/synergy-sim/`):
```
./run-all.sh                 # ชุดหลัก 13 configs (2 คิวขนาน ≈ 8 นาทีบน 2 core)
./run-big.sh                 # ติดตามผล N=90: base, B2, B3
SYN=base npx tsx mirror.ts ; SYN=B3 npx tsx mirror.ts   # Starter vs Advanced แบบคุมตัวแปร
npx tsx exploit.ts           # Stage D (ทดสอบช่องโหว่/regression) -> ALL PASSED
python3 summarize.py > out/summary.md                    # ตารางทั้งหมด (ไฟล์เต็ม out/summary.md)
```
Deck: 5 archetype ในพูล Starter (Aggro/Tank/Heal/Combo/Control; ชื่อ chain ทั้ง 7 + spell/trap ใน `run.ts`) + Random (7 chain สุ่ม) · "Advanced tier" = มี EVO-001 ×3, Lv40/70 ของ chain นั้น ≤15 ใบ, และ Signature ที่ผูกกับ chain (ดูข้อจำกัด 8.1)

## 2. โมเดล Game Synergy ที่จำลอง (แยกจาก production)
ใส่เป็น **aura ภายนอก** หลัง `act()` แต่ละครั้ง (`analysis/synergy-sim/synergy.ts`) ไม่มีการแก้ `src/engine` · ไม่มีฟิลด์ ATK ในโมเดล (ATK = 0 โดยโครงสร้าง) · ตามตาราง handoff (+3 HP ทุกกลุ่ม; DEF 2/1/2/2/1/1/2/1/2)
- เปิดเมื่อ ≥2 **ยูนิตที่ต่างกัน** ของฝั่งเดียวกันอยู่กลุ่มเดียวกัน · ปิดทันทีเมื่อเหลือ 1 · ใบที่ 3+ ไม่คูณ
- ยูนิตที่ฟิวชั่นใช้กลุ่มของ "การ์ดบน" เท่านั้น · การ์ดที่ไม่มีแถว affiliation (เช่น Lv70/99 ส่วนใหญ่) **ไม่มีกลุ่ม**
- variants: **B2** ตารางตามเสนอ ไม่ cap · **B3** + cap HP+10/DEF+4 · **B4** ผู้รับ = ทุกยูนิตฝ่ายเดียวกัน (+cap) · **B5** HP อย่างเดียว · **B6** DEF อย่างเดียว · **B7** B3 แต่ +HP เพิ่มเฉพาะ max (ไม่ฮีล)
- engine จริง: HP ของยูนิตเก็บเป็น `maxHp` + `hp`; Story HP-aura เพิ่มทั้งสองตอนคู่เข้า (จึงมี quirk ฮีลซ้ำ) — ใน B2–B6 โมเดลทำเหมือนกันโดยตั้งใจ (`grow`), B7 คือทางเลือกที่ไม่ฮีล

## 3. ผลหลัก — Stage B (Starter, Story on, Fusion on)
Win rate % (ต่อ archetype รวมทุกคู่ต่อสู้):

| Config | Aggro | Tank | Heal | Combo | Control | Random |
|---|---:|---:|---:|---:|---:|---:|
| **base (ไม่มี synergy)** | 92.3 | 11.4 | 48.7 | 58.7 | 29.3 | 59.7 |
| B2 ตาราง ไม่ cap | 90.7 | 20.3 | 49.3 | 56.3 | 25.0 | 58.3 |
| B3 + cap HP10/DEF4 | 91.0 | 11.3 | 49.3 | 61.0 | 27.0 | 60.4 |
| B4 ผู้รับ = ทุกยูนิต | 91.3 | 12.7 | 49.7 | 59.6 | 27.0 | 59.7 |
| B5 HP เท่านั้น | 89.7 | 12.3 | 49.7 | 56.7 | 28.7 | 63.0 |
| B6 DEF เท่านั้น | 90.0 | 12.7 | 47.3 | 58.3 | 28.0 | 63.7 |
| B7 max-HP เท่านั้น | 90.0 | 10.6 | 48.0 | 58.3 | 28.3 | 64.7 |

ติดตามผลด้วย N=90 (2,700 เกม/ค่า):

| Config | Aggro | Tank | Heal | Combo | Control | Random |
|---|---:|---:|---:|---:|---:|---:|
| base | 92.9 | 11.7 | 52.3 | 58.0 | 30.7 | 54.4 |
| B2 (ไม่ cap) | 91.9 | **19.1** | 53.0 | 58.4 | **24.7** | 52.9 |
| B3 (cap) | 92.5 | 11.8 | 53.0 | 60.9 | 27.3 | 54.6 |

ตัวเลขเพิ่มเติม (เทิร์นเฉลี่ย, ดาเมจ/เทิร์น ทั้งสองฝั่งรวมยูนิต+LP, ตายต่อเกม, direct ต่อเกม, % จบด้วย LP, coverage) ครบทุก config อยู่ใน `analysis/synergy-sim/out/summary.md`. สรุปย่อ (base → B3): เทิร์น Aggro 19.5→18.5, Tank 28.1→29.1, Heal 25.3→27.3; ดาเมจ/เทิร์นรวม ≈ 61–69 → 63–72 (+3–5%); ตายต่อเกม ≈ เดิม (±1); direct/เกม 3.2–4.6 เท่าเดิม; **เกมจบด้วย LP 87–100% ทุก config** (ไม่ใช่ deck-out); coverage ของ synergy 87–96%.

**Target band (Starter, Story on):** base ผ่าน 2/6 (Heal, Combo) · B2 2/6 · **B3 1/6** (Combo ออกนอกกรอบ 61) · B4 2/6 · B5 2/6 · B6 2/6 · B7 2/6. **ไม่มี config ใดทำให้ Aggro (≤65) / Tank (≥40) / Control (≥45) เข้ากรอบ**

ผลของ Story/Fusion ต่อ synergy (base → B3): Story ปิด Combo 50.3→51.3; Story เปิด 58.7→61.0 · Fusion ปิด Combo 56.0→57.7 ⇒ **Synergy ไม่ทำปฏิกิริยากับ Story/Fusion อย่างมีนัยสำคัญ** (Story ยังให้ Combo +7–9 pt แยกต่างหาก ตามที่รายงานก่อนหน้า)

## 4. Matchup matrix (Starter, Story on; แถวชนะคอลัมน์ %)
base:

| | Aggro | Tank | Heal | Combo | Control | Random |
|---|---:|---:|---:|---:|---:|---:|
| Aggro | – | 100 | 96.7 | 86.7 | 95 | 83.3 |
| Tank | 0 | – | 6.7 | 11.7 | 31.7 | 6.7 |
| Heal | 3.3 | 93.3 | – | 31.7 | 80 | 35 |
| Combo | 13.3 | 88.3 | 68.3 | – | 71.7 | 51.7 |
| Control | 5 | 68.3 | 20 | 28.3 | – | 25 |
| Random | 16.7 | 93.3 | 65 | 48.3 | 75 | – |

B3: Aggro v Tank 100, v Heal 95, v Combo 81.7, v Control 95; Tank v Control 35; Heal v Combo 26.7; Combo v Control 73.3 — **ทุกคู่ขยับ ≤ ~7 pt ไม่มีคู่ไหนพลิกผล** (matrix เต็ม B3 และ B7 ใน `out/summary.md`)

## 5. Aggro vs Tank/Heal/Control, Combo vs Control (สาเหตุของ outlier)
| Deck (7 chain Lv15) | HP เฉลี่ย | ATK เฉลี่ย | DEF เฉลี่ย | ATK สูงสุด | DEF สูงสุด |
|---|---:|---:|---:|---:|---:|
| Aggro | 82.9 | **37.9** | 0.4 | 40 | 1 |
| Tank | 87.7 | 17.4 | 4.0 | 20 | 5 |
| Heal | 79.7 | 21.0 | 3.4 | 35 | 5 |
| Combo | 80.7 | 24.9 | 1.7 | 40 | 5 |
| Control | 86.3 | 23.4 | 2.4 | 25 | 3 |
| การ์ด Lv15 ทั้งหมด | 85.4 | 25.1 | 2.2 | DEF ช่วง 0–5 | |
- **สาเหตุ Aggro:** ATK เฉลี่ยสูงกว่าทุกเด็ค 1.5–2.2 เท่า ขณะที่ HP ใกล้เคียงกันทั้งหมด (80–88) ⇒ ฮิตต่อ HP สูงสุดและ "tank" ไม่มีส่วนต่าง HP ให้ใช้ · **สาเหตุ Tank:** ชื่อ Tank แต่ DEF เพิ่มแค่ +3.6 และ ATK ต่ำสุด ⇒ ตีเบาและทนไม่ต่าง · ผลคือ DEF/HP แทบไม่มีบทบาทเชิงกลยุทธ์ใน Lv15 (DEF 0–5 เทียบ ATK 10–40)
- **Control:** ไม่มีเครื่องมือหยุด Aggro (ส่วนใหญ่ spell ผลต่อเนื่อง); Combo ชนะ Control 71–73% ผ่าน Fusion/Story ไม่ใช่ synergy
- **ข้อสรุป:** ปัญหาอยู่ที่ **ช่องว่าง ATK ของการ์ด Lv15 และการขาดกลไกลดดาเมจ** ไม่ใช่การขาด HP/DEF เล็กน้อยที่ synergy ให้ (ห้ามแก้ base HP/ATK ⇒ ต้องใช้ Spell/Trap/Effect/ค่า DEF ผ่าน aura ที่ใหญ่กว่านี้)

## 6. Starter vs ระดับสูง (Stage C)
Archetype round-robin (Story on):

| Config | Aggro | Tank | Heal | Combo | Control | Random |
|---|---:|---:|---:|---:|---:|---:|
| Starter base | 92.3 | 11.4 | 48.7 | 58.7 | 29.3 | 59.7 |
| Advanced base | 80.0 | 13.7 | 43.0 | 38.3 | 38.0 | 87.0 |
| Advanced + B3 | 80.7 | 16.7 | 46.0 | 40.3 | 30.7 | 85.7 |

⚠ **Advanced round-robin ใช้ตัดสิน Pay-to-Win ไม่ได้**: ในข้อมูลมีเพียง **7 chain** ที่มีฟอร์ม Lv40+ ดังนั้น deck "Random" (สุ่ม chain) มี extra เต็มกว่าเด็ค archetype จึงชนะ 87% และ archetype ได้ extra น้อย
**Mirror แบบคุมตัวแปร** (`mirror.ts`: chain ชุดเดียวกัน 7 chain ที่มีฟอร์ม; ฝั่งหนึ่งเพิ่ม Evolution+Lv40/70 [+Signature], 240 เกม/ค่า): ฝั่ง **Starter ชนะ**

| ฝั่ง Advanced เพิ่มอะไร | Starter ชนะ (base) | Starter ชนะ (+B3) |
|---|---:|---:|
| Evolution card + ฟอร์ม Lv40/70 | **23.3%** | 28.3% |
| + Signature ที่ผูก chain | **33.3%** | 39.6% |
→ **Starter ยังเอาชนะได้ ~⅓–¼ ของเกม แต่ตามหลังชัดเจน** (ขอบเขตเท่ากับ "คนเสียเงินได้เปรียบ" ในระดับสูง — เกินแนวคิด Pay for Progression ถ้าถือว่าควร ≈ 40–45%) · B3 ช่วย Starter ≈ +5–6 pt (ค่า synergy ให้ทั้งสองฝั่ง แต่ฝั่ง Starter มักมีกลุ่มเต็มกว่าเพราะ Lv15 สมาชิกเยอะกว่า Lv70) · ข้อสังเกต: Lv40+ ส่วนใหญ่ไม่มี affiliation ในข้อมูล (46 การ์ดเท่านั้น; Lv70+ มี 1 ใบ) จึง **เสียสิทธิ์ synergy เมื่อวิวัฒนาการ**
Signature + Spell/Trap + ธาตุ: ดาเมจเพดาน 120/180 ที่ audit รายงานไม่เปลี่ยนด้วย synergy (ATK ไม่ถูกแตะ); synergy ลดดาเมจต่อฮิตเพียง 1–4 (ดู ข้อ 5)

## 7. Stage D — Exploit/Regression (`exploit.ts`: ALL PASSED)
| ตรวจ | ผล |
|---|---|
| เปิดที่ 2 ยูนิตพอดี / ปิดทันทีเมื่อเหลือ 1 | PASS (TEE DEF 4→8, maxHP 80→89; ออกแล้วกลับ 4/80) |
| 3+ ยูนิต ไม่คูณ | PASS (2 vs 7 ยูนิต ได้ DEF 5/HP 86 เท่ากัน) |
| หลายกลุ่ม additive + cap | PASS: 1GOKU (4 กลุ่ม) B2 = +12 HP/+6 DEF, B3 = +10/+4 |
| refresh ซ้ำ ไม่เปลี่ยน HP | PASS (20 รอบ) |
| **ออก-เข้าซ้ำ ฮีล** | **ช่องโหว่ใน B3 (grow):** 5 รอบ ฮีล 45 HP (9 ต่อรอบ); **B7 = 0** ← ใช้ max-HP only ถ้าจะทำ |
| ไม่มี ATK ทั้งทางตรง/ทางอ้อม | PASS (200 กระดาน × 6 variants = 1,200 เช็ค ATK เท่าเดิม) |
| Fusion ใช้ FUS ×1 + วัตถุดิบ 2 ใบ หมดครั้งเดียว, ใช้ใบเดียวซ้ำถูกปฏิเสธ | PASS |
| Fusion ไม่ยิง Story ใส่ตัวเอง | **main 9b5adfd: ยังเกิด** (BACKJI+NONG ยิง 2 แถว ATK 54/DEF 7) · **P1 branch: 0 (ATK 49/DEF 2)** ⇒ ต้อง merge P1 ก่อนถ้าถือเป็นข้อกำหนดของ baseline |
| 7 ช่อง / จำกัด HP ตลอด 12 เกม Bot เต็ม (1,590 action) | PASS (0 ละเมิด; 0<HP≤maxHP) |
| Evolution | วิวัฒนาการสร้างยูนิตใหม่ (`evolveHp` รักษาดาเมจที่โดน) — ใน grow-mode ได้ +HP ซ้ำอีกครั้งตอนเข้าใหม่ (ปิดด้วย B7) |
ข้อสังเกตอื่น: ตารางมี WarZ แต่ **0 สมาชิก**; Among Us 41 ใบ ⇒ synergy เปิดเกือบตลอด

## 8. ข้อจำกัด / สิ่งที่ยังไม่รู้
1. Advanced tier: มีเพียง 7 chain ที่มี Lv40+ ในข้อมูล ⇒ เด็ค archetype ไม่ได้ Evolution เต็มรูป; ใช้ mirror เป็นหลัก (ก็ใช้ 7 chain เดิมซ้ำ 12 ชุด spell ต่างกัน)
2. ผลจาก Bot ไม่ใช่ผู้เล่นจริง (Bot เหมาะกับ Aggro) · อ่านเป็นทิศทางเท่านั้น
3. การอ่าน "ผู้รับ" (กลุ่มเท่านั้น vs ทุกยูนิต) ให้ผลไม่ต่างเกิน noise (B3 vs B4) จึงไม่จำเป็นต้องตัดสินเพื่อสมดุล
4. ยูนิตฟิวชั่นใช้กลุ่มของการ์ดบนเท่านั้น (ทางเลือก "รวมกลุ่มสองใบ" ไม่ได้ทดสอบ)
5. Bot ไม่ได้วางแผนโดยคำนึง synergy (อ่าน HP/DEF จริงแต่ไม่หาวิธีเปิด synergy) ⇒ ผล synergy อาจต่ำกว่าผู้เล่นที่สร้างเด็คตามกลุ่ม
6. ไม่ได้ทดสอบ Aggro ต่างเด็ค (ใช้ 5 เด็คคงที่) และไม่ได้ทดสอบ LP ≠ 100 / ยกเลิก cap 60 (ตามคำสั่ง: คงไว้)
7. การ aura ใช้เป็น post-hook: ยูนิตที่เพิ่งลง/ตายกลาง action ได้รับ/เสียค่า synergy ตอนจบ action (ความคลาดเคลื่อนเล็ก)

## 9. คำแนะนำ — **REVISE** (ไม่ reject เพราะไม่เสียหาย แต่ไม่คุ้มติดตั้งตามค่าที่เสนอ)
1. **อย่าติดตั้ง B3/B7 ตามค่าที่เสนอเพื่อหวังแก้ Aggro/Tank** — ผลเท่าศูนย์ (±noise) แม้ coverage 90%
2. ถ้าต้องการให้ synergy เป็นเครื่องมือแก้ Tank: DEF stacking แบบไม่ cap (B2) ให้ผลจริง (+7 pt Tank) แต่ **ทำร้าย Control** และเสี่ยง DEF 7+ ใน Lv15 ⇒ ทดสอบเพิ่ม (เช่น cap DEF +6, มูลค่าเฉพาะกลุ่มเล็ก) ก่อน
3. **เปลี่ยนโครงสร้างให้ synergy มีความหมายเชิงเด็ค:** ตัดหรือลดสมาชิก Among Us (41) / เพิ่มเกณฑ์ ≥3 ยูนิต / ให้ synergy ต่อกลุ่มเล็ก (FiveM, Ragnarok, ROV, Ghost) ไม่ใช่กลุ่มที่ทุกคนอยู่
4. ถ้าจะใช้: ต้อง **max-HP only (B7)** เพื่อกันฮีลซ้ำ
5. สาเหตุหลักของ Aggro/Tank คือช่องว่าง ATK Lv15 (38 vs 17) — ทางแก้ที่ "เล็กที่สุดและย้อนกลับได้" น่าจะเป็น **Spell/Trap/Effect ลดดาเมจ** (P5 จากรายงาน audit) มากกว่าบวก DEF 1–2
6. ต้อง merge **P1** ก่อนวัด baseline ใหม่ (Fusion self-Story ยังเกิดบน main)

**การตัดสินใจที่ต้องการจาก Owner:** (a) จะ merge P1 หรือไม่ (b) จะทดสอบ B2-แบบ-DEF-cap เพิ่มหรือไม่ (c) จะรีแมป/ลดกลุ่ม Among Us หรือไม่ (d) ยืนยันว่าสมาชิก affiliation ของ Lv40+ ควรสืบทอดตามสาย chain หรือไม่ (ปัจจุบันขาดหาย)

## 10. ไฟล์ที่เพิ่ม/แก้ (ทั้งหมดอยู่นอก src/db/public)
เพิ่ม: `docs/balance/GAME_SYNERGY_SIMULATION_REPORT_2026-11-26.md` (ไฟล์นี้) · `analysis/synergy-sim/` { `lib.ts`, `synergy.ts`, `run.ts`, `mirror.ts`, `exploit.ts`, `chainstats.ts`, `summarize.py`, `run-all.sh`, `run-big.sh`, `data/fusion-pairs-production-37.json`, `data/game-affiliations-production.txt`, `out/*.json|log|summary.md` }
**ยืนยัน:** ไม่ได้แก้ `src/`, `db/`, `public/`, `tests/`, ข้อมูลการ์ด/CMS/DB, กฎเกม · มีการอ่านข้อมูล production ด้วย SELECT เท่านั้น (card_affiliations, card_fusion_partners) · ไม่ merge/deploy
ตรวจ: `git diff --stat 9b5adfd -- src db public tests` ว่างเปล่า
