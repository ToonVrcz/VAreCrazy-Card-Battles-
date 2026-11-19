# Effect Compatibility Matrix

> **AUDIT ONLY.** Sources: `src/engine/effects.ts` (parser `parseEffect`), `src/engine/effect-registry.ts` (CMS Registry + `validateSystem`), `src/engine/game.ts` `runEffects` / `refreshAuras` (lines 155-203), `src/server/service.ts` `cleanEffects` / `transition`, `tests/effect-registry.test.ts`. Counts below come from running `parseEffect` over `card-data-export/cards.json`.

## 1. Three layers that must agree

| Layer | What it allows | Enforces engine parity? |
|---|---|---|
| **Admin structured editor** (Registry) | Only entries with status `supported` per field, plus cross-field rules in `validateSystem` | **Yes**: server re-derives the legacy columns from the Registry; `tests/effect-registry.test.ts` checks everything the Registry offers is accepted by `parseEffect` (one direction only) |
| **Admin legacy / free-text Rule Builder** (`cleanEffects` else-branch) | any text for action/target/condition/cost; trigger must be in `TRIGGERS` (includes `combo`, `on_cast`), duration in `DURATIONS` (includes `n_turns`), limit in `LIMITS` | **No** (only the publish gate for characters) |
| **Engine parser** `parseEffect` | exact wordings only; anything else returns `null` = the ability is **not executed** and shown as "not active" | n/a (the source of truth) |
| **Publish gate** (`transition`) | a *character* with any non-parsing effect row cannot leave `draft` (422) | blocks characters only; spell/trap/EVO/FUS rows are exempt |

## 2. Registry fields (what the CMS offers)

| Category | Supported | **Unsupported (blocked in the structured editor)** |
|---|---|---|
| Trigger | on_summon, on_evolve, on_attack, on_destroyed, to_graveyard, turn_start, turn_end, passive | `on_cast` (spells run by ID), `combo` (no Combo in the engine) |
| Condition | target_destroyed ("target destroyed by the attack"), target_hp_lower ("target HP lower than self"), both **only with on_attack** | - |
| Cost | discard_hand_1 (**only with draw**) | `sacrifice` |
| Target | self, allies (every own unit incl. source), ally1 (1 own unit), enemy1 (1 enemy unit), deck (**only with search_evo**) | - |
| Action | atk_up, atk_down, damage, heal (amount or full), draw, maxhp_up (passive only), protect (on_summon + self only), search_evo | - |
| Duration | instant, until_end_of_turn, permanent | `n_turns` |
| Use limit | none, once_per_turn, once_per_game (**per unit instance**) | - |

## 3. Admin can create it, the engine cannot run it

| Effect the Admin can still save (legacy editor / import) | Engine result | Severity |
|---|---|---|
| trigger `combo` (e.g. FOLLOW-YOU-040 row 2) | `parseEffect` -> null, not executed, blocks publish | P2 |
| trigger `on_cast` on a character | not executed (blocked at publish for characters) | P3 |
| duration `n_turns` | not executed | P3 |
| cost `sacrifice` / any cost other than "discard 1 to draw 1" | not executed | P3 |
| any free-text action/target/condition not in the exact wording list (e.g. "HP -10" with a different dash, "ATK+10" without a space, `ฟื้น HP 10` with a unit name) | not executed; the card text still shows it to the player | P2 (silent mismatch between text and behaviour until publish) |
| `use_limit` once_per_game written by an author who thinks "once per game" | runs **once per unit instance** (re-summon resets it) | P3 |
| condition on a non-attack trigger | parser returns null | P3 |
| `protect` on any trigger other than on_summon + self | null | P3 |
| spell/trap effect rows (`on_cast`, trap triggers) | **never read**: the card behaves per the hard-coded card-ID code; editing the row changes only the printed text | **P2** (false control) |

## 4. Exact grammar the parser accepts (`parseRaw`)

| Wording (`action_text`) | Needs | Result (`kind`) |
|---|---|---|
| `ATK +N` | duration until_end_of_turn (temporary) or permanent / suffix ` ถาวร` and optional ` (สูงสุด +M)` cap; passive needs duration permanent and no suffix | atk |
| `ATK −N` (U+2212 minus) | duration until_end_of_turn | atk (negative) |
| `HP −N` | duration instant; not passive | damage to a **unit** (never LP) |
| `ฟื้น HP N` / `ฟื้น HP เต็ม` | duration instant; not passive | heal (capped at max HP) |
| `จั่ว N ใบ` | duration instant; target self; optional cost `ทิ้งการ์ดจากมือ 1 ใบ` | draw (a full hand of 5 means nothing is drawn) |
| `HP +N` | passive + permanent; target self or allies | max HP aura |
| `ป้องกันการเลือกเป็นเป้าหมาย` | trigger on_summon, target self, until_end_of_turn | untargetable this turn |
| `ค้นการ์ด Evolution ขึ้นมือ` | duration instant, target `Main Deck` | search_evo |

