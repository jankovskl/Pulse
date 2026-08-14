# Leaderboard Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two filters to the Leaderboard screen — search a player by nickname to see their lifts across exercises, and a "Not doing" toggle that restricts the exercise dropdown to exercises the current user has not lifted in.

**Architecture:** New lazy Supabase fetchers + pure ranking helpers in `src/lib/leaderboard.js` (same mockable pattern as `fetchTopLifts`/`buildRows`), a `searchProfiles` fetcher in `src/lib/profile.js`, a small presentational filter-bar component, and state + a second realtime channel wired into `LeaderboardScreen.jsx`. The existing per-exercise board fetch and realtime channel are left untouched.

**Tech Stack:** React 18 + Vite, Supabase JS client, `node:test` unit tests (no React component test infra), lucide-react icons.

## Global Constraints

- Mobile (`< md`, 768px) layouts must stay byte-identical — the Leaderboard screen is intentionally desktop-untouched (no `md:` additions anywhere in this work).
- Only modify: `src/lib/leaderboard.js`, `src/lib/profile.js`, their `*.test.js` files, `src/components/LeaderboardFilterBar.jsx` (new), and `src/screens/LeaderboardScreen.jsx`.
- Do NOT touch: `src/lib/store.jsx`, `src/lib/auth.jsx`, `src/lib/supabase.js`, `src/lib/data.js`, any other screen/component.
- `npm run build` must pass. Unit tests: `node --test src/lib/*.test.js` must pass (existing suite = 37 tests; keep green and add new ones).
- Async functions take the Supabase client as their first argument (mockable). Pure helpers are exported for unit tests.
- New UI copy uses the app's terse lowercase style: "no lifts yet", "no players found", "you're on every board", "X exercises".
- The existing per-exercise realtime channel (`lifts:${current}`, filter `exercise=eq.${current}`) must remain as-is and continue driving the default board.

---

### Task 1: Leaderboard data layer — fetchers and pure helpers

**Files:**
- Modify: `src/lib/leaderboard.js` (append below existing `buildRows`)
- Test: `src/lib/leaderboard.test.js`

**Interfaces:**
- Produces (used by Task 4):
  - `fetchUserLifts(supabase, userId) => Promise<Array<{ exercise: string, weight: number }>>`
  - `fetchLiftRanks(supabase, userLifts) => Promise<Record<string, number>>` — exact rank (1-based) per exercise; rank = count of lifts in that exercise heavier than the user's own weight + 1.
  - `fetchDistinctExercises(supabase) => Promise<string[]>` — sorted, unique, non-empty exercise names that have lifts.
  - `notDoneExercises(allExercises, myExercises) => string[]` — pure set difference, alphabetically sorted.
  - `buildPlayerExerciseList(userLifts, ranks) => Array<{ exercise, weight, rank }>` — pure, sorted by rank ascending (best first).
- Note: the spec's `rankFromBoard` helper is intentionally dropped — exact ranks beyond the visible top 50 come from the count query in `fetchLiftRanks`, so `rankFromBoard` would be dead code (YAGNI).

- [ ] **Step 1: Write the failing tests** (append to `src/lib/leaderboard.test.js`)

```js
import { fetchTopLifts, fetchUserLift, buildRows, fetchUserLifts, fetchLiftRanks, fetchDistinctExercises, notDoneExercises, buildPlayerExerciseList } from './leaderboard.js'
```

Add a mock client that supports the new query shapes — one simple mock per shape, following the existing `makeClient` style (do not try to overload a single mock for every shape). Each test below defines its concrete mock inline.

Add the tests:

