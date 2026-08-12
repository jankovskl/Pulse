# Pulse Supabase Account System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase-backed account system to Pulse: email/password + Google/Apple OAuth, cloud sync of the full workout state as a JSON blob, live multi-device updates via Realtime, and a real cross-user leaderboard — with an auth modal opened from the Settings "Account" row.

**Architecture:** Local-first model is preserved (`store.jsx` keeps its `localStorage` cache). A thin pure `sync` module mirrors the state blob to a `user_state` table when a user is signed in and subscribes to Realtime for other-device changes. A `leaderboard` module queries a `lifts` table (populated on workout completion) joined with `profiles`. Auth UI is a modal triggered from the existing Settings "Account" row.

**Tech Stack:** React 19 + Vite 8 (PWA), `@supabase/supabase-js`, Supabase Auth (email/password + Google/Apple OAuth, PKCE), Postgres + RLS + Realtime. Tests use Node's built-in `node:test` + `node:assert` (matches existing `src/lib/changelog.test.js`).

## Global Constraints

- Data storage is a **single JSON blob per user** (`user_state.data jsonb`); shape identical to today's persisted `state`.
- Offline edits apply locally; push on reconnect; conflicts resolve **last-write-wins** on `updated_at`.
- **First login migrates** existing local data to the cloud (push local → becomes synced data); if a cloud row already exists, pull it down.
- Auth methods: **email/password + Google + Apple OAuth** (PKCE, `redirectTo: window.location.origin`).
- Auth UI is a **modal popup** opened from the Settings "Account" row — no full screen.
- Anonymous users keep working exactly as today; sync engages only after login.
- Follow existing `ui` component styling (Tailwind classes, `bg-card`, `text-ink`, `text-faint`, `var(--color-accent)`, rounded-[16px]/[20px]).

---

## File Structure

**New files**
- `supabase/schema.sql` — tables, RLS, profile trigger, realtime publication.
- `.env.example` — placeholder Supabase creds.
- `src/lib/supabase.js` — client singleton + config guard.
- `src/lib/auth.jsx` — `AuthProvider`, `useAuth`, `getUserId`, `subscribeUser`.
- `src/lib/sync.js` — pure sync helpers (load/push/login/lifts), no React.
- `src/lib/leaderboard.js` — pure `fetchLeaderboard`, no React.
- `src/components/AuthModal.jsx` — auth modal popup.
- `tests/lib/sync.test.js` — unit tests for `sync.js`.
- `tests/lib/leaderboard.test.js` — unit tests for `leaderboard.js`.

**Modified files**
- `package.json` — add `@supabase/supabase-js` dep + `test` script.
- `src/components/ui.jsx` — add `Modal` overlay component.
- `src/lib/store.jsx` — wire sync + lifts recording.
- `src/lib/data.js` — demote `leaderboardFor` to fallback only.
- `src/screens/SettingsScreen.jsx` — wire "Account" row to `AuthModal`.
- `src/screens/LeaderboardScreen.jsx` — use real `fetchLeaderboard`.
- `src/App.jsx` — wrap app in `AuthProvider`.

---

### Task 1: Add dependency, env, and schema

**Files:**
- Create: `supabase/schema.sql`, `.env.example`
- Modify: `package.json`

**Interfaces:** None (standalone setup).

- [ ] **Step 1: Add the dependency and a `test` script to `package.json`**

Replace the `"dependencies"` and `"scripts"` blocks so they read:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "test": "node --test tests/",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "@tailwindcss/vite": "^4.3.3",
    "lucide-react": "^1.31.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "tailwindcss": "^4.3.3"
  },
```

Then run `npm install` to install `@supabase/supabase-js`.

- [ ] **Step 2: Create `.env.example`**

```env
# Supabase project credentials (copy to .env and fill in)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Create `supabase/schema.sql`**

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise text not null,
  weight numeric not null,
  date date not null default current_date
);

create index if not exists lifts_exercise_idx on public.lifts (exercise);

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

