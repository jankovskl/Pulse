# Appearance Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Settings' inline APPEARANCE card with a single "Appearance" row that opens a full-screen theme + accent picker page with a back button.

**Architecture:** SettingsScreen gains a local `view` state (`'main' | 'appearance'`). The main view keeps everything today except the APPEARANCE card, which becomes one `Row` (Palette icon, current theme name as subtitle, gradient chip on the right). The appearance view renders the picker content (two theme groups + accent colors, moved verbatim) under a header with a back button. No Router, store, or lib changes.

**Tech Stack:** React 19, Tailwind v4, lucide-react, existing `Row`/`ThemeSwatch`/`Screen` components.

## Global Constraints

- Only `src/screens/SettingsScreen.jsx` may be modified.
- No changes to `App.jsx` (Router), `src/lib/store.jsx`, `src/lib/themes.js`, `src/components/ui.jsx`.
- `ThemeSwatch` and the accent-circle markup keep their exact current behavior (they move, they do not change).
- Theme/accent persistence stays via `store.setSettings({ theme: t.id })` / `store.setSettings({ accent: t })`.
- Commit ONLY the touched file — never `git add .`. Unrelated uncommitted working-tree changes (auth.jsx, timer.jsx, etc.) exist in the repo: leave them alone. A "LF will be replaced by CRLF" warning on commit is harmless.
- Environment: Windows PowerShell 5.1 — NO `&&` (use `; if ($?) { ... }`), no `cd` (run bash commands with workdir set to `C:\Users\mateu\Documents\.VS projects\Pulse\Pulse`).
- Verification commands: `npx oxlint` (14 pre-existing warnings OK, none new), `npx vite build` (only pre-existing chunk-size warning), `node --test src/lib/sync.test.js src/lib/themes.test.js` (16/16, unchanged by this feature).

---
## File Structure

- `src/screens/SettingsScreen.jsx` — sole changed file. Gains: `themeGradient(t)` module-level helper (shared by `ThemeSwatch` and the new row chip), `view` state, Appearance page branch, Appearance row. Keeps: `ThemeSwatch`, `Row`, modals, changelog sheet, accent `THEMES` const.

## Task 1: Appearance row + sub-page

**Files:**
- Modify: `src/screens/SettingsScreen.jsx` (whole file — exact replacements below)

**Interfaces:**
- Consumes: `themeById` (already imported), `useStore` (already in scope), lucide `ChevronLeft`, `Palette` (add to the lucide import list on line 2-16)
- Produces: `themeGradient(t)` helper (module scope); `view` state `'main' | 'appearance'` in `SettingsScreen`. No other task consumes these — Task 2 only verifies.

- [ ] **Step 1: Add the `themeGradient` helper**

Directly above `ThemeSwatch` (line 43), add:

```jsx
function themeGradient(t) {
  return t.colors.mid
    ? `linear-gradient(-157deg, ${t.colors.bg} 14.645%, ${t.colors.mid} 50%, ${t.colors.bg2} 85.355%)`
    : `linear-gradient(-157deg, ${t.colors.bg} 14.645%, ${t.colors.bg2} 85.355%)`
}
```

- [ ] **Step 2: Point `ThemeSwatch` at the helper (behavior identical)**

Replace the `style={{ background: t.colors.mid ? ... }}` block inside `ThemeSwatch` (lines 51-55) with:

```jsx
      style={{ background: themeGradient(t) }}
```

- [ ] **Step 3: Add `ChevronLeft` and `Palette` to the lucide import**

In the import from `'lucide-react'` (lines 2-16), add `ChevronLeft,` and `Palette,` in alphabetical position (between `Cat`/`Check` and `Cloud`/`CloudCheck`... — the existing list is alphabetized: `Cat, Check, ChevronRight, Cloud, CloudCheck, CloudOff, Database, Download, Pencil, Rocket, Upload, User, X`). Insert `ChevronLeft,` before `ChevronRight,` and `Palette,` before `Pencil,`.

- [ ] **Step 4: Add the `view` state**

In `SettingsScreen()` body, next to the other state hooks (after `const [online, setOnline] = useState(navigator.onLine)` on line 77), add:

```jsx
  const [view, setView] = useState('main')
```

- [ ] **Step 5: Replace the APPEARANCE card with the Appearance row**

Delete the entire APPEARANCE card block (lines 241-291: `<div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">` through its closing `</div>` at 291) and replace it with:

```jsx
        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">APPEARANCE</div>
          <Row
            icon={<Palette size={15} color="var(--color-accent)" />}
            title="Appearance"
            subtitle={themeById(store.settings.theme).name}
            onClick={() => setView('appearance')}
            right={
              <span
                className="h-8 w-8 rounded-[10px]"
                style={{ background: themeGradient(themeById(store.settings.theme)) }}
              />
            }
          />
        </div>
```

