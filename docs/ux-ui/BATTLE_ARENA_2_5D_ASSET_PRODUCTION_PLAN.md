# VAreCrazy Card Battles — Battle Arena 2.5D & Asset Production Plan

> Status: OWNER-DIRECTED UX/UI PLAN — VISUAL PROTOTYPE ONLY  
> Decision date: 2026-11-27  
> Target: Browser-based game (/play)  
> Primary reference: Owner-supplied “VAreCrazy Battle Arena” reference image from 2026-11-27  
> Implementation branch: `ux/battle-arena-2-5d-assets-plan-2026-11-27`

## 1. Current owner direction

The owner wants the Battle Arena to visually match the supplied reference: a premium dark-fantasy card battle scene with a purple / black / gold palette, dramatic perspective, glowing magical details, ornate UI, and the four VAreCrazy team members seated as spectators on the upper balcony.

The game is browser-based and must remain practical on desktop and mobile. The current implementation direction is **Premium 2.5D**, not a plain flat board and not a full Three.js arena.

Use layered 2D artwork, CSS perspective/transforms, lighting, shadows, and DOM UI to create convincing depth while keeping cards and controls crisp, accessible, and interactive.

This is a visual direction decision. It does not authorize production integration.

## 2. Visual target and hierarchy

### Primary reference characteristics to preserve
- Dark fantasy competition venue.
- Purple, near-black, and warm gold as the core palette.
- Stone arena / magical battlefield with strong perspective and depth.
- Upper spectator balcony featuring Toon, Add, Nu, and Ball.
- Ornate gold frames and purple accents for HUD and controls.
- Card artwork remains the clearest, most readable interactive content.
- Player and opponent LP panels are prominent.
- Hand cards sit along the bottom edge of the play surface.
- Strong visual polish without excessive decoration obscuring play.

### Layer stack
1. Background architecture / arena backdrop.
2. Spectator balcony and four character artworks.
3. Arena floor and battlefield surface.
4. Slot frames and card placement plane.
5. Player/opponent HUD, LP, turn/phase indicators.
6. Hand cards, contextual card detail, action dock, prompts, and event feedback.
7. Cosmetic glow / magic effects.

Use CSS/DOM for functional layers. Decorative art must not intercept pointer or touch events.

## 3. Asset production list

Create only assets that materially improve fidelity. Prefer reusable layered assets over one flattened screenshot.

### P0 — Required to establish the visual identity

| Asset | Purpose | Recommended format | Notes |
|---|---|---|---|
| Arena background | Main fantasy venue, architecture and depth | WebP, with optional layered PNGs | Wide desktop composition; keep gameplay area low-contrast enough for legibility |
| Spectator balcony / upper scene | Background stage behind the four characters | WebP or transparent PNG layers | Separate from character cutouts where practical |
| Toon spectator art | Seated upper-balcony character | Transparent PNG/WebP | Use approved Toon character reference; do not redesign identity |
| Add spectator art | Seated upper-balcony character | Transparent PNG/WebP | Use approved Add character reference; do not invent details |
| Nu spectator art | Seated upper-balcony character | Transparent PNG/WebP | Use approved Nu character reference; do not invent details |
| Ball spectator art | Seated upper-balcony character | Transparent PNG/WebP | Use approved Ball character reference; do not invent details |

Character images should share a consistent art style, lighting direction, camera angle, scale, and rendering quality. Prefer waist-up or seated three-quarter poses that fit the balcony. Keep transparent edges clean. The four characters are spectators, not player avatars or battle units.

### P1 — Gameplay presentation assets

| Asset | Purpose | Recommended approach |
|---|---|---|
| Arena floor / center crest | Adds depth and a central magical identity | Separate transparent layer or background texture |
| Character slot frame | Seven character positions per player | CSS component first; use image texture only if CSS cannot match the reference |
| Spell/Trap slot frame | Five back-row positions per player | CSS component first; visually distinct from character slots |
| Card back | Deck, opponent hidden hand, and set cards | Reuse existing approved card-back asset if available; otherwise create one reusable asset |
| Card selection / target glow | Shows selection and legal targeting | CSS effects, not baked into card art |
| Magic circle / ambient particles | Subtle cosmetic effects | Small transparent WebP/PNG or CSS; respect reduced-motion |

### P2 — UI decoration (create after layout is approved)

- LP panel ornament / frame.
- Card detail panel border.
- Turn and phase banner decoration.
- Button icon set for supported actions.
- Small deck / graveyard / evolution controls decoration.
- Subtle corner ornaments and ambient light overlays.

