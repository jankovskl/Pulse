# Pulse Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Pulse into a desktop app — responsive web layout (sidebar shell at ≥768px) plus a Tauri v2 Windows shell with an NSIS installer and auto-updates, sharing the existing Supabase account/data with the phone app.

**Architecture:** Single React + Vite + Tailwind codebase. The `Screen` component in `src/components/ui.jsx` becomes responsive — at desktop width it renders a left `Sidebar` instead of the mobile bottom `TabDock`. Each screen adapts via layout-only class changes. A new `src-tauri/` folder is the Tauri v2 shell that loads the built web app in WebView2.

**Tech Stack:** React 19, Vite 8, Tailwind 4, lucide-react, Tauri v2 (Rust), NSIS.

## Global Constraints

- Existing data/sync/auth/state layers are **untouched**: `src/lib/sync.js`, `src/lib/auth.js`, `src/lib/supabase.js`, `src/lib/store.jsx`, `src/lib/timer.jsx`.
- Vite `base` is `/Pulse/` for the web deploy; the Tauri build uses a **relative base** (`vite build --base=./`) via a separate npm script — never change the web base.
- Mobile behavior must be **unchanged** below the `md:` (768px) breakpoint; all desktop-only styling is behind `md:` classes.
- The `Screen` `activeTab` values stay as-is (home/timer/progress/settings) and must not be renamed.
- Build gate: `npm run build` must pass before `tauri build`.
- No new React test framework — verification for layout is visual/manual; existing `node --test` suites must stay green.

---

### Task 1: Responsive Screen + Sidebar component

**Files:**
- Modify: `src/components/ui.jsx` (add `Sidebar`; make `Screen` responsive)

**Interfaces:**
- Consumes: existing `useNav()` (returns `{ name, go }`), existing `TABS` array and icon paths in `ui.jsx`.
- Produces: `Sidebar({ active })` component. `Screen` keeps its `activeTab` prop and continues to render `TabDock` below `md:` and `Sidebar` at `md:` and up.

**Steps:**

- [ ] **Step 1: Extend the icon set in `ui.jsx`**

