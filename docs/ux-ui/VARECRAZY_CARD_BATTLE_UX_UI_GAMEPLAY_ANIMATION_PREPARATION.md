# VAreCrazy Card Battle — UX/UI, Gameplay UX & Animation Preparation

> Status: PREPARATION / RESEARCH BASELINE  
> Prepared: 2026-11-25  
> Repository baseline reviewed: `main` at `a6c68113e938e8e84a80fe1edcb525b6f16e796d`  
> This document records the initial planning discussion. It is not an implementation instruction or approval to change the game engine.

## 1. Purpose

Prepare a coherent UX/UI and Gameplay Experience specification for VAreCrazy Card Battle, aligned with the current repository and existing server-authoritative game system.

The intended handoff to Claude will eventually cover:

- UX audit of the existing player-facing experience
- Visual direction and design system
- Battle Arena layout and interaction model
- Gameplay UX and player feedback
- Animation specification mapped to existing engine events
- Technical integration notes and acceptance criteria

The preparation phase is documentation and design only. Do not modify the Game Engine, Backend, Database, CMS, API contracts, or deploy anything as part of this planning work unless the owner separately approves it.

## 2. Repository snapshot reviewed

Repository: `ToonVrcz/VAreCrazy-Card-Battles-`  
Default branch observed: `main`

Latest main commit at the time of review:

| Commit | Date (UTC) | Summary |
|---|---|---|
| `a6c6811` | 2026-11-25 | CMS: bulk publish in detailed-settings table |
| `ace62ae` | 2026-11-20 | CMS: bulk detailed metadata settings for gender / games / Story / Fusion |
| `0f53299` | 2026-11-19 | Balance round 1: DEF/effect balance, element matrix, migration 024 |
| `655d42b` | 2026-11-19 | Game balance audit and implementation preparation documentation |
| `5b85f89` | 2026-11-19 | Security: remove trust-by-name from XSS lint |
| `c8dcb62` | 2026-11-19 | Phase 1 remediation: XSS lint, DOM tests, RLS migrations, proxy-header hardening, CSP report-only |

This is a point-in-time snapshot. Re-check `main` and relevant branches before implementation begins.

## 3. Existing architecture — preserve before redesigning

The inspected repository indicates the following architecture and implementation characteristics:

| Area | Observed implementation |
|---|---|
| Game rules | TypeScript engine in `src/engine/` |
| Online rooms | Server-side room orchestration in `src/server/rooms.ts` |
| API routing | Transport-independent router in `src/server/api.ts` |
| Online state | Server-authoritative; clients receive seat-relative redacted views |
| Online transport | HTTP polling; room comment describes approximately 1.5-second polling |
| Player interface | `public/play.html` |
| Card rendering | `public/card-renderer.js` and renderer code embedded/bundled into the play page |
| Board / card visual prototype | `src/board-demo.template.html` |
| Backend / database | Supabase Edge Function and PostgreSQL integration are present in the project |

Important existing online-play behavior observed in `rooms.ts`:

- The server owns the authoritative game state.
- Each player receives a seat-relative, redacted view.
- Opponent hand, deck, and face-down traps are not exposed to the other player.
- Spectators receive a read-only spectator view.
- Room lifecycle includes waiting, lobby, playing, and finished states.
- The host starts the game after the guest is ready.
- Turn timing, timeout handling, disconnect/absence handling, and forfeits are server-managed.

UX must communicate these states clearly without attempting to own or independently calculate authoritative game state.

## 4. Existing gameplay and event integration opportunities

The inspected engine and play client contain event-driven behavior that can serve as the basis for visual feedback and animation mapping.

Events and gameplay moments observed or referenced during review include:

- `summon`
- `attack`
- `dmg`
- `destroyed`
- `evolve`
- `fuse`
- `cast`
- `trap_fired`
- `game_over`

Other existing gameplay concepts visible in the engine include:

- Spell and trap resolution
- Damage to characters and Life Points
- Buffs and debuffs / stat changes
- Graveyard movement
- Target selection for effects
- Fusion bonuses
- Turn and action sequencing
- Interactive prompts / pending answers for player choices

The play client already has a notification queue that consumes engine events, deduplicates and displays notifications, and keeps event progress in session storage. The UI/animation design should build on the actual event contract rather than inventing a parallel rules system.

