# VAreCrazy Card Battle — Battle Arena v1 Layout Specification

> Status: DESIGN SPECIFICATION / NOT IMPLEMENTATION APPROVAL  
> Date: 2026-11-26  
> Base reviewed: current `main` source on 2026-11-26  
> Scope: Battle Arena visual layout and UX proposal only

## 1. Goal

Define the first practical Battle Arena layout for VAreCrazy Card Battle as a lightweight browser game. Preserve the owner's approved first Arena reference image and extend its composition rather than replacing its art direction.

The Arena should feel like a VAreCrazy competition venue: two players compete on the central battlefield while Toon, Add, Nu, and Ball sit in the background as spectators.

## 2. Verified implementation facts

The following are confirmed in the inspected source as of this document date:

| Area | Verified fact | Source |
|---|---|---|
| Player client | `public/play.html` is the current player-facing page; it loads `/card-renderer.js` and `/engine.js`. | `public/play.html` |
| Current layout | The current client uses a narrow centered app container (max-width 520px), stacked bars, two 7-column character rows, two 5-column back rows, a 5-column hand, and action/navigation controls. | `public/play.html` |
| Character field | Engine rule constant `fieldSlots: 7`; each player's `field` is an array of nullable Units. | `src/engine/game.ts` |
| Back-row field | Engine rule constant `backSlots: 5`; each player's `back` is an array of nullable face-down/set traps or supports. | `src/engine/game.ts` |
| Player state | Player state includes LP, deck, hand, field, back, graveyard, optional extra/evolution cards, and turn flags. | `src/engine/game.ts` |
| Match state | Game state includes turn, active seat, phase (main/battle), winner, pending interaction, events, and event sequence. | `src/engine/game.ts` |
| Server authority | Online room orchestration is server-side; server owns the game state and clients send actions. | `src/server/rooms.ts` |
| Privacy | Opponent hand, deck contents, and face-down traps are not sent to the opposing player. | `src/server/rooms.ts` |
| Spectators | Room constant `spectatorMax: 10`; spectator views are supported by the room/deck-view flow. Spectator UI details still need a targeted verification before a dedicated spectator layout is specified. | `src/server/rooms.ts` |
| Events | Event stream includes turn, draw, summon, attack, damage, LP, destroyed, spell/trap, evolve, fuse, and game-over events; viewer-relative redaction is applied by `viewEvents`. | `src/engine/events.ts` |
| Polling | Room source comment describes HTTP polling at approximately 1.5 seconds. | `src/server/rooms.ts` |

### Important correction to earlier assumptions

The current engine confirms exactly **7 character slots and 5 back-row slots per player**. The current page already renders these as seven and five columns. These counts can therefore be used for the Arena layout, while remaining data-driven from the engine/view rather than hard-coded into visual state.

The existence of `extra`/evolution cards in player state is verified, but their exact visual interaction and visibility rules should be confirmed against the current redacted view before implementation.

## 3. Owner-approved visual direction

These decisions come from the owner's prior approval and the existing UX preparation record:

- Keep the first supplied Battle Arena image as the primary visual reference.
- Keep the battlefield as the central focal point.
- Keep the Dark Fantasy direction with purple, black, and gold.
- Toon, Add, Nu, and Ball are spectators, not player avatars or battle units.
- The characters should be seated and watching the players compete, positioned behind/above the field.
- Spectators must not obscure cards, LP, prompts, or controls.
- Treat VAreCrazy Card Battle as a browser-based web game.
- Prefer layered 2D artwork, HTML/DOM, CSS, and Vanilla JavaScript.
- Do not add a full 3D engine, React, GSAP, or another framework without separate owner approval.

## 4. Proposed desktop Arena composition

Use a wide landscape composition at desktop/laptop widths. The arena is arranged as a set of clear horizontal bands inside a decorative frame.

### A. Arena header — top utility band
Contains:
- Room/match status
- Turn number and active player
- Current phase (Main / Battle)
- Turn timer, when supplied by the current match view
- Match log / event-history control
- Leave / surrender control in the existing supported state

Design intent: compact and readable; never compete visually with the battlefield.

### B. Opponent identity band
Contains:
- Opponent display name / identity
- Opponent LP as a prominent, readable value
- Deck and graveyard counters/actions only where current view permits
- Optional small status indicators (connected / waiting / disconnected) only when supported by the room response

Do not show opponent hand faces, deck order/content, or hidden trap identities.

### C. Opponent back row
- Five back-row slots, matching engine `backSlots: 5`.
- Face-down cards remain visually concealed.
- Empty slots remain visually quiet; legal targeting/highlight states come from server/client legal-action state, not visual guesswork.

### D. Opponent character row
- Seven character slots, matching engine `fieldSlots: 7`.
- Cards face toward the player where practical, but keep card text/stats legible.
- Show only the data present in the viewer-relative state.
- Selection/target/attacked/disabled states must be distinct and accessible without relying on color alone.

### E. Central spectator balcony and Arena centerpiece
This is the visual identity layer behind/above the central field:
- Toon, Add, Nu, and Ball seated in a spectator row/balcony.
- A restrained central crest / arena insignia may sit behind the field as background art.
- Use a low-contrast treatment behind card zones so the field remains dominant.
- Spectator art is pointer-events:none and must not intercept touch/click.
- Optional idle/reaction art is cosmetic only and must never imply hidden information or predict outcomes.

The approved reference image determines the final art placement and proportions. This spec defines the functional layering, not a replacement composition.

### F. Player character row
- Seven character slots.
- Cards, stats, selection, and legal action prompts remain the most visually legible elements.
- Keep the same visual language as the opponent row while clearly identifying the local player's side.

### G. Player back row
- Five back-row slots.
- Own set cards may show their face only when the current player view actually includes the card identity.
- Opponent-facing or spectator views must respect the redacted view.

