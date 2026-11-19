# Card Changelog (Issue #2)

> **STATUS: PROPOSED — NOT APPROVED.** Nothing in this document is implemented. HP and ATK are never changed. Toon reviews and approves before any implementation.

One entry per proposed change. HP/ATK untouched everywhere. Unchanged cards: 40 (listed at the end).

## Data changes

| # | Card | Field | Current | Proposed | Reason |
|---|---|---|---|---|---|
| 1 | 1GOKU-015 | DEF | 0 | 3 | Lv15 is below average while Lv40 is above; closes a little of the gap. |
| 2 | 1GOKU-040 | effect[1] `on_destroyed` | เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 20 | เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10 | Two strong effects on a strong body; trim the secondary one. |
| 3 | BABY-015 | DEF | 0 | 5 | A support card has to be a good heal; ATK is locked. |
| 4 | BABY-015 | effect[0] `on_summon` | เมื่อถูกเรียก ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ | เมื่อถูกเรียก ฟื้น HP 30 ให้ตัวละครฝ่ายเรา 1 ใบ | A support card has to be a good heal; ATK is locked. |
| 5 | BACKJI-015 | DEF | 0 | 3 | Fragile assassin; small DEF. |
| 6 | BADGUY-015 | DEF | 0 | 4 | A tank-leaning assassin that needs survivability. |
| 7 | BADGUY-040 | effect[0] `on_attack` | เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +25 จนจบเทิร์น (1 ครั้ง/เทิร์น) | เมื่อโจมตีเป้าหมายที่ HP น้อยกว่าตัวเอง ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น) | Strongest Lv40; trim the effects only. |
| 8 | BADGUY-040 | effect[1] `on_destroyed` | เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 20 | เมื่อถูกทำลาย ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 15 | Strongest Lv40; trim the effects only. |
| 9 | CUTIE-015 | effect[0] `on_summon` | เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10 | เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 5 | Same reason as PIKACHU-015; keeps the 3 chip-damage Mages consistent. |
| 10 | DNMAN-015 | effect[0] `on_attack` | เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น) | เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น) | The stat line is locked, so the effect is the only lever. |
| 11 | FOLLOW-YOU-015 | DEF | 0 | 2 | Lowest-stats of the four draw-on-summon cards. |
| 12 | FOLLOW-YOU-040 | effect[0] `on_attack` | เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น) | เมื่อโจมตี ATK +20 จนจบเทิร์น (1 ครั้ง/เทิร์น) | Compensates for the dead second ability with a supported number. |
| 13 | LALAPING-015 | DEF | 0 | 4 | Small survivability for a defensive card; effect stays the same as the other healers. |
| 14 | LALAPING-040 | DEF | 0 | 6 | Support unit that has to survive to heal; effect already powerful. |
| 15 | LEON-S-KENNEDY-015 | DEF | 0 | 3 | Keeps LEON slightly above OUFILLING while both rise from C. |
| 16 | LINLADA-015 | effect[0] `on_attack` | เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น) | เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น) | Same lever as DNMAN-015. |
| 17 | LORDNAM-015 | DEF | 0 | 2 | Minimal buff to stay ahead of LUCKY-015. |
| 18 | LUCKY-015 | DEF | 0 | 4 | Closes the gap with LORDNAM-015, which has the same effect. |
| 19 | MELON-015 | effect[0] `on_attack` | เมื่อโจมตี ATK +10 จนจบเทิร์น (1 ครั้ง/เทิร์น) | เมื่อโจมตี ATK +5 จนจบเทิร์น (1 ครั้ง/เทิร์น) | Same lever as DNMAN-015. |
| 20 | MON-015 | effect[0] `on_summon` | เมื่อถูกเรียก จั่วการ์ด 1 ใบ | เมื่อถูกเรียก ทิ้งการ์ดจากมือ 1 ใบ เพื่อจั่วการ์ด 1 ใบ | Removes the pure card-advantage part; the ATK 40 body stays. Uses the one cost the parser knows. |
| 21 | NORMAN-015 | DEF | 0 | 3 | Bear Warrior is a tank role. |
| 22 | OUFILLING-015 | DEF | 0 | 4 | Weak effect; survivability is the only lever without changing the design. |
| 23 | PIKACHU-015 | effect[0] `on_summon` | เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 10 | เมื่อถูกเรียก ลด HP ตัวละครฝ่ายตรงข้าม 1 ใบ 5 | Trims the free value; the strong body is untouched. |
| 24 | SATOSHI-015 | DEF | 0 | 5 | A pure healer should out-heal its siblings (LALAPING-015, SMILE-015 after nerf). |
| 25 | SATOSHI-015 | effect[0] `turn_end` | จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น) | จบเทิร์น ฟื้น HP 15 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น) | A pure healer should out-heal its siblings (LALAPING-015, SMILE-015 after nerf). |
| 26 | SATOSHI-040 | effect[0] `turn_end` | จบเทิร์น ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น) | จบเทิร์น ฟื้น HP 15 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น) | A healer with the second-highest Lv40 ATK should not also out-heal. |
| 27 | SATOSHI-040 | effect[1] `on_destroyed` | เมื่อถูกทำลาย ฟื้น HP 30 ให้ตัวละครฝ่ายเรา 1 ใบ | เมื่อถูกทำลาย ฟื้น HP 20 ให้ตัวละครฝ่ายเรา 1 ใบ | A healer with the second-highest Lv40 ATK should not also out-heal. |
| 28 | SMILE-015 | effect[0] `turn_end` | จบเทิร์น ฟื้น HP 10 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น) | จบเทิร์น ฟื้น HP 5 ให้ตัวละครฝ่ายเรา 1 ใบ (1 ครั้ง/เทิร์น) | Attacker body plus support heal is double-dipping; keep heal as the weaker half. |
| 29 | TAN-015 | DEF | 0 | 3 | Evolution search has real tempo value; the body is below average. |
| 30 | TEE-015 | DEF | 0 | 4 | Raises the temporary value without making it permanent. |
| 31 | TEE-015 | effect[0] `on_summon` | เมื่อถูกเรียก ATK +10 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ | เมื่อถูกเรียก ATK +15 จนจบเทิร์น ให้ตัวละครฝ่ายเรา 1 ใบ | Raises the temporary value without making it permanent. |
| 32 | TEE-040 | DEF | 0 | 6 | Tank-leaning Lv40. |
| 33 | THAI32-015 | DEF | 0 | 3 | Defensive card with the lowest ATK; small DEF suits its role. |
| 34 | WENDYWENDIE-015 | DEF | 0 | 5 | Makes the thief archetype usable with a 10-ATK body. |
| 35 | WENDYWENDIE-015 | effect[0] `on_attack` | เมื่อโจมตีและทำให้เป้าหมายถูกทำลาย จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น) | เมื่อโจมตี จั่วการ์ด 1 ใบ (1 ครั้ง/เทิร์น) | Makes the thief archetype usable with a 10-ATK body. |
| 36 | ZEESKY-015 | DEF | 0 | 3 | Lowest-power chip-damage Mage; small DEF raises survivability only. |

