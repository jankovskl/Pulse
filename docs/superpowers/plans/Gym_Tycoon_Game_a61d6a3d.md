# Gym Tycoon Game inside Pulse

Cartoonish 3D bird's-eye-view gym management game, launched from the Timer tab as a full-screen overlay. Follows the existing spec at [2026-08-16-gym-tycoon-design.md](file:///c:/Users/mateu/Documents/.VS%20projects/Pulse/Pulse/Pulse/docs/superpowers/specs/2026-08-16-gym-tycoon-design.md), scoped to Phases 1-2.

## Tech Approach

- **Rendering**: vanilla `three.js` (new dependency, `npm i three`) with a fixed-angle perspective camera for the bird's-eye look. All models are procedural low-poly primitives (rounded boxes, cylinders, capsules) in the doc's vibrant palette — no external assets. Blob/fake shadows, DPR capped at 2 for mobile.
- **Architecture**: pure-JS simulation core decoupled from React (tick loop), React only for HUD/panels. Avoids re-render cost during the game loop.
- **Persistence**: `localStorage` key `pulse.gym.v1`, debounced save + save-on-close. Local-only (no Supabase sync — that is a later phase).
- New code lives in `Pulse/src/game/` plus one overlay component; existing Pulse conventions (Tailwind v4 theme tokens, lucide-react icons, rounded-pill buttons) used for all UI.

## Simulation Core — `Pulse/src/game/`

- `catalog.js` — equipment catalog: cardio (treadmill, bike), strength (bench, rack, cable machine), amenities (plant, water cooler, juice bar, mirror, poster). Each entry: cost, footprint (1x1 / 2x1), zone color, income rate, tier chain (basic -> advanced -> elite with upgraded look + income). Staff catalog: cleaner, trainer with wage and effect stats.
- `engine.js` — tick-based sim (dt-driven, pauses when overlay closed):
  - Grid floor 12x12, expandable via purchase at gym levels.
  - Placement rules: occupancy check, footprint fit.
  - Clients: spawn at door rate driven by reputation + time-of-day curve; walk to free machines (simple BFS pathing on grid); use machine for a duration; pay coins; leave. Mood (wait time, cleanliness, decor coverage) -> happy/sad emoji billboards -> reputation (0-100).
  - Staff: cleaners restore cleanliness (which decays with client traffic), trainers shorten workout time + boost satisfaction; wages deducted each in-game day.
  - Economy + progression: coins, XP from visits/revenue, gym level unlocks catalog items and expansions.
  - In-game clock (accelerated day cycle) feeding the top-bar day/time indicator.
  - Capped offline earnings computed from elapsed wall time on load.
- `save.js` — serialize/normalize/restore sim state; versioned payload.

## 3D Renderer — `Pulse/src/game/render.js`

- Scene: gym floor with color-coded zone tiles, walls + entrance door, soft cartoon lighting.
- Procedural mesh builder per catalog item; tier upgrades swap mesh variants.
- Clients/staff as capsule avatars with randomized colors, simple bob/walk animation, machine-use animations (treadmill belt scrolling, bench bobbing).
- Camera controls: drag to pan, pinch/wheel zoom, clamped to floor bounds. Tap = raycast to grid cell (place/select); drag threshold distinguishes tap vs pan.
- Feedback: floating "+coins" sprites, emoji sprites over heads, placement ghost + green/red validity highlight, level-up confetti particles.

## Overlay UI — `Pulse/src/components/GymGame.jsx`

Full-screen `fixed inset-0 z-40` overlay containing the canvas plus HUD (all Tailwind, matching Pulse styling):

- **Top bar**: coins, gym level + XP bar, reputation stars, in-game day/time, close button.
- **Rest timer chip**: own compact pill using `useTimer()` showing live rest countdown; pulses/turns accent when rest ends so players never miss a set.
- **Build menu** (bottom sheet): category tabs, item cards with cost, tap item then tap grid to place; move and sell modes; upgrade button on selected machine sheet.
- **Staff panel**: hire/fire, wage info, active counts.
- **Goals/level sheet**: current level, next unlocks, simple goal list (e.g. "Reach 50 visits").

## Timer Tab Integration

- [TimerScreen.jsx](file:///c:/Users/mateu/Documents/.VS%20projects/Pulse/Pulse/src/screens/TimerScreen.jsx): add a "Gym Tycoon — play while you rest" card below the presets that opens the overlay (local state in TimerScreen). No router changes needed.
- Sim keeps running only while overlay is open; state persists across open/close.

## Out of Scope (later phases)

Monetization/cosmetics, cloud save + leaderboards, audio/music, staff skill trees, expansion gym themes.

## Test Plan

- `npm run lint` (oxlint) and `npm run build` per repo verification convention.
- Manual check via `npm run dev`: place/move/sell/upgrade equipment, clients spawn + path + pay, staff effects, level-up unlocks, save/restore after close and reload, rest-timer chip countdown while playing, mobile-width layout.

## Assumptions

- Entry stays Timer-tab-only (overlay), no new nav tab.
- Local save only; account-scoped/cloud sync deferred.
- No audio in MVP.