```js
test('notDoneExercises returns only exercises the user has not lifted in', () => {
  const all = ['Squat', 'Bench Press', 'Deadlift']
  const mine = ['Bench Press']
  assert.deepEqual(notDoneExercises(all, mine), ['Deadlift', 'Squat'])
})

test('notDoneExercises dedupes and sorts', () => {
  assert.deepEqual(notDoneExercises(['b', 'a', 'b', 'a'], ['b']), ['a'])
})

test('buildPlayerExerciseList sorts by rank ascending', () => {
  const lifts = [
    { exercise: 'Deadlift', weight: 180 },
    { exercise: 'Bench Press', weight: 100 },
    { exercise: 'Squat', weight: 140 },
  ]
  const ranks = { 'Bench Press': 3, Squat: 1, Deadlift: 2 }
  const out = buildPlayerExerciseList(lifts, ranks)
  assert.deepEqual(out, [
    { exercise: 'Squat', weight: 140, rank: 1 },
    { exercise: 'Deadlift', weight: 180, rank: 2 },
    { exercise: 'Bench Press', weight: 100, rank: 3 },
  ])
})

test('buildPlayerExerciseList falls back to weight order when ranks missing', () => {
  const lifts = [
    { exercise: 'A', weight: 50 },
    { exercise: 'B', weight: 80 },
  ]
  const out = buildPlayerExerciseList(lifts, {})
  assert.equal(out[0].exercise, 'B')
})

test('fetchUserLifts returns that user\'s lifts', async () => {
  const client = /* mock: select('exercise, weight') -> eq('user_id','u1') -> rows */
    { from: () => ({ select: () => ({ eq: async () => ({ data: [{ exercise: 'Squat', weight: 140 }], error: null }) }) }) }
  const out = await fetchUserLifts(client, 'u1')
  assert.equal(out[0].exercise, 'Squat')
})

test('fetchLiftRanks computes 1-based rank per exercise', async () => {
  const counts = [4, 9] // 4 heavier than Deadlift lift, 9 heavier than Bench lift
  const client = { from: () => ({ select: () => ({ eq: (c, e) => ({ gt: async (field, w) => ({ count: counts.shift(), error: null }) }) }) }) }
  const out = await fetchLiftRanks(client, [
    { exercise: 'Deadlift', weight: 180 },
    { exercise: 'Bench Press', weight: 100 },
  ])
  assert.deepEqual(out, { Deadlift: 5, 'Bench Press': 10 })
})

test('fetchDistinctExercises returns unique non-null exercises sorted', async () => {
  const client = { from: () => ({ select: async (c, opts) => ({ data: [{ exercise: 'Squat' }, { exercise: 'Squat' }, { exercise: 'Deadlift' }, { exercise: null }], error: null }) }) }
  const out = await fetchDistinctExercises(client)
  assert.deepEqual(out, ['Deadlift', 'Squat'])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/lib/leaderboard.test.js`
Expected: FAIL — `notDoneExercises is not a function` (and the other new functions undefined).

- [ ] **Step 3: Implement the functions** (append to `src/lib/leaderboard.js`)

```js
// Return every lift row (exercise + weight) a user has logged.
export async function fetchUserLifts(supabase, userId) {
  const { data, error } = await supabase
    .from('lifts')
    .select('exercise, weight')
    .eq('user_id', userId)
  if (error) throw error
  return data ?? []
}

// Exact 1-based rank per exercise for a user's lifts: number of lifts heavier
// than theirs in that exercise + 1 (correct even beyond the visible top 50).
export async function fetchLiftRanks(supabase, userLifts) {
  const ranks = {}
  for (const lift of userLifts ?? []) {
    const { count, error } = await supabase
      .from('lifts')
      .select('*', { count: 'exact', head: true })
      .eq('exercise', lift.exercise)
      .gt('weight', lift.weight)
    if (error) throw error
    ranks[lift.exercise] = (count ?? 0) + 1
  }
  return ranks
}

// Distinct, non-null, alphabetically sorted exercises that have lifts.
export async function fetchDistinctExercises(supabase) {
  const { data, error } = await supabase
    .from('lifts')
    .select('exercise', { distinct: true })
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.exercise).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  )
}

// Exercises the user is NOT on (pure set difference, sorted).
export function notDoneExercises(allExercises, myExercises) {
  const mine = new Set(myExercises ?? [])
  return [...new Set(allExercises ?? [])]
    .filter((e) => !mine.has(e))
    .sort((a, b) => a.localeCompare(b))
}

// Player's exercise rows sorted best-first (rank ascending, weight fallback).
export function buildPlayerExerciseList(userLifts, ranks) {
  return (userLifts ?? [])
    .map((l) => ({ exercise: l.exercise, weight: Number(l.weight), rank: ranks?.[l.exercise] ?? null }))
    .sort((a, b) => {
      if (a.rank != null && b.rank != null) return a.rank - b.rank
      return b.weight - a.weight
    })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/lib/leaderboard.test.js`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.js src/lib/leaderboard.test.js
