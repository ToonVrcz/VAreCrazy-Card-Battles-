# VAreCrazy Card Battles — 39 Character Signature Spell / Trap Cards
**Date:** 2026-11-25  
**Branch:** `balance/full-70-card-handoff`  
**Status:** OWNER-APPROVED DESIGN PROPOSAL — NOT YET IMPLEMENTED IN GAME / DATABASE  
**Owner:** Toon  
**Design:** Ball  
**Scope:** One dedicated Spell or Trap card for each of the 39 Lv.15 characters  
**Market price:** 300 Point per card

## 1. Design intent
Create exactly one signature support card for each Lv.15 character. Each card is tied to its named character and can only be activated while that specific Lv.15 character is on its owner's field. The card's effect should reflect that character's existing identity and ability.

- 39 characters = 39 signature cards.
- Each character receives exactly one card: either Spell or Trap.
- Market price is fixed at 300 Point each.
- If all 39 are purchased once, gross market value is 11,700 Point.
- These are additional cards; they do not replace any existing Spell, Trap, Character, Story, Fusion, or Evolution card.
- No character base HP/ATK/DEF is changed by this proposal.
- No existing card effect or existing Story/Fusion record is changed.
- The proposed effects below are design text, not confirmed engine capabilities. Claude must map them to supported effect handlers and report any unsupported behavior rather than improvising.

## 2. Activation and ownership rules proposed for this set
1. A signature card is playable only if its linked Lv.15 character is currently on the field under the activating player's control.
2. A signature Spell resolves only when legally activated; after resolution it goes to the Graveyard.
3. A signature Trap must first be set according to the game's existing Trap rules; it can activate only when its listed trigger occurs and its linked character is still on the field under its owner's control. After resolution it goes to the Graveyard.
4. If the linked character leaves the field or changes control before activation/resolution, the signature card cannot activate; if already activated as a resolving effect, use the engine's normal resolution/target validation policy.
5. A signature card is not itself a character and does not occupy a character slot.
6. These cards are separate from the existing 10 Spell and 10 Trap cards. They are 39 additional proposed card records.
7. One copy of each signature card is listed in the market catalogue. Market stock refresh, purchase limits, resale, and deck inclusion rules are not defined here; Claude must not invent or implement those economy rules without Toon approval.

## 3. Full 39-card catalogue

