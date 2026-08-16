# Pulse Gym Tycoon — rest-timer mini-game (design & implementation brief)

Date: 2026-08-16
Status: Ready for implementation

## 1. Vision

A persistent **gym-management mini-game** ("build your own gym") playable from the
Rest Timer screen between sets. Real workouts mint a currency called **Reps**; during
rest the user spends Reps to buy machines, place/arrange them on a room grid by
dragging, and upgrade them. The gym grows visibly with training consistency.

The game is a **meta-progression layer on top of existing gamification** (badges,
decorations, titles, leaderboard) — not a separate toy.

## 2. Hard rules (non-negotiable)

1. **The rest timer always wins.** When the countdown hits 0 the game panel closes
   itself. No dialogs, no "save?" prompts, nothing blocking `completeTimer`.
2. **Reps are only earned from completed exercises.** Never from tapping, waiting,
   or watching ads-like mechanics. Follow the existing anti-cheat patterns in
   `src/lib/integrity.js` / `store.jsx` (see §5).
3. **No new dependencies.** React 19 + Tailwind v4 + Lucide only. Rendering is
   DOM/CSS/SVG (grid tiles), no canvas engine.
4. **Pure logic in `src/lib`, UI in `src/screens`/`src/components`.** Keep the game
   logic Supabase-free and unit-testable, exactly like `badges.js`, `profile.js`.
5. **Sync for free.** Gym state lives inside the existing store state blob
   (`pulse.state.v2` → `user_data.data`), so cross-device sync needs no new table.

## 3. Game design

### 3.1 The loop
1. User completes an exercise set → store mints Reps (see §5.2 formula).
2. Rest timer runs (30/60/90s presets in `REST_PRESETS`).
3. User taps the "Your Gym" pill on the Timer screen → full-screen panel opens
   showing their gym room.
4. They spend Reps: **buy** a machine from the catalog, **drag it onto a free
   floor cell**, **drag to rearrange**, or **tap a placed machine to upgrade**
   (3 levels each).
5. At ≤10 seconds left the panel shows a subtle "get ready" dim overlay; at 0 it
   auto-closes and the ring screen shows the next set.

### 3.2 Room & machines (v1 scope)
- Room = **4×3 grid of floor cells** (12 slots). Flat top-down tiles, rounded
  corners, `bg-field`/`bg-tile` surfaces, accent-gradient highlights — same visual
  language as the rest of the app.
- Machine catalog (id, label, emoji/SVG art, cost, unlock gym level):

  | id | Label | Base cost | Art |
  |---|---|---|---|
  | bench | Bench Press | 100 | 🛋️/svg |
  | rack | Squat Rack | 180 | 🏋️/svg |
  | dumbbells | Dumbbell Corner | 80 | 🏋️‍♀️/svg |
  | treadmill | Treadmill | 140 | 🏃/svg |
  | cable | Cable Tower | 220 | svg |
  | platform | Deadlift Platform | 300 | svg |
  | mirror | Mirror Wall (decor) | 60 | svg |
  | plant | Plant (decor) | 30 | 🪴 |

- Each machine has **3 levels**. Upgrade cost = base cost × level (lvl2 = ×1, lvl3 = ×2).
  Level changes the tile art (e.g. adds a glow or extra plate) and its **prestige points**.
- **Gym level** = derived value: `floor(total prestige points / 100) + 1`. Pure function,
  computed from `slots`, never stored.
- Decor items (mirror, plant) cost less, give few prestige points — they exist so
  arranging/furnishing feels like The Sims, not only spreadsheet upgrades.

### 3.3 Members (v2 — DO NOT build yet)
Tiny CSS-animated emoji members wandering between owned machines; member count =
gym level. Listed here only so v1 data model doesn't block it.

## 4. Data model

New top-level slice on the store state (`DEFAULT` in `src/lib/store.jsx`):