alter publication supabase_realtime add table public.user_state;
```

- [ ] **Step 4: Verify install**

Run: `npm ls @supabase/supabase-js`
Expected: the package is listed (no `missing` / `invalid`).

---

### Task 2: Supabase client singleton

**Files:**
- Create: `src/lib/supabase.js`

**Interfaces:**
- Produces: `export const supabase` (a `SupabaseClient` or `null`), `export function isSupabaseConfigured()`.

- [ ] **Step 1: Create `src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured() {
  return Boolean(url && anonKey)
}

if (!isSupabaseConfigured()) {
  console.warn('[pulse] Supabase env vars missing; account features disabled.')
}

export const supabase = isSupabaseConfigured()
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds (env vars undefined during build is fine; `supabase` resolves to `null`).

---

### Task 3: Auth module

**Files:**
- Create: `src/lib/auth.jsx`

**Interfaces:**
- Produces: `export function AuthProvider({ children })`, `export function useAuth()`, `export function getUserId()`, `export function subscribeUser(cb)`.
- `useAuth()` returns `{ user, loading, signUpEmail(email, password), signInEmail(email, password), signInOAuth(provider), signOut() }`.
- `getUserId()` returns `string | null` synchronously.
- `subscribeUser(cb)` calls `cb(userId)` immediately and on every change; returns an unsubscribe function.

- [ ] **Step 1: Create `src/lib/auth.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

// Module-level mirrors so non-React modules (store.jsx) can read the user
// without re-rendering and can subscribe to changes.
let currentUserId = null
const listeners = new Set()

function setUserId(id) {
  currentUserId = id
  for (const cb of listeners) cb(id)
}

export function getUserId() {
  return currentUserId
}

export function subscribeUser(cb) {
  listeners.add(cb)
  cb(currentUserId)
  return () => listeners.delete(cb)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const u = data.session?.user ?? null
      setUser(u)
      setUserId(u?.id ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      setUserId(u?.id ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const api = {
    user,
    loading,
    signUpEmail: (email, password) =>
      supabase.auth.signUp({ email, password }),
    signInEmail: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signInOAuth: (provider) =>
      supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
```

- [ ] **Step 2: Verify it lints/builds**

Run: `npm run lint`
Expected: no errors (only the pre-existing `react(only-export-components)` fast-refresh warnings are acceptable).

---

### Task 4: Sync module (pure, unit-tested)

**Files:**
- Create: `src/lib/sync.js`
- Test: `tests/lib/sync.test.js`

**Interfaces:**
- Consumes: a Supabase-like client exposing `.from(table).select(cols).eq(col,val).maybeSingle()` and `.from(table).upsert(row)` / `.insert(rows)`.
- Produces:
  - `export async function loadRemote(supabase, userId)` → returns the blob `data` or `null` when no row.
  - `export async function pushRemote(supabase, userId, data)` → upserts `{ user_id, data, updated_at }`.
  - `export async function syncOnLogin(supabase, userId, localData)` → if no remote row, pushes `localData` and returns it; else returns the remote blob.
  - `export async function recordLifts(supabase, userId, lifts)` → inserts `[{ user_id, exercise, weight, date }]`; no-op when empty.

