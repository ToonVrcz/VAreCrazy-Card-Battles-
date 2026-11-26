# Hybrid 3D Battle Arena Prototype v1

Standalone visual-only web prototype for the owner-approved Hybrid 3D direction.

## Run

Open index.html in a modern browser with internet access. The 3D scene imports Three.js 0.170.0 from jsDelivr as an ES module. A local HTTP server may be required by some browsers for module loading; no package installation or build step is included.

## Prototype contents

- Three.js dark-fantasy arena environment, raised battlefield platform, columns, balcony, lighting, and seated stylized 3D spectators for Toon, Add, Nu, and Ball.
- 2D HTML/CSS player HUD, mock cards, seven character slots and five back-row slots per player, hand, phase display, battle log, and card preview dialog.
- Desktop-first responsive layout with tablet/mobile adaptations.
- Low-effects toggle and prefers-reduced-motion handling.
- Mock data only; no engine/API/DB integration.

## Known prototype limitations

- Spectators are primitive stylized 3D placeholders, not final character models or approved likenesses.
- No real card actions, turn progression, legal-action validation, combat, network requests, or game-state integration.
- Three.js is CDN-loaded; offline use is not supported until dependency hosting is decided.
- Performance has not yet been benchmarked on a device matrix. This is a visual prototype, not production-ready.

## Scope protection

Do not copy this scene into the live client or merge to main without owner review. Do not modify engine/server/rules/stats/rewards/API/DB/CMS or hidden-information behavior as part of this prototype.
