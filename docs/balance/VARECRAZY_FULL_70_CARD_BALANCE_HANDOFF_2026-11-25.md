# VAreCrazy Card Battles — Full 70-Card Balance Handoff
**Date:** 2026-11-25  
**Branch:** `balance/full-70-card-handoff`  
**Status:** PROPOSAL FOR IMPLEMENTATION REVIEW — NOT PRODUCTION DATA  
**Owner:** Toon (final approval)  
**Balance analyst:** Ball  
**Implementation:** Claude

## 0. Non-negotiable constraints
1. Do not change any character's base HP or base ATK. This includes Lv.15, Lv.40 and Lv.70 cards.
2. Do not alter HP/ATK fusion bonuses or affiliation/story synergy bonuses in this task. Flag them for a separate owner decision if they create imbalance.
3. Balance levers are DEF and Effect values/conditions/limits/text only.
4. Do not change game rules, turn structure, deck size, summon rules, evolution sacrifice counts, board slots, DB schema, API contracts or engine architecture without separate owner approval.
5. Treat this file as a single consolidated implementation brief. Claude must inspect current main and current engine behavior first, reconcile any already-landed balance changes, then implement only deltas that remain applicable. Do not blindly overwrite newer work.
6. Do not deploy, apply production migrations, or change production DB. Implement in a dedicated branch, add tests, and report exact files/behavior changed for Toon to review.
7. These are design recommendations, not proven win-rate outcomes. No playtest telemetry has been supplied.

## 1. Verified database snapshot
Read from Supabase project `jcjqooeckoapoikcwpet` on 2026-11-25:
- 39 Character Lv.15
- 7 Character Lv.40
- 2 Character Lv.70
- 10 Spell
- 10 Trap
- 1 Evolution
- 1 Fusion
- Total: 70 cards
- Character averages: Lv.15 HP 85.4 / ATK 25.1 / DEF 1.5; Lv.40 HP 152.1 / ATK 52.1 / DEF 3.7; Lv.70 HP 305 / ATK 90 / DEF 4.
- This is a live DB snapshot, not a claim about current production deployment or Git branch parity.

## 2. DEF proposal — all 48 characters
All HP and ATK remain exactly as stored. DEF targets below are proposals; Claude must compare with current main and existing balance branch changes before applying. Values are intentionally conservative, with role identity prioritized over flattening the roster.

### Lv.15 (39)
| Card ID | Current DEF | Proposed DEF | Role / rationale |
|---|---:|---:|---|
| 1GOKU-015 | 3 | 3 | Balanced fighter; keep |
| BABY-015 | 5 | 5 | Fragile support but already durable enough |
| BACKJI-015 | 3 | 2 | Assassin; lower durability offsets conditional burst |
| BADGUY-015 | 1 | 2 | High HP/low ATK assassin; modest survivability |
| BAM-015 | 0 | 1 | Frontline sword role; small floor |
| BAMMIE-015 | 0 | 1 | Preserve distinct identity while avoiding exact twin fragility |
| BOBO-015 | 0 | 1 | Aggressive swordsman; modest protection |
| CHAEM-015 | 0 | 2 | Utility/card draw; DEF compensates modest combat profile |
| CUTIE-015 | 0 | 0 | High ATK mage; glass-cannon identity |
| DNMAN-015 | 0 | 1 | High ATK crusader; minimal durability |
| FOLLOW-YOU-015 | 2 | 2 | Draw support; keep |
| GOD-WA-015 | 0 | 1 | Conditional draw-on-kill; modest DEF |
| I-M-GRAPE-015 | 0 | 2 | Scaling druid needs enough time to build; keep scaling cap |
| JAOJAY-015 | 0 | 0 | High ATK / low HP assassin; retain glass cannon |
| LALAPING-015 | 4 | 4 | Healer; retain defensive identity |
| LEON-S-KENNEDY-015 | 3 | 3 | Graveyard-synergy support; keep |
| LINLADA-015 | 0 | 1 | Aggressive spear role; modest floor |
| LORDNAM-015 | 2 | 2 | Target protection; keep, clarify protection scope |
| LUCKY-015 | 4 | 3 | Already protected by target-avoidance effect; reduce overlap |
| MELON-015 | 0 | 1 | Aggressive warrior; modest floor |
| MIKI-015 | 0 | 2 | Fighter with repeatable attack boost; slight DEF |
| MON-015 | 0 | 0 | ATK 40 with hand filtering; glass-cannon |
| NONG-TAENGMO-015 | 0 | 1 | Conditional draw-on-kill; modest durability |
| NORMAN-015 | 3 | 4 | Bear warrior / defensive fighter identity |
| OUFILLING-015 | 4 | 4 | Graveyard synergy; keep |
| PIKACHU-015 | 0 | 0 | High ATK mage; glass-cannon |
| PK-015 | 0 | 2 | Draw utility with lower combat stats |
| PKXCY-015 | 0 | 2 | Fighter with repeatable attack boost |
| SATOSHI-015 | 5 | 5 | Dedicated healer; keep |
| SKYMOON-015 | 0 | 3 | High HP, low ATK support/blacksmith; DEF creates tank role |
| SMILE-015 | 0 | 1 | Cleric with repeatable heal; small DEF only |
| SOMYES-015 | 0 | 2 | Summon debuff utility; moderate protection |
| TAN-015 | 3 | 3 | Evolution search utility; keep |
| TEE-015 | 4 | 4 | Burst on summon; keep |
| THAI26-015 | 0 | 2 | Fusion-linked fighter; moderate DEF |
| THAI32-015 | 3 | 4 | High HP and death-trigger support; modest durability |
| THOMAS-015 | 0 | 2 | Draw utility; modest DEF |
| WENDYWENDIE-015 | 5 | 4 | Repeatable draw on attack; reduce excessive defense |
| ZEESKY-015 | 3 | 3 | Summon debuff; keep |

