# VAreCrazy Card Battle — Hybrid 3D Arena Concept v1

> Status: OWNER-APPROVED VISUAL PROTOTYPE DIRECTION / NOT PRODUCTION INTEGRATION APPROVAL  
> Decision date: 2026-11-26  
> Repository: ToonVrcz/VAreCrazy-Card-Battles-  
> Related specification: docs/ux-ui/BATTLE_ARENA_V1_LAYOUT_SPEC.md

## 1. Decision

The owner selected **Option B — Hybrid 3D Arena**.

The existing first supplied Battle Arena reference image remains the primary visual reference. The goal is to improve the visual quality and depth of that concept, not to replace it with a different design.

## 2. Core visual concept

A dark-fantasy competition venue in the VAreCrazy visual identity: purple, black, and gold; an ornate 3D arena environment; a central battlefield; and the four VAreCrazy team characters seated in a balcony behind/above the field, watching two players compete.

### 3D environment
- Arena architecture and decorative framing.
- Battlefield platform/environment and depth.
- Spectator balcony and seating.
- Environmental lighting, shadows, and restrained atmosphere.
- Seated spectator character presentation for Toon, Add, Nu, and Ball.

### 2D gameplay and interface
Keep all functional game elements as crisp HTML/CSS/DOM:
- Character cards and card frames.
- Seven character slots per player.
- Five Spell/Trap/back-row slots per player.
- Player/opponent identity and LP panels.
- Main Deck, Graveyard, Evolution/Extra Deck controls where supported by the current view.
- Hand cards, selection details, prompts, buttons, phase/turn indicators, and battle log.

## 3. Spectator direction

Toon, Add, Nu, and Ball are audience members, not avatars and not battle units. They must be visibly seated and looking toward the active match. Their silhouettes and poses should read clearly at desktop scale. Reactions may be explored later as subtle cosmetic details only. Do not invent character personalities, dialogue, or signature reactions without owner approval.

Spectator artwork is decorative and must not intercept pointer/touch events or obscure the gameplay plane.

## 4. Technical direction

- Browser-based web game remains the target.
- Evaluate Three.js only for the isolated 3D environment/spectator scene.
- Keep the existing game UI and card rendering as HTML/CSS.
- Use mock data in the prototype; no live engine/API integration.
- Prefer a fixed or tightly constrained perspective camera from slightly above the board.
- Optimize models, textures, lighting, shadows, draw calls, and initial loading cost.
- Provide reduced-motion and low-effects/static fallback behavior.
- Build desktop first, then deliberate tablet and mobile compositions that preserve card readability.

## 5. Performance quality gates

The prototype must be assessed for:
- First-load/download size.
- Scene initialization and time-to-interactive.
- Frame rate and frame-time stability.
- CPU/GPU and memory use.
- Texture/model memory footprint.
- Browser compatibility.
- Low-end mobile usability.
- Behavior with reduced motion and reduced effects enabled.

Use baked/static lighting or simplified effects where they provide the required look at lower cost. The visual scene must never degrade card interaction or legibility.

## 6. Strict scope and exclusions

This approval is for a visual-only prototype, not a production game rewrite.

Allowed in the isolated prototype:
- Three.js for the 3D environment and spectator scene.
- Prototype-only assets, scene composition, camera, lighting, and cosmetic animation.
- Existing 2D HTML/CSS card and HUD presentation, with mock data.

Not authorized:
- Any change to engine/server code, rules, HP/ATK/DEF, card data, rewards/economy, matchmaking, or game outcomes.
- Any API, database, CMS, authentication, or server-authority changes.
- Any exposure of hidden opponent information.
- Any change to the seven character slots or five back-row slots per player.
- Production deployment or merge into main.

## 7. Prototype sequence

1. Preserve the existing approved composition and create a 3D environment blockout.
2. Add the spectator balcony and seated placeholders/character assets for Toon, Add, Nu, and Ball.
3. Align the 2D gameplay plane over the 3D scene; keep cards and controls interactive.
4. Add restrained lighting and environmental polish.
5. Add responsive desktop/tablet/mobile framing and fallback modes.
6. Run performance and interaction checks.
7. Present to the owner for review; do not merge or integrate without a new explicit approval.

## 8. Definition of done

- Recognizably follows the owner's original Battle Arena reference.
- Arena environment reads as 3D, not a flat CSS mockup.
- Four VAreCrazy characters are seated as spectators behind/above the field.
- 2D card game UI remains clear, crisp, and interactive.
- Correct 7 + 5 slot counts per player.
- Desktop/tablet/mobile and reduced-effects behavior are represented.
- Performance measurements and known limitations are documented.
- No production systems or game rules have been changed.
