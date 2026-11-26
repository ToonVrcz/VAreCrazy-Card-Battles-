# Hybrid 3D Battle Arena Prototype v1

Standalone visual-only web prototype for the owner-approved Hybrid 3D direction.

## Run

Open `index.html` in a modern browser with internet access. The 3D scene imports Three.js 0.170.0 from jsDelivr as an ES module. A local HTTP server may be required by some browsers for module loading; no package installation or build step is included.

## Prototype contents

- Three.js dark-fantasy arena environment, raised battlefield platform, columns, rear balcony, lighting, and four differentiated seated 3D spectator silhouettes.
- Toon (red spiked hair), Add (golden hair), Nu (blue hood/hair), and Ball (violet swept hair) are represented as stylized blockout characters, not final production models.
- 2D HTML/CSS player HUD, mock cards, seven character slots and five back-row slots per player, hand, phase display, battle log, and card preview dialog.
- Responsive camera framing and tablet/mobile layout adjustments.
- Low-effects toggle and prefers-reduced-motion handling.
- Animation loop pauses when the browser tab is hidden.
- Mock data only; no engine/API/DB integration.

## Current quality status

- Visual structure: implemented as a prototype blockout.
- Character likeness: not final; silhouettes and palette are differentiated, but owner-supplied character reference art is still needed to match likeness accurately.
- Responsive behavior: CSS and camera breakpoints are implemented; real-device visual QA is still required.
- Performance: pixel ratio is capped, shadow/ambient effects can be reduced, and hidden-tab rendering pauses. No device benchmark has been run yet, so no FPS or memory claims are made.
- Browser QA: not yet completed across Chrome, Edge, Safari, and mobile browsers.

## Known limitations

- No final rigged character models, textures, facial details, or approved likeness references have been supplied in this prototype branch.
- No real card actions, turn progression, legal-action validation, combat, network requests, or game-state integration.
- Three.js is CDN-loaded; offline use is not supported until dependency hosting is decided.
- The 3D scene is a decorative layer only and does not own input or game state.
- This is not production-ready.

## Scope protection

Do not copy this scene into the live client or merge to main without owner review. Do not modify engine/server/rules/stats/rewards/API/DB/CMS or hidden-information behavior as part of this prototype.
