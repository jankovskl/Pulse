# Pulse — Supabase Account System (Design)

**Date:** 2026-08-12
**Status:** Approved for implementation planning

## Goal

Add a Supabase-backed account system to Pulse (React + Vite PWA) that provides:

1. **Authentication** — email/password + Google + Apple OAuth.
2. **Cloud sync** — the user's full workout state lives in Supabase and follows them across devices.
3. **Multi-device live** — edits on one device appear on others in near real time.
4. **Leaderboard backend** — replace the current synthetic leaderboard with real, cross-user data.

Anonymous (not-logged-in) users keep using the app exactly as today, with localStorage only. Sync engages only after login.

## Decisions (from clarifying Q&A)

| Topic | Decision |
|---|---|
| Scope | Auth + cloud sync + multi-device live + leaderboard backend |
| Auth methods | Email/password + Google + Apple OAuth |
| Data storage | Single JSON blob per user (`user_state.data jsonb`) |
| Offline | Local cache; edits apply locally, push on reconnect; **last-write-wins** |
| First login | Migrate existing local data to the cloud (push local → become synced data) |
| Auth UI | "Account" row in Settings → opens a **modal popup** for auth |

## Architecture

Local-first model is preserved. `store.jsx` continues to own state in `localStorage`. A new **sync layer** mirrors the blob to Supabase when a user is signed in, and a Realtime subscription pulls remote changes from other devices.

```
┌────────────┐   useAuth()   ┌──────────────┐
│ Settings   │ ────────────▶│  AuthProvider │ (supabase.auth)
│  (Account) │   modal       └──────────────┘
└────────────┘                                      │
                                                    ▼
┌────────────┐   upsert blob / lifts    ┌────────────────────┐
│  store.jsx │ ────────────────────────▶│  Supabase (Postgres)│
│ (localStorage│ ◀──── Realtime UPDATE ──│  user_state, lifts  │
│   cache)    │                          └────────────────────┘
└────────────┘
```

## 1. Supabase setup

- User creates a Supabase project. Credentials are read at build time from `.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Ship `.env.example` with placeholder values and a note to copy to `.env`.
- Auth providers enabled in Supabase dashboard: Email/Password, Google, Apple. OAuth uses the **PKCE** flow with `redirectTo: window.location.origin`.

### Schema (`supabase/schema.sql`)

```sql
-- Profiles, one row per auth user, auto-created by trigger.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- One JSON blob per user = the entire app state.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Per-lift rows powering the leaderboard.
create table if not exists public.lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise text not null,
  weight numeric not null,
  date date not null default current_date
);

create index if not exists lifts_exercise_idx on public.lifts (exercise);

-- Auto-create profile on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, handle)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          split_part(new.email, '@', 1));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.user_state enable row level security;
alter table public.lifts enable row level security;

create policy "profiles readable by all" on public.profiles
  for select using (auth.uid() is not null);
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

create policy "state owner rw" on public.user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "lifts readable by all" on public.lifts
  for select using (auth.uid() is not null);
create policy "lifts owner write" on public.lifts
  for insert with check (auth.uid() = user_id);