| # | Linked Lv.15 character | Card name | Type | Effect proposal |
|---:|---|---|---|---|
| 1 | 1GOKU-015 | หมัดทะลวงขีดจำกัด | Spell | Give 1GOKU-015 ATK +10 until the end of the current turn. |
| 2 | BABY-015 | พลังผู้พิทักษ์ตัวน้อย | Spell | Heal 15 HP to BABY-015 or one other allied character. Cannot exceed that character's maximum HP. |
| 3 | BACKJI-015 | สวนกลับฉับพลัน | Trap | When BACKJI-015 is chosen as an attack target, give BACKJI-015 ATK +10 until that battle resolves. |
| 4 | BADGUY-015 | กลยุทธ์ลวงศัตรู | Trap | When BADGUY-015 is attacked, reduce the attacking enemy's ATK by 10 until that battle resolves. |
| 5 | BAM-015 | คมดาบเร่งพลัง | Spell | Give BAM-015 ATK +10 until the end of the current turn. |
| 6 | BAMMIE-015 | ตั้งรับเคียงข้าง | Trap | When an allied character would take battle damage, reduce that damage by 10. The linked BAMMIE-015 must be on the field. |
| 7 | BOBO-015 | ฟันเปิดทาง | Spell | Give BOBO-015 ATK +10 for its next attack this turn. |
| 8 | CHAEM-015 | แผนสำรองของแช่ม | Spell | Give one allied character DEF +5 until the end of the current turn. |
| 9 | CUTIE-015 | เวทมนตร์สะกดขวัญ | Spell | Choose one enemy character; reduce its ATK by 10 until the end of the current turn. |
| 10 | DNMAN-015 | คำพิพากษาครูเสด | Spell | Give DNMAN-015 ATK +10 for its next attack this turn. |
| 11 | FOLLOW-YOU-015 | ส่งกำลังใจ | Spell | Give one other allied character ATK +5 and DEF +5 until the end of the current turn. |
| 12 | GOD-WA-015 | พันธสัญญานักล่า | Trap | When GOD-WA-015 destroys an enemy character by its attack, heal 10 HP to GOD-WA-015. Trigger once for this card's resolution. |
| 13 | I-M-GRAPE-015 | เถาวัลย์คุ้มกัน | Spell | Give I-M-GRAPE-015 DEF +5 until the end of the opponent's next turn. |
| 14 | JAOJAY-015 | กับดักจู่โจมย้อนศร | Trap | When JAOJAY-015 is declared as an attack target, reduce the attacker's ATK by 10 until that battle resolves. |
| 15 | LALAPING-015 | พรแห่งการเยียวยา | Spell | Heal 20 HP to one allied character. Cannot exceed its maximum HP. |
| 16 | LEON-S-KENNEDY-015 | ยุทธวิธีเอาตัวรอด | Trap | When another allied character is sent from the field to the Graveyard, give LEON-S-KENNEDY-015 DEF +5 until the end of the current turn. |
| 17 | LINLADA-015 | หอกพิชิตแนวหน้า | Spell | Give LINLADA-015 ATK +10 for its next attack this turn. |
| 18 | LORDNAM-015 | เกราะคุ้มกันเจ้าน้ำ | Trap | When an enemy effect selects LORDNAM-015 as its target, negate that effect's application to LORDNAM-015. Does not negate non-targeting effects or attacks. |
| 19 | LUCKY-015 | จังหวะโชคช่วย | Trap | When LUCKY-015 is selected for an enemy attack, the opponent must choose a different legal attack target if one exists; otherwise the attack proceeds normally. |
| 20 | MELON-015 | พลังนักรบเมลอน | Spell | Give MELON-015 ATK +10 until the end of the current turn. |
| 21 | MIKI-015 | จังหวะเร่งฝีเท้า | Spell | Give MIKI-015 ATK +5 and DEF +5 until the end of the current turn. |
| 22 | MON-015 | อ่านเกมขาด | Trap | When an enemy Spell targets MON-015, reduce the effect's numerical damage or stat reduction to MON-015 by 5. If the effect has no numerical value, this Trap has no effect. |
| 23 | NONG-TAENGMO-015 | แรงฮึดนักสู้ | Spell | Give NONG-TAENGMO-015 ATK +10 for its next attack this turn. |
| 24 | NORMAN-015 | พลังหมีคำราม | Spell | Give NORMAN-015 DEF +10 until the end of the current turn. |
| 25 | OUFILLING-015 | สัญญาจากสุสาน | Trap | When another allied character is sent from the field to the Graveyard, heal 10 HP to OUFILLING-015. Trigger once per actual Graveyard transition for this Trap. |
| 26 | PIKACHU-015 | สายฟ้าช็อตสนาม | Spell | Deal 10 damage to one enemy character. |
| 27 | PK-015 | คำแนะนำจากพีเค | Spell | Give one allied character DEF +5 until the end of the opponent's next turn. |
| 28 | PKXCY-015 | หมัดประสานพลัง | Spell | Give PKXCY-015 ATK +10 until the end of the current turn. |
| 29 | SATOSHI-015 | พรฟื้นฟูซาโตชิ | Spell | Heal 15 HP to one allied character. Cannot exceed its maximum HP. |
| 30 | SKYMOON-015 | โลหะจันทราคุ้มภัย | Spell | Give one allied character DEF +10 until the end of the current turn. |
| 31 | SMILE-015 | รอยยิ้มแห่งการปกป้อง | Trap | When an allied character would be destroyed by an enemy effect, prevent that destruction once and leave it at 1 HP. Does not prevent battle destruction unless the engine treats it as an effect. |
| 32 | SOMYES-015 | ศรผนึกพลัง | Trap | When an enemy character declares an attack, reduce that enemy's ATK by 5 until the battle resolves. |
| 33 | TAN-015 | แผนค้นหาวิวัฒนาการ | Spell | If TAN-015 is on the field, look at the top 3 cards of your Main Deck, reveal any Evolution card among them, add one revealed Evolution card to your hand, and place the rest on the bottom in an order chosen by the owner. If no Evolution card is found, place all 3 on the bottom. |
| 34 | TEE-015 | เร่งเครื่องเต็มกำลัง | Spell | Give TEE-015 ATK +15 until the end of the current turn. |
| 35 | THAI26-015 | คมดาบไทยยี่สิบหก | Spell | Give THAI26-015 ATK +10 for its next attack this turn. |
| 36 | THAI32-015 | น้ำใจหลังการต่อสู้ | Trap | When THAI32-015 is destroyed and sent to the Graveyard, heal 10 HP to one other allied character. |
| 37 | THOMAS-015 | คำสั่งการของโทมัส | Spell | Give one allied character ATK +5 until the end of the current turn, then draw 1 card. The draw is optional if the hand is at capacity; no card is created beyond the hand limit. |
| 38 | WENDYWENDIE-015 | จังหวะโจมตีต่อเนื่อง | Trap | When WENDYWENDIE-015 declares an attack, give it ATK +5 for that attack. This does not itself draw a card. |
| 39 | ZEESKY-015 | คลื่นพลังสะท้านฟ้า | Spell | Deal 10 damage to one enemy character. |

