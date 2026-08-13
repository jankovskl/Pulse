# Implementation Plan: Theme Presets

- **Date**: 2026-08-13
- **Project**: Pulse workout app (React 19 + Vite 8 + Tailwind CSS v4 + lucide-react)
- **Spec**: `docs/superpowers/specs/2026-08-13-theme-presets-design.md` (committed `7caba4b`, user-approved)
- **Pre-implementation status**: Design approved; all screens inventoried (HomeScreen, DayDetailScreen, LibraryScreen, TimerScreen, ProgressScreen, LeaderboardScreen, SettingsScreen, ui.jsx, AuthModal.jsx, App.jsx, store.jsx, index.css)

## Summary

Add 6 full color presets (Dark, Light, Glass, Midnight, OLED, Rose) to the Pulse workout app. A `data-theme` attribute on `<html>` switches a set of semantic color tokens defined in `[data-theme=...]` CSS blocks that override the Tailwind v4 `@theme` defaults. Every hardcoded color in the UI is converted to a semantic token so all presets render correctly. The accent color stays independently adjustable (existing behavior). Settings gains a Discord-style theme picker grid with live preview cards.

## Goals

1. User picks a theme preset in Settings; the whole app recolors instantly.
2. 6 presets: `dark` (current look), `light`, `glass` (frosted cards over an animated accent-tinted wallpaper), `midnight` (deep purple), `oled` (pure black), `rose` (soft pink light theme).
3. Accent color remains a separate, per-theme-independent setting.
4. No visual regression in the `dark` preset.

## Global Constraints

- **Commands**: run in PowerShell with workdir `C:\Users\mateu\Documents\.VS projects\Pulse\Pulse`. Lint: `npx oxlint`. Build: `npx vite build` (a pre-existing chunk-size warning is acceptable). Unit tests: `node --test src/lib/sync.test.js src/lib/themes.test.js`.
- **Never use `white/` or `black/` alpha utilities for surfaces** — those break the light themes. They become `line/`, `overlay`, or token-based values.
- **Semantic constants stay literal in every theme** (do NOT tokenize): `#17C964` (good), `#F5A524` (gold), `#DB3B3E` + `#F2606E` (danger), `#FF7A7D`, `#B08D57` (bronze podium), `#3B3B47` (leaderboard avatar bg), `DAY_COLORS` in `data.js`, the podium gradients `from-[#F5A52422]`, `from-[#A1A1AA22]`, `from-[#B08D5722]` + their `outline-[...40]` in LeaderboardScreen. `--color-accent` / `--color-accent-light` usage is untouched.
- **Silver token**: `text-silver` is a *medal* color; do not use it for secondary text. `#C9C9D6` used as text becomes `text-sub`.
- **White-on-accent text** (`text-[#0B0B12]` on accent backgrounds) becomes `text-white` — accent backgrounds stay saturated in every theme.
- **Single source of truth**: `src/lib/themes.js` defines every preset's full token set (used by the Settings preview cards and tests). `src/index.css` `[data-theme=...]` blocks MUST match those values exactly — Task 12's visual pass is the drift check.
- Commit after each task (`git add` the touched files only; the repo has unrelated uncommitted changes from another session — never `git add .`).

## Mapping Table (used by every conversion task)

Replace hardcoded colors with semantic tokens:

| Old | New | Notes |
|---|---|---|
| `bg-[#0B0B12]` / `#0b0b12` in gradients | `var(--color-bg)` | Screen wrapper gradient → `bg-[linear-gradient(-157deg,var(--color-bg)_14.645%,var(--color-bg2)_85.355%)]` + add `screen-bg` class |
| `#050508` (body bg in CSS) | `var(--color-bg)` | in index.css only |
| `#17171FCC` (TabDock) | `bg-dock` | new `--color-dock` token |
| `#0F0F16` | `bg-field` | existing token |
| `#1F1F2A` | `bg-tile` | Timer preset chips |
| `#262728` / `#23242B` | `bg-tile` | Home input / active card |
| `#1C1C22` | `bg-card` | Home rest-day option |
| `#1B1B26` (ring track) | `stroke="var(--color-ring)"` | new `--color-ring` token |
| `bg-white/5`, `bg-white/10`, `outline-white/5`, `outline-white/10`, `border-white/5`, `border-white/10`, `bg-white/[0.08]` | same with `line` instead of `white` | new `--color-line` (#FFF dark, #000 light) |
| `bg-black/40`, `bg-black/60` | `bg-overlay` | new `--color-overlay` token (Modal scrims) |
| `color="#FCFCFC"` (lucide) | `color="var(--color-soft)"` | text on accent/chips |
| `color="#F4F4F6"` | `color="var(--color-ink)"` | back chevrons |
| `color="#A1A1AA"` | `color="var(--color-sub)"` | secondary icons |
| `color="#6E6E7A"` | `color="var(--color-muted)"` | tertiary icons |
| `color="#9C9CA8"` / `text-[#9C9CA8]` | `var(--color-faint)` / `text-faint` | faint icons |
| `color="#71717A"` | `color="var(--color-muted)"` | gray icons |
| `#C9C9D6` as text (dropdowns) | `text-sub` | NOT `text-silver` |
| `text-[#0B0B12]` on accent | `text-white` | Start/Continue/preset-active labels |

## Theme Token Values (single source → `src/lib/themes.js`; mirrored in index.css)

Keys: `bg, bg2, surface, card, tile, field, dock, ink, soft, sub, muted, faint, line, overlay, ring`.

- **dark** (current): `#0B0B12, #131322, #17171F, #18181B, #232325, #0F0F16, #17171FCC, #F4F4F6, #FCFCFC, #A1A1AA, #6E6E7A, #9C9CA8, #FFFFFF, rgba(0,0,0,0.6), #1B1B26` — glass: false
- **light**: `#F2F3F7, #E6E8F0, #FFFFFF, #FFFFFF, #EDEEF4, #FFFFFF, rgba(255,255,255,0.85), #1B1C24, #0E0F16, #4E515C, #8B8D9A, #767986, #000000, rgba(0,0,0,0.35), #E4E6EE` — glass: false
- **glass**: `rgba(14,14,26,0.55), rgba(20,18,48,0.55), rgba(255,255,255,0.08), rgba(255,255,255,0.07), rgba(255,255,255,0.12), rgba(0,0,0,0.28), rgba(16,16,30,0.55), #F4F4F6, #FFFFFF, #C6C4D4, #8F8DA0, #A6A4B8, #FFFFFF, rgba(0,0,0,0.5), rgba(255,255,255,0.15)` — glass: true
- **midnight**: `#0E0D1C, #171431, #17142E, #1A1733, #262143, #0B0A18, rgba(14,13,28,0.85), #F1EFFA, #FAF9FF, #B3AECC, #6F6B8C, #9C97B8, #FFFFFF, rgba(0,0,0,0.6), #211D40` — glass: false
- **oled**: `#000000, #000000, #0A0A0A, #0D0D0D, #151515, #000000, rgba(0,0,0,0.9), #F5F5F5, #FFFFFF, #A8A8A8, #6E6E6E, #9C9C9C, #FFFFFF, rgba(0,0,0,0.7), #141414` — glass: false
- **rose**: `#FDF2F6, #FBE4ED, #FFFFFF, #FFFFFF, #F6E3EA, #FFFFFF, rgba(255,255,255,0.85), #3A2430, #1F0F17, #8A6474, #B08B9B, #9D7488, #000000, rgba(0,0,0,0.35), #F1D9E2` — glass: false

---

## Task 1 — `src/lib/themes.js` + tests + store default

**Goal**: The theme preset data module exists, is unit-tested, and the store defaults include the new setting.

**Files**: `src/lib/themes.js` (new), `src/lib/themes.test.js` (new), `src/lib/store.jsx` (edit)

**Store edit** (`src/lib/store.jsx` line 12): `settings: { notify: true, neko: true, accent: '#0485F7' }` → `settings: { notify: true, neko: true, accent: '#0485F7', theme: 'dark' }`. No other store changes needed (settings are already merged/exported wholesale).

**`src/lib/themes.js`** (plain JS, no React — testable with `node:test`):

```js
export const DEFAULT_THEME = 'dark'

export const THEMES = [
  {
    id: 'dark', name: 'Dark', glass: false,
    colors: { bg: '#0B0B12', bg2: '#131322', surface: '#17171F', card: '#18181B', tile: '#232325', field: '#0F0F16', dock: '#17171FCC', ink: '#F4F4F6', soft: '#FCFCFC', sub: '#A1A1AA', muted: '#6E6E7A', faint: '#9C9CA8', line: '#FFFFFF', overlay: 'rgba(0,0,0,0.6)', ring: '#1B1B26' },
  },
  {
    id: 'light', name: 'Light', glass: false,
    colors: { bg: '#F2F3F7', bg2: '#E6E8F0', surface: '#FFFFFF', card: '#FFFFFF', tile: '#EDEEF4', field: '#FFFFFF', dock: 'rgba(255,255,255,0.85)', ink: '#1B1C24', soft: '#0E0F16', sub: '#4E515C', muted: '#8B8D9A', faint: '#767986', line: '#000000', overlay: 'rgba(0,0,0,0.35)', ring: '#E4E6EE' },
  },
  {
    id: 'glass', name: 'Glass', glass: true,
    colors: { bg: 'rgba(14,14,26,0.55)', bg2: 'rgba(20,18,48,0.55)', surface: 'rgba(255,255,255,0.08)', card: 'rgba(255,255,255,0.07)', tile: 'rgba(255,255,255,0.12)', field: 'rgba(0,0,0,0.28)', dock: 'rgba(16,16,30,0.55)', ink: '#F4F4F6', soft: '#FFFFFF', sub: '#C6C4D4', muted: '#8F8DA0', faint: '#A6A4B8', line: '#FFFFFF', overlay: 'rgba(0,0,0,0.5)', ring: 'rgba(255,255,255,0.15)' },
  },
  {
    id: 'midnight', name: 'Midnight', glass: false,
    colors: { bg: '#0E0D1C', bg2: '#171431', surface: '#17142E', card: '#1A1733', tile: '#262143', field: '#0B0A18', dock: 'rgba(14,13,28,0.85)', ink: '#F1EFFA', soft: '#FAF9FF', sub: '#B3AECC', muted: '#6F6B8C', faint: '#9C97B8', line: '#FFFFFF', overlay: 'rgba(0,0,0,0.6)', ring: '#211D40' },
  },
  {
    id: 'oled', name: 'OLED', glass: false,
    colors: { bg: '#000000', bg2: '#000000', surface: '#0A0A0A', card: '#0D0D0D', tile: '#151515', field: '#000000', dock: 'rgba(0,0,0,0.9)', ink: '#F5F5F5', soft: '#FFFFFF', sub: '#A8A8A8', muted: '#6E6E6E', faint: '#9C9C9C', line: '#FFFFFF', overlay: 'rgba(0,0,0,0.7)', ring: '#141414' },
  },
  {
    id: 'rose', name: 'Rose', glass: false,
    colors: { bg: '#FDF2F6', bg2: '#FBE4ED', surface: '#FFFFFF', card: '#FFFFFF', tile: '#F6E3EA', field: '#FFFFFF', dock: 'rgba(255,255,255,0.85)', ink: '#3A2430', soft: '#1F0F17', sub: '#8A6474', muted: '#B08B9B', faint: '#9D7488', line: '#000000', overlay: 'rgba(0,0,0,0.35)', ring: '#F1D9E2' },
  },
]

const TOKEN_KEYS = ['bg', 'bg2', 'surface', 'card', 'tile', 'field', 'dock', 'ink', 'soft', 'sub', 'muted', 'faint', 'line', 'overlay', 'ring']

export function themeById(id) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
```

**`src/lib/themes.test.js`** (mirror the style of `sync.test.js` — `node:test` + `node:assert/strict`):

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_THEME, THEMES, themeById } from './themes.js'