- [ ] **Step 6: Add the Appearance page branch**

In the return statement, wrap the main content in a `view === 'appearance' ? ... : ...` conditional. The main-content div (currently lines 134-320: `<div className="flex flex-col gap-5">` … closing `</div>` right before the `{sheetOpen && (` block) becomes the `:` branch unchanged. Add the `?` branch directly before it:

```jsx
      {view === 'appearance' ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('main')}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-tile"
            >
              <ChevronLeft size={16} color="var(--color-sub)" />
            </button>
            <div className="flex flex-col gap-1">
              <h1 className="text-[26px] font-bold text-ink">Appearance</h1>
              <span className="text-[12px] text-faint">Theme, gradients & accent color</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink">Theme</span>
              <span className="text-[12px] text-muted">{themeById(store.settings.theme).name}</span>
            </div>
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
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink">Accent color</span>
              <span className="text-[12px] text-muted">{store.settings.accent}</span>
            </div>
            <div className="flex items-center gap-3.5">
              {THEMES.map((t) => {
                const active = store.settings.accent === t
                return (
                  <button
                    key={t}
                    onClick={() => store.setSettings({ accent: t })}
                    title={`Set accent ${t}`}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform ${
                      active ? 'scale-105 outline outline-2 outline-white/25 outline-offset-2' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: t }}
                  >
                    {active && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
            <span className="text-[11px] text-faint">Saved on this device — accent updates everywhere</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
```

The main-content div that follows (with header, profile card, DATA & ACCOUNT group, new APPEARANCE row group, Neko row, SYNC & ABOUT group, footer) keeps its existing content and closing `</div>`. After its closing `</div>` (previously line 320), close the conditional: `      )}`.

The `{sheetOpen && (...)}` changelog sheet, `<AuthModal …/>` and `<Modal …>` blocks stay after the conditional, unchanged, still inside `<Screen>`.

- [ ] **Step 7: Verify**

Run: `npx oxlint`
Expected: 14 pre-existing warnings, none new.

Run: `npx vite build`
Expected: clean build, only the pre-existing chunk-size warning.

Run: `node --test src/lib/sync.test.js src/lib/themes.test.js`
Expected: 16/16 PASS (unchanged — this feature touches no lib code).

- [ ] **Step 8: Self-review**

- Settings main view shows: header, profile card, DATA & ACCOUNT group, APPEARANCE row group, Neko row, SYNC & ABOUT group, footer — in that order, nothing else.
- Appearance page shows: back button, "Appearance" title + subtitle, Theme row with current name, 6 swatches, GRADIENTS label, 10 swatches, Accent color row, 5 circles, note.
- No remaining reference to the deleted card markup; `themeGradient` used by both `ThemeSwatch` and the row chip; `view` state used in the conditional and the two `setView` calls.

- [ ] **Step 9: Commit**

```bash
git add src/screens/SettingsScreen.jsx
git commit -m "feat(settings): appearance sub-page with grouped picker"
```

## Task 2: Verification

**Files:** none (read-only checks)

- [ ] **Step 1: Run the full automated suite**

Run: `node --test src/lib/sync.test.js src/lib/themes.test.js` — expect 16/16 PASS, output pristine.

Run: `npx oxlint` — expect the 14 pre-existing warnings only.

Run: `npx vite build` — expect clean build (only pre-existing chunk-size warning).

- [ ] **Step 2: Check the diff shape**

Run: `git diff --stat d214a77..HEAD` — the appearance feature adds exactly one source change on top of the gradient work: `src/screens/SettingsScreen.jsx` from the Task 1 commit plus `docs/superpowers/specs/2026-08-13-appearance-screen-design.md` and `docs/superpowers/plans/2026-08-13-appearance-screen.md`.

- [ ] **Step 3: Manual pass (human — the user runs the dev server)**

- Tap Appearance row in Settings → full-screen page opens; back button returns to Settings.
- Settings row chip + subtitle show the current theme's gradient and name, and update live after picking a theme.
- Switch through all 16 themes and all 5 accent colors on the Appearance page; check Home, Day detail, Library, Timer, Progress, Leaderboard still render with the selected theme, gradients included.
- The remaining Settings groups (DATA & ACCOUNT, Neko, SYNC & ABOUT) are intact.

- [ ] **Step 4: Commit any fix from the manual pass (only if Step 3 found issues)**

```bash
git add <touched files>
git commit -m "fix(settings): appearance page"
```