Targets (`target_text`): `ตัวเอง`, `ตัวละครฝ่ายเราทุกใบ`, `ตัวละครฝ่ายเรา 1 ใบ`, `ตัวละครฝ่ายตรงข้าม 1 ใบ`, `Main Deck`. Limits: `none`, `once_per_turn`, `once_per_game`.

## 5. Runtime semantics (verified in `runEffects` and the probes)

- **Timing:** `on_summon` after the unit lands (and after TRP-004 may lock it); `on_attack` before damage (`target_hp_lower` compares HP at that moment); the `target_destroyed` variant fires after damage only if the attacker survives and the target is gone; `on_destroyed` after the unit is removed (not if TRP-008 saves it); `to_graveyard` fires on the **other** own units when a card goes to the graveyard; `turn_start`/`turn_end` only for the **active** player's units; `passive` effects are recalculated after every action (`refreshAuras`).
- **Targeting:** `ally1`/`enemy1` ask the owner in interactive rooms (a `pending` question) and pick automatically otherwise (highest ATK enemy, lowest HP% ally for heals); `enemy1` skips units that are untargetable this turn.
- **Stacking:** auras are additive (probe +10 ATK / +20 HP from two aura cards); permanent ATK has an optional per-unit cap (I-M-GRAPE-015 +5/turn up to +15; SKYMOON-015 +10 permanent, **no cap**); spell buffs have no cap.
- **Limits:** tracked in `unit.used[]` per effect index: `turn` = once per game turn number, `game` = once ever **for that unit instance**.
- **Failure mode:** an effect whose cost cannot be paid or whose target does not exist is skipped silently.

## 6. Coverage of the 78 shipped effect rows

| Group | Rows | Runs in the engine |
|---|---|---|
| Character rows | 56 | **55 run**, 1 inactive (FOLLOW-YOU-040 `combo`) |
| EVO-001, FUS-001 | 2 | by card ID (not through `parseEffect`) |
| Spells | 10 | by card ID |
| Traps | 10 | by card ID |

Character ability usage (trigger | action | target | limit): on_attack ATK self per-turn x14; on_attack ATK conditional x3; on_attack draw-on-kill x4; on_destroyed damage enemy x2; on_destroyed heal ally x2; on_evolve ATK ally x1, damage enemy x1, heal ally x1; on_summon ATK ally x2 (game), ATK -N enemy x1, damage enemy x3, draw x4, loot x1, heal ally x1, protect x2, search EVO x1; passive ATK allies x1, HP allies x1; to_graveyard ATK x2; turn_end heal ally x4, heal allies x1, heal self x1; turn_start ATK ramp x1, heal self x1.

## 7. Findings

| ID | Sev | Finding | Evidence | Proposed solution |
|---|---|---|---|---|
| X-1 | P2 | Registry parity is one-directional: it proves "Registry => parser accepts", not "parser accepts => Registry shows". Legacy free text bypasses the Registry. | `tests/effect-registry.test.ts`, `service.ts cleanEffects` | Warn (or refuse) free-text rows that fail `parseEffect` at save time, not only at publish. |
| X-2 | P2 | Spell/trap rows are decorative: editing their numbers/duration does not change the game. | `game.ts` 324-346, `TRAP` map | Mark them read-only "behaviour fixed by card ID" in the Admin, or move numbers into data (engine work). |
| X-3 | P3 | `once_per_game` per instance (not per player per game) is not described anywhere in the UI. | `runEffects` `used[]` | Label it "1 ครั้ง/เกม ต่อใบบนสนาม" in the Registry. |
| X-4 | P3 | SKYMOON-015 permanent +10 ATK has no cap and can stack with SPL-004. | cards + `runEffects` | Review in balance. |
| X-5 | P3 | `protect` hides a unit only from *effects/spells* (`targetable`); it does not stop attacks. | `targetable` line 103 | Rule text on LORDNAM/LUCKY already says "effects": keep. |