- [ ] **Step 1: Write the failing test `tests/lib/sync.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadRemote, pushRemote, syncOnLogin, recordLifts } from '../../src/lib/sync.js'

function mockSupabase({ maybeSingle, upsert, insert }) {
  const calls = { upsert: [], insert: [] }
  const builder = {
    from() { return this },
    select() { return this },
    eq() { return this },
    maybeSingle() { return Promise.resolve(maybeSingle ?? { data: null, error: null }) },
    upsert(row) { calls.upsert.push(row); return Promise.resolve(upsert ?? { error: null }) },
    insert(rows) { calls.insert.push(rows); return Promise.resolve(insert ?? { error: null }) },
    _calls: calls,
  }
  return builder
}

test('loadRemote returns the nested data blob', async () => {
  const sb = mockSupabase({ maybeSingle: { data: { data: { days: [] } }, error: null } })
  const out = await loadRemote(sb, 'u1')
  assert.deepEqual(out, { days: [] })
})

test('loadRemote returns null when no row exists', async () => {
  const sb = mockSupabase({ maybeSingle: { data: null, error: null } })
  assert.equal(await loadRemote(sb, 'u1'), null)
})

test('pushRemote upserts user_id, data and updated_at', async () => {
  const sb = mockSupabase({})
  await pushRemote(sb, 'u1', { days: [] })
  assert.equal(sb._calls.upsert.length, 1)
  const row = sb._calls.upsert[0]
  assert.equal(row.user_id, 'u1')
  assert.deepEqual(row.data, { days: [] })
  assert.ok(typeof row.updated_at === 'string')
})

test('syncOnLogin pushes local when remote missing, returns local', async () => {
  const sb = mockSupabase({ maybeSingle: { data: null, error: null } })
  const res = await syncOnLogin(sb, 'u1', { days: [{ id: 'a' }] })
  assert.equal(sb._calls.upsert.length, 1)
  assert.deepEqual(res, { days: [{ id: 'a' }] })
})

test('syncOnLogin returns remote and does not push when row exists', async () => {
  const sb = mockSupabase({ maybeSingle: { data: { data: { days: [{ id: 'remote' }] } }, error: null } })
  const res = await syncOnLogin(sb, 'u1', { days: [] })
  assert.equal(sb._calls.upsert.length, 0)
  assert.deepEqual(res, { days: [{ id: 'remote' }] })
})

test('recordLifts inserts mapped rows', async () => {
  const sb = mockSupabase({})
  await recordLifts(sb, 'u1', [
    { exercise: 'Bench Press', weight: 60, date: '2026-08-12' },
  ])
  assert.equal(sb._calls.insert.length, 1)
  assert.deepEqual(sb._calls.insert[0], [
    { user_id: 'u1', exercise: 'Bench Press', weight: 60, date: '2026-08-12' },
  ])
})

test('recordLifts is a no-op for empty input', async () => {
  const sb = mockSupabase({})
  await recordLifts(sb, 'u1', [])
  assert.equal(sb._calls.insert.length, 0)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/lib/sync.test.js`
Expected: FAIL — `Cannot find module '../../src/lib/sync.js'`.

- [ ] **Step 3: Create `src/lib/sync.js`**

```js
export async function loadRemote(supabase, userId) {
  const { data, error } = await supabase
    .from('user_state')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.data ?? null
}

export async function pushRemote(supabase, userId, data) {
  const { error } = await supabase
    .from('user_state')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function syncOnLogin(supabase, userId, localData) {
  const remote = await loadRemote(supabase, userId)
  if (remote === null) {
    await pushRemote(supabase, userId, localData)
    return localData
  }
  return remote
}

export async function recordLifts(supabase, userId, lifts) {
  if (!lifts.length) return
  const rows = lifts.map((l) => ({
    user_id: userId,
    exercise: l.exercise,
    weight: l.weight,
    date: l.date,
  }))
  const { error } = await supabase.from('lifts').insert(rows)
  if (error) throw error
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/lib/sync.test.js`
Expected: all assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.js tests/lib/sync.test.js package.json .env.example supabase/schema.sql
git commit -m "feat: add Supabase client, schema, and pure sync module (with tests)"
```

---

### Task 5: Leaderboard module (pure, unit-tested)

**Files:**
- Create: `src/lib/leaderboard.js`
- Test: `tests/lib/leaderboard.test.js`

**Interfaces:**
- Consumes: Supabase-like client with `.from('lifts').select('user_id, weight').eq('exercise', ex)` and `.from('profiles').select('id, display_name, handle').in('id', ids)`.
- Produces: `export async function fetchLeaderboard(supabase, exercise, currentUserId)` → array of `{ userId, name, handle, weight, you, rank }` sorted by `weight` desc, with `you` true when `userId === currentUserId`. Max weight per user; duplicates collapsed by `max`.

- [ ] **Step 1: Write the failing test `tests/lib/leaderboard.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchLeaderboard } from '../../src/lib/leaderboard.js'

function mockSupabase(lifts, profiles) {
  return {
    from(table) {
      return {
        select() {
          if (table === 'lifts') {
            return {
              eq() {
                return Promise.resolve({ data: lifts, error: null })
              },
            }
          }
          return {
            in() {
              return Promise.resolve({ data: profiles, error: null })
            },
          }
        },
      }
    },
  }
}