git commit -m "feat: leaderboard data layer for player search and not-doing filter"
```

---

### Task 2: Profile search fetcher

**Files:**
- Modify: `src/lib/profile.js`
- Test: `src/lib/profile.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 4): `searchProfiles(supabase, query, limit = 8) => Promise<Array<{ user_id, nickname, pfp }>>` — case-insensitive substring match on nickname.

- [ ] **Step 1: Write the failing test** (append to `src/lib/profile.test.js`; add `searchProfiles` to the import)

```js
test('searchProfiles finds nicknames by substring (case-insensitive)', async () => {
  const supa = {
    from: () => ({
      select: () => ({
        ilike: () => ({
          limit: async () => ({
            data: [
              { user_id: 'u1', nickname: 'Marcus', pfp: null },
              { user_id: 'u2', nickname: 'Marco', pfp: 'https://x/m.png' },
            ],
            error: null,
          }),
        }),
      }),
    }),
  }
  const out = await searchProfiles(supa, 'mar')
  assert.equal(out.length, 2)
  assert.equal(out[0].nickname, 'Marcus')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/lib/profile.test.js`
Expected: FAIL — `searchProfiles is not a function`.

- [ ] **Step 3: Implement** (append to `src/lib/profile.js`)

```js
// Search profiles by nickname (case-insensitive substring). Used by the
// leaderboard player search.
export async function searchProfiles(supabase, query, limit = 8) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, nickname, pfp')
    .ilike('nickname', `%${query}%`)
    .limit(limit)
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/lib/profile.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile.js src/lib/profile.test.js
git commit -m "feat: profile nickname search for leaderboard"
```

---

### Task 3: Filter bar component

**Files:**
- Create: `src/components/LeaderboardFilterBar.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (self-contained presentational component).
- Produces (used by Task 4): default export `LeaderboardFilterBar` with props:
  - `query: string`
  - `onQueryChange(value: string): void`
  - `results: Array<{ user_id, nickname, pfp }>`
  - `onSelectPlayer(player): void`
  - `onClearQuery(): void`
  - `notDoing: boolean`
  - `onToggleNotDoing(): void`
  - `searching: boolean`

- [ ] **Step 1: Create the component**

```jsx
import { Search, X } from 'lucide-react'
import { Avatar, initialsOf } from './ui'