Add two icon path constants next to the existing `icons` map in `TabDock`, so `Sidebar` can reuse them (library + leaderboard aren't in `TABS` today):

```jsx
// lucide "library": books on a shelf
const LIBRARY_PATH = (
  <>
    <path d="m16 6 4 14" />
    <path d="M12 6v14" />
    <path d="M8 8v12" />
    <path d="M4 4v16" />
  </>
)
// lucide "trophy"
const TROPHY_PATH = (
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />
)
```

- [ ] **Step 2: Write the `Sidebar` component**

Add to `ui.jsx` (after `TabDock`). It renders a vertical rail with all six destinations. Reuse the `icons` object already defined in `TabDock` by hoisting it — simplest: define the icon map once at module scope (rename to `ICON_PATHS` and use it in both `TabDock` and `Sidebar`), adding `library` and `leaderboard` keys:

```jsx
const SIDEBAR_TABS = [
  { key: 'home', label: 'Home', icon: 'house' },
  { key: 'timer', label: 'Timer', icon: 'timer' },
  { key: 'progress', label: 'Progress', icon: 'trending-up' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'library', label: 'Library', icon: 'library' },
  { key: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
]

export function Sidebar({ active }) {
  const nav = useNav()
  return (
    <aside className="hidden h-dvh w-[220px] shrink-0 flex-col gap-1 border-r border-line/10 bg-dock/40 p-3 backdrop-blur md:flex">
      <div className="mb-3 flex items-center gap-2 px-2 pt-2">
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="text-[14px] font-semibold text-soft">Pulse</span>
      </div>
      {SIDEBAR_TABS.map((t) => {
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            onClick={() => nav.go(t.key === 'progress' ? 'progress' : t.key)}
            className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
              isActive ? 'bg-accent/15' : 'hover:bg-tile/60'
            }`}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none"
              stroke={isActive ? 'var(--color-accent)' : 'var(--color-faint)'}
              strokeWidth={isActive ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
              {ICON_PATHS[t.icon]}
            </svg>
            <span className={`text-[13px] ${isActive ? 'font-semibold text-accent-light' : 'text-sub'}`}>
              {t.label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 3: Make `Screen` responsive**

In `ui.jsx`, refactor the icon map to module scope as `ICON_PATHS` (replacing the function-local `icons`), add `library: LIBRARY_PATH` and `leaderboard: TROPHY_PATH` keys, update `TabDock` to use `ICON_PATHS`, and rewrite `Screen`'s layout:

```jsx
export function Screen({ children, activeTab }) {
  const timer = useTimer()
  const nav = useNav()
  return (
    <div className="screen-bg relative mx-auto flex min-h-dvh w-full max-w-[420px] flex-col md:max-w-none md:flex-row">
      <Sidebar active={nav.name} />
      <div className="flex-1 px-5 pb-2 pt-3 md:mx-auto md:w-full md:max-w-[1100px]">{children}</div>
      <div className="sticky bottom-0 z-20 md:hidden">
        <TabDock active={activeTab} />
      </div>
      {timer.running && nav.name !== 'timer' && (
        <button onClick={() => nav.go('timer')} className="absolute right-4 top-3 z-50 flex h-[30px] items-center gap-1.5 rounded-full bg-tile px-3 shadow-[0px_4px_16px_#00000059] outline outline-1 outline-line/[0.08]">
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="var(--color-accent)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2h4M12 14l3-3M13 6a7 7 0 1 0 0 12 7 7 0 0 0 0-12z" />
          </svg>
          <span className="text-[12px] font-semibold tabular-nums text-ink">{fmt(timer.left)}</span>
        </button>
      )}
    </div>
  )
}
```

Note: `Sidebar` is `hidden ... md:flex`, `TabDock` wrapper becomes `md:hidden`, and the outer container grows from `max-w-[420px]` to full width at `md:` with a centered `max-w-[1100px]` content column. The mobile layout is byte-for-byte identical below 768px.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: `vite build` completes with no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors for `src/components/ui.jsx`.

- [ ] **Step 6: Manual responsive check (mobile)**

Open the dev server at ~390px width. Confirm: left sidebar absent, bottom `TabDock` (Home/Timer/Progress/Settings) present, layout identical to before this change.

- [ ] **Step 7: Manual responsive check (desktop)**

Widen to ~1280px. Confirm: left sidebar with all six items, active item accent-highlighted, clicking each navigates correctly, bottom dock hidden, content centered.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui.jsx
git commit -m "feat: add responsive sidebar shell for desktop"
```

---

### Task 2: Home screen desktop layout

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

**Interfaces:**
- Consumes: nothing new — layout-only class changes inside the existing JSX.

**Steps:**

- [ ] **Step 1: Desktop day-tile grid**

The day row is `flex h-[88px] gap-1.5`. Make it a proper 7-column grid on desktop and taller so day names read clearly:

```jsx
<div className="flex h-[88px] gap-1.5 md:h-[110px] md:grid md:grid-cols-7 md:gap-2">
```

(`DayTile` uses `flex-1`; switch it to fill the grid cell: change its `flex h-full flex-1 flex-col` to `flex h-full flex-col` so `flex-1` doesn't conflict in grid mode.)

- [ ] **Step 2: Desktop workout-day cards horizontal**

The workout-day card container is `flex cursor-pointer flex-col gap-3 rounded-[24px] bg-card p-4 ...`. On desktop show the muscles row beside the title row:

```jsx
className="flex cursor-pointer flex-col gap-3 rounded-[24px] bg-card p-4 shadow-[0px_2px_4px_0px_#0000000A] transition-colors active:bg-tile md:flex-row md:items-center md:gap-6"
```

Keep the muscles `<div className="flex flex-wrap gap-1.5">` unchanged (it will sit to the right of the title row inside the flex-row card).

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 4: Manual check**

At ~1280px: seven evenly spaced day tiles fill the row width; workout cards lay out title-left / muscles-right. At ~390px: identical to before.

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.jsx
git commit -m "feat: responsive Home screen layout for desktop"
```

---

### Task 3: DayDetail + Library desktop layout

**Files:**
- Modify: `src/screens/DayDetailScreen.jsx`
- Modify: `src/screens/LibraryScreen.jsx`

**Interfaces:**
- Consumes: nothing new — layout-only class changes.

**Steps:**

- [ ] **Step 1: DayDetail — widen exercise rows**

Exercise rows are `flex flex-col gap-3 rounded-[20px] p-4 ...`. Put the steppers (Sets/Reps/KG) inline to the right on desktop:

```jsx
className={`flex flex-col gap-3 rounded-[20px] p-4 transition-opacity md:flex-row md:items-center md:justify-between ${...}`}
```

The stepper row is `<div className="flex flex-wrap items-center gap-3 pl-6 ...">` — change `pl-6` to `pl-6 md:pl-0 md:justify-end` so it right-aligns on desktop.

- [ ] **Step 2: Library — two-column results**

The results container is `<div className="flex flex-col">`. Make it a responsive grid:

```jsx
<div className="flex flex-col md:grid md:grid-cols-2 md:gap-x-6">
```

The rows use `border-b border-line/5 py-3 last:border-b-0`. On desktop, give each a light card look and avoid border-collapse artifacts by switching borders to a per-cell rounded surface only at `md:`:

```jsx
className="flex items-center justify-between border-b border-line/5 py-3 last:border-b-0 md:rounded-[16px] md:border md:border-line/5 md:px-3"
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual check**

At ~1280px: DayDetail exercise rows show name/steppers side by side; Library results are two columns. At ~390px: unchanged mobile layouts.

- [ ] **Step 6: Commit**

```bash
git add src/screens/DayDetailScreen.jsx src/screens/LibraryScreen.jsx
git commit -m "feat: responsive DayDetail and Library layouts"
```

---

### Task 4: Timer / Progress / Settings / Leaderboard desktop pass

**Files:**
- Modify: `src/screens/TimerScreen.jsx`
- Modify: `src/screens/ProgressScreen.jsx`
- Modify: `src/screens/SettingsScreen.jsx`
- Modify: `src/screens/LeaderboardScreen.jsx`

**Interfaces:**
- Consumes: the wider `Screen` content column from Task 1.
- Produces: screens that use the full desktop width without logic changes.

**Steps:**

- [ ] **Step 1: Audit each screen's outer container**

For each of the four screens, confirm their content renders inside the `Screen` children container (they already do). On desktop the content is now up to `1100px` wide. For each screen, if the inner container has a hard `max-w` (e.g. `max-w-[420px]`) remove it or replace with `md:max-w-none`, otherwise leave as-is. Concretely:
- `TimerScreen`: verify timer card and controls look balanced at full width; if the big timer reads best centered, wrap its main block in `mx-auto w-full max-w-[520px]`.
- `ProgressScreen` / `SettingsScreen` / `LeaderboardScreen`: leave structure; just confirm nothing is stretched awkwardly.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Manual check**

At ~1280px: each of the four screens uses the widened column sensibly (no giant empty gaps, no stretched single-line buttons). At ~390px: unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/screens/TimerScreen.jsx src/screens/ProgressScreen.jsx src/screens/SettingsScreen.jsx src/screens/LeaderboardScreen.jsx
git commit -m "feat: desktop width pass for Timer, Progress, Settings, Leaderboard"
```

---

### Task 5: Web build gate + regression test

**Files:**
- Modify: none (verification only)

**Interfaces:**
- Consumes: all Task 1–4 work.
- Produces: a verified, green baseline before touching the Tauri shell.

**Steps:**

- [ ] **Step 1: Run all existing tests**

Run: `node --test src/lib/*.test.js`
Expected: 37+ tests pass.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

---

### Task 6: Install Rust toolchain + Tauri CLI

**Files:**
- Modify: `package.json` (add tauri devDependency + scripts)
- Create: none (toolchain install)

**Interfaces:**
- Consumes: Visual Studio Build Tools 2026 C++ workload already present on the machine.
- Produces: `cargo`/`rustc` on PATH; `@tauri-apps/cli` in devDependencies; npm scripts `tauri`, `tauri:dev`, `build:tauri`.

**Steps:**

- [ ] **Step 1: Install Rust via rustup (winget)**

Run: `winget install --id Rustlang.Rustup -e`
Then in a fresh shell: `rustup default stable`. Verify:

```bash
cargo --version
rustc --version
```
Expected: both print versions (cargo ≥ 1.74).

- [ ] **Step 2: Add Tauri CLI as a dev dependency**

Run: `npm install -D @tauri-apps/cli`

- [ ] **Step 3: Add npm scripts**

In `package.json` `scripts`, add:

```json
"tauri": "tauri",
"tauri:dev": "tauri dev",
"build:tauri": "vite build --base=./"
```

- [ ] **Step 4: Verify CLI**

Run: `npx tauri --version`
Expected: prints a Tauri v2 version (2.x).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Tauri CLI and Rust toolchain scripts"
```

---

### Task 7: Scaffold and configure the Tauri shell

**Files:**
- Create: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src-tauri/build.rs`, `src-tauri/.gitignore`, `src-tauri/icons/*` (generated)
- Modify: `.gitignore` (ignore `src-tauri/target`)

**Interfaces:**
- Consumes: web build output (`../dist`) via `frontendDist`; `build:tauri` script for the relative-base build.
- Produces: a buildable Tauri app with identifier `com.mateu.pulse`, window 1280×800 resizable, NSIS installer config.

**Steps:**

- [ ] **Step 1: Scaffold with `tauri init`**

Run: `npx tauri init --app-name Pulse --window-title Pulse --frontend-dist ../dist --dev-url http://localhost:5173 --before-dev-command "npm run dev" --before-build-command "npm run build:tauri"`

This creates `src-tauri/` with default `Cargo.toml`, `main.rs`, `tauri.conf.json`, `capabilities/default.json`, `build.rs`.

- [ ] **Step 2: Configure `src-tauri/tauri.conf.json`**

Edit to (keep Tauri v2 keys — `$schema` and `productName` as scaffolded):

```json
{
  "productName": "Pulse",
  "identifier": "com.mateu.pulse",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build:tauri",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Pulse",
        "width": 1280,
        "height": 800,
        "resizable": true,
        "minWidth": 420,
        "minHeight": 700
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "windows": {
      "nsis": {
        "installMode": "currentUser",
        "displayLanguageSelector": false
      }
    }
  }
}
```

- [ ] **Step 3: Generate the icon set from the existing icon**

Run: `npm run tauri icon public/icons/icon-512.png`
Expected: writes `src-tauri/icons/` (32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico, Square*.png). If the command errors on the 512 source, copy `public/icons/icon-512.png` to a temp 1024px PNG (e.g. resize via the project's sandbox or an online tool) and rerun.

- [ ] **Step 4: Minimal `src-tauri/src/main.rs`**

`tauri init` scaffolds a correct main.rs. Keep it minimal; confirm it matches:

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pulse_lib::run()
}
```

and `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Trim capabilities to the minimum**

Edit `src-tauri/capabilities/default.json` to only the core permissions the shell needs (as scaffolded by `tauri init` — core + window). Remove any demo/extra plugin permissions. Supabase/network runs in the webview, not through Tauri IPC, so no extra plugin permissions are required.

- [ ] **Step 6: Ignore the Rust build target**

Append to `.gitignore`:

```
src-tauri/target
```

- [ ] **Step 7: Add `src-tauri/.gitignore`**

```gitignore
/target
/gen/schemas
```

- [ ] **Step 8: Verify dev shell builds**

Run: `npm run tauri:dev`
Expected: Rust compiles, a "Pulse" window opens at 1280×800 loading the app, sidebar visible, login/Supabase reachable. Close it after confirming.

- [ ] **Step 9: Commit**

```bash
git add src-tauri .gitignore
git commit -m "feat: scaffold and configure Tauri desktop shell"
```

---

### Task 8: Produce the NSIS installer

**Files:**
- Modify: none (build output)

**Interfaces:**
- Consumes: Task 7 shell + Task 5 build gate.
- Produces: `src-tauri/target/release/bundle/nsis/Pulse_<version>_x64-setup.exe` and a portable exe.

**Steps:**

- [ ] **Step 1: Release build**

Run: `npm run tauri build`
Expected: Rust release build (first one takes several minutes), then NSIS bundles the installer and portable exe under `src-tauri/target/release/bundle/`.

- [ ] **Step 2: Smoke test the installer**

Run the produced `Pulse_*_x64-setup.exe`. Confirm: installs to the default user dir, creates Start Menu / Desktop shortcuts, launches Pulse, login → sync → Home renders with the sidebar, timer works.

- [ ] **Step 3: Smoke test the portable exe**

Run the `Pulse_*_x64_en-US.msi`-adjacent portable `.exe` if produced. Confirm it opens the app without installing.

---

### Task 9: Auto-update wiring (GitHub Releases)

**Files:**
- Create: `.github/workflows/release.yml` (optional; requires repo on GitHub)
- Modify: `src-tauri/tauri.conf.json` (updater config + `pubkey`)

**Interfaces:**
- Consumes: the installer artifact from Task 8.
- Produces: automatic update checks on app launch, hosted on GitHub Releases.

**Steps:**

- [ ] **Step 1: Generate a signing key**

Run: `npm run tauri signer generate -w ~/.tauri/pulse.key`
Expected: writes a private key + prints the corresponding public key.

- [ ] **Step 2: Enable the updater + set the public key**

In `tauri.conf.json` add under `app`:

```json
"updater": {
  "active": true,
  "pubkey": "<public key from step 1>",
  "endpoints": ["https://github.com/<user>/<repo>/releases/latest/download/latest.json"]
}
```

Set the plugin in `Cargo.toml`:

```toml
tauri-plugin-updater = "2"
```

and register it in `src-tauri/src/lib.rs`:

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

- [ ] **Step 3: Add the release workflow**

Create `.github/workflows/release.yml` that builds the installer and publishes it + `latest.json` to a GitHub Release on a version tag (use `tauri-apps/tauri-action` v0).

- [ ] **Step 4: Document the release flow**

Note in `README.md` (or the changelog) that releasing = tagging a version and pushing; the workflow builds, signs, and uploads the installer + updater manifest.

- [ ] **Step 5: Commit**

```bash
git add .github src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/tauri.conf.json README.md
git commit -m "feat: wire auto-update via GitHub Releases"
```

---

## Self-Review

- **Spec coverage:** Responsive shell (Task 1), Home grid/cards (Task 2), DayDetail + Library (Task 3), other screens width pass (Task 4), web gate (Task 5), Rust/Tauri toolchain (Task 6), shell config + icons + identifier + NSIS (Task 7), installer build + smoke test (Task 8), auto-update (Task 9). Data/sync untouched per spec — no task modifies `lib/`. ✅
- **Placeholder scan:** All steps contain concrete code/commands; the only variable placeholders are `<user>/<repo>` in the updater endpoint and the generated signing public key, both documented as to-be-filled. ✅
- **Type consistency:** `Sidebar({ active })` is called in `Screen` with `nav.name`; `ICON_PATHS` reused by both `TabDock` and `Sidebar`; `SIDEBAR_TABS` keys match `nav.go` names (`home/timer/progress/settings/library/leaderboard`). ✅