Before implementation, inspect the complete current event type definitions and payloads in `src/engine/events.ts`, the engine action flow, and the client event consumer. Map every proposed animation to the exact event payload and lifecycle.

## 5. UX/UI direction — initial proposal, not a final design

Proposed visual direction:

- Original VAreCrazy identity; do not copy another game's exact interface or artwork.
- Dark Fantasy atmosphere.
- Core palette direction: purple, black, and gold.
- High-quality card presentation with depth and readable stats.
- Magical visual language for spells, traps, elements, buffs, debuffs, evolution, and fusion.
- Clear hierarchy between board state, player information, hand, action controls, and feedback.
- Responsive layout and a reduced-effects mode for less powerful devices.

Reference point for studying duel-board usability and information hierarchy: Yu-Gi-Oh! Master Duel. Use it as a research reference only, not as a visual template to reproduce.

## 6. Proposed workstreams

### UX-01 — Existing UX Audit
- Inventory the actual screens and flows in the current branch.
- Document current behavior, strengths, friction points, and missing states.
- Separate implemented features from mockups, prototypes, and proposed features.
- Identify the source file and route for every screen.

### UX-02 — Art Direction and Design System
- Define color tokens, typography, spacing, borders, surfaces, iconography, card frames, and feedback states.
- Define visual rules for character, spell, trap, evolution, and fusion cards.
- Establish accessibility and legibility requirements.

### UX-03 — Battle Arena Layout
Treat the Battle Arena as the first major design target because it establishes the shared visual and interaction system.

Elements to investigate and specify:
1. Camera perspective and board orientation
2. Arena environment and background
3. Player and opponent zones
4. Character card slots (the current prototype presents seven active board slots)
5. Spell / Trap placement zones and their actual engine limits
6. Main Deck and Evolution Deck zones
7. Graveyard zone
8. Player identity and Life Points
9. Hand cards and hand interaction
10. Turn indicator, timer, and action controls
11. Target selection and pending decision prompts
12. Spectator presentation, if supported by the current flow

Do not finalize slot counts or placement based only on the prototype. Verify them against the current engine rules and data structures before the spec is approved.

### UX-04 — Gameplay UX
Specify the full player journey and feedback for:
- Create room, join room, public room discovery, lobby, ready, and start
- Deck selection and validation
- Draw and hand management
- Summon and placement
- Attack and target selection
- Spell and trap activation
- Buff / debuff and stat changes
- Evolution and Fusion
- Destruction and graveyard
- Turn transitions, timeout, disconnect, surrender, and match completion
- Spectating and match results

For each interaction, define: player intent, available actions, legal/disabled states, confirmation needs, success feedback, error feedback, and recovery behavior.

### UX-05 — Animation Specification
Create an event-to-animation matrix. For each animation define:
- Triggering engine event and exact payload
- Start and end visual state
- Duration and easing
- Camera movement (if any)
- Sound cue (optional and separately specified)
- Priority and interruption behavior
- Reduced-motion / low-performance fallback
- What happens if multiple events arrive together
- How the UI reconciles with the next server snapshot

Animations must be presentation-only. They must never determine damage, card ownership, turn order, legal actions, or match outcomes.

### UX-06 — Claude Handoff
Deliver one master specification and supporting diagrams/tables with:
- Verified current-state findings
- Approved design decisions
- Open questions and assumptions
- File/component mapping
- Event mapping
- Responsive and performance requirements
- Acceptance criteria
- Explicit out-of-scope list

## 7. Preliminary technical considerations — not approved decisions

Potential technologies discussed for evaluation:

| Concern | Candidate direction | Status |
|---|---|---|
| 3D arena rendering | Three.js | Research only |
| Card tilt / depth | CSS 3D transforms | Research only |
| Timeline / complex animation | GSAP | Research only |
| Simple UI transitions | CSS and JavaScript | Existing-friendly option |
| Gameplay event integration | Existing engine event stream | Preferred integration direction |

Do not add Three.js, GSAP, React, or another framework merely because it appears in this planning document. First evaluate bundle size, mobile performance, compatibility with the existing Vanilla JavaScript client, accessibility, maintainability, and whether CSS/DOM animation is sufficient.