### Lv.40 (7)
| Card ID | Current DEF | Proposed DEF | Rationale |
|---|---:|---:|---|
| 1GOKU-040 | 3 | 4 | Aggressive evolved fighter; small durability increase |
| BADGUY-040 | 1 | 2 | Conditional burst plus drawback; reduce fragility slightly |
| FOLLOW-YOU-040 | 2 | 3 | Aggressive evolved summoner; modest floor |
| LALAPING-040 | 6 | 6 | Team healer/tank; keep |
| NORMAN-040 | 3 | 4 | Self-healing bruiser; moderate DEF |
| SATOSHI-040 | 5 | 5 | Healer with high ATK; keep |
| TEE-040 | 6 | 6 | High HP defensive support; keep |

### Lv.70 (2)
| Card ID | Current DEF | Proposed DEF | Rationale |
|---|---:|---:|---|
| FOLLOW-YOU-070 | 2 | 3 | High ATK evolution; modest DEF to avoid one-dimensional glass cannon |
| LALAPING-070 | 6 | 6 | Team sustain; keep high defensive identity |

## 3. Character Effect proposal — all 48
Unless listed as a change below, keep the current effect exactly as stored. Do not change any base HP/ATK.

### Lv.15
| Card ID | Current effect | Proposed effect |
|---|---|---|
| 1GOKU-015 | On attack: ATK +10 until end of turn, once/turn | Keep |
| BABY-015 | On summon: heal 30 to one ally, once/game | Keep |
| BACKJI-015 | On attack vs target with lower HP: ATK +15, once/turn | Keep; target comparison must use current HP at attack resolution |
| BADGUY-015 | Same conditional ATK +15 | Keep |
| BAM-015 | On attack: ATK +10, once/turn | Keep |
| BAMMIE-015 | On attack: ATK +10, once/turn | Keep |
| BOBO-015 | On attack: ATK +10, once/turn | Keep |
| CHAEM-015 | On summon: draw 1, once/game | Keep |
| CUTIE-015 | On summon: reduce one enemy character HP by 5, once/game | Keep |
| DNMAN-015 | On attack: ATK +5, once/turn | Keep |
| FOLLOW-YOU-015 | On summon: draw 1, once/game | Keep |
| GOD-WA-015 | On attack, if target is destroyed: draw 1, once/turn | Keep; trigger only after confirmed destruction by this attack |
| I-M-GRAPE-015 | Turn start: permanent ATK +5, max +15 | Keep; enforce hard cap +15 across repeated trigger resolution |
| JAOJAY-015 | On attack, if target is destroyed: draw 1, once/turn | Keep; trigger only after confirmed destruction by this attack |
| LALAPING-015 | Turn end: heal 10 to one ally, once/turn | Keep |
| LEON-S-KENNEDY-015 | When an allied character goes to graveyard: ATK +5 until end of turn, once/turn | Keep; count only allied character movement to graveyard |
| LINLADA-015 | On attack: ATK +5, once/turn | Keep |
| LORDNAM-015 | On summon: cannot be selected by enemy effects for the rest of turn | Keep; define as targeted effects only, not combat attacks or non-targeting global effects |
| LUCKY-015 | Same protection on summon | Keep; same precise scope as LORDNAM |
| MELON-015 | On attack: ATK +5, once/turn | Keep |
| MIKI-015 | On attack: ATK +10, once/turn | Keep |
| MON-015 | On summon: discard 1, draw 1, once/game | Keep; require a card to discard before effect can resolve |
| NONG-TAENGMO-015 | On attack, if target is destroyed: draw 1, once/turn | Keep; trigger only after confirmed destruction by this attack |
| NORMAN-015 | On attack: ATK +10, once/turn | Keep |
| OUFILLING-015 | When an allied character goes to graveyard: ATK +5 until end of turn, once/turn | Keep |
| PIKACHU-015 | On summon: reduce one enemy character HP by 5, once/game | Keep |
| PK-015 | On summon: draw 1, once/game | Keep |
| PKXCY-015 | On attack: ATK +10, once/turn | Keep |
| SATOSHI-015 | Turn end: heal 15 to one ally, once/turn | **Change heal 15 → 10** |
| SKYMOON-015 | On summon: grant one ally permanent ATK +10, once/game | Keep; verify target validity and permanent buff persistence |
| SMILE-015 | Turn end: heal 5 to one ally, once/turn | **Change heal 5 → 10** |
| SOMYES-015 | On summon: ATK −10, once/game | Keep; verify intended target is explicitly selected/defined |
| TAN-015 | On summon: search Evolution card to hand, once/game | Keep; only search eligible Evolution card and obey hand capacity |
| TEE-015 | On summon: ATK +15, once/game | Keep |
| THAI26-015 | On attack: ATK +10, once/turn | Keep |
| THAI32-015 | On destroyed: heal 20 to one ally | Keep, but trigger exactly once on final destruction (not on repeated state checks) |
| THOMAS-015 | On summon: draw 1, once/game | Keep |
| WENDYWENDIE-015 | On attack: draw 1, once/turn | Keep; verify intended draw trigger is unconditional and not exploitable by repeated attack event |
| ZEESKY-015 | On summon: reduce enemy character HP by 10, once/game | Keep |