## 4. Balance notes and items requiring owner confirmation
This set is intentionally conservative and mostly uses small, temporary modifiers. The following entries have special interactions and must be checked carefully:
- #18 LORDNAM: overlaps conceptually with LORDNAM-015's existing summon protection. The Trap is intended to protect against a later targeted enemy effect, but the engine's target-protection rules must be checked.
- #19 LUCKY: current character effect already prevents enemy targeting for the rest of the summon turn. This Trap is intended to manipulate attack target selection, not to grant general untargetability. Confirm the game has legal attack-target selection rules supporting this.
- #22 MON: depends on the engine exposing the numerical value of a targeted enemy Spell effect. If unsupported, mark BLOCKED and suggest a simpler alternative; do not approximate.
- #31 SMILE: the proposed “leave at 1 HP” behavior resembles TRP-008. Confirm whether the signature Trap should be distinct from or reuse that existing effect. Do not duplicate implementation logic unsafely.
- #33 TAN: deck top-three inspection, selective reveal, and bottom-deck ordering may not exist in the current engine. If unsupported, mark BLOCKED and propose a simpler search alternative for Toon.
- #37 THOMAS: adds draw to a temporary buff. Confirm that the linked character restriction and hand-limit handling work. Do not permit duplicate draws on retries.
- #38 WENDYWENDIE: existing character already draws on attack. This Trap deliberately adds a small attack buff only, not another draw.

## 5. Required Claude review before implementation
1. Verify all 39 character IDs exist and are Lv.15 in the current card dataset.
2. Verify that exactly one proposed signature card is assigned to each of the 39 characters, with no missing or duplicate character.
3. Inspect the current card schema, CMS form, effect config format, effect resolver, target selection, Trap activation timing, turn-duration handling, Graveyard transitions, deck/hand limit, and market/shop implementation.
4. Map every proposed card to existing supported effect handlers. Provide a table: card ID/name → required effect config → existing handler or missing capability → test required.
5. Identify effects that overlap with existing Spell/Trap cards or character abilities; flag them rather than silently removing or rewriting the proposal.
6. For unsupported mechanics, mark BLOCKED and offer a minimal alternative for Toon to approve. Do not add new engine semantics or schema fields without approval.
7. Confirm the market price field can represent 300 Point and inspect the existing market purchase flow. Do not implement market stock, purchase limits, or wallet changes unless separately approved.
8. Prepare a non-production implementation plan and test plan. No Supabase writes, production migrations, deployment, merge, or production release under this approval.
9. Export a proposal JSON/CSV or CMS-ready mapping only after schema inspection; do not fabricate unknown required fields.
10. Return a review report to Toon before making code or database changes.

## 6. Hard constraints
- The owner has approved the design work for 39 signature cards at 300 Point each. This does not authorize production implementation or DB writes.
- Keep this proposal additive. Do not modify existing 70-card catalogue entries.
- Do not change any character's base HP/ATK/DEF.
- Do not modify existing Spell/Trap cards, Story links, Fusion partner rows, Evolution rules, game rules, API contracts, or DB schema.
- Do not deploy, merge, or write to production.
- Preserve all existing Story/Fusion records and their values exactly.
- If any effect is ambiguous or unsupported, report it as BLOCKED and ask Toon before substituting another effect.

**End of proposal.**
