# Leaderboard Filters — Design

Date: 2026-08-14
Status: Approved (design review), awaiting implementation plan

## Summary

Add two filters to the Leaderboard screen (mobile app + Tauri desktop shell share the same web UI):

1. **Player search** — find a player by nickname and see a list of every exercise they have a lift on (with weight + rank), tap one to open that exercise's board.
2. **"Not doing" toggle** — show only the exercises where the current user has **no** lift, so every visible board is one the user is not on ("the leaderboard without me").

## Current behavior (context)

- `src/screens/LeaderboardScreen.jsx` shows **one exercise at a time**: exercise dropdown → top-50 board (podium + ranked rows) from the `lifts` table via `fetchTopLifts` (`src/lib/leaderboard.js`), ranked by `weight` desc, profiles resolved via `fetchProfiles` (`src/lib/profile.js`).
- Exercise dropdown options come from `exerciseOptions(store.days, store.sessions)` (`src/lib/data.js`) — only exercises the user has logged (fallback: 4 known exercises).
- Live updates: a per-exercise realtime channel refetches on any `lifts` change.
- Signed-out users see a blurred, locked board behind a login prompt.
- Offline fallback `leaderboardFor` generates fake community data — filters are only meaningful with real data and are hidden when signed out.

## Requirements

### UI — filter bar (`LeaderboardScreen`)

- A filter bar renders between the header and the exercise dropdown, **only when `auth.user` is present**.
- Contains:
  - A search input (rounded card style matching existing inputs, search icon, clear ✕ button when non-empty).
  - A "Not doing" toggle chip (pill, accent background when active).

### Player search

- Debounced (~300ms) `ilike` match on `profiles.nickname`, case-insensitive, partial match. Results limited to 8, rendered as a live dropdown under the input (avatar, nickname).
- Selecting a player replaces the screen content with a **player view**:
  - Header: back button (returns to the normal view, filters intact), player avatar + nickname, count of exercises ("X exercises").
  - Body: list of every exercise the player has a lift in. Each row: exercise name, player's weight, player's rank, medal emoji if rank 1–3. Tap a row → opens that exercise's normal board and exits the player view.
- Clearing the search (✕) returns to the normal view.

### "Not doing" toggle

- When active, the exercise dropdown lists only exercises where the current user has **no** lift.
- The exercise universe is boards that actually exist: `distinct exercise` over `lifts`.
- If the currently selected exercise is one the user is on, auto-switch to the first "not doing" exercise.
- Toggle off restores the full list (own logged exercises, as today).

### Edge states

- Player with no lifts → "This player has no lifts yet" message in player view.
- No nickname matches the query → "No players found" in the search dropdown.
- Toggle on but the user is on every existing board → "You're on every board" message; dropdown shows nothing.
- Players without a nickname are not searchable (only `profiles.nickname` is matched).
- Signed out: filter bar is not rendered.

## Data layer (`src/lib/leaderboard.js`, `src/lib/profile.js`)

Lazy queries — no full-table fetch:

- **Player view**: `fetchUserLifts(supabase, userId)` — `lifts` where `user_id`, select `exercise, weight`. Then for each exercise the player is in, one count query `lifts where exercise = X and weight > playerWeight` + 1 → exact rank (correct even beyond the visible top 50).
- **Not doing**: `fetchDistinctExercises(supabase)` — `select('exercise')` distinct over `lifts`. Plus the current user's own lifts (same `fetchUserLifts` with their id). Dropdown set = global − own.

New pure helpers (same pattern as `buildRows`, unit-tested):

- `rankFromBoard(rows, weight)` — rank from pre-ranked rows (rank 1 = highest).
- `notDoneExercises(allExercises, myExercises)` — set difference.
- `buildPlayerExerciseList(userLifts, ranks)` — sorted exercise rows `{ exercise, weight, rank }`.

Async functions take the Supabase client (mockable, per existing convention).

## Liveness

- The existing per-exercise realtime channel is untouched.
- While the player view or the "not doing" toggle is active, a second channel subscribes to all `lifts` changes (`event: '*'`, no filter) and lazily refetches the active filter's data (debounced). The channel is removed when both filters are exited.

## Testing & constraints

- Unit tests for the new pure helpers in `src/lib/*.test.js`; existing suite (37 tests) stays green.
- `npm run build` clean.
- Mobile-first styling consistent with the screen's current classes; no `md:` additions (Leaderboard was deliberately left out of the desktop width pass).
- `src/lib/*` and `src/screens/LeaderboardScreen.jsx` are the only files touched (plus tests). No changes to `store.jsx`, `auth.jsx`, `data.js` (except no changes at all to `data.js`), `supabase.js`.
- New UI text in the app's existing terse lowercase style ("no lifts yet", "no players found", "you're on every board", "X exercises").