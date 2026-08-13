# Theme Presets Design

Date: 2026-08-13
Status: Approved

## Goal

Discord-style theme customization: users pick one of six full presets (Dark, Light, Glass, Midnight, OLED, Rose). The accent color remains separately adjustable on top of any preset. A proper light theme requires converting the ~150 hardcoded hex colors across screens to theme-aware semantic tokens.

## Approach

Token system with `data-theme` presets. One `themes.js` file defines every preset as a full mapping of UI-role colors. Applied as `data-theme="<name>"` on `<html>`; CSS `[data-theme=...]` blocks override the Tailwind `@theme` defaults in `index.css`. Accent stays a separate CSS variable, unchanged.

Alternatives rejected: Tailwind `dark:` variant (only supports 2 states, cannot express 6 presets cleanly), JS-injected variable sets (no CSS fallback, harder to preview/transition).

## Design

### 1. Theme tokens & presets

- New `src/lib/themes.js` defining 6 presets: `dark`, `light`, `glass`, `midnight`, `oled`, `rose`.
- Each preset defines the full set of UI role colors: `bg`, `bg2`, `surface`, `card`, `tile`, `field`, `ink`, `soft`, `sub`, `muted`, `faint`, plus new `line` (borders) and `overlay` (dim/scrim) tokens, and per-theme flags `glass` + `wallpaper` gradient colors.
- Applied via `data-theme="<name>"` on `<html>`; `index.css` gets `[data-theme=...]` blocks that override the `@theme` defaults.
- `store.settings` gains `theme: 'dark'` (default). Persistence, backup export/import, and cross-device sync keep working as-is (settings are already merged and exported wholesale).
- `AccentSync` in `App.jsx` becomes `ThemeSync`: sets `data-theme` on `<html>` plus the accent vars in one effect.

### 2. Color conversion (one-time cleanup)

- Replace the ~150 hardcoded hexes in screens/components with semantic classes: `bg-surface`, `bg-card`, `bg-tile`, `bg-field`, `text-ink`, `text-soft`, `text-sub`, `text-muted`, `text-faint`, and new `line`/`overlay` tokens for borders (`outline-line`, `border-line`) and scrims (`bg-overlay`).
- White/black alpha blends (`bg-white/10`, `bg-black/60`) become token-based so they work in light themes too (dark theme = white-alpha borders, light theme = black-alpha).
- Colors that are semantic and constant across themes stay literal: `good` green, `gold/silver/bronze` medals, danger `#DB3B3E`, theme swatch colors themselves.
- No behavior changes — purely class swaps, screen by screen, verified by build + visual pass in each theme.

### 3. Settings UI: theme picker

- Discord-style grid of 6 theme cards, each a mini preview: the theme's background color, a fake card tile with the theme's surface color, and the accent dot.
- Tap applies instantly (no save button); active card gets the accent outline/checkmark, matching the existing accent-swatch styling.
- Card names: Dark, Light, Glass, Midnight, OLED, Rose. Sits above the existing "Color themes" accent row, retitled to make the split clear (Theme / Accent color).
- Uses the same `Row`/surface styling language as the rest of Settings.

### 4. Glass preset

- Wallpaper: soft, slow-drifting animated gradient (CSS keyframes, ~20s loop, muted accent-tinted hues) behind everything, fixed, never interfering with tap targets.
- Cards/surfaces become frosted: semi-transparent surface tokens + `backdrop-blur` so the gradient glows through; borders stay subtle.
- Only the `glass` theme uses it; the other 5 get plain backgrounds as today.
- Text stays high-contrast on the frosted cards; the gradient uses the current accent color as one of its hues so it reacts to accent changes.

### 5. Persistence, transitions, testing

- Theme lives in `store.settings.theme` → auto-saved to localStorage, included in backup export/import, synced cross-device like accent.
- Brief crossfade (CSS `transition`) when switching themes so it feels like Discord's instant-but-soft swap.
- Verification: existing vitest suite keeps passing, `vite build` clean, plus a manual visual pass on all 6 themes across Home, Timer, Progress, Settings; light theme checked for contrast on cards/inputs/leaderboard rows.

## Files touched

- `src/lib/themes.js` (new)
- `src/index.css` (preset token blocks, glass wallpaper keyframes)
- `src/lib/store.jsx` (settings default + theme passthrough)
- `src/App.jsx` (ThemeSync)
- `src/screens/SettingsScreen.jsx` (theme picker grid, retitle rows)
- All screens/components: semantic class swaps

## Out of scope

- User-defined custom themes / theme editor
- Per-screen background customization
- Light-theme variants of the Neko pet or leaderboard medal colors