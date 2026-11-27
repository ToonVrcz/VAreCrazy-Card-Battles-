# Battle Arena Visual Prototype v2 (2.5D + image layers)

Visual-only prototype. Mock data. No engine / API / DB / CMS connection. Not for production; not merged to main.

- Direction: owner's Battle Arena reference (purple/black/gold fantasy arena, spectator balcony with Toon, Add, Nu, Ball).
- Spectator band: image layer cropped from the owner's reference (`assets/spectators*.jpg`); the stray "AJDD" label was retouched out.
- Battlefield: CSS 3D perspective plane (`rotateX`) with a generated stone floor texture (`assets/floor.jpg`); 7 character slots + 5 back-row slots per side.
- Cards, HUD, hand, buttons: real HTML/CSS (clickable). Card art is cropped from the reference (placeholder, low-res).
- Card back: owner's supplied back design (`assets/card-back.jpg`).
- Phases shown: Main / Battle / End only (matches game rules).
- Layouts: desktop landscape 1672x941, phone portrait 430x932, phone landscape 940x430 (auto-picked by screen; force with ?m=land|port|pl), all scaled to fit. Low-effects toggle and prefers-reduced-motion supported.
- Run: open `index.html` (local file works). `?m=port` / `?m=land` forces a layout.
