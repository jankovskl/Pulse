# Pulse Desktop Design

Date: 2026-08-14
Status: Approved

## Goal

Let Pulse run as a desktop app on the user's computer while keeping the phone app unchanged. Two layers on one codebase: (1) the web app becomes responsive so its layout adapts to wide desktop windows, and (2) a Tauri v2 shell wraps the built app into a native, installable Windows program (NSIS installer, auto-updates, app icon). Data, account, and sync stay identical — desktop and phone share the same Supabase account.

## Approach

Keep a single React + Vite + Tailwind codebase. Add responsive behavior through the existing single `Screen` chokepoint in `src/components/ui.jsx`: at desktop width it renders a left `Sidebar` instead of the mobile bottom `TabDock`. Each screen adapts via layout-only class changes — no state, data, or interaction logic is rewritten. Add a new `src-tauri/` folder containing the Tauri v2 shell that loads the built web app.

## Design

### 1. Architecture

```
Pulse/ (existing React + Vite + Tailwind app)
├── src/            ← responsive layout changes (shared with web)
├── src-tauri/      ← NEW: Tauri v2 shell (Rust, ~10MB app)
└── public/icons    ← existing icon set; icon-512.png → Windows .ico
```

- Same codebase, no fork. Phone keeps working unchanged.
- `Screen` component (src/components/ui.jsx) becomes responsive: at ≥768px it renders the left `Sidebar` instead of the bottom `TabDock`. All screens get the desktop treatment through that one chokepoint.
- Tauri v2 shell loads the built web app in WebView2 (present on Windows 11), opens at 1280×800 resizable, ships as an NSIS installer with the app icon.

### 2. Components — desktop shell

- New `Sidebar` component in `src/components/ui.jsx`, alongside `TabDock`:
  - Fixed left rail (~220px), same visual language: dark `bg-dock`-style background, accent-highlighted active item.
  - Six items — Home, Timer, Progress, Settings, Library, Leaderboard — using the same lucide icons as mobile.
  - Collapses to the existing bottom `TabDock` below 768px. One breakpoint; mobile behavior untouched.
  - The floating timer pill (top-right during a running timer) stays, since `Screen` renders it in both modes.
- Screen adaptations at wide widths (layout-only, inside existing screens):
  - Home: day tiles row → full-width 7-column grid with day names always visible; workout-day cards get a horizontal layout with exercises inline.
  - DayDetail: exercise list uses the full width (larger set/rep rows); add-exercise flow unchanged.
  - Library: search bar + results become a two-column grid instead of one long list.
  - Timer / Progress / Settings / Leaderboard: content column widens; no logic changes.
- No component is rewritten — each screen keeps its state, data hooks, and interactions; only container classes adapt.

### 3. Data, sync & state

- No new data layer. Existing Supabase sync (`lib/sync.js`, `lib/auth.js`) is untouched — desktop logs into the same account, same tables, same offline cache. Phone ↔ desktop sync is automatic.
- State (`lib/store.jsx`, `lib/timer.jsx`) is entirely in-app; nothing changes.
- Verify `lib/supabase.js` config works from inside WebView2 (it is plain HTTPS fetch, expected to work with no code change).

### 4. Distribution (NSIS + auto-updates)

- `tauri build` produces an NSIS `.exe` installer + portable exe, signed or unsigned (code signing added later if desired).
- Auto-updates via Tauri updater hosted on GitHub Releases — app checks on launch, offers update. Requires the repo to be on GitHub (currently a local git repo; pushing is optional and the updater can be wired later without touching app code).

### 5. Tauri shell specifics (`src-tauri/`)

- `tauri.conf.json`: app identifier (e.g. `com.mateu.pulse`), window 1280×800 resizable, icon set (`.ico` derived from icon-512.png).
- `Cargo.toml` + `src/main.rs`: minimal Rust entry that loads the built web app.
- Windows bundle config for the NSIS installer (name "Pulse", default install dir, shortcuts).
- `capabilities/default.json`: only the permissions the app needs (core, window). Supabase/network runs in the webview, not through Tauri IPC, so no extra plugin permissions.

### 6. Testing & verification

- Web layer: existing tests stay green (`node --test`, oxlint). Add a responsive check verifying the sidebar renders at desktop width and the dock at mobile width (manual/visual, plus a small render assertion if feasible).
- Build gate: `npm run build` must pass before `tauri build`.
- Desktop smoke test: launch the built exe, confirm login → sync → Home renders with sidebar, timer works.