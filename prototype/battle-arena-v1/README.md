# Battle Arena Visual Prototype v1

A standalone, visual-only browser prototype for the VAreCrazy Card Battle Arena.

## Open locally
Open `index.html` in a modern browser. No build step, package install, API, database, or server is required.

## Included
- Desktop-first Arena layout with opponent and player strips.
- 7 character slots and 5 back-row slots on each side.
- Spectator balcony with Toon, Add, Nu, and Ball seated behind the field.
- Sample hand cards, card detail dialog, phase-label toggle, and sample battle log.
- Responsive tablet/mobile rearrangement.
- Reduced-motion fallback.

## Explicitly not included
- No game engine integration.
- No real legal-action validation, attack, damage, LP mutation, turn progression, rewards, matchmaking, or network calls.
- All names, cards, stats, LP, deck/grave counts, and logs are mock data.
- The phase control only changes a display label; it does not advance a real game phase.

## Constraints
No framework, third-party JS dependency, API, DB, CMS, or engine files are changed. The CSS references Google Fonts as a progressive enhancement; system sans-serif fallback is provided. For offline deployment, remove the `@import` and use local/system fonts.