test('aggregates max weight per user and sorts desc with ranks', async () => {
  const lifts = [
    { user_id: 'a', weight: 60 },
    { user_id: 'a', weight: 70 },
    { user_id: 'b', weight: 80 },
  ]
  const profiles = [
    { id: 'a', display_name: 'Alice', handle: '@alice' },
    { id: 'b', display_name: 'Bob', handle: '@bob' },
  ]
  const rows = await fetchLeaderboard(mockSupabase(lifts, profiles), 'Bench Press', 'a')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { userId: 'b', name: 'Bob', handle: '@bob', weight: 80, you: false, rank: 1 })
  assert.deepEqual(rows[1], { userId: 'a', name: 'Alice', handle: '@alice', weight: 70, you: true, rank: 2 })
})

test('returns empty array when no lifts', async () => {
  const rows = await fetchLeaderboard(mockSupabase([], []), 'Squat', 'a')
  assert.deepEqual(rows, [])
})

test('falls back to Anonymous when profile missing', async () => {
  const rows = await fetchLeaderboard(mockSupabase([{ user_id: 'x', weight: 50 }], []), 'Deadlift', 'x')
  assert.equal(rows[0].name, 'Anonymous')
  assert.equal(rows[0].you, true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/lib/leaderboard.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/leaderboard.js`**

```js
export async function fetchLeaderboard(supabase, exercise, currentUserId) {
  const { data: lifts, error } = await supabase
    .from('lifts')
    .select('user_id, weight')
    .eq('exercise', exercise)
  if (error) throw error

  const byUser = new Map()
  for (const l of lifts ?? []) {
    const cur = byUser.get(l.user_id) ?? 0
    if (l.weight > cur) byUser.set(l.user_id, l.weight)
  }

  const userIds = [...byUser.keys()]
  let profiles = []
  if (userIds.length) {
    const res = await supabase.from('profiles').select('id, display_name, handle').in('id', userIds)
    profiles = res.data ?? []
  }
  const profMap = new Map(profiles.map((p) => [p.id, p]))

  const rows = [...byUser.entries()].map(([uid, weight]) => {
    const p = profMap.get(uid) ?? {}
    return {
      userId: uid,
      name: p.display_name ?? 'Anonymous',
      handle: p.handle ?? '',
      weight,
      you: uid === currentUserId,
    }
  })

  rows.sort((a, b) => b.weight - a.weight)
  rows.forEach((r, i) => {
    r.rank = i + 1
  })
  return rows
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/lib/leaderboard.test.js`
Expected: all assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.js tests/lib/leaderboard.test.js
git commit -m "feat: add pure leaderboard fetch module (with tests)"
```

---

### Task 6: Wire sync into the store

**Files:**
- Modify: `src/lib/store.jsx`

**Interfaces:**
- Consumes: `supabase` (from `./supabase`), `getUserId`, `subscribeUser` (from `./auth`), `syncOnLogin`, `pushRemote`, `recordLifts` (from `./sync`).
- Produces: same `useStore()` API as before; plus lifts are recorded on workout completion when a user is signed in.

**Behavior to add (do not change existing reducer logic):**
1. On user change (via `subscribeUser`): if a `userId` is present and `supabase` exists, call `syncOnLogin(supabase, userId, stateRef.current)`; set a `suppressUpsert` ref `true` while applying the returned blob via `setState`, then reset it. If `userId` becomes `null`, stop any realtime subscription.
2. While a user is signed in and `!suppressUpsert`, debounce (~500ms) state changes and call `pushRemote(supabase, userId, state)`.
3. When signed in, open a Realtime channel on `user_state` for the current `user_id`; on remote change, set `suppressUpsert` true, load the blob, then reset.
4. In `toggleExercise`, inside the block that already builds `fresh` (day just completed), if `getUserId()` and `supabase`, call `recordLifts(supabase, getUserId(), fresh.map((e) => ({ exercise: e.exercise, weight: e.weight, date: e.full })))` (fire-and-forget).

- [ ] **Step 1: Add imports and module-level refs near the top of `StoreProvider`**

After the existing `import` lines at the top of `store.jsx`, add:

```js
import { getUserId, subscribeUser } from './auth'
import { supabase } from './supabase'
import { syncOnLogin, pushRemote, recordLifts } from './sync'
```

Inside `StoreProvider`, add two refs (near `const [state, setState] = useState(load)`):

```js
const suppressUpsert = useRef(false)
const realtimeCh = useRef(null)
const stateRef = useRef(state)
useEffect(() => { stateRef.current = state }, [state])
```

- [ ] **Step 2: Add the login/realtime subscription effect**

Add this effect inside `StoreProvider` (after the `stateRef` sync effect):

```js
useEffect(() => {
  if (!supabase) return
  const unsub = subscribeUser((userId) => {
    if (!userId) {
      realtimeCh.current?.unsubscribe()
      realtimeCh.current = null
      return
    }
    syncOnLogin(supabase, userId, stateRef.current)
      .then((blob) => {
        suppressUpsert.current = true
        setState((s) => ({ ...s, ...blob }))
        suppressUpsert.current = false
      })
      .catch(() => {})
    realtimeCh.current?.unsubscribe()
    realtimeCh.current = supabase
      .channel(`user_state:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_state',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const blob = payload.new?.data
        if (!blob) return
        suppressUpsert.current = true
        setState((s) => ({ ...s, ...blob }))
        suppressUpsert.current = false
      })
      .subscribe()
  })
  return () => {
    unsub()
    realtimeCh.current?.unsubscribe()
    realtimeCh.current = null
  }
}, [supabase])
```

- [ ] **Step 3: Add the debounced push effect**

Add this effect inside `StoreProvider`:

```js
useEffect(() => {
  if (!supabase || !getUserId()) return
  if (suppressUpsert.current) return
  const id = setTimeout(() => {
    const uid = getUserId()
    if (uid) pushRemote(supabase, uid, stateRef.current).catch(() => {})
  }, 500)
  return () => clearTimeout(id)
}, [state, supabase])
```

- [ ] **Step 4: Record lifts on workout completion**

In `toggleExercise`, locate the block that ends with `if (fresh.length) sessions = [...fresh, ...sessions].slice(0, 60)`. Immediately after that line (still inside the `if (!prevAll && nextAll)` block), add:

```js
if (supabase && getUserId()) {
  const uid = getUserId()
  recordLifts(
    supabase,
    uid,
    fresh.map((e) => ({ exercise: e.exercise, weight: e.weight, date: e.full })),
  ).catch(() => {})
}
```

- [ ] **Step 5: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; only pre-existing fast-refresh warnings from `timer.jsx`/`store.jsx`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.jsx
git commit -m "feat: wire cloud sync + realtime + lifts recording into store"
```