export default function LeaderboardFilterBar({
  query,
  onQueryChange,
  results,
  onSelectPlayer,
  onClearQuery,
  notDoing,
  onToggleNotDoing,
  searching,
}) {
  const showDropdown = !searching && query.length > 0
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={15}
          color="var(--color-faint)"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search player"
          className="h-9 w-full rounded-[12px] bg-card pl-9 pr-9 text-[13px] text-ink shadow-[0px_2px_6px_0px_#0000000F] outline-none placeholder:text-faint"
        />
        {query && (
          <button
            onClick={onClearQuery}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X size={14} color="var(--color-faint)" />
          </button>
        )}
        {(searching || showDropdown) && (
          <div className="absolute inset-x-0 top-[40px] z-10 rounded-[24px] bg-card p-1.5 shadow-[0px_12px_32px_0px_#00000040] outline outline-1 outline-line/10">
            {searching ? (
              <span className="block px-3 py-2 text-[12px] text-faint">Searching…</span>
            ) : results.length ? (
              results.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => onSelectPlayer(p)}
                  className="flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-[13px] text-sub hover:bg-accent/15"
                >
                  <Avatar initials={initialsOf(p.nickname)} color="#3B3B47" size={22} src={p.pfp} />
                  <span className="truncate">{p.nickname}</span>
                </button>
              ))
            ) : (
              <span className="block px-3 py-2 text-[12px] text-faint">No players found</span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onToggleNotDoing}
        className={`flex h-9 items-center justify-center rounded-full px-4 text-[13px] font-medium ${
          notDoing ? 'bg-accent/15 text-accent' : 'bg-card text-sub shadow-[0px_2px_6px_0px_#0000000F]'
        }`}
      >
        Not doing
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds** (no component test infra; check imports/exports resolve)

Run: `npm run build`
Expected: exit 0, no errors referencing `LeaderboardFilterBar`.

- [ ] **Step 3: Commit**

```bash
git add src/components/LeaderboardFilterBar.jsx
git commit -m "feat: leaderboard filter bar component"
```

---

### Task 4: Wire filters into the Leaderboard screen

**Files:**
- Modify: `src/screens/LeaderboardScreen.jsx`
- Test: `node --test src/lib/*.test.js` + `npm run build`

**Interfaces:**
- Consumes: `fetchUserLifts`, `fetchLiftRanks`, `fetchDistinctExercises`, `notDoneExercises`, `buildPlayerExerciseList` (Task 1); `searchProfiles` (Task 2); `LeaderboardFilterBar` (Task 3); existing `fetchTopLifts`, `buildRows`, `fetchProfiles`, `useStore`, `useAuth`, `supabase`, `useNav`.
- Produces: the updated screen with all filters wired.

- [ ] **Step 1: Add imports and state**

At the top, extend imports:

```jsx
import { useRef } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Lock } from 'lucide-react'
import { exerciseOptions, leaderboardFor } from '../lib/data'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  fetchTopLifts,
  buildRows,
  fetchUserLifts,
  fetchLiftRanks,
  fetchDistinctExercises,
  notDoneExercises,
  buildPlayerExerciseList,
} from '../lib/leaderboard'
import { fetchProfiles, searchProfiles } from '../lib/profile'
import LeaderboardFilterBar from '../components/LeaderboardFilterBar'
```

> Note: keep all existing imports that remain used (`AuthModal`, `Avatar`, `initialsOf`, `Screen`, `useDialog`, `useNav`). Do NOT import `Search` — the filter bar owns its own search icon.

Inside the component, add filter state after the existing state:

```jsx
const [query, setQuery] = useState('')
const [debouncedQuery, setDebouncedQuery] = useState('')
const [searchResults, setSearchResults] = useState([])
const [searching, setSearching] = useState(false)
const [player, setPlayer] = useState(null) // { user_id, nickname, pfp } | null
const [playerRows, setPlayerRows] = useState(null) // null = loading
const [notDoing, setNotDoing] = useState(false)
const [notDoingOptions, setNotDoingOptions] = useState(null) // null = loading/off
const [filterTick, setFilterTick] = useState(0)
const refreshTimer = useRef(null)
```

- [ ] **Step 2: Debounce the query**

```jsx
useEffect(() => {
  const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
  return () => clearTimeout(t)
}, [query])
```

- [ ] **Step 3: Search profiles (on debounced query)**

```jsx
useEffect(() => {
  if (!supabase || !auth.user || !debouncedQuery) {
    setSearchResults([])
    setSearching(false)
    return
  }
  let active = true
  setSearching(true)
  searchProfiles(supabase, debouncedQuery)
    .then((res) => {
      if (active) setSearchResults(res)
    })
    .catch(() => {
      if (active) setSearchResults([])
    })
    .finally(() => {
      if (active) setSearching(false)
    })
  return () => {
    active = false
  }
}, [debouncedQuery, auth.user])
```

- [ ] **Step 4: Load the player's exercise list (player view)**

```jsx
useEffect(() => {
  if (!supabase || !player) {
    setPlayerRows(null)
    return
  }
  let active = true
  const load = async () => {
    try {
      const lifts = await fetchUserLifts(supabase, player.user_id)
      const ranks = await fetchLiftRanks(supabase, lifts)
      if (active) setPlayerRows(buildPlayerExerciseList(lifts, ranks))
    } catch {
      if (active) setPlayerRows([])
    }
  }
  load()
  return () => {
    active = false
  }
}, [player, auth.user, filterTick])
```

- [ ] **Step 5: Load "not doing" options**

```jsx
useEffect(() => {
  if (!supabase || !auth.user || !notDoing) {
    setNotDoingOptions(null)
    return
  }
  let active = true
  const load = async () => {
    try {
      const [all, mine] = await Promise.all([
        fetchDistinctExercises(supabase),
        fetchUserLifts(supabase, auth.user.id).then((l) => l.map((x) => x.exercise)),
      ])
      if (active) setNotDoingOptions(notDoneExercises(all, mine))
    } catch {
      if (active) setNotDoingOptions([])
    }
  }
  load()
  return () => {
    active = false
  }
}, [notDoing, auth.user, filterTick])
```

- [ ] **Step 6: Auto-switch to a "not doing" exercise**

```jsx
useEffect(() => {
  if (notDoing && notDoingOptions?.length && !notDoingOptions.includes(current)) {
    setExercise(notDoingOptions[0])
  }
}, [notDoing, notDoingOptions, current])
```

- [ ] **Step 7: Second realtime channel for active filters**

```jsx
useEffect(() => {
  if (!supabase || !auth.user || (!player && !notDoing)) return
  const channel = supabase
    .channel('lifts:all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lifts' }, () => {
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => setFilterTick((t) => t + 1), 500)
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}, [player, notDoing, auth.user])
```

- [ ] **Step 8: Derive options + exit-player handler**

```jsx
const options = notDoing ? (notDoingOptions ?? []) : exOptions
const exitPlayer = () => {
  setPlayer(null)
  setQuery('')
  setSearchResults([])
}
```

Also guard `current` so a stale `exercise` (from a player-view tap that is not in `options`) doesn't break the board: replace the existing `const current = exercise || exOptions[0] || 'Bench Press'` with:

```jsx
const current = exercise || options[0] || 'Bench Press'
```

- [ ] **Step 9: Render the filter bar and player view**

Replace the header block and the exercise-dropdown block region so the structure becomes:

```jsx
<div className="flex flex-col gap-5">
  {/* header — unchanged */}

  {auth.user && !player && (
    <LeaderboardFilterBar
      query={query}
      onQueryChange={setQuery}
      results={searchResults}
      onSelectPlayer={(p) => {
        setPlayer(p)
        setQuery('')
        setSearchResults([])
      }}
      onClearQuery={() => {
        setQuery('')
        setSearchResults([])
      }}
      notDoing={notDoing}
      onToggleNotDoing={() => setNotDoing((v) => !v)}
      searching={searching}
    />
  )}

  {player ? (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={exitPlayer}
          className="flex h-9 w-9 items-center justify-center rounded-3xl"
        >
          <ChevronLeft size={18} color="var(--color-ink)" />
        </button>
        <Avatar
          initials={initialsOf(player.nickname || player.user_id)}
          color="#3B3B47"
          size={30}
          src={player.pfp}
        />
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-ink">{player.nickname}</span>
          <span className="text-[11px] text-faint">
            {playerRows === null ? 'Loading lifts…' : `${playerRows.length} exercises`}
          </span>
        </div>
      </div>
      {playerRows === null ? null : playerRows.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-faint">This player has no lifts yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {playerRows.map((r) => (
            <button
              key={r.exercise}
              onClick={() => {
                setExercise(r.exercise)
                exitPlayer()
              }}
              className="flex items-center gap-3 rounded-[16px] bg-surface px-3.5 py-3 text-left outline outline-1 outline-line/10"
            >
              <div className="flex flex-1 flex-col">
                <span className="text-[14px] font-medium text-ink">{r.exercise}</span>
                <span className="text-[11px] text-muted">{r.weight} kg</span>
              </div>
              <span className="text-[14px] font-semibold text-ink">
                {r.rank <= 3 ? (r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉') : `#${r.rank}`}
              </span>
              <ChevronRight size={16} color="var(--color-faint)" />
            </button>
          ))}
        </div>
      )}
    </div>
  ) : (
    <>
      {/* exercise dropdown — replace its options mapping to use `options` instead of `exOptions` */}
      {/* board + login lock + hints — unchanged, with the hint gated by !notDoing (see Step 10) */}
    </>
  )}