Keep all text, values, labels, LP numbers, card data, and button hit areas as HTML/CSS. Do not bake text into image assets. Avoid making a separate image for every button or every slot unless a tested visual need justifies it.

## 4. Suggested asset dimensions and delivery

These are production targets, not rigid constraints; Claude should confirm final dimensions against the actual layout and optimize for web delivery.

- Main arena background: 16:9 master artwork, target 2560×1440; provide a 1920×1080 optimized WebP derivative.
- Balcony/background layer: same composition coordinate system as the arena master, preferably separated from the arena background.
- Spectator character cutouts: target 1200–1600 px tall per character at source quality, transparent PNG or WebP with alpha where supported by the pipeline.
- Card back: match the existing card aspect ratio and design system; preserve exact ratio, no stretching.
- Decorative overlays: transparent assets, tightly cropped to visible content.
- Prefer WebP/AVIF for photographic or painted backgrounds where alpha is not required; use transparent PNG/WebP for cutouts.
- Keep source masters separately from optimized runtime files.

Naming convention:
- `arena-main-master.png`
- `arena-main.webp`
- `balcony-background.webp`
- `spectator-toon.png`
- `spectator-add.png`
- `spectator-nu.png`
- `spectator-ball.png`
- `arena-center-crest.png`
- `card-back.webp`

## 5. Responsive compositions

### Desktop / laptop
- Wide landscape composition closest to the reference image.
- Spectator balcony spans the upper background.
- Opponent field and back row above the central crest.
- Player field and back row below the central crest.
- Hand and action dock at the bottom.
- Keep the battlefield and card artwork as the main focal point.

### Tablet
- Reduce decorative balcony height and side ornaments first.
- Preserve card readability and all slot positions.
- Avoid shrinking the entire desktop image as a single bitmap.

### Mobile portrait
- Create a deliberate vertical composition; do not simply scale down desktop.
- Spectator art becomes a compact upper panorama / short balcony strip while retaining all four identities.
- Keep opponent identity and field, player field, hand, prompts, and primary actions visible and usable.
- Use a contextual bottom sheet for card details where appropriate.
- Ensure safe-area insets, touch targets, and scrolling are tested.
- Do not hide or change the 7 character + 5 back-row slot rules per player.

## 6. Technical implementation guidance for Claude

- Inspect current `public/play.html`, existing CSS, card renderer, and current asset inventory before changing anything.
- Prefer existing vanilla HTML/CSS/JavaScript architecture; do not add a framework or library for this visual task.
- Use CSS perspective, layered backgrounds, transforms, gradients, shadows, masks, and restrained animation for the 2.5D depth.
- Use DOM elements for every interactive card, slot, button, HUD value, and prompt.
- Decorative images must use `pointer-events: none` and must not cover interactive zones.
- Use existing card art and card renderer where possible; do not recreate card faces as flattened background images.
- Keep all labels, Thai/Latin text, numbers, LP, ATK/DEF, and card rules live in DOM text.
- Reuse the existing card-back asset if one exists.
- Do not add animation that communicates an unconfirmed game outcome. Visual effects must follow existing events or mock events.
- Provide a reduced-motion / low-effects mode and static fallback.
- Optimize image dimensions, compression, loading priority, and lazy loading for below-the-fold or non-critical assets.
- Do not use a full-scene screenshot as the only mobile layout; compose responsive layers deliberately.

## 7. Gameplay layout constraints

The current game rules and field structure remain unchanged:
- 7 character slots per player.
- 5 Spell/Trap / back-row slots per player.
- Current game phase model must be respected; do not copy extra phases from the reference image if they do not exist in the game.
- LP values and all card stats must come from the current game view or mock data during prototype.
- Hidden opponent hand, deck contents, and face-down card identities must never be exposed.
- Toon, Add, Nu, and Ball are decorative spectators only.

## 8. Work phases and checkpoints

### Phase 0 — Audit and preparation
1. Inspect current play page, CSS, card renderer, and existing artwork.
2. Identify reusable card-back, character, logo, and UI assets.
3. Record missing assets and confirm which supplied reference files are available.
4. Create a visual asset manifest and proposed layer map.
**Checkpoint:** send the owner a short reuse/missing-assets report before producing large batches of artwork.

### Phase 1 — Core art pack
1. Produce the arena background.
2. Produce the balcony background/layer.
3. Produce four consistent seated spectator cutouts (Toon, Add, Nu, Ball).
4. Optimize files and add them to the isolated prototype asset folder.
**Checkpoint:** present a static composition screenshot for owner approval.

