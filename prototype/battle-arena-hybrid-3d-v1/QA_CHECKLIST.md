# Hybrid 3D Battle Arena — Prototype QA Plan

> Status: IMPLEMENTATION CHECKLIST / DEVICE TESTS NOT YET RUN  
> Branch: prototype/battle-arena-hybrid-3d-v1  
> Scope: isolated visual prototype only

## Implemented safeguards

- Three.js is limited to the decorative environment and spectator scene.
- Cards, slots, HUD, hand, prompts, and controls remain 2D HTML/CSS.
- The 3D canvas and scene wrapper have pointer events disabled.
- Rendering pixel ratio is capped at 1.35 in normal mode and 1.0 in low-effects mode.
- Low-effects mode disables shadows and continuous ambient motion.
- Reduced-motion preference starts the prototype in low-effects mode.
- Rendering pauses when the browser tab is hidden.
- Camera framing changes at desktop, tablet, and narrow mobile breakpoints.
- All card/game values are mock data; no server or engine connection exists.

## Manual visual QA matrix

| Test | Desktop | Tablet | Mobile | Status |
|---|---|---|---|---|
| Arena composition resembles approved reference | Pending | Pending | Pending | Not run |
| Four spectators clearly read as seated audience | Pending | Pending | Pending | Not run |
| Both player rows and 7 character slots remain legible | Pending | Pending | Pending | Not run |
| Both back rows show exactly 5 slots | Pending | Pending | Pending | Not run |
| Cards and buttons remain clickable above the 3D canvas | Pending | Pending | Pending | Not run |
| No horizontal overflow or clipped essential controls | Pending | Pending | Pending | Not run |
| Low-effects mode renders a stable static scene | Pending | Pending | Pending | Not run |
| Reduced-motion preference is respected | Pending | Pending | Pending | Not run |

## Performance measurements to collect

Test on representative desktop, mid-range mobile, and lower-powered mobile devices.

- Initial document and module download size.
- Time until the arena scene is visible.
- Time until card controls can be used.
- Average and 1% low frame rate during the scene.
- CPU/GPU load and memory after 5 minutes.
- WebGL context loss/recovery behavior.
- Thermal/battery impact on mobile after 10 minutes.
- Results with shadows enabled and with low-effects enabled.

Do not claim performance readiness until these measurements are actually collected.

## Browser coverage

- Chrome desktop
- Edge desktop
- Safari macOS/iOS
- Chrome Android

## Release gates

1. Owner reviews visual match against the original reference.
2. Owner supplies/approves the character reference art before final likeness work.
3. Manual responsive and interaction QA passes.
4. Performance results are documented and accepted.
5. Separate explicit approval is obtained before live integration or merge to main.