## 8. Non-negotiable architecture and scope constraints

1. Preserve the server-authoritative game architecture.
2. The client must not become the source of truth for game rules or outcomes.
3. Do not reveal hidden opponent information through UI state, animation, debug output, or payload handling.
4. Do not change game rules, card values, HP, ATK, DEF, reward logic, database schema, API contracts, or CMS behavior as part of UX preparation.
5. Do not replace the current frontend framework without explicit owner approval.
6. Animation must be cosmetic and must tolerate polling delays, duplicate events, missing intermediate frames, reconnects, and state resynchronization.
7. Every screen and interaction must be checked against actual current implementation before being described as existing.
8. Any implementation task for Claude must include scope, files allowed to change, prohibited changes, tests, and acceptance criteria.

## 9. Initial decision log

| ID | Decision / principle | Status |
|---|---|---|
| D-UX-001 | Begin with research and UX audit before implementation | Agreed |
| D-UX-002 | Battle Arena is the first major design workstream | Proposed starting point |
| D-UX-003 | Preserve current engine and server-authoritative architecture | Required constraint |
| D-UX-004 | Use engine events as the source for animation triggers | Preferred direction; exact mapping pending |
| D-UX-005 | Dark Fantasy with purple / black / gold as initial art direction | Initial proposal; owner approval pending |
| D-UX-006 | Three.js / GSAP are candidates only, not approved dependencies | Research only |
| D-UX-007 | No code, database, CMS, API, or deployment changes during preparation | Agreed |

## 10. Immediate next task

Start with **UX-01 + UX-03 research**:

1. Re-read the latest `main` and compare it with any active development branches.
2. Inspect all current player-facing screens and identify the real entry points.
3. Inspect the complete engine event definitions and board/deck constraints.
4. Produce a current-state screen inventory and a Battle Arena layout requirements document.
5. List unresolved questions before drawing a final board layout.

Do not begin implementation until the owner reviews and approves the UX/UI specification.

---

**Document owner:** VAreCrazy project owner  
**Planning assistant:** ChatGPT (Ball) — UX/UI and Gameplay Experience planning  
**Implementation handoff:** Claude — only after owner approval  


## 11. Owner-confirmed visual reference — Battle Arena

The owner confirmed that the **first supplied Battle Arena image** is already an acceptable visual direction and should remain the primary visual reference. Do not replace it with a substantially different concept merely to add more decoration.

Core composition to preserve:
- The card battlefield remains the central focal point.
- The VAreCrazy team characters appear in the background as spectators watching the players compete.
- The spectator area belongs behind/above the battlefield, visually separated from interactive card zones.
- Keep the established purple / black / gold Dark Fantasy atmosphere, ornate framing, glowing card zones, player LP panels, phase information, hand cards, and action controls.
- The characters are not player avatars and are not combat units. They are part of the arena audience / VAreCrazy world presentation.

### Spectator presentation

The intended scene is an arena match with VAreCrazy characters seated and watching the two players compete. Treat the first supplied image as the accepted starting reference for the overall look and composition.

Possible future presentation details (design proposals, not yet individually approved):
- A dedicated spectator balcony / seating row behind the arena.
- Each team character has a recognizable seated pose and a clear silhouette.
- Small, restrained reactions to major match events (watching attentively, leaning forward, cheering, surprise, disappointment).
- Reactions must remain secondary to the game board and must never obscure cards, stats, LP, prompts, or controls.
- Character reactions are cosmetic and must not communicate hidden information or imply an outcome before the server confirms it.

Do not invent or permanently assign character personalities, dialogue, or unique behavior without owner-provided character references / approval.

## 12. Web-game delivery constraints — owner-confirmed

The owner explicitly clarified that VAreCrazy Card Battle is a **web game**. All visual and interaction design must be evaluated as a browser-based game, not as a native PC game or a full 3D game.