</div>
```

In the dropdown's `exOptions.map(...)`, change `exOptions.map` → `options.map`. The empty dropdown for "not doing" (when `notDoingOptions` is `[]`) is handled in Step 10.

- [ ] **Step 10: Gate the board hint and add the empty "not doing" message**

Change the signed-in hint (currently `!hasUser && <p>Log a {current} workout to place your best lift on this board.</p>`) to:

```jsx
{notDoing ? (
  notDoingOptions !== null && !notDoingOptions.length ? (
    <p className="text-[11px] leading-relaxed text-faint">You're on every board.</p>
  ) : null
) : (
  !hasUser && (
    <p className="text-[11px] leading-relaxed text-faint">
      Log a {current} workout to place your best lift on this board.
    </p>
  )
)}
```

- [ ] **Step 11: Run all unit tests**

Run: `node --test src/lib/*.test.js`
Expected: PASS — existing 37 + new tests.

- [ ] **Step 12: Build**

Run: `npm run build`
Expected: exit 0, no errors.

- [ ] **Step 13: Commit**

```bash
git add src/screens/LeaderboardScreen.jsx
git commit -m "feat: wire leaderboard player search and not-doing filter"
```

---

### Task 5: End-to-end verification

**Files:**
- Test: full suite + build + manual smoke

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Full unit test suite**

Run: `node --test src/lib/*.test.js`
Expected: PASS (all tests).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Manual smoke (requires dev server + a signed-in account with at least one other player with a nickname and lifts)**

Run: `npm run dev` and open the Leaderboard screen. Verify:
1. Signed out → no filter bar is shown (board is blurred/locked as before).
2. Signed in → filter bar shows search input + "Not doing" chip.
3. Type a player's nickname → dropdown lists matching players; typing junk → "No players found".
4. Select a player → player view lists their exercises with weight + rank; a player with no lifts → "This player has no lifts yet."; back (chevron) returns to the normal board.
5. Tap an exercise in the player view → that exercise's board opens and the player view exits.
6. Toggle "Not doing" → the exercise dropdown shows only exercises you have no lift in; if you were on the selected exercise, the board auto-switches to the first not-doing exercise; the "Log a {current} workout…" hint is hidden.
7. If you have a lift in every existing exercise → toggle on shows "You're on every board." and no dropdown entries.
8. Live update: with the toggle or player view open, changing a lift in another tab/account updates the view within ~1s.
9. Existing behavior unaffected: without filters, the board, podium, and per-exercise live updates behave exactly as before.

- [ ] **Step 4: Record the manual smoke result in the ledger and finish**

Add a line to `.superpowers/sdd/2026-08-14-pulse-desktop/progress.md` (or the active SDD ledger) noting the feature shipped and the manual smoke outcome. No code changes.