### H. Player identity band
Contains:
- Player display name / identity
- Player LP
- Deck and graveyard controls/counters
- Evolution/extra-deck control only if supported by the current view
- Optional connected/ready status only when supplied by room state

### I. Hand and action dock
- Hand is anchored at the bottom of the play surface.
- Preserve card aspect ratio and readable touch targets.
- Selected card detail/actions appear in a contextual panel rather than permanently consuming the battlefield.
- Main/Battle phase action and end-turn control remain easy to reach.
- Pending target selection, trap response, or other server prompt must take priority over decorative UI.

### J. Event feedback
- A compact combat log can expand without covering essential card zones.
- Notifications should be driven by the existing event stream.
- High-priority events (attack result, LP loss, destruction, evolve, fusion, game over) may receive stronger visual emphasis.
- All visual feedback must reconcile to the latest server snapshot; it must not independently calculate outcomes.

## 5. Proposed responsive behavior

### Desktop / laptop (primary)
- Landscape board with opponent and player field rows across the center.
- Spectator balcony behind/above the central battlefield.
- Hand dock at bottom.
- Utility and player identity bands kept compact.

### Tablet
- Preserve the same top-to-bottom battle order.
- Reduce spectator balcony height and decorative framing before reducing card readability.
- Keep card slots scroll-free where possible; if constrained, prioritize the seven-card row and allow controlled horizontal overflow only as a documented fallback.

### Mobile
- Do not shrink the desktop board proportionally until cards become unreadable.
- Use a deliberate vertical arrangement: opponent identity → opponent field/back row → compact spectator strip → player field/back row → player identity → hand → action dock.
- Spectators may become a short seated panorama or compact banner; do not remove the identity of the four characters.
- Keep target prompts and primary actions within comfortable thumb reach.
- Card detail should open as a bottom sheet/modal that does not hide the active decision prompt.
- Ensure touch targets, safe-area insets, and scrolling behavior are tested on narrow screens.

## 6. Visual hierarchy and tokens — proposal

| Token | Proposed direction |
|---|---|
| Main background | Deep violet / near-black |
| Primary surface | Aubergine / dark purple |
| Accent | Warm gold |
| Interactive highlight | Bright violet or gold outline, with shape/icon support |
| Important feedback | Gold / amber |
| Damage / danger | Muted crimson |
| Positive buff / heal | Restrained green |
| Borders | Fine ornamental gold/purple lines; avoid excessive ornament around every card |
| Typography | Clear Thai/Latin sans-serif; numbers must remain highly legible |
| Card focus | Strongest contrast and largest visual priority on the field |

Do not treat these as final CSS values; establish exact tokens after comparing against the approved reference artwork and existing card assets.

## 7. Interaction and state rules

1. The server remains the only authority for game state, legal actions, and match outcomes.
2. The UI renders the latest player-relative or spectator-redacted view.
3. Never infer a legal action from appearance alone.
4. Hidden opponent hand/deck/face-down trap information must never be rendered or exposed through DOM data.
5. The spectator layer is decorative and must not receive pointer/touch input.
6. Animation is cosmetic; if an event is delayed, duplicated, skipped, or followed by a state resync, the final displayed board must match the server snapshot.
7. When a prompt is pending, prompt clarity takes precedence over log, effects, and spectator reactions.
8. Reduced-motion mode disables non-essential motion and substitutes static highlights.

## 8. Implementation boundaries

This document does **not** authorize implementation. Once the owner approves implementation, the recommended first technical slice is a visual-only Arena shell using mock data, isolated from the real game state.

Allowed in a future separately approved prototype:
- New visual-only CSS and markup components isolated from the live engine.
- Mock match/player/card data.
- Compressed 2D background and spectator assets.
- Responsive layout and static interaction-state previews.

Not allowed without separate owner approval:
- Changes to `src/engine/**`, `src/server/**`, API contracts, database schema, CMS, reward/economy logic, card values, rules, or deployment.
- Replacing the current client framework or adding dependencies.
- Altering the number or meaning of game slots.
- Changing polling, event contracts, or authoritative state flow.

## 9. Acceptance criteria for the visual-only v1

- [ ] Uses the owner's first Arena image as the primary reference.
- [ ] Battlefield remains the visual focal point.
- [ ] Toon, Add, Nu, and Ball appear seated as spectators behind/above the field.
- [ ] Exactly seven character slots and five back-row slots are represented per player.
- [ ] Player/opponent identity and LP are clearly separated.
- [ ] Hand and primary actions remain accessible.
- [ ] No hidden opponent information is exposed.
- [ ] Desktop, tablet, and mobile layouts are intentionally designed.
- [ ] Spectator artwork never blocks interactions.
- [ ] Reduced-motion / low-effects fallback exists.
- [ ] No engine, backend, API, database, CMS, rules, stats, reward, or dependency changes.
- [ ] Visual prototype is tested with mock data before any live integration.

## 10. Open items before implementation

1. Re-check the current online room response and exact spectator view shape before wiring any live data.
2. Confirm whether the first supplied reference artwork exists as a repository asset or must be provided to the implementation branch.
3. Confirm exact player-name/avatar fields available in the current view.
4. Confirm exact visibility and interaction rules for Evolution/extra-deck display.
5. Confirm whether the approved reference's spectator arrangement can be achieved with existing character art assets or requires new seated poses.
6. Confirm final breakpoint dimensions using a browser prototype.

## 11. Handoff summary

Build the Arena as a presentation layer around the existing player-relative game view. Start with the wide desktop composition and the approved spectator balcony. Use mock data first. Integrate only after a separate owner approval and after confirming the current response shape. Preserve the existing engine and server-authoritative architecture.

**Owner approval required before any implementation or merge.**
