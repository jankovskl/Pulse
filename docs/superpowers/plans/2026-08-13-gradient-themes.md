# Gradient Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 uigradients-inspired gradient themes with dark-frosted glass surfaces to the existing theme system.

**Architecture:** Each gradient theme is a normal entry in `THEMES` (built by a `gradientTheme()` factory that shares one dark-frosted token set) whose id starts with `g-`. CSS uses the `[data-theme^='g-']` attribute-prefix selector for the shared tokens and a `--bg-gradient` CSS var for the background so 3-stop King Yna works without touching the 2-stop themes.

**Tech Stack:** React 19, Vite 8, Tailwind v4, node:test. PowerShell shell (no `&&`; use `; if ($?) { ... }`).

## Global Constraints

- Commands run in project root `C:\Users\mateu\Documents\.VS projects\Pulse\Pulse` via `workdir`; PowerShell, no `cd`.
- Tests: `node --test src/lib/sync.test.js src/lib/themes.test.js` (node:test + `node:assert/strict`).
- Lint: `npx oxlint` (pre-existing warnings OK). Build: `npx vite build` (pre-existing chunk-size warning OK).
- Commit ONLY touched files (`git add <files>`), never `git add .`. LF→CRLF warnings on commit are harmless.
- Gradient theme ids MUST start with `g-` (CSS prefix-selector contract).
- Gradient themes share the exact dark-frosted token set (see Task 1 `GRADIENT_TOKENS`); only `bg`, `bg2`, and optionally `mid` differ per theme.
- `mid` is the only optional token key; the 6 existing themes must render pixel-identical (their `bg`/`bg2` interpolation is unchanged — see Task 2 math).
- Spec: `docs/superpowers/specs/2026-08-13-gradient-themes-design.md`.

---
### Task 1: Theme data — `gradientTheme()` factory + 10 gradient themes

**Files:**
- Modify: `src/lib/themes.js`
- Test: `src/lib/themes.test.js`

**Interfaces:**
- Produces: `THEMES` gains 10 entries with ids `g-sweet-morning`, `g-pure-lust`, `g-royal-blue`, `g-purple-love`, `g-sublime-vivid`, `g-vice-city`, `g-love-couple`, `g-king-yna`, `g-pacific-dream`, `g-dawn`. Each has `{ id, name, glass: true, colors }` where `colors` = shared frosted tokens + `bg`/`bg2` (+ `mid` only for `g-king-yna`). `themeById` behavior unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/themes.test.js`:

```js
test('gradient themes are glass with light ink', () => {
  const gradients = THEMES.filter((t) => t.id.startsWith('g-'))
  assert.ok(gradients.length >= 10, 'expected at least 10 gradient themes')
  for (const t of gradients) {
    assert.equal(t.glass, true, `${t.id} must be glass`)
    assert.equal(t.colors.ink, '#F4F4F6', `${t.id} must use light ink`)
    assert.ok(t.colors.bg.startsWith('#') && t.colors.bg2.startsWith('#'))
  }
})

test('only King Yna uses a mid stop', () => {
  const withMid = THEMES.filter((t) => t.colors.mid)
  assert.deepEqual(withMid.map((t) => t.id), ['g-king-yna'])
  assert.equal(withMid[0].colors.mid, '#B21F1F')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/themes.test.js`
Expected: both new tests FAIL (no `g-` themes exist yet); existing 6 tests still PASS.

- [ ] **Step 3: Implement factory + themes**

In `src/lib/themes.js`, after the existing `rose` entry and before the closing `]`, add the shared token set, factory, and 10 entries:

```js
  {
    id: 'g-sweet-morning',
    name: 'Sweet Morning',
    glass: true,
    colors: gradientThemeColors('#FF5F6D', '#FFC371'),
  },
```

Then the helper functions go at the END of the file (after `themeById`):

```js
const GRADIENT_TOKENS = {
  surface: 'rgba(0,0,0,0.32)',
  card: 'rgba(0,0,0,0.28)',
  tile: 'rgba(255,255,255,0.10)',
  field: 'rgba(0,0,0,0.38)',
  dock: 'rgba(10,10,20,0.55)',
  ink: '#F4F4F6',
  soft: '#FFFFFF',
  sub: '#C6C4D4',
  muted: '#8F8DA0',
  faint: '#A6A4B8',
  line: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.5)',
  ring: 'rgba(255,255,255,0.15)',
}