const TOKEN_KEYS = ['bg', 'bg2', 'surface', 'card', 'tile', 'field', 'dock', 'ink', 'soft', 'sub', 'muted', 'faint', 'line', 'overlay', 'ring']

test('themes have unique ids', () => {
  const ids = THEMES.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('default theme exists', () => {
  assert.ok(THEMES.some((t) => t.id === DEFAULT_THEME))
})

test('every theme has every token key', () => {
  for (const t of THEMES) {
    for (const key of TOKEN_KEYS) {
      assert.ok(typeof t.colors[key] === 'string' && t.colors[key].length > 0, `${t.id}.${key} missing`)
    }
  }
})

test('every theme has a name and boolean glass flag', () => {
  for (const t of THEMES) {
    assert.ok(typeof t.name === 'string' && t.name.length > 0)
    assert.equal(typeof t.glass, 'boolean')
  }
})

test('light themes use dark line tokens, dark themes use light line tokens', () => {
  const light = themeById('light')
  const rose = themeById('rose')
  assert.equal(light.colors.line, '#000000')
  assert.equal(rose.colors.line, '#000000')
  assert.equal(themeById('dark').colors.line, '#FFFFFF')
})

test('unknown id falls back to dark', () => {
  assert.equal(themeById('nope').id, DEFAULT_THEME)
})
```

**Verify**: `node --test src/lib/sync.test.js src/lib/themes.test.js` — all pass. Commit: `feat(theme): theme preset data module + store default`.

---

## Task 2 — `src/index.css`: tokens, `[data-theme]` blocks, glass, transitions

**Goal**: Every token the app needs exists as a `@theme` default (dark) and each preset overrides it via a `[data-theme=...]` block; glass gets backdrop blur + an animated accent-tinted wallpaper; surfaces transition smoothly on theme switch.

**Files**: `src/index.css` (edit)

1. Read the current `@theme` block. Keep every existing token. Add 4 new defaults (dark values):
   ```css
   --color-line: #ffffff;
   --color-overlay: rgba(0, 0, 0, 0.6);
   --color-dock: #17171fcc;
   --color-ring: #1b1b26;
   ```
2. After `@theme`, add six blocks — values EXACTLY as in `themes.js` (see Global Constraints; dark block is optional since `@theme` already holds it, but include it for clarity):
   ```css
   [data-theme='light'] { --color-bg: #f2f3f7; --color-bg2: #e6e8f0; --color-surface: #ffffff; --color-card: #ffffff; --color-tile: #edeef4; --color-field: #ffffff; --color-dock: rgba(255,255,255,0.85); --color-ink: #1b1c24; --color-soft: #0e0f16; --color-sub: #4e515c; --color-muted: #8b8d9a; --color-faint: #767986; --color-line: #000000; --color-overlay: rgba(0,0,0,0.35); --color-ring: #e4e6ee; }
   [data-theme='glass'] { --color-bg: rgba(14,14,26,0.55); --color-bg2: rgba(20,18,48,0.55); --color-surface: rgba(255,255,255,0.08); --color-card: rgba(255,255,255,0.07); --color-tile: rgba(255,255,255,0.12); --color-field: rgba(0,0,0,0.28); --color-dock: rgba(16,16,30,0.55); --color-ink: #f4f4f6; --color-soft: #ffffff; --color-sub: #c6c4d4; --color-muted: #8f8da0; --color-faint: #a6a4b8; --color-line: #ffffff; --color-overlay: rgba(0,0,0,0.5); --color-ring: rgba(255,255,255,0.15); }
   [data-theme='midnight'] { --color-bg: #0e0d1c; --color-bg2: #171431; --color-surface: #17142e; --color-card: #1a1733; --color-tile: #262143; --color-field: #0b0a18; --color-dock: rgba(14,13,28,0.85); --color-ink: #f1effa; --color-soft: #faf9ff; --color-sub: #b3aecc; --color-muted: #6f6b8c; --color-faint: #9c97b8; --color-line: #ffffff; --color-overlay: rgba(0,0,0,0.6); --color-ring: #211d40; }
   [data-theme='oled'] { --color-bg: #000000; --color-bg2: #000000; --color-surface: #0a0a0a; --color-card: #0d0d0d; --color-tile: #151515; --color-field: #000000; --color-dock: rgba(0,0,0,0.9); --color-ink: #f5f5f5; --color-soft: #ffffff; --color-sub: #a8a8a8; --color-muted: #6e6e6e; --color-faint: #9c9c9c; --color-line: #ffffff; --color-overlay: rgba(0,0,0,0.7); --color-ring: #141414; }
   [data-theme='rose'] { --color-bg: #fdf2f6; --color-bg2: #fbe4ed; --color-surface: #ffffff; --color-card: #ffffff; --color-tile: #f6e3ea; --color-field: #ffffff; --color-dock: rgba(255,255,255,0.85); --color-ink: #3a2430; --color-soft: #1f0f17; --color-sub: #8a6474; --color-muted: #b08b9b; --color-faint: #9d7488; --color-line: #000000; --color-overlay: rgba(0,0,0,0.35); --color-ring: #f1d9e2; }
   ```
3. Replace the `body` background rule (`#050508` or similar) with `background-color: var(--color-bg);` and add `transition: background-color 200ms ease;`.
4. Glass effects (place after the theme blocks):
   ```css
   [data-theme='glass'] .screen-bg,
   [data-theme='glass'] .bg-surface,
   [data-theme='glass'] .bg-card,
   [data-theme='glass'] .bg-tile,
   [data-theme='glass'] .bg-field,
   [data-theme='glass'] .bg-dock {
     backdrop-filter: blur(20px) saturate(160%);
     -webkit-backdrop-filter: blur(20px) saturate(160%);
   }
   [data-theme='glass'] body::before {
     content: '';
     position: fixed;
     inset: -20%;
     z-index: -1;
     background: linear-gradient(120deg,
       color-mix(in srgb, var(--color-accent) 18%, transparent),
       #7c3aed2b,
       color-mix(in srgb, var(--color-accent) 10%, transparent),
       #0485f71f);
     background-size: 300% 300%;
     animation: pulse-wallpaper 16s ease-in-out infinite;
   }
   @keyframes pulse-wallpaper {
     0% { background-position: 0% 50%; }
     50% { background-position: 100% 50%; }
     100% { background-position: 0% 50%; }
   }
   ```
5. Smooth theme transitions:
   ```css
   .screen-bg,
   .bg-surface, .bg-card, .bg-tile, .bg-field, .bg-dock {
     transition: background-color 180ms ease, background 180ms ease;
   }
   ```
   (Keep this inside the existing Tailwind layer structure so it does not override hover states.)

**Verify**: `npx vite build` succeeds. Confirm the `@theme` block in `src/index.css` contains the 4 new tokens (grep `--color-line`, `--color-overlay`, `--color-dock`, `--color-ring`). Commit: `feat(theme): theme token blocks, glass wallpaper, transitions`.

---

## Task 3 — `src/App.jsx`: AccentSync → ThemeSync

**Goal**: The app applies the stored theme (and accent) to the document root.

**Files**: `src/App.jsx` (edit)

Replace the `AccentSync` component (lines ~43–51) with:

```jsx
function ThemeSync() {
  const accent = useStore((s) => s.settings.accent)
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme ?? DEFAULT_THEME
    document.documentElement.style.setProperty('--color-accent', accent)
    document.documentElement.style.setProperty('--color-accent-light', ACCENT_LIGHT[accent] ?? accent)
  }, [accent, theme])
  return null
}
```

- Keep the existing `ACCENT_LIGHT` map untouched (lines ~35–41).
- Add `import { DEFAULT_THEME } from './lib/themes'`.
- Update the `AccentSync` usage inside the provider to `<ThemeSync />` (it is currently rendered as `<AccentSync />`).

**Verify**: `npx oxlint` + `npx vite build` pass. Commit: `feat(theme): ThemeSync applies data-theme + accent`.

---

## Task 4 — `src/screens/SettingsScreen.jsx`: theme picker

**Goal**: Settings gets a Discord-style theme picker (3×2 grid of preview cards using each theme's real colors), active card outlined in accent; the existing accent swatch section header is retitled.

**Files**: `src/screens/SettingsScreen.jsx` (edit)

1. Add imports: `import { THEMES, themeById } from '../lib/themes'`.
2. Insert a new "Theme" section ABOVE the existing "Color themes" (accent) section, matching the file's existing section-header pattern (`text-[12px] font-semibold text-soft` / muted span):
   ```jsx
   <div className="flex items-center justify-between">
     <h2 className="text-[13px] font-semibold text-soft">Theme</h2>
     <span className="text-[12px] text-muted">{themeById(settings.theme).name}</span>
   </div>
   <div className="grid grid-cols-3 gap-2">
     {THEMES.map((t) => {
       const active = settings.theme === t.id
       return (
         <button
           key={t.id}
           onClick={() => setSettings({ theme: t.id })}
           aria-pressed={active}
           className={`flex h-[72px] flex-col justify-between rounded-[14px] p-2.5 outline outline-1 transition-transform active:scale-[0.97] ${
             active ? 'outline-2 outline-accent' : 'outline-line/10'
           }`}
           style={{ background: `linear-gradient(-157deg, ${t.colors.bg} 14.645%, ${t.colors.bg2} 85.355%)` }}
         >
           <span
             className="h-3 w-3 rounded-full"
             style={{ background: t.colors.surface, outline: `1px solid ${t.colors.line}26` }}
           />
           <span className="text-left text-[11px] font-medium" style={{ color: t.colors.ink }}>
             {t.name}
           </span>
         </button>
       )
     })}
   </div>
   ```
3. Retitle the accent section: change its header text (currently "Color themes") to "Accent color". Do not touch the accent swatch logic.
4. Verify `settings` is destructured from the store in this component (it is — the accent section already reads `settings.accent`); if `setSettings` is not yet destructured, add it.

**Verify**: `npx oxlint` + `npx vite build` pass. Manual: in the running app, tap each preview — app recolors instantly, active card shows accent ring, header label shows the theme name. Commit: `feat(theme): settings theme picker grid`.

---

## Task 5 — Convert `src/components/ui.jsx` + `src/components/AuthModal.jsx`

**Goal**: Shared components stop using `white/black` alpha utilities and hardcoded grays; they render correctly under all 6 themes.

**Files**: `src/components/ui.jsx`, `src/components/AuthModal.jsx` (edit)

Apply the full Mapping Table to every occurrence in these two files. Known spots (grep the files for `#0B0B12|#131322|#17171F|#0F0F16|white/|black/|#FCFCFC|#F4F4F6|#A1A1AA|#6E6E7A|#9C9CA8|#71717A|#C9C9D6|#1B1B26|#1F1F2A` to catch them all):

- `ui.jsx` — `Screen` wrapper: the `bg-[linear-gradient(-157deg,_#0B0B12_14.645%,_#131322_85.355%)]` arbitrary class becomes `screen-bg bg-[linear-gradient(-157deg,var(--color-bg)_14.645%,var(--color-bg2)_85.355%)]` (the class must remain a valid Tailwind arbitrary value — replace the hex literals with `var(...)` inside the same brackets, no spaces around commas are fine either way).
- `ui.jsx` — `TabDock`: `bg-[#17171FCC]` → `bg-dock`; shadow stays literal.
- `ui.jsx` — `Modal` scrim: `bg-black/60` (or similar) → `bg-overlay`.
- `ui.jsx` — all `bg-white/5`, `outline-white/10`, `border-white/5` etc. → `line/…` equivalents; lucide `color` props per Mapping Table (`#FCFCFC`→soft, `#A1A1AA`→sub, `#6E6E7A`→muted, `#9C9CA8`→faint, `#71717A`→muted).
- `AuthModal.jsx` — same treatment; keep `#DB3B3E`/`#F2606E` danger literals and any `good`/`gold` token usage as-is.

**Verify**: `grep -E "white/|black/|#[0-9A-Fa-f]{6}" src/components/ui.jsx src/components/AuthModal.jsx` — remaining matches must only be semantic constants (good/gold/danger/FF7A7D) or shadows (`shadow-` lines). Run `npx oxlint` + `npx vite build`. Commit: `refactor(theme): tokenize shared components`.

---

## Task 6 — Convert `src/screens/HomeScreen.jsx`

**Goal**: Home renders correctly in every theme.

**Files**: `src/screens/HomeScreen.jsx` (edit)

Apply the Mapping Table. Known spots (grep `#[0-9A-Fa-f]{6}|white/|black/`):

- Day "card" tiles: `bg-card` is already a token; their `outline-white/10` → `outline-line/10`; active day `bg-[#23242B]` → `bg-tile`.
- Rest-day option `bg-[#1C1C22]` → `bg-card`.
- "Add exercise" input `bg-[#262728]` / `bg-[#0F0F16]` → `bg-tile` / `bg-field`.
- Lucide icon colors: `#FCFCFC` → `var(--color-soft)`, `#A1A1AA` → `var(--color-sub)`, `#6E6E7A` → `var(--color-muted)`, `#9C9CA8` → `var(--color-faint)`.
- `colors.rest = '#71717A'` (local const) → `colors.rest = 'var(--color-muted)'`.
- Any `white/` alpha utilities → `line/`.
- Keep `bg-good/15`, `bg-accent`, `text-good`, `DAY_COLORS`-driven styles untouched.

**Verify**: grep as in Task 5 — only semantic constants remain. `npx oxlint` + `npx vite build`. Commit: `refactor(theme): tokenize home screen`.

---

## Task 7 — Convert `src/screens/DayDetailScreen.jsx`

**Goal**: Day detail renders correctly in every theme.

**Files**: `src/screens/DayDetailScreen.jsx` (edit)

Apply the Mapping Table. Known spots:

- `Stepper`: `border border-white/5 bg-white/5` (lines 33, 64) → `border-line/5 bg-line/5`; `color="#A1A1AA"` → `var(--color-sub)` (lines 35, 66).
- Back chevron `color="#FCFCFC"` (line 119) → `var(--color-soft)`.
- Session card `outline-white/10` (line 131) → `outline-line/10`.
- Progress bar track `bg-white/5` (line 146) → `bg-line/5`; the `pct === 100 ? '#17C964'` branch stays literal.
- Danger buttons/text `#DB3B3E` (lines 170–173, 190, 194, 202) stay literal.
- Done states `bg-good/15`, `CircleCheck color="#17C964"` (lines 196, 254), and the not-done `color="#6E6E7A"` icons (lines 257, 269) → `var(--color-muted)`.
- `Trash2 color="#A1A1AA"` (line 276) → `var(--color-sub)`.
- Exercise card `outline-white/10` (line 244) → `outline-line/10`.

**Verify**: grep + lint + build as before. Commit: `refactor(theme): tokenize day detail screen`.

---

## Task 8 — Convert `src/screens/LibraryScreen.jsx`

**Goal**: Library renders correctly in every theme.

**Files**: `src/screens/LibraryScreen.jsx` (edit)

Apply the Mapping Table. Known spots (grep `#[0-9A-Fa-f]{6}|white/|black/`):

- Back chevron `color="#F4F4F6"` → `var(--color-ink)`.
- `Plus` icon `color="#FCFCFC"` → `var(--color-soft)`.
- `outline-white/10` / `bg-white/5` / `border-white/5` → `line/` equivalents.
- Lucide grays: `#A1A1AA` → `var(--color-sub)`, `#9C9CA8` → `var(--color-faint)`, `#6E6E7A` → `var(--color-muted)`.
- Add button `bg-tile`, `text-accent`, `Plus color="var(--color-accent)"` — already tokenized, leave.
- Keep `bg-good/15` and danger literals.

**Verify**: grep + lint + build. Commit: `refactor(theme): tokenize library screen`.

---

## Task 9 — Convert `src/screens/TimerScreen.jsx`

**Goal**: Timer renders correctly in every theme.

**Files**: `src/screens/TimerScreen.jsx` (edit)

Apply the Mapping Table. Known spots:

- Session card (lines 53, 81): `bg-[#0F0F16]` → `bg-field`; `outline-white/10` → `outline-line/10`; `shadow-[0px_8px_20px_0px_#00000059]` stays literal.
- Day dots `bg-white/10` (line 64) → `bg-line/10`.
- "Continue/Start" chip: `ArrowRight color="#0B0B12"` + `text-[#0B0B12]` (lines 74–75) → `color="#FFFFFF"` + `text-white`.
- `MoonStar color="#A1A1AA"` (lines 83, 93) → `var(--color-sub)`.
- Ring track `stroke="#1B1B26"` (line 112) → `stroke="var(--color-ring)"`.
- Preset chips (line 164): `bg-[#1F1F2A] outline-white/[0.08]` → `bg-tile outline-line/[0.08]`; active state `bg-accent outline-transparent` + `text-[#0B0B12]` (line 168) → `text-white`.
- `RotateCcw color="#9C9CA8"` (line 183) → `var(--color-faint)`.
- `bg-accent/15`, `text-accent`, `CircleCheck color="#17C964"`, `bg-good/15`, `text-good` — leave.
- The remaining section (lines 190–203) may contain more grays — apply the Mapping Table to anything matching.

**Verify**: grep + lint + build. Commit: `refactor(theme): tokenize timer screen`.

---

## Task 10 — Convert `src/screens/ProgressScreen.jsx`

**Goal**: Progress renders correctly in every theme.

**Files**: `src/screens/ProgressScreen.jsx` (edit)

Apply the Mapping Table. Known spots (grep `#[0-9A-Fa-f]{6}|white/|black/`):

- Back chevron `color="#F4F4F6"` → `var(--color-ink)`; other lucide grays per Mapping Table.
- Dropdown text `text-[#C9C9D6]` → `text-sub` (NOT silver); `ChevronDown color="#9C9CA8"` → `var(--color-faint)`; `Dumbbell color="#9C9CA8"` → `var(--color-faint)`; active row `bg-accent/15 text-accent` stays.
- Dropdown panel `bg-card` + `outline-white/10` → `outline-line/10`.
- Any `white/`/`black/` alpha → `line/` / `overlay` per Mapping Table.
- Keep `bg-good/15`, `text-good`, `bg-accent`, `bg-accent/15`, gold/silver/bronze medal colors, and `var(--color-accent)` usage.

**Verify**: grep + lint + build. Commit: `refactor(theme): tokenize progress screen`.

---

## Task 11 — Convert `src/screens/LeaderboardScreen.jsx`

**Goal**: Leaderboard renders correctly in every theme.

**Files**: `src/screens/LeaderboardScreen.jsx` (edit)

Apply the Mapping Table. Known spots:

- Back chevron `color="#F4F4F6"` (line 80) → `var(--color-ink)`.
- Exercise dropdown button text `text-[#C9C9D6]` (line 96) → `text-sub`; `ChevronDown color="#9C9CA8"` (line 97) → `var(--color-faint)`.
- Dropdown panel `outline-white/10` (line 100) → `outline-line/10`; option rows `text-[#C9C9D6]` (line 111) → `text-sub`; `Dumbbell color="#9C9CA8"` (line 117) → `var(--color-faint)`; `Check color="var(--color-accent)"` stays.
- Podium gradients + `outline-[#F5A52440]` / `#A1A1AA40` / `#B08D5740` (lines 144–147) stay literal (semantic constants).
- Rest rows `outline-white/10` (line 171) → `outline-line/10`; `bg-accent/15` + `outline-accent/40` stay.
- Rank number `text-faint` (already tokenized) stays.

**Verify**: grep + lint + build. Commit: `refactor(theme): tokenize leaderboard screen`.

---

## Task 12 — Final verification

**Goal**: Everything green; all 6 themes visually verified.

1. Run `node --test src/lib/sync.test.js src/lib/themes.test.js` — all pass.
2. Run `npx oxlint` — no errors.
3. Run `npx vite build` — succeeds (chunk-size warning is pre-existing).
4. `grep -rE "white/|black/" src` — the only remaining matches must be intentional (e.g. `text-white` on accent backgrounds, `outline-white` inside `[data-theme]` comments if any, podium `from-[#...]` literals). No `bg-white/`/`outline-white/` in components.
5. Manual visual pass (`npm run dev`, picker in Settings): for each of the 6 presets — Home, Day detail, Library, Timer ring + presets, Progress dropdown, Leaderboard, Auth modal, TabDock all readable; light + rose have dark text on light surfaces; glass shows the animated wallpaper with frosted cards; oled is pure black; dark is unchanged from before.
6. If any preset has unreadable contrast, adjust the offending theme's values in BOTH `themes.js` and the matching `[data-theme]` block, re-run steps 1–3, and note the change.
7. No commit needed (changes already committed per task) — unless step 6 changed values, then commit: `fix(theme): contrast adjustments`.

## Risks & Mitigations

- **Theme data drift** (themes.js vs index.css): values are defined once in this plan and copied to both; Task 12 step 4–6 is the check.
- **Light themes exposing un-tokenized colors**: the per-task grep verifies only semantic constants remain.
- **`text-silver` misuse** (silver is a medal color, #C9C9D6 text would vanish on light bg): Mapping Table pins `#C9C9D6` → `text-sub`; Task 12 step 5 checks readability.
- **Backdrop-filter on glass over heavy blur**: 20px blur × saturate is a standard frosted-glass look; acceptable on the app's small component count.