### Lv.40
| Card ID | Current effect | Proposed effect |
|---|---|---|
| 1GOKU-040 | On attack ATK +20 once/turn; on destroyed HP −10 | Keep both; verify destruction penalty is applied once and to the intended controller/target |
| BADGUY-040 | Conditional on-attack ATK +20 once/turn; on destroyed HP −15 | Keep both; verify penalty target and timing |
| FOLLOW-YOU-040 | On attack ATK +20 once/turn | Keep |
| LALAPING-040 | Turn end heal 10 to every ally | **Change heal 10 → 5 per ally per own turn**; cap each target at max HP |
| NORMAN-040 | On attack ATK +20 once/turn; turn start heal self 10 | Keep |
| SATOSHI-040 | Turn end heal 15 to one ally once/turn; on destroyed heal 20 to one ally | **Change turn-end heal 15 → 10**; retain death heal 20 |
| TEE-040 | On evolve ATK +20; turn end heal self 10 | Keep; on-evolve bonus must resolve once per successful evolution |

### Lv.70
| Card ID | Current effect | Proposed effect |
|---|---|---|
| FOLLOW-YOU-070 | On evolve HP −30; passive ATK +5 | Keep; ensure the HP loss cannot reduce below 1 or create an invalid state; do not alter base HP |
| LALAPING-070 | On evolve heal one ally to full; passive HP +10 | **Change full heal to fixed heal 50**; passive HP +10 remains unchanged |

