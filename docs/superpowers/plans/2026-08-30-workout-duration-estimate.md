# Workout Duration Estimate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an estimated workout duration (`~36–45 min` style range, 4–5 minutes per set) in the DayDetailScreen subtitle, HomeScreen day list, and Calendar plan picker.

**Architecture:** Two pure helpers (`estimateDuration`, `formatDuration`) in `src/lib/data.js` compute the range from total sets; three UI sites render the formatted string. Nothing is persisted.

**Tech Stack:** React (JSX), Vite, oxlint, Node built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-08-30-workout-duration-estimate-design.md`

**Working directory:** all commands run from `Pulse/` (the folder containing `package.json`). Shell is PowerShell — use `;` not `&&` to chain commands.

---

### Task 1: Duration helpers in data.js (TDD)

**Files:**
- Create: `src/lib/data.test.js`
- Modify: `src/lib/data.js` (append after `firstOfMonth` at end of file)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/data.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateDuration, formatDuration } from './data.js'

const day = (exercises) => ({ id: 'd1', name: 'push', exercises })

test('estimateDuration sums sets across exercises (4-5 min per set)', () => {
  assert.deepEqual(
    estimateDuration(day([{ sets: 3 }, { sets: 4 }, { sets: 2 }])),
    { min: 36, max: 45 },
  )
})

test('estimateDuration returns zeros for a day with no exercises', () => {
  assert.deepEqual(estimateDuration(day([])), { min: 0, max: 0 })
})

test('formatDuration renders ~min–max range', () => {
  assert.equal(formatDuration(day([{ sets: 9 }])), '~36–45 min')
})

test('formatDuration renders 0 min for an empty day', () => {
  assert.equal(formatDuration(day([])), '0 min')
})
```

Note the en dash `–` (U+2013) between the numbers in the expected string — keep it exact.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/data.test.js`
Expected: FAIL — `estimateDuration is not a function` / `formatDuration is not a function` (exports don't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Append to `src/lib/data.js` (after the `firstOfMonth` export on the last line):

```js
// Estimated session length: each set (work + rest) takes about 4-5 minutes.
export function estimateDuration(day) {
  const totalSets = day.exercises.reduce((n, e) => n + (e.sets || 0), 0)
  return { min: totalSets * 4, max: totalSets * 5 }
}

export function formatDuration(day) {
  if (!day.exercises.length) return '0 min'
  const { min, max } = estimateDuration(day)
  return `~${min}\u2013${max} min`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/data.test.js`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data.js src/lib/data.test.js
git commit -m "feat: add workout duration estimate helpers"
```

---

### Task 2: Restore duration in DayDetailScreen subtitle

**Files:**
- Modify: `src/screens/DayDetailScreen.jsx` (imports near line 12; header subtitle around lines 198–200)

- [ ] **Step 1: Add the import**

In `src/screens/DayDetailScreen.jsx`, after `import { useTimer } from '../lib/timer'` add:

```js
import { formatDuration } from '../lib/data'
```

- [ ] **Step 2: Append the estimate to the subtitle under the day name**

Replace:

```jsx
<span className="text-[13px] text-muted">
  {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
</span>
```

with:

```jsx
<span className="text-[13px] text-muted">
  {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
  {day.exercises.length > 0 && <> · {formatDuration(day)}</>}
</span>
```

Note: this `span` is the one inside the header block next to the back button (directly under `<h1 ...>{day.name}</h1>`). Do not touch the identical-looking label in the "Today's session" card.

- [ ] **Step 3: Commit**

```bash
git add src/screens/DayDetailScreen.jsx
git commit -m "feat: show estimated duration in day detail subtitle"
```

---

### Task 3: Add duration to HomeScreen day list

**Files:**
- Modify: `src/screens/HomeScreen.jsx` (data import at line 5; day-list sub-label around lines 289–291)

- [ ] **Step 1: Extend the existing data import**

Change line 5 of `src/screens/HomeScreen.jsx` from:

```js
import { dateKey, WEEKDAY_NAMES } from '../lib/data'
```

to:

```js
import { dateKey, formatDuration, WEEKDAY_NAMES } from '../lib/data'
```

- [ ] **Step 2: Append the estimate to each day's sub-label**

In the day list, replace:

```jsx
<span className="text-[12px] text-sub">
  {d.exercises.length} {d.exercises.length === 1 ? 'exercise' : 'exercises'}
</span>
```

with:

```jsx
<span className="text-[12px] text-sub">
  {d.exercises.length} {d.exercises.length === 1 ? 'exercise' : 'exercises'}
  {d.exercises.length > 0 && <> · {formatDuration(d)}</>}
</span>
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.jsx
git commit -m "feat: show estimated duration in home day list"
```

---

### Task 4: Replace old formula in Calendar PlanDayPicker

**Files:**
- Modify: `src/components/Calendar.jsx` (import at line 2; local `estMin` at line 125; label at lines 158–160)

- [ ] **Step 1: Extend the data import**

Change line 2 of `src/components/Calendar.jsx` from:

```js
import { dateKey } from '../lib/data'
```

to:

```js
import { dateKey, formatDuration } from '../lib/data'
```

- [ ] **Step 2: Remove the obsolete local estimate**

Delete this line inside `PlanDayPicker`:

```js
const estMin = (d) => Math.max(1, Math.round(d.exercises.reduce((n, e) => n + e.sets * 45 + 30, 0) / 60))
```

- [ ] **Step 3: Use the shared helper in the row label**

Replace:

```jsx
<span className="text-[12px] text-muted">
  {d.exercises.length} exercises · ~{estMin(d)} min
</span>
```

with:

```jsx
<span className="text-[12px] text-muted">
  {d.exercises.length} exercises · {formatDuration(d)}
</span>
```

(`formatDuration` already includes the `~` prefix and `min` suffix, and returns `0 min` for empty days.)

- [ ] **Step 4: Commit**

```bash
git add src/components/Calendar.jsx
git commit -m "feat: use shared duration estimate in calendar plan picker"
```

---

### Task 5: Verify lint, tests, and build

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests**

Run: `node --test src/lib/data.test.js`
Expected: PASS — 4/4.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors (oxlint).

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual smoke check (optional)**

Run: `npm run dev`, open a day detail screen — the subtitle under the day name should read e.g. `6 exercises · ~36–45 min`, the Home day list rows show the same, and the Calendar plan picker rows show the new range. Adjusting a Sets stepper updates the estimate live.