-- Realtime for live multi-device sync.
alter publication supabase_realtime add table public.user_state;
```

## 2. Client & auth

**`src/lib/supabase.js`**
- `import { createClient } from '@supabase/supabase-js'`
- Export a singleton `supabase` built from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Throw a clear error at init if env vars are missing (so misconfiguration is obvious).

**`src/lib/auth.jsx`**
- `AuthProvider` wrapping the app (added in `App.jsx` inside `StoreProvider`).
- `useAuth()` returns:
  - `user` — current Supabase user or `null`
  - `loading` — initial session resolution
  - `signUpEmail(email, password)` → `supabase.auth.signUp`
  - `signInEmail(email, password)` → `supabase.auth.signInWithPassword`
  - `signInOAuth(provider)` → `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })`
  - `signOut()` → `supabase.auth.signOut`
- Subscribe to `supabase.auth.onAuthStateChange` to keep `user` in sync.
- Expose `session` if needed by the sync layer.

## 3. Sync layer (extension of `store.jsx`)

The store's localStorage persistence is **unchanged** and remains the local cache.

Add an internal sync module (can live in `store.jsx` or a new `src/lib/sync.js`):

- **On login / auth state change to signed-in:**
  1. Fetch `user_state` row for `user.id`.
  2. If **no row exists** → upsert the current local blob (`{ user_id, data, updated_at }`). This is the "migrate local data to cloud" behavior.
  3. If a **row exists** → load its `data` into the store (replace local state). This handles re-login on a new device.
- **On local state change while signed in:** debounce (~500ms) then upsert the blob to `user_state`. Guard with a `suppressUpsert` flag so remote pulls don't echo back up.
- **Realtime:** subscribe to `user_state` changes (`UPDATE`/`INSERT`) where `user_id = current user`. On event:
  - set `suppressUpsert = true`
  - load incoming `data` into the store
  - clear `suppressUpsert` after applying
  This yields live multi-device updates.
- **Offline:** local edits always apply. If an upsert fails (offline), queue/retry on the `window` `online` event. `navigator.onLine` gates immediate pushes. Conflicts resolve **last-write-wins** (newest `updated_at` — Supabase `updated_at` defaults on conflict-free upsert; we send client timestamp).

> Note: `store.jsx` currently hosts `backfillExercises` and other logic keyed off the single state object. The blob shape stored in `user_state.data` is identical to today's persisted `state`, so no shape change is required.

## 4. Leaderboard backend

**`src/lib/leaderboard.js`**
- `fetchLeaderboard(exercise)`:
  ```sql
  select p.display_name, p.handle, p.avatar_url, max(l.weight) as weight
  from public.lifts l
  join public.profiles p on p.id = l.user_id
  where l.exercise = :exercise
  group by p.id, p.display_name, p.handle, p.avatar_url
  order by weight desc
  limit 50
  ```
- Returns rows `{ name, handle, color, weight, rank, you }`. `you` is true when `user_id = current user`. `color` derived from an avatar color function (reuse `Avatar`/`initialsOf` logic from `ui`).
- Handles the anonymous case by returning `[]` (UI shows the existing "log a workout" hint).

**`LeaderboardScreen.jsx`**
- Replace synthetic `leaderboardFor` call with `fetchLeaderboard(current)`.
- Add a loading state while fetching; keep the existing exercise picker UI.
- `useAuth()` supplies the current user for the `you` flag.

**Lifts writes (`store.toggleExercise`)**
- When a day is completed and a user is signed in, insert a `lifts` row per completed exercise that has `weight > 0`: `{ user_id, exercise: e.name, weight: e.weight, date: full }`.
- Dedupe is handled by the `max(weight)` aggregation in the query, so repeated logs for the same exercise/date are safe.
- Anonymous users: skip lifts writes (no `user_id`).
- The `data.js` `leaderboardFor` synthetic function can remain as a no-network fallback but is no longer used by the default path.

## 5. Auth UI (modal popup)

- **`SettingsScreen.jsx`**: add an **"Account"** settings row. Tapping it opens an auth modal.
- **`src/components/AuthModal.jsx`** (new): a popup overlay styled with existing `ui` components, containing:
  - When **signed out**: email + password fields, "Sign up" and "Sign in" buttons, plus "Continue with Google" and "Continue with Apple" buttons. Inline error display.
  - When **signed in**: shows display name / email / avatar, and a "Sign out" button. Also indicates sync status (e.g., "Synced" / "Offline — will sync when online").
- Close button; backdrop click closes.
- OAuth buttons trigger `signInOAuth(provider)` and the browser redirects; the app resumes at `window.location.origin` and `onAuthStateChange` picks up the session.

## 6. Files touched

**New**
- `src/lib/supabase.js`
- `src/lib/auth.jsx`
- `src/lib/leaderboard.js`
- `src/components/AuthModal.jsx`
- `supabase/schema.sql`
- `.env.example`

**Modified**
- `src/lib/store.jsx` — sync layer (upsert on change, pull on login, realtime subscribe, lifts insert).
- `src/App.jsx` — wrap in `AuthProvider`.
- `src/screens/LeaderboardScreen.jsx` — real `fetchLeaderboard`.
- `src/screens/SettingsScreen.jsx` — "Account" row → opens `AuthModal`.
- `src/lib/data.js` — `leaderboardFor` becomes fallback only (or removed if unused).
- `package.json` — add `@supabase/supabase-js` dependency.

## 7. Error handling & edge cases

- Missing env vars → singleton throws a readable error; app still works anonymously.
- Network failure during upsert → retain local, retry on `online`.
- Two devices editing → last-write-wins on `updated_at`.
- Realtime echo prevention via `suppressUpsert` flag.
- OAuth redirect return handled by `onAuthStateChange`; no manual session parsing.
- Sign out → stop realtime subscription, stop upserts; local cache remains for anonymous use.

## 8. Testing

- Unit: `store.jsx` sync decisions (mock `supabase`) — verify migrate-on-first-login, pull-on-existing, lift insert on completion, suppressUpsert flag.
- `leaderboard.js`: mock `supabase` query, assert shape and `you` flag.
- `auth.jsx`: mock `supabase.auth`, assert `signInEmail`/`signUpEmail`/`signInOAuth`/`signOut` call the right methods.
- Manual: sign up, log a workout, open second device/browser, confirm live update; sign out and confirm local cache persists; leaderboard shows real rows after logging lifts.

## 9. Out of scope (YAGNI)

- Password reset email UI (Supabase handles the flow; can be linked later).
- Editing profile/handle in-app (trigger sets a default; editing is a future addition).
- Real-time conflict merging beyond last-write-wins.
- Team/shared workout plans.