---

### Task 7: Modal component + AuthModal

**Files:**
- Modify: `src/components/ui.jsx` (add `Modal`)
- Create: `src/components/AuthModal.jsx`

**Interfaces:**
- `ui.Modal`: `export function Modal({ open, onClose, children, title })` — fixed overlay, backdrop click closes, Esc closes, styled like the existing "What's new" sheet but centered.
- `AuthModal`: `export default function AuthModal({ open, onClose })`.

- [ ] **Step 1: Add `Modal` to `src/components/ui.jsx`**

Append this export at the end of `ui.jsx`:

```jsx
export function Modal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[380px] flex-col gap-4 rounded-[24px] bg-card p-5 outline outline-1 outline-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/AuthModal.jsx`**

```jsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Avatar, initialsOf, Modal } from './ui'

export default function AuthModal({ open, onClose }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn) {
    setError('')
    setBusy(true)
    try {
      const { error: e } = await fn()
      if (e) setError(e.message)
      else onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (auth.user) {
    return (
      <Modal open={open} onClose={onClose}>
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-semibold text-soft">Account</span>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-tile">
            <X size={15} color="#A1A1AA" />
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-[16px] bg-surface p-3">
          <Avatar initials={initialsOf(auth.user.email || 'U')} size={40} />
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-[14px] font-semibold text-ink">{auth.user.email}</span>
            <span className="text-[11px] text-faint">Signed in</span>
          </div>
        </div>
        <button
          onClick={() => run(() => auth.signOut())}
          className="h-10 rounded-[14px] bg-accent text-[14px] font-semibold text-white"
        >
          Sign out
        </button>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold text-soft">Account</span>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-tile">
          <X size={15} color="#A1A1AA" />
        </button>
      </div>
      {error && <span className="text-[12px] text-[#FF6B6B]">{error}</span>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="h-10 rounded-[12px] bg-surface px-3 text-[14px] text-ink outline outline-1 outline-white/10"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="h-10 rounded-[12px] bg-surface px-3 text-[14px] text-ink outline outline-1 outline-white/10"
      />
      <div className="flex gap-2">
        <button
          onClick={() => run(() => auth.signInEmail(email, password))}
          disabled={busy}
          className="h-10 flex-1 rounded-[14px] bg-accent text-[14px] font-semibold text-white disabled:opacity-50"
        >
          Sign in
        </button>
        <button
          onClick={() => run(() => auth.signUpEmail(email, password))}
          disabled={busy}
          className="h-10 flex-1 rounded-[14px] bg-tile text-[14px] font-semibold text-ink disabled:opacity-50"
        >
          Sign up
        </button>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={() => auth.signInOAuth('google')}
          className="h-10 rounded-[14px] bg-surface text-[14px] font-semibold text-ink outline outline-1 outline-white/10"
        >
          Continue with Google
        </button>
        <button
          onClick={() => auth.signInOAuth('apple')}
          className="h-10 rounded-[14px] bg-surface text-[14px] font-semibold text-ink outline outline-1 outline-white/10"
        >
          Continue with Apple
        </button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui.jsx src/components/AuthModal.jsx
git commit -m "feat: add Modal component and AuthModal popup"
```