## 4. Spell proposal — all 10
| Card ID | Current | Proposal |
|---|---|---|
| SPL-001 | Deal 20 damage to one enemy character | Keep |
| SPL-002 | Heal 30 to one ally | Keep |
| SPL-003 | DEF +15 to one ally until end of turn; rules text says once per character per turn | Keep +15. Enforce the once-per-target-per-turn restriction in engine; repeated casts must not stack beyond +15 on the same target in one turn. |
| SPL-004 | ATK +15 to one ally until end of turn; rules text says once per character per turn | Keep +15. Enforce once-per-target-per-turn; repeated casts must not stack beyond +15 on same target in one turn. |
| SPL-005 | Draw 2 | Keep; enforce normal hand limit and prevent drawing beyond allowed capacity |
| SPL-006 | Return one Lv.15 character from own graveyard to hand | Keep; obey hand limit and only eligible character cards |
| SPL-007 | Effect: swap one of our characters with one enemy character | **Keep the cross-side swap exactly as intended.** Select one character controlled by us and one controlled by the opponent, then exchange their sides/ownership and corresponding board positions as one atomic action. Do not reinterpret this as swapping two characters on the same side. Validate both selected characters and both destination slots before applying either move. If a slot/ownership condition fails, the entire effect fails with no partial movement. |
| SPL-008 | One enemy character cannot attack for 1 enemy turn | Keep; duration must expire at the end of the intended opponent turn |
| SPL-009 | One enemy character takes 5 damage at start of each opponent turn for 3 turns | Keep; apply exactly 3 opponent-turn ticks, no extra tick on caster's turn |
| SPL-010 | Destroy one face-down enemy trap | Keep; target only a valid face-down trap |

## 5. Trap proposal — all 10
All traps are one-shot and should be sent to graveyard after successful resolution unless the existing engine has a documented different rule.
| Card ID | Current | Proposal |
|---|---|---|
| TRP-001 | Cancel an enemy attack | Keep |
| TRP-002 | Reflect 50% of damage to attacker | Keep; floor rounding as current text specifies if present |
| TRP-003 | Reduce direct LP damage by 50% | Keep; round down |
| TRP-004 | On enemy summon/fusion, prevent that character attacking for next enemy turn | Keep; ensure trigger covers both summon and fusion exactly once |
| TRP-005 | Cancel enemy evolution; Evolution card discarded; evolved form reverts; no sacrifice required | **Preserve sacrifice cancellation exactly as current card text says.** Roll back evolution atomically: restore original character, do not consume sacrifice materials, discard the Evolution card. Must be tested against Lv.40/70/99 thresholds and face-up evolution cards. |
| TRP-006 | At opponent turn end, deal 15 to enemy character with highest ATK | Keep; deterministic tie handling required |
| TRP-007 | At opponent turn start, deal 5 to every enemy character | Keep; snapshot eligible targets before applying damage |
| TRP-008 | Prevent own character destruction, leave it at HP 1 | Keep; must resolve before graveyard transition and once per trap |
| TRP-009 | Cancel attack and return attacker to owner's hand; if full, graveyard | Keep; resolve cancellation before movement and verify hand-full fallback |
| TRP-010 | When own character goes to graveyard, draw 1 | Keep; one trigger per trap activation and respect hand limit |

## 6. Evolution and Fusion
### EVO-001
Current text in DB describes spending one Evolution card from hand per step and sacrificing 1/2/3 face-up characters for Lv.40/70/99. The owner’s latest evolution design says the Evolution Deck is separate and Evolution cards are face-up on the board; required face-up Evolution count is Lv.40 = 1, Lv.70 = 2, Lv.99 = 3. This is a known specification conflict.
- Do not invent a resolution. Claude must inspect the latest approved GDD/rules and implementation, then report the exact conflict.
- Do not change Evolution rules in this balance task.
- Do not rebalance EVO-001's generic effect until its use/consumption lifecycle is confirmed.
- Evolution must be transactional: validate requirements, perform sacrifices and evolution, and only then commit state; failed/cancelled evolution must not partially consume cards.
### FUS-001
Current text: use with two hand characters marked as Fusion partners; stack in one slot (top 100%, bottom 50% + pair bonus).
- Keep the base 100%/50% stacking formula and existing partner bonus values.
- Do not change fusion HP/ATK bonuses.
- Verify stat calculation order and that bottom-card contribution is calculated once, not compounded by repeated recalculation.
- Verify fusion slot occupancy, ownership, graveyard handling and separation/undo rules.