### Phase 2 — Arena shell
1. Build layered 2.5D arena composition.
2. Position the spectator balcony and characters.
3. Add battlefield floor, center crest, perspective, depth, lighting, and shadows.
4. Ensure the board remains visually dominant and cards remain readable.
**Checkpoint:** present desktop arena screenshot before adding detailed HUD decoration.

### Phase 3 — Gameplay UI skin
1. Apply purple/black/gold design tokens.
2. Style player/opponent LP panels, turn/phase banner, buttons, and card detail.
3. Render exactly 7 character slots and 5 back-row slots per side.
4. Keep cards and text as interactive DOM elements.
**Checkpoint:** present a full mock-match screenshot with sample cards and LP.

### Phase 4 — Cosmetic animation
Use CSS/vanilla JS and existing event hooks or mock events only:
- Card enter / summon.
- Attack movement and impact.
- Damage / LP feedback.
- Spell and trap activation.
- Evolution and Fusion presentation.
- Turn / phase change and game-over presentation.
Animations are cosmetic only; do not calculate or alter game outcomes.
**Checkpoint:** review motion clarity and reduced-motion behavior.

### Phase 5 — Responsive and performance QA
Test:
- Desktop wide (e.g. 1920×1080 and 1366×768).
- Tablet landscape and portrait.
- Mobile portrait (including narrow viewport).
- Card readability and tap targets.
- Initial asset download size and load behavior.
- FPS / animation smoothness on representative devices.
- Reduced-motion and low-effects mode.
- Browser console errors and broken assets.
**Checkpoint:** provide screenshots, test matrix, asset-size report, known limitations, and preview URL if available.

### Phase 6 — Owner review
The owner reviews the visual prototype. Any production integration, live data wiring, merge, or deployment requires a separate explicit approval.

## 9. Strict scope and safety boundaries

Allowed:
- Visual-only work on an isolated branch.
- HTML/CSS layout and styling.
- Decorative image assets and optimized asset pipeline.
- CSS/vanilla JS cosmetic animation.
- Mock data and visual state previews.
- Local/preview testing that does not affect production.

Not allowed without separate owner approval:
- Changes to `src/engine/**`, `src/server/**`, `src/edge/**`, API contracts, database schema/migrations, CMS, authentication, economy/rewards, matchmaking, rules, card data, or card stats.
- Changes to server-authoritative behavior or game outcomes.
- Revealing hidden opponent information.
- Changing the 7+5 slot structure.
- Adding a new framework, 3D engine, or paid dependency.
- Merging into `main` or deploying to production.

Never deploy until the owner explicitly says **Deploy**.

## 10. Definition of done

- [ ] Visual direction clearly matches the supplied Battle Arena reference.
- [ ] Premium dark-fantasy purple / black / gold identity is consistent.
- [ ] Arena has convincing 2.5D depth, not a flat CSS board.
- [ ] Toon, Add, Nu, and Ball appear as seated spectators on the upper balcony.
- [ ] Character and balcony assets are visually consistent and optimized.
- [ ] 7 character slots + 5 back-row slots per player are represented.
- [ ] Cards, card text, LP, stats, buttons, and prompts remain crisp DOM elements.
- [ ] Desktop, tablet, and mobile compositions are intentionally designed.
- [ ] Decorative assets do not intercept pointer/touch interaction.
- [ ] Cosmetic animations follow event/mock state and do not affect outcomes.
- [ ] Reduced-motion / low-effects fallback exists.
- [ ] Asset sizes, load behavior, and responsive QA are documented.
- [ ] No engine, rules, card data, backend, database, CMS, reward, or production changes.
- [ ] Owner has reviewed the preview; no merge/deploy occurred without approval.

## 11. Open inputs / dependencies

- The supplied reference image is present in the conversation but must be added to the implementation workspace or shared with Claude as a reference file; do not assume it already exists in the repository.
- Use approved character reference art for Toon, Add, Nu, and Ball. If any character source is missing, ask the owner for that specific reference rather than inventing a new design.
- Confirm whether the existing card-back and logo assets can be reused before creating replacements.
- Confirm the actual target browser/device matrix during QA.

## 12. Handoff summary

Build a **Premium 2.5D Battle Arena** for the browser. Preserve the owner's supplied reference image as the visual anchor. Create the five most important visual inputs first: one arena background plus four seated spectator character assets. Add the balcony as a separate layer where practical. Keep all game cards and functional UI as HTML/CSS/DOM. Proceed in small visual checkpoints, starting with an asset audit and static composition. This is a visual-only prototype; production integration, merge, and deployment are not approved.
