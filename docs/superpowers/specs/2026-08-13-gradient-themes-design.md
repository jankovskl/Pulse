# Gradient Themes Design

Extends the theme system (see `2026-08-13-theme-presets-design.md`) with 10 uigradients-inspired gradient presets using dark-frosted glass surfaces.

## Context

The app currently ships 6 solid themes (dark, light, glass, midnight, oled, rose), each a 15-token color set applied via `[data-theme=X]` CSS blocks overriding Tailwind v4 `@theme` defaults. The Settings picker already renders each theme as a `bg→bg2` gradient swatch. The user wants uigradients.com-style gradient backgrounds (Sweet Morning, Pure Lust, plus 8 more).

## Decision: dark frosted glass

uigradients colors are vivid (Sweet Morning ends in bright `#FFC371`). Surfaces on gradient themes are **dark translucent + backdrop blur** (Spotify-style) so white text stays readable on the brightest stop of any gradient. This was chosen explicitly by the user over light frosted glass (current Glass look, washes out on bright gradients) and over scrimming the gradient itself (flatter look).

## The 10 gradient themes

All `glass: true`, light text tokens, dark-frosted surfaces. Identical token set shared across all 10 — they differ ONLY in background stops.

| id | name | stops |
|---|---|---|
| `g-sweet-morning` | Sweet Morning | `#FF5F6D → #FFC371` |
| `g-pure-lust` | Pure Lust | `#333333 → #DD1818` |
| `g-royal-blue` | Royal Blue | `#536976 → #292E49` |
| `g-purple-love` | Purple Love | `#CC2B5E → #753A88` |
| `g-sublime-vivid` | Sublime Vivid | `#FC466B → #3F5EFB` |
| `g-vice-city` | Vice City | `#3494E6 → #EC6EAD` |
| `g-love-couple` | Love Couple | `#3A6186 → #89253E` |
| `g-king-yna` | King Yna | `#1A2A6C → #B21F1F → #FDBB2D` (3 stops) |
| `g-pacific-dream` | Pacific Dream | `#34E89E → #0F3443` |
| `g-dawn` | Dawn | `#F3904F → #3B4371` |

Colors verified against the ghosh/uiGradients repository (King Yna from gradient.page — it is a 3-color gradient not present in the repo JSON).

## Shared token set (all gradient themes)

```
bg/bg2/mid: per-theme stops
surface: rgba(0,0,0,0.32)   card: rgba(0,0,0,0.28)
tile: rgba(255,255,255,0.10) field: rgba(0,0,0,0.38)
dock: rgba(10,10,20,0.55)
ink: #F4F4F6  soft: #FFFFFF  sub: #C6C4D4  muted: #8F8DA0  faint: #A6A4B8
line: #FFFFFF  overlay: rgba(0,0,0,0.5)  ring: rgba(255,255,255,0.15)
```

## Architecture

### `src/lib/themes.js`

- Add a `gradientTheme(id, name, { bg, bg2, mid? })` factory that returns a full theme object with the shared token set above and `glass: true`.
- Append the 10 themes to `THEMES` via the factory. Order: after `rose`, grouped together.
- Schema: `mid` becomes an optional 3rd stop. `themeById` fallback to `dark` unchanged.

### `src/index.css`

- One shared block `[data-theme^='g-']` declaring the shared frosted tokens (surface/card/tile/field/dock/ink/soft/sub/muted/faint/line/overlay/ring).
- 10 per-theme blocks `[data-theme='g-…']` overriding only `--color-bg`, `--color-bg2`, and (King Yna) `--color-bg-mid`.
- Backdrop-filter rule: extend the existing selector `[data-theme='glass']` to `[data-theme='glass'], [data-theme^='g-']` so gradient themes get the frosted blur.
- The `[data-theme='glass'] body::before` animated wallpaper stays Glass-only (YAGNI: gradient themes keep their static `screen-bg` gradient).

### `src/components/ui.jsx` (Screen)

- `screen-bg` gradient gains mid-stop support via CSS-var fallbacks at the existing 14.645% / 85.355% positions:
  `linear-gradient(-157deg, var(--color-bg) 14.645%, var(--color-bg-mid, var(--color-bg)) 14.645%, var(--color-bg-mid, var(--color-bg2)) 85.355%, var(--color-bg2) 85.355%)`
- For 2-stop themes the fallbacks resolve to the current exact behavior — the 6 existing themes are pixel-identical.

### `src/screens/SettingsScreen.jsx`

- Appearance card: split the theme grid into two labeled groups — "Themes" (6 existing) and "Gradients" (10 new) with a small section label between them. 3-column grid unchanged.
- Swatch background mirrors the screen formula including `mid` for 3-stop themes.

### ThemeSync

No change — applies `data-theme` id strings as before.

## Testing

- `themes.test.js`: token-key test treats `mid` as optional; new invariant — every theme whose id starts with `g-` is `glass: true` and has a light `ink` token (protects the CSS prefix contract).
- Verification: `node --test src/lib/sync.test.js src/lib/themes.test.js`, `npx oxlint`, `npx vite build`, then manual visual pass through all 10 gradients (Settings, Home, Day detail, Library, Timer, Progress, Leaderboard, Auth modal) checking white text on the brightest stop of each.

## Out of scope

- Animated wallpaper for gradient themes (can be a follow-up).
- Changing the 6 existing themes' tokens or behavior.
- Wallpaper-vs-theme decoupling (separate "wallpaper" concept) — YAGNI; gradients are full themes.