Principles:
1. Preserve the current web client and Vanilla JavaScript direction unless the owner approves a change.
2. Prefer layered 2D artwork, HTML/DOM, CSS, and lightweight JavaScript for the arena, cards, HUD, spectator layer, and transitions.
3. Use CSS transforms / transitions for depth and movement where practical; do not assume a real-time 3D scene is required.
4. Do not add Three.js, GSAP, React, a new renderer, or another framework without a separate technical evaluation and explicit owner approval.
5. Any proposed asset or animation must consider download size, first-load time, memory, CPU/GPU use, browser compatibility, and lower-powered mobile devices.
6. Optimize and serve character art and arena backgrounds as appropriately compressed assets; avoid loading unnecessary high-resolution or off-screen assets.
7. Support desktop and laptop as primary wide layouts while defining usable tablet and mobile adaptations. Mobile must be intentionally rearranged, not merely scaled down until text and cards become unreadable.
8. Provide reduced-motion / low-effects behavior and avoid continuous decorative animation that wastes resources.
9. Animation remains presentation-only. The server-authoritative engine remains the sole authority for game state, legal actions, and outcomes.
10. The spectator layer must not block pointer/touch interaction with the actual game UI.

## 13. Updated design principles and decision log

| ID | Decision / principle | Status |
|---|---|---|
| D-UX-008 | Use the owner's first supplied Battle Arena image as the primary visual reference; retain its overall composition and visual direction | Owner confirmed |
| D-UX-009 | VAreCrazy team characters are spectators watching the players compete, not player avatars or battle units | Owner confirmed |
| D-UX-010 | Keep the spectator characters in the background / audience area so the battlefield remains the primary focus | Owner-confirmed intent; exact layout to be specified |
| D-UX-011 | This is a browser-based web game; design for browser performance and responsive behavior | Owner confirmed |
| D-UX-012 | Prefer lightweight layered 2D + HTML/DOM/CSS/Vanilla JavaScript over a full 3D implementation | Design/technical direction; evaluate against current source before implementation |
| D-UX-013 | Character idle/reaction animation may be explored, but must be subtle, cosmetic, performance-aware, and must not reveal hidden game information | Proposed constraint |

### Scope reminder

This update is documentation only. It does not authorize changes to the player UI, Game Engine, server, API, CMS, database, dependencies, or deployment. The existing UX-01 / UX-03 research task remains subject to re-checking the latest implementation before detailed layout specifications are finalized.


## 14. Owner-approved Hybrid 3D decision — 2026-11-26

**Decision: Option B — Hybrid 3D Arena.** This is the current approved direction and supersedes D-UX-012 above wherever it conflicts. The older 2D-first recommendation is retained as historical context only; it is no longer the selected Arena direction.

- Preserve the first supplied Battle Arena image as the primary visual reference.
- Use 3D for the arena environment, platform depth, architecture, spectator balcony, lighting/shadows, and seated spectator presentation.
- Toon, Add, Nu, and Ball sit behind/above the battlefield watching the two players compete. They remain spectators, not avatars or combat units.
- Keep cards, card slots, player information, LP, deck/grave/evolution controls, hand, prompts, action buttons, turn/phase indicators, and battle log as 2D HTML/CSS/DOM.
- Evaluate Three.js only for the isolated 3D scene. The owner has approved its use in a visual-only prototype; no additional framework or animation dependency is approved by this decision.
- This remains a browser-based web game. Desktop first, with deliberate tablet/mobile layouts, reduced-motion and low-effects/static fallback, and performance testing for load time, memory, CPU/GPU, frame stability, and low-end devices.
- The approval is for an isolated prototype using mock data only. It does not authorize live engine integration, production deployment, or merge to main.
- No changes to engine/server code, rules, HP/ATK/DEF, card data, rewards, API, database, CMS, authentication, hidden-information handling, or server-authoritative behavior.
- Preserve exactly 7 character slots and 5 back-row slots per player.

The detailed concept and acceptance criteria are recorded in docs/ux-ui/BATTLE_ARENA_HYBRID_3D_CONCEPT_V1.md and the updated Battle Arena layout spec.

| ID | Decision / principle | Status |
|---|---|---|
| D-UX-014 | Adopt Hybrid 3D: 3D arena environment and seated spectators; 2D HTML/CSS gameplay and HUD | Owner confirmed |
| D-UX-015 | Use Three.js only in an isolated visual prototype, subject to performance gates | Owner confirmed for prototype only |
| D-UX-016 | Prototype must not change production engine, rules, card stats, API, DB, CMS, rewards, or deploy/merge to main | Owner confirmed |