---

### Task 8: Wire Settings "Account" row to AuthModal

**Files:**
- Modify: `src/screens/SettingsScreen.jsx`

**Interfaces:**
- Consumes: `AuthModal` (default export), `useAuth` (from `../lib/auth`).

- [ ] **Step 1: Add imports and open state**

In `SettingsScreen.jsx`, update the import line `import { Avatar, initialsOf, Screen, Toggle } from '../components/ui'` to also import `Modal` (already used) — no change needed there. Add:

```js
import { useAuth } from '../lib/auth'
import AuthModal from '../components/AuthModal'
```

Inside `SettingsScreen`, add state next to `const [sheetOpen, setSheetOpen] = useState(false)`:

```js
const { user } = useAuth()
const [acctOpen, setAcctOpen] = useState(false)
```

- [ ] **Step 2: Update the existing "Account" Row**

The existing Account `Row` (currently has no `onClick`) should open the modal and show the signed-in email as a subtitle. Replace:

```jsx
          <Row
            icon={<User size={15} color="var(--color-accent)" />}
            title="Account"
            subtitle="Profile details and avatar"
          />
```

with:

```jsx
          <Row
            icon={<User size={15} color="var(--color-accent)" />}
            title="Account"
            subtitle={user ? user.email : 'Sign in to sync your data'}
            onClick={() => setAcctOpen(true)}
          />
```

- [ ] **Step 3: Render the AuthModal**

After the closing `</Screen>` of the component (before the final `}`), add:

```jsx
      <AuthModal open={acctOpen} onClose={() => setAcctOpen(false)} />
```

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.jsx
git commit -m "feat: open AuthModal from Settings Account row"
```

---

### Task 9: Use real leaderboard data

**Files:**
- Modify: `src/screens/LeaderboardScreen.jsx`
- Modify: `src/lib/data.js` (demote `leaderboardFor` to fallback)

**Interfaces:**
- Consumes: `fetchLeaderboard(supabase, exercise, currentUserId)` (from `../lib/leaderboard`), `useAuth` (from `../lib/auth`), `supabase` (from `../lib/supabase`).

- [ ] **Step 1: Replace synthetic data with a real fetch in `LeaderboardScreen.jsx`**

At the top of the file, update imports:

```js
import { useMemo, useState, useEffect } from 'react'
import { Check, ChevronDown, ChevronLeft, Dumbbell } from 'lucide-react'
import { exerciseOptions } from '../lib/data'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fetchLeaderboard } from '../lib/leaderboard'
import { Avatar, initialsOf, Screen, useNav } from '../components/ui'
```

Inside the component, after `const current = exercise || exOptions[0] || 'Bench Press'`, replace the `rows` `useMemo` with:

```js
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    if (!supabase) {
      setRows([])
      setLoading(false)
      return
    }
    fetchLeaderboard(supabase, current, user?.id ?? null)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch(() => { if (!cancelled) setRows([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [current, user?.id])
```

Remove the now-unused `leaderboardFor` import from `data.js` usage here (it is no longer referenced in this file).

- [ ] **Step 2: Show a loading state**

In the JSX, before the podium block (the `<div className="flex items-end justify-center gap-2.5 pt-4">`), add:

```jsx
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-tile border-t-accent" />
            <span className="text-[13px] text-sub">Loading leaderboard…</span>
          </div>
        )}
```

And wrap the existing podium + list in `{!loading && (...)}` so they only render once loaded (keep the "log a workout" hint outside). Concretely, change the opening of the podium section to `{!loading && (` and close it before the final `</div>` of the column, adding `)}`.

- [ ] **Step 3: Demote `leaderboardFor` in `src/lib/data.js`**

In `data.js`, keep the `leaderboardFor` function but mark it as a fallback (it is no longer imported by `LeaderboardScreen.jsx`). Add a one-line comment above it: `// DEPRECATED: synthetic data, kept only as an offline fallback.`. Do not delete it.

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; `leaderboardFor` may show as unused — that is acceptable (kept intentionally).

- [ ] **Step 5: Commit**

```bash
git add src/screens/LeaderboardScreen.jsx src/lib/data.js
git commit -m "feat: leaderboard uses real Supabase data"
```

---

### Task 10: Wrap app in AuthProvider

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `AuthProvider` (from `./lib/auth`).

- [ ] **Step 1: Wrap the providers**

In `App.jsx`, add `import { AuthProvider } from './lib/auth'` and wrap `StoreProvider` with `AuthProvider`:

```jsx
function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <AccentSync />
        <NekoCat />
        <TimerProvider>
          <NavProvider>
            <Router />
          </NavProvider>
        </TimerProvider>
      </StoreProvider>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Verify build and run the full test suite**

Run: `npm run build && npm run test`
Expected: build succeeds; `sync.test.js` and `leaderboard.test.js` all pass.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wrap app in AuthProvider"
```

---

### Task 11: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Apply the schema**

In the Supabase dashboard SQL editor, run the contents of `supabase/schema.sql`. Confirm tables `profiles`, `user_state`, `lifts` exist and RLS policies are active. Enable the `user_state` table in Replication / Realtime (the schema's `alter publication` handles it; verify in Dashboard → Database → Replication).

- [ ] **Step 2: Configure env + providers**

Create `.env` from `.env.example`, fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. In Supabase Auth settings, enable Email/Password, Google, and Apple, each with `redirectTo` = your dev origin.

- [ ] **Step 3: Run dev and verify flows**

Run: `npm run dev`. Then:
1. As an anonymous user, add a day + exercise, complete it → confirm a `lifts` row appears for your test user after signing in.
2. Sign up via email → confirm the local data migrated (reload shows same data) and a `user_state` row exists.
3. Open a second browser/device, sign in with the same account, complete a set on device A → confirm device B updates within a few seconds (Realtime).
4. Sign out → confirm local cache remains and the app still works offline.
5. Open Leaderboard, complete a lift, confirm your row appears (with "you" highlighted) and others' lifts show from `lifts`.

- [ ] **Step 4: Lint + build final gate**

Run: `npm run lint && npm run build && npm run test`
Expected: all clean; all tests pass.

---

## Self-review notes (completed)

- **Spec coverage:** schema/tables/RLS/realtime (Task 1), client (Task 2), auth + providers (Task 3), sync blob migrate/pull/push/realtime (Task 6), leaderboard backend (Task 5 + 9), lifts on completion (Task 6), auth modal from Settings Account row (Task 7 + 8), offline last-write-wins (Tasks 6 + 11), first-login migrate (Task 6). All spec requirements map to a task.
- **Placeholders:** none — every code step has concrete code or commands.
- **Type/name consistency:** `syncOnLogin/pushRemote/loadRemote/recordLifts` (Task 4) match store usage (Task 6); `fetchLeaderboard(supabase, exercise, currentUserId)` matches LeaderboardScreen (Task 9); `useAuth/getUserId/subscribeUser` consistent across Tasks 3, 6, 8, 9, 10. `supabase` may be `null` everywhere it is consumed, and all consumers guard with `if (!supabase) return`.