```js
gym: {
  v: 1,
  balance: 0,        // spendable Reps
  earnedLog: {},     // anti-farm ledger: `${full}|${exercise}` -> awarded amount
  slots: [],         // placed machines: { id: catalogId, cell: 0..11, level: 1..3 }
}
```

- `slots` max length 12, unique `cell`, validated in store actions.
- Add `gym` to `normalize()` (backfill `DEFAULT.gym` for old states), `exportAll()`,
  and `importAll()` — import must **recompute nothing trusted**: accept gym as-is
  but clamp negative balances to 0 (cosmetic currency, see anti-cheat note §5.3).
- Persistence & Supabase sync work automatically via the existing debounced
  `pushState` — no `sync.js` changes needed.

## 5. Economy & anti-cheat

### 5.1 Award trigger
The ONLY mint point is `toggleExercise` in `src/lib/store.jsx` when `willBeDone`
is true (same code path that records the session and computes the clamped weight).

### 5.2 Formula
```
base   = ex.sets * ex.reps                  // planned volume of the completed exercise
weightBonus = weight >= prevBest && weight > 0 ? 20% bonus : 0
awarded = round(base * (1 + weightBonus))   // PRs pay extra
```
Use the **clamped** weight (post-`clampWeight`) for the PR check, so typed-in
fantasy weights can't farm bonuses.

### 5.3 Anti-farm rules (mirror existing patterns)
- **Ledger**: award is written under key `${full}|${exercise}`; if the key exists,
  no Reps. Unchecking + rechecking an exercise cannot re-award (same spirit as
  `totals.lastSessionDay`). Unchecking also does NOT refund.
- **Ledger cap**: keep newest ~120 entries (same `.slice` hygiene as `sessions`).
- Gym currency is **cosmetic** (like decorations): never let it feed badges or
  stats without server cross-checks. If gym level is ever published to
  `profiles.stats`, extend the server validation the way `stats.best` is validated
  against `lifts`.

## 6. Timer integration (TimerScreen)

- While `running && !paused`, show a pill button under the ring / above presets:
  `🏋️ Your Gym · <balance>` (styled like the existing preset chips: rounded-full,
  bg-tile, outline-line/[0.08]).
- The pill is also visible when the timer isn't running (the gym is visitable any
  time — rest is just the natural moment).
- The game opens as its **own nav view** `nav.go('gym')` (see §7), not a modal —
  so the floating mini-timer pill in `Screen` (already built into `ui.jsx`) keeps
  showing the countdown on top of the game, and tapping it returns to Timer.
- Auto-close: inside `GymScreen`, when `timer.running` transitions true→false and
  `timer.left === 0`, call `nav.go('timer')` after ~600ms. When `left <= 10`,
  show a non-blocking banner "Next set in {left}s" with a "Go back" button.
- No changes to `src/lib/timer.jsx` are allowed except exposing already-public
  values. The game must never delay `completeTimer`.

## 7. UI / screens

### 7.1 `src/screens/GymScreen.jsx` (new)
- Wrapped in `<Screen activeTab="timer">`.
- Header row: title "My Gym", gym-level chip, Reps balance pill (accent bg like
  the Continue button in TimerScreen).
- Room: aspect-ratio grid, `grid-cols-4`, gap-2, each cell `rounded-[16px] bg-tile
  outline outline-1 outline-line/[0.08]`. Placed machines render art + level pips.
- Bottom sheet "Shop" (reuse `Modal`/glass-panel conventions from `ui.jsx`):
  catalog cards with cost, disabled state when unaffordable.
- Machine detail sheet on tap: Upgrade (cost, disabled if maxed/unaffordable),
  Move (enters drag mode), Sell (refund 50% of total invested).
- Desktop: follow the existing 50/50 split convention — room left, shop/details
  right at `md:`.

### 7.2 Drag & drop
- Pointer events (`onPointerDown/Move/Up` + `setPointerCapture`) — works for touch
  AND mouse; the user is free-handed during rest, so dragging is a first-class input.