## Engine / text proposals (not data)

### ENGINE-PROP-01 — SPL-007: stolen unit cannot attack the turn it arrives

- Status: PROPOSED / NOT APPROVED / NEW ENGINE WORK
- Change: In the SPL-007 case of src/engine/game.ts set summonedTurn = g.turn on both swapped units (the existing "just summoned cannot attack" rule then applies).
- Evidence: verify.spl007: stolenCanAttackSameTurn = true (a Lv70 FOLLOW-YOU-070 obtained for a Lv15 attacks at once).
- Tests: T-ENG-01..03

### ENGINE-PROP-02 — SPL-003 / SPL-004: cap stacking per unit

- Status: PROPOSED / NOT APPROVED / NEW ENGINE WORK
- Change: Allow one SPL-003 and one SPL-004 buff per unit, or cap total bonusDef / bonusAtk from spells at +30 (Toon decides the form). Needs a per-unit counter in Unit.
- Evidence: verify.spl003x3: bonusDef 45; verify.spl004x3: bonusAtk 45 (total ATK 75 from a 30-ATK unit).
- Tests: T-ENG-04..06

### ENGINE-PROP-03 — Optional: spells per turn limit (e.g. 2)

- Status: PROPOSED / NOT APPROVED / NEW ENGINE WORK / OPTIONAL
- Change: Add a per-turn spell counter on Player; reject the 3rd cast.
- Evidence: verify.spellVolume: 3 casts in one turn, deck 30 -> 21 (SPL-005 draws).
- Tests: T-ENG-07

### ENGINE-PROP-04 — Optional: activate the "combo" trigger (FOLLOW-YOU-040)

- Status: PROPOSED / NOT APPROVED / NEW ENGINE WORK / OPTIONAL
- Change: Define "another Combo card on the field" in the parser/registry and the engine; today any combo row returns null from parseEffect and is not executed. Must stay in parity with src/engine/effect-registry.ts.
- Evidence: effects.ts parseRaw does not accept trigger "combo"; has_combo exists only as card metadata.
- Tests: T-ENG-08

### ENGINE-PROP-05 — Text/data alignment: SPL-003 and SPL-004 duration

- Status: PROPOSED / NOT APPROVED / DATA CHANGE
- Change: Choose one canonical behaviour: "until the unit leaves the field" (what the engine does and rules_text says) or "until end of turn" (what the effect row says). Update the other text; if the engine is changed it is new engine work.
- Evidence: Effect row: DEF +15 จนจบเทิร์น; rules_text and engine: until the unit leaves the field.
- Tests: T-ENG-09

## Unchanged cards

BAM-015, BAMMIE-015, BOBO-015, CHAEM-015, FOLLOW-YOU-070, GOD-WA-015, I-M-GRAPE-015, JAOJAY-015, LALAPING-070, MIKI-015, NONG-TAENGMO-015, NORMAN-040, PK-015, PKXCY-015, SKYMOON-015, SOMYES-015, THAI26-015, THOMAS-015, EVO-001, FUS-001, SPL-001, SPL-002, SPL-003, SPL-004, SPL-005, SPL-006, SPL-007, SPL-008, SPL-009, SPL-010, TRP-001, TRP-002, TRP-003, TRP-004, TRP-005, TRP-006, TRP-007, TRP-008, TRP-009, TRP-010