## 7. Cross-card and rules interactions to validate
1. Fusion bonuses, gender pair bonus, affiliation synergy, and story-link bonuses are separate systems. Do not adjust their HP/ATK values under this brief.
2. Check that card effects with `use_limit = none` are still naturally bounded by trigger cadence, and add explicit caps only where the intended design says so.
3. Check all `once_per_turn` effects use a stable per-card/per-turn activation key and cannot be reset by bouncing, evolving, fusing, or changing control.
4. Ensure damage, healing and stat buffs clamp correctly; healing never exceeds max HP.
5. Ensure attack-triggered draw-on-kill resolves only after a confirmed destruction caused by that attack.
6. Ensure graveyard triggers distinguish own vs opposing character and do not fire twice during nested destruction/evolution flows.
7. Target protection on LORDNAM/LUCKY blocks targeted enemy effects only; clarify in UI and tests.
8. Spell buff stacking: SPL-003 and SPL-004 once per target per turn, not one unrestricted application per cast.
9. SPL-007 is confirmed by the owner: swap one of our characters with one enemy character. It is a cross-side exchange, not a same-side positional swap. Keep this meaning consistent in card text, effect config, UI selection and engine behavior.
10. TRP-005 must preserve the current card text's “no sacrifice” cancellation behavior unless Toon explicitly changes that rule.
11. No change to LP, starting hand, 40-card Main Deck, seven character slots, one summon per turn, or any other core rules.

## 8. Required implementation and QA deliverables for Claude
1. Read current main branch and all existing balance-related commits/files before touching code. Compare this brief with any already-implemented changes and avoid duplicate work.
2. Produce a mapping table: proposed change → file/DB field/engine handler/test.
3. Implement on this branch only; no production writes, deployment, merge or migrations applied to production.
4. Add/update automated tests for:
   - HP/ATK base values unchanged for all 48 character cards.
   - DEF matches approved proposal for all 48 after implementation.
   - every changed effect amount, duration, condition and use limit.
   - SPL-003/SPL-004 non-stacking rule.
   - SPL-007 cross-side ownership exchange and atomic rollback on invalid targets.
   - TRP-005 evolution cancellation/sacrifice restoration.
   - Fusion stack formula and one-time bonus application.
   - turn triggers, once-per-turn, once-per-game, death triggers and draw/heal caps.
5. Run all existing test suites and report exact pass/fail counts.
6. Export final 70-card data and diff against baseline. Include explicit proof that all character base HP/ATK values are unchanged.
7. If any proposal cannot be implemented without changing core rules, schema/API, or unsupported engine semantics, do not improvise; list it as BLOCKED with the exact reason and ask Toon.
8. Deliver a concise implementation report and a separate unresolved-questions list for Toon. Do not claim competitive balance is proven until human playtests/telemetry are completed.

## 9. Owner decisions still required — do not guess
- Evolution design conflict: face-up Evolution Deck cards on board vs current EVO-001 hand-spend text; exact consumption/retention lifecycle must be confirmed from approved GDD.
- SPL-007 meaning is confirmed: one friendly character exchanges sides with one enemy character. Claude only needs to verify/implement that exact behavior in the engine; do not ask the owner to redefine the effect. If the engine cannot support it safely, report the technical blocker.
- Whether fusion and synergy bonus values remain frozen for this balancing pass (default instruction here is yes).
- After implementation and QA, Toon reviews DEF/Effect diff before any merge or production release.


## 10. Detailed analysis of the five balance concerns (owner-ready decisions)