function gradientThemeColors(bg, bg2, mid) {
  return { ...GRADIENT_TOKENS, bg, bg2, ...(mid ? { mid } : {}) }
}
```

Insert all 10 entries into the `THEMES` array after `rose` (before the closing `]`), in this order, each shaped exactly like the `g-sweet-morning` example above:

| id | name | colors call |
|---|---|---|
| `g-sweet-morning` | Sweet Morning | `gradientThemeColors('#FF5F6D', '#FFC371')` |
| `g-pure-lust` | Pure Lust | `gradientThemeColors('#333333', '#DD1818')` |
| `g-royal-blue` | Royal Blue | `gradientThemeColors('#536976', '#292E49')` |
| `g-purple-love` | Purple Love | `gradientThemeColors('#CC2B5E', '#753A88')` |
| `g-sublime-vivid` | Sublime Vivid | `gradientThemeColors('#FC466B', '#3F5EFB')` |
| `g-vice-city` | Vice City | `gradientThemeColors('#3494E6', '#EC6EAD')` |
| `g-love-couple` | Love Couple | `gradientThemeColors('#3A6186', '#89253E')` |
| `g-king-yna` | King Yna | `gradientThemeColors('#1A2A6C', '#FDBB2D', '#B21F1F')` |
| `g-pacific-dream` | Pacific Dream | `gradientThemeColors('#34E89E', '#0F3443')` |
| `g-dawn` | Dawn | `gradientThemeColors('#F3904F', '#3B4371')` |

Note: `mid` is passed as the 3rd arg for King Yna only — the `mid` key is absent from the other 9.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/themes.test.js`
Expected: 8/8 PASS (6 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/themes.js src/lib/themes.test.js
git commit -m "feat(theme): gradient theme data + factory"
```

---
### Task 2: CSS — shared `g-` block, per-theme blocks, `--bg-gradient`, frosted blur

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/ui.jsx:83`

**Interfaces:**
- Consumes: theme ids from Task 1 (`g-sweet-morning` … `g-dawn`), optional `--color-bg-mid` var.
- Produces: `[data-theme^='g-']` sets `--bg-gradient` (and all frosted tokens); `.screen-bg` class renders `var(--bg-gradient, <2-stop fallback>)`; gradient themes get backdrop blur.

Math note for the shared `--bg-gradient`: `var(--color-bg-mid, var(--color-bg))` at the 50% stop lies exactly on the `bg→bg2` interpolation line, so themes WITHOUT `mid` render identically to the current 2-stop gradient.

- [ ] **Step 1: Add the shared `g-` block and per-theme blocks**

In `src/index.css`, after the `[data-theme='rose'] { ... }` block (line 135), insert:

```css
[data-theme^='g-'] {
  --bg-gradient: linear-gradient(-157deg, var(--color-bg) 14.645%, var(--color-bg-mid, var(--color-bg)) 50%, var(--color-bg2) 85.355%);
  --color-surface: rgba(0, 0, 0, 0.32);
  --color-card: rgba(0, 0, 0, 0.28);
  --color-tile: rgba(255, 255, 255, 0.10);
  --color-field: rgba(0, 0, 0, 0.38);
  --color-dock: rgba(10, 10, 20, 0.55);
  --color-ink: #f4f4f6;
  --color-soft: #ffffff;
  --color-sub: #c6c4d4;
  --color-muted: #8f8da0;
  --color-faint: #a6a4b8;
  --color-line: #ffffff;
  --color-overlay: rgba(0, 0, 0, 0.5);
  --color-ring: rgba(255, 255, 255, 0.15);
}

[data-theme='g-sweet-morning'] { --color-bg: #ff5f6d; --color-bg2: #ffc371; }
[data-theme='g-pure-lust'] { --color-bg: #333333; --color-bg2: #dd1818; }
[data-theme='g-royal-blue'] { --color-bg: #536976; --color-bg2: #292e49; }
[data-theme='g-purple-love'] { --color-bg: #cc2b5e; --color-bg2: #753a88; }
[data-theme='g-sublime-vivid'] { --color-bg: #fc466b; --color-bg2: #3f5efb; }
[data-theme='g-vice-city'] { --color-bg: #3494e6; --color-bg2: #ec6ead; }
[data-theme='g-love-couple'] { --color-bg: #3a6186; --color-bg2: #89253e; }
[data-theme='g-king-yna'] { --color-bg: #1a2a6c; --color-bg-mid: #b21f1f; --color-bg2: #fdbb2d; }
[data-theme='g-pacific-dream'] { --color-bg: #34e89e; --color-bg2: #0f3443; }
[data-theme='g-dawn'] { --color-bg: #f3904f; --color-bg2: #3b4371; }
```

- [ ] **Step 2: Move the screen background into `.screen-bg`**

In `src/index.css`, after the `body { ... }` rule (line 175-179), add:

```css
.screen-bg {
  background: var(--bg-gradient, linear-gradient(-157deg, var(--color-bg) 14.645%, var(--color-bg2) 85.355%));
}
```

In `src/components/ui.jsx:83`, remove the arbitrary gradient utility:

```jsx
<div className="screen-bg relative mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-[linear-gradient(-157deg,var(--color-bg)_14.645%,var(--color-bg2)_85.355%)]">
```
→
```jsx
<div className="screen-bg relative mx-auto flex min-h-dvh w-full max-w-[420px] flex-col">
```

- [ ] **Step 3: Extend the frosted blur to gradient themes**

In `src/index.css`, replace the 6 selectors of the backdrop-filter rule (lines 137-143):

```css
:is([data-theme='glass'], [data-theme^='g-']) .screen-bg,
:is([data-theme='glass'], [data-theme^='g-']) .bg-surface,
:is([data-theme='glass'], [data-theme^='g-']) .bg-card,
:is([data-theme='glass'], [data-theme^='g-']) .bg-tile,
:is([data-theme='glass'], [data-theme^='g-']) .bg-field,
:is([data-theme='glass'], [data-theme^='g-']) .bg-dock {
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}
```

The `[data-theme='glass'] body::before` animated wallpaper rule (line 147) stays Glass-only — do NOT extend it.

- [ ] **Step 4: Verify build**

Run: `npx vite build`
Expected: builds with only the pre-existing chunk-size warning. Also run `npx oxlint` — no new warnings beyond the known pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/ui.jsx
git commit -m "feat(theme): gradient css blocks + frosted blur + bg-gradient var"
```

---
### Task 3: Settings — grouped theme picker with 3-stop swatches

**Files:**
- Modify: `src/screens/SettingsScreen.jsx` (Appearance card, ~lines 216-245)

**Interfaces:**
- Consumes: `THEME_PRESETS` (= `THEMES`, 16 entries) from `../lib/themes`; `t.colors.mid` optional key.
- Produces: two labeled groups ("Themes" 6, "Gradients" 10); swatch background mirrors the Task 2 `--bg-gradient` formula.

- [ ] **Step 1: Add a `ThemeSwatch` local component**

In `src/screens/SettingsScreen.jsx`, add above `export default function SettingsScreen()`:

```jsx
function ThemeSwatch({ t, active, onPick }) {
  return (
    <button
      onClick={onPick}
      aria-pressed={active}
      className={`flex h-[72px] flex-col justify-between rounded-[14px] p-2.5 outline outline-1 transition-transform active:scale-[0.97] ${
        active ? 'outline-2 outline-accent' : 'outline-line/10'
      }`}
      style={{
        background: t.colors.mid
          ? `linear-gradient(-157deg, ${t.colors.bg} 14.645%, ${t.colors.mid} 50%, ${t.colors.bg2} 85.355%)`
          : `linear-gradient(-157deg, ${t.colors.bg} 14.645%, ${t.colors.bg2} 85.355%)`,
      }}
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
}
```

- [ ] **Step 2: Replace the single grid with two groups**

Replace the existing grid block (the `THEME_PRESETS.map` section) with:

```jsx
<div className="grid grid-cols-3 gap-2">
  {THEME_PRESETS.filter((t) => !t.id.startsWith('g-')).map((t) => (
    <ThemeSwatch
      key={t.id}
      t={t}
      active={store.settings.theme === t.id}
      onPick={() => store.setSettings({ theme: t.id })}
    />
  ))}
</div>
<span className="mt-3 text-[10px] font-semibold tracking-[1.4px] text-muted">GRADIENTS</span>
<div className="grid grid-cols-3 gap-2">
  {THEME_PRESETS.filter((t) => t.id.startsWith('g-')).map((t) => (
    <ThemeSwatch
      key={t.id}
      t={t}
      active={store.settings.theme === t.id}
      onPick={() => store.setSettings({ theme: t.id })}
    />
  ))}
</div>
```

- [ ] **Step 3: Verify build**

Run: `npx oxlint; npx vite build`
Expected: no new warnings; builds clean.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.jsx
git commit -m "feat(theme): grouped gradient picker in settings"
```

---
### Task 4: Full verification

**Files:** none (read-only checks)

- [ ] **Step 1: Run all tests**

Run: `node --test src/lib/sync.test.js src/lib/themes.test.js`
Expected: 16/16 PASS (14 existing + 2 new).

- [ ] **Step 2: Check for stray hex colors / white-black utilities**

Run: `rg -n "white/|black/|#[0-9A-Fa-f]{6}" src`
Expected: only intentional matches — shadows (`#00000059`, `#0000000F`, `#00000040`), `#17C964`, danger reds, podium gradients (`#F5A52422` etc.), `#FFFFFF` on accent, `#0B0B12` shadows, `#3B3B47` (leaderboard avatar bg). No new ones.

- [ ] **Step 3: Visual pass (manual)**

Run `npm run dev` and check, switching through all 10 gradient themes in Settings: every screen (Home, Day detail, Library, Timer ring + preset chips, Progress chart/dropdown, Leaderboard podium, Auth modal, TabDock) shows white/light text clearly readable on the BRIGHTEST stop of each gradient; frosted cards blur the gradient behind them; settings swatch previews match the real screen; the 6 existing themes look unchanged.

If a gradient is too bright (text unreadable on frosted `rgba(0,0,0,0.32)` surfaces), darken its frosted surfaces — adjust `GRADIENT_TOKENS.surface`/`card`/`field` in `src/lib/themes.js` AND the matching values in the `[data-theme^='g-']` block in `src/index.css` (both must stay in sync), then commit `fix(theme): gradient surface contrast`.

- [ ] **Step 4: Commit any fixes from the visual pass (only if Step 3 found issues)**

```bash
git add <touched files>
git commit -m "fix(theme): gradient surface contrast"
```

---
## Self-Review

- **Spec coverage:** gradient list (Task 1), shared token set + prefix blocks + blur + `--bg-gradient` (Task 2), King Yna 3-stop end to end (Tasks 1-3), grouped picker + swatch mid (Task 3), tests incl. `g-` invariants (Task 1), full verification incl. contrast fix path (Task 4), glass-only wallpaper + out-of-scope items (Task 2 note). All spec sections covered.
- **Placeholder scan:** no TBD/TODO; every code step has full literal code.
- **Type consistency:** `gradientThemeColors(bg, bg2, mid)` signature matches all 10 call sites; `t.colors.mid` optional check consistent across tests (Task 1), CSS var (`--color-bg-mid`, Task 2), and swatch (Task 3); ids match between Task 1 table and Task 2 CSS blocks exactly (`g-king-yna` has `mid` in both).