- Drag a placed machine: ghost tile follows the pointer, free cells highlight,
  drop snaps to the cell; dropping outside/onto an occupied cell cancels.
- Buying from the shop places onto the first free cell; user can drag it after.
- Keep it dumb-simple: no inertia, no zoom, no multi-touch.

### 7.3 Navigation entry points
- Add `'gym'` to `SIDEBAR_TABS` in `src/components/ui.jsx` (icon: lucide
  `Dumbbell` via existing ICON_PATHS inline-svg convention), NOT to the mobile
  `TABS` dock (dock stays 4 tabs).
- Wire `nav.name === 'gym'` → `<GymScreen/>` in `App.jsx` next to existing views.
- Timer pill (§6) is the primary entry during workouts.

## 8. Gamification tie-ins (task 5)

- New badges in `src/lib/badges.js` (client-computed from the gym slice, cosmetic):
  - `gym-founder` (Easy): own 3 machines — hint "Place 3 machines in your gym"
  - `gym-landlord` (Medium): own 8 machines
  - `gym-magnate` (Hard): reach gym level 10
  - `gym-empire` (Legendary): all 12 cells filled at level 3
- New decorations unlocked by those badges (extend `DECORATIONS`):
  accessory `headband`, title `title-owner` ("Gym Owner"), frame `gym-floor`.
- These badges are computed **locally from `state.gym`**, not from published
  stats — pass the gym slice into `computeBadges` via a new optional param.
  Document in code that they are cosmetic until server validation exists.

## 9. Task breakdown (execute in order, one brief per task)

### Task 1 — Pure game logic: `src/lib/gym.js` (+ `gym.test.js`)
Catalog (`MACHINES`), cost table, `prestigeOf(slots)`, `gymLevel(slots)`,
`awardFor(ex, prevBest)` (formula §5.2), `canAfford`, `upgradeCost`, `sellRefund`,
`validateSlots(slots)` (bounds, unique cells, known ids).
Tests use `node:test` + `node:assert/strict` (see `changelog.test.js`), run with
`node --test src/lib/gym.test.js`.

### Task 2 — Store integration: `src/lib/store.jsx`
`gym` slice + `normalize` backfill, `gymEarn` inside `toggleExercise` (with
ledger), actions: `gymBuy(machineId, cell)`, `gymUpgrade(id)`, `gymMove(id, cell)`,
`gymSell(id)`. All actions validate via `validateSlots` and refuse negative
balances. Update `exportAll`/`importAll`. Add ledger-cap hygiene.

### Task 3 — Gym screen UI: `src/screens/GymScreen.jsx` + App.jsx + ui.jsx
Grid room rendering, shop sheet, upgrade/sell sheet, nav wiring, sidebar entry.
Follow existing styling conventions exactly (rounded-[20px+] cards, outline-line/10,
accent gradients, `SectionLabel` uppercase labels).

### Task 4 — Drag & drop + timer interplay
Pointer-event dragging (§7.2), TimerScreen pill (§6), auto-close on timer end,
≤10s banner. Verify on touch (mobile viewport) and mouse (desktop/Tauri).

### Task 5 — Badges & decorations tie-in (§8)
Extend `badges.js` + renderers in `ui.jsx` for the new decoration types; show
gym badges in Settings achievements list alongside existing ones.

### Each task ends with
1. `npm run lint` clean
2. `npm run build` clean
3. `node --test src/lib/gym.test.js` green (task 1; extended in later tasks)
4. Manual pass: complete an exercise → Reps appear → buy/place/upgrade works →
   start rest timer → open gym → timer ends → panel returns to ring.
5. Toggle on/off farming check: no duplicate Reps.

## 10. Out of scope / future (v2)
Members animation, visiting friends' gyms (pairs with the chat feature), gym-level
leaderboard column, seasonal gym skins, sounds. Do not pre-build hooks for these
beyond what §3.3 notes.