### 10.1 Effects with no explicit Use Limit
**Finding:** `use_limit = none` does not automatically mean unlimited activations. A trigger such as `turn_start` or `turn_end` may naturally occur once per relevant turn, while `on_destroyed`, `to_graveyard`, `passive` or nested event triggers may fire multiple times or be re-entered.
**Decision:** Do not mass-add `once_per_turn` to every `none` effect. Preserve the card's current intended trigger cadence. Claude must inspect the event dispatcher and prove whether each effect can resolve multiple times in one turn/event.
**Specific checks:**
- LALAPING-040 `turn_end` heal all allies 5: one resolution per owner's turn; each ally healed at most 5, capped at max HP. It is not “once per card per turn” if the trigger dispatcher already guarantees one turn-end event; add a guard only if repeated dispatch is possible.
- NORMAN-040 `turn_start` self-heal 10: one resolution at the controller's turn start.
- TEE-040 `turn_end` self-heal 10: one resolution at its controller's turn end.
- THAI32-015 `on_destroyed` heal 20: once per actual destruction transition, not every state validation.
- SATOSHI-040 `on_destroyed` heal 20: same one-time destruction-transition rule.
- FOLLOW-YOU-070 `passive` ATK +5: apply once as a static modifier, never once per render/recalculation.
- LALAPING-070 `passive` HP +10: apply once to max/current HP according to the existing passive-stat convention; do not repeatedly add +10 on recalculation. Do not alter printed base HP.
- TEE-040 `on_evolve` ATK +20: only after a successful evolution and once per successful evolution event.
- I-M-GRAPE-015: permanent ATK +5 at turn start with hard total cap +15; no extra stacks from duplicate event delivery.
**Implementation rule:** use event identity / state-transition identity and stable per-card activation keys. Avoid arbitrary global limits that change intended design.

### 10.2 Card draw and card advantage
**Verified effect categories in current DB:**
- On-summon once/game draw 1: CHAEM-015, FOLLOW-YOU-015, PK-015, THOMAS-015.
- Discard 1 then draw 1 on summon: MON-015.
- Draw on confirmed attack destruction once/turn: GOD-WA-015, JAOJAY-015, NONG-TAENGMO-015.
- Draw on attack once/turn: WENDYWENDIE-015.
- Spell draw 2: SPL-005.
- Graveyard-trigger draw once per trap: TRP-010.
**Decision:** Keep these values in this balance pass; no blanket reduction. The once-per-game draw is a one-time tempo/card replacement effect, while draw-on-kill requires winning combat and should reward a successful attack. WENDYWENDIE is the main repeatable draw risk because it does not require a kill.
**Required safeguards:**
1. WENDYWENDIE-015: at most one draw per card per controller turn; trigger only when a real attack is declared/resolved, not when an attack animation or retry event is re-fired. If it can draw even when the attack is cancelled, choose one consistent rule: recommended draw only after the attack has actually proceeded to damage/resolution.
2. GOD-WA / JAOJAY / NONG-TAENGMO: draw only if the target transitions from alive/on-field to destroyed due to this attack; no draw if another effect destroyed it, it was returned to hand, or attack was cancelled.
3. MON-015: must discard exactly one card before drawing one; if hand empty, the effect cannot resolve and does not draw.
4. SPL-005: draw up to two subject to the game's hand capacity; no overflow exploit and no duplicate draw on retry.
5. All draw effects respect one centralized hand-cap rule and deck-empty behavior; do not silently create cards when deck is empty.
6. TRP-010: one draw per actual own-character graveyard transition while this trap is active, then consume the trap exactly once.
**Balance conclusion:** no numerical changes to draw count recommended now. Revisit only if playtests show draw engines dominate; first fix trigger duplication and hand-limit semantics.

### 10.3 Target protection — LORDNAM-015 and LUCKY-015
**Decision:** Protection applies only to enemy effects that explicitly select that character as a target. It does not block:
- ordinary combat attacks (attacks are governed by attack/defense rules, not targetable spell/effect selection);
- non-targeting global effects affecting all characters or a class/group;
- effects that target the controller/player, LP, a slot or a card zone rather than this character;
- the owner's own effects.
It does block a targeted enemy Spell/Trap/character effect whose target is that protected character.
**Duration:** from successful summon until the end of that same turn, as the current card text states. It does not persist through later turns.
**Interaction:** if a cross-side effect such as SPL-007 chooses the protected character as a target, the protection blocks the selection unless the effect is explicitly non-targeting. Once the protection expires, normal targeting applies.
**Important:** this is a rules clarification, not an added permanent shield. Keep both effects and current durations; align UI tooltip and engine target validator. If existing engine uses a different meaning for “cannot be selected”, report the discrepancy and propose a minimal implementation.

