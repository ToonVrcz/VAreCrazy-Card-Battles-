# เตรียมเชื่อม VAreCrazy Universe (ยังไม่เชื่อม)

สถานะ: ฝั่งเกมพร้อมแล้ว ยังไม่ได้แตะ repo Universe และไม่ได้ deploy อะไร

## ไฟล์ที่เตรียมไว้
- `src/universe/contract.ts`: สำเนาสัญญา module ของ Universe (types เท่านั้น ไม่ import โค้ดของเขา)
- `src/universe/module.ts`: `cardBattleModule` ทำครบ start / act / tick / deadline / view / outcome / sanitizeSettings
- `src/engine/deck-view.ts`: `buildDeck` กับ `viewFor` แยกออกมาเป็นฟังก์ชันล้วน (ห้องออนไลน์เดิมใช้ต่อ)
- `tests/universe-module.test.ts`: เล่นบอทชนบอททั้งเกมผ่านสัญญา, เช็ก view ไม่รั่ว, timeout, ออกจากห้อง, JSON round trip

## แปลงระหว่างเรากับ Universe
| Universe | ของเรา |
| --- | --- |
| `start(seats, settings, ctx)` | สร้างเด็คด้วย `buildDeck(ctx.content.pool, pairs, ctx.random)` แล้ว `createGame(..., {interactive:true})` |
| `act` | `engineAct`; ผู้เล่นต้องเป็นคนที่ถึงตา (หรือเป็นผู้ตอบโต้ตอนมี pending); error ของเอนจินกลายเป็น `{ok:false}` |
| `tick` / `deadline` | หมดเวลา: pass หรือจบเทิร์นอัตโนมัติ; พลาดติดกันครบ `maxMisses` (ค่าเริ่ม 3) = ยอมแพ้; คนออกจากห้อง = ยอมแพ้ทันที |
| `view` | `viewFor(game, seat)` + `you`, `seatIds`, `deadline`; คนดูได้แค่ `{spectator:true}` |
| `outcome` | ผู้ชนะ 1 คน, faction `SOLO`, แต้ม ชนะ 10 / แพ้ 2 (`POINTS`) |
| `ctx.content` | `{ pool: CardDef[], pairs: FusionPair[] }` ที่ห้องโหลดจากคลังการ์ด |

## ต้องทำตอนเชื่อมจริง (ยังไม่ทำ)
1. ตัดสินใจว่าการ์ดอยู่ที่ไหน: ฐานข้อมูลของ Universe หรือ Supabase ของเรา (ห้ามย้าย production โดยไม่ผ่านเจ้าของ)
2. คัดลอก `module.ts` เข้า `apps/game/src/games/card-battle/` แล้ว import types จาก `../types`
3. เพิ่ม `'card_battle'` ใน `GAME_TYPES`, `MODULE_GAME_TYPES`, `GAME_INFO` (2 ผู้เล่น), `registry.ts`, `release-defaults.ts` (ปิดไว้จนกว่าเจ้าของเปิด)
4. UI: ย้าย `public/play.html` เป็นคอมโพเนนต์ใน `components/games/card-battle/` + `module-ui.ts` และข้อความไทย/อังกฤษ (ห้ามใช้ภาษาอื่น ห้ามใช้ em dash)
5. ให้ route ของห้องโหลด content การ์ดก่อน `start` (เหมือนคลังคำของเกมอื่น)
6. EXP / ควสต์ / กระเป๋า: ผ่าน bridge ของ Core (ยังไม่ได้อ่าน `docs/core/game-bridge.md`)
7. Trap-vs-trap chain ยังไม่มี (ต้องมีชนิดการ์ดใหม่)

## กฎของ repo Universe ที่ต้องเคารพ
ห้าม deploy, ห้าม migrate production, ห้ามเปลี่ยน layout โดยไม่ผ่านเจ้าของ