### 10.4 Evolution and TRP-005
**Known specification conflict:** database EVO-001 text currently says spend an Evolution card from hand per step and sacrifice 1/2/3 face-up characters for Lv.40/70/99. The latest owner design stored in project context instead says Evolution Deck is separate and face-up Evolution cards are placed on the board; requirement is Lv.40 = 1 face-up Evolution card, Lv.70 = 2, Lv.99 = 3. The exact consumption/retention lifecycle has not been resolved in the approved text available here.
**Decision:** do not guess whether face-up Evolution cards are consumed or remain. Claude must locate the latest approved GDD/rule spec and compare it with the current engine; if still ambiguous, mark the lifecycle as BLOCKED and do not implement a speculative change.
**TRP-005 confirmed behavior from DB card text:** when opponent evolves, cancel that evolution; the Evolution card used is sent to graveyard; evolved form reverts to prior form; sacrifice materials are NOT required / NOT consumed. Preserve this behavior.
**Atomic resolution sequence:**
1. Validate opponent's evolution attempt and the active TRP-005.
2. Snapshot pre-evolution form, evolution resource state, sacrifice material identities, field positions and controller.
3. Cancel the evolution and restore the prior character form.
4. Send only the Evolution card used to graveyard (as card text says).
5. Restore/retain sacrifice materials; do not send them to graveyard.
6. Consume TRP-005 once and close the event.
7. If any step fails, roll back the whole transaction; never leave partial sacrifice or double forms.
**Tests:** cancel Lv.40, Lv.70 and Lv.99 evolution; verify face-up Evolution resource handling under whichever owner-approved model is confirmed; verify no sacrifice material is lost; verify Evolution card is discarded; verify only one trap activation.

### 10.5 Fusion and pair bonuses
**Verified DB facts:** `card_fusion_partners` has partner-chain links for character pairs. Some pairs have +20 HP and +10 ATK bonuses; many have zero. The `def_bonus` is currently 0 in all returned rows. FUS-001 text says stack two linked hand characters in one slot: top contributes 100%, bottom contributes 50%, plus the pair bonus.
**Decision:** keep the 100%/50% formula and all existing partner bonus values in this task. Do not change base HP/ATK or fusion HP/ATK bonus fields. Do not invent new bonuses.
**Required calculation model:**
- Calculate the upper card's current effective stats once at fusion resolution.
- Calculate the lower card's current effective stats once, multiply only the lower contribution by 50% using the game's documented rounding rule.
- Add the existing pair bonus exactly once.
- Apply each external modifier (synergy, temporary buffs, equipment/other modifiers) at one documented stage only; do not apply the same modifier both before and after fusion.
- Store or derive the fused result from source-card identities so repeated UI renders/stat refreshes cannot compound the 50% contribution or pair bonus.
- Define which card is “top” from the player's selection/order and show that clearly before confirming Fusion.
- Confirm what happens to both source cards when Fusion is destroyed, returned, or undone; preserve current rules unless owner-approved GDD states otherwise.
**Synergy separation:** affiliation synergies and gender/story bonuses in DB are marked `proposed` in their descriptions/status context, not necessarily active engine rules. Do not assume they are live. Claude must check the runtime path and feature flags. If inactive, they must not be included in effective stats. If active, calculate them once and include them in the audit, but do not change their values here.
**Balance risk:** Fusion may be disproportionately strong only for the subset with +20 HP/+10 ATK pair bonuses; however, the 50% lower-card contribution and existing bonus can offset or compound depending on implementation. Do not make numeric changes without simulation/playtests. First ensure the formula is deterministic and non-compounding.

## 11. SPL-007 owner clarification (supersedes any earlier discrepancy note)
Toon confirms: **Effect = swap one of our characters with one enemy character.**
- It is not a same-side swap.
- It is a cross-side exchange: one friendly character and one enemy character exchange sides/ownership and board positions.
- Keep the card meaning unchanged. Only verify the implementation matches it.
- Update the UI target picker to require one friendly target and one enemy target.
- Resolve both movements atomically after validating both destinations.
- If a selected character is invalid or the other side's destination cannot accept it, fail cleanly with no partial transfer.
- Do not add any extra stat, damage, or control-duration bonus not stated in the card text.


**End of handoff.**
