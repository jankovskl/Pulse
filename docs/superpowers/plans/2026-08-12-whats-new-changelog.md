# What's New Live Changelog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Settings "What's new" row open a bottom sheet showing changes fetched live from `CHANGELOG.md` in the GitHub repo, with a live version subtitle.

**Architecture:** A zero-dependency `src/lib/changelog.js` module (parser + session-cached fetch) fed by a `CHANGELOG.md` at the repo root; SettingsScreen consumes it for the row subtitle and a bottom-sheet modal. Tests run on Node's built-in `node --test` runner — no new dependencies anywhere.

**Tech Stack:** React 19, Vite 8, Tailwind 4, lucide-react, Node 20+ built-in test runner.

## Global Constraints

- Repo root: `C:\Users\mateu\Documents\.VS projects\Pulse\Pulse` — **path contains spaces, quote all paths**. Branch `main` auto-deploys to GitHub Pages on push.
- **Zero new dependencies** (runtime and dev). Tests use `node --test` / `node:test` built-ins only.
- Fetch URL: `https://raw.githubusercontent.com/jankovskl/pulse/main/CHANGELOG.md`.
- CHANGELOG.md format (strict): `# Pulse Changelog` top heading; one `## <version> [— <date>]` per release; `- ` bullets under it.
- Follow existing UI patterns (dark theme, `bg-card` / `bg-tile` / `text-soft` / `text-faint` / `var(--color-accent)`, `fixed inset-0 z-50` overlays). No code comments.
- Verify with: `npm run lint`, `npm run build`, `node --test`, manual dev check.

---

### Task 1: Create CHANGELOG.md at repo root

**Files:**
- Create: `CHANGELOG.md`

**Interfaces:**
- Produces: the file the app fetches; content must match the strict format in Global Constraints.

- [ ] **Step 1: Create the file**

```markdown
# Pulse Changelog

## 2.0.2 — 2026-08-12
- What's new panel shows live changes from GitHub
- Neko pet stays awake between idle states

## 2.0.1
- Rest timer with set countdowns
- Progress charts in the Progress tab
- Exercise library and leaderboard
```

- [ ] **Step 2: Verify format visually**

Run: `Get-Content CHANGELOG.md`
Expected: three headings, bullets indented with `- `, em-dash separating version from date (single version uses no date).

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add changelog"
```

---

### Task 2: Parser in src/lib/changelog.js with node:test tests

**Files:**
- Create: `src/lib/changelog.js`
- Create: `src/lib/changelog.test.js`

**Interfaces:**
- Produces: `parseChangelog(markdown: string) -> Array<{ version: string, date: string | null, items: string[] }>` — newest entry first (document order). Skips everything that isn't a `## ` heading or `- ` bullet under the current heading. Unknown headings (`# `, `### `) and stray bullets are ignored.

- [ ] **Step 1: Write the failing tests**

`src/lib/changelog.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseChangelog } from './changelog.js'

test('parses version heading with date and bullets', () => {
  const md = `# Pulse Changelog

## 2.0.2 — 2026-08-12
- First change
- Second change

## 2.0.1
- Old change`
  assert.deepEqual(parseChangelog(md), [
    { version: '2.0.2', date: '2026-08-12', items: ['First change', 'Second change'] },
    { version: '2.0.1', date: null, items: ['Old change'] },
  ])
})

test('ignores non-changelog lines and stray bullets', () => {
  const md = `# Title

Some intro paragraph that is ignored.

### Subheading ignored
## 1.0.0
- kept bullet

- bullet with no heading above is ignored
`
  assert.deepEqual(parseChangelog(md), [{ version: '1.0.0', date: null, items: ['kept bullet'] }])
})

test('empty input yields empty list', () => {
  assert.deepEqual(parseChangelog(''), [])
})

test('accepts plain hyphen as date separator', () => {
  const md = `## 1.1.0 - 2026-01-01
- thing`
  assert.deepEqual(parseChangelog(md), [
    { version: '1.1.0', date: '2026-01-01', items: ['thing'] },
  ])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/changelog.test.js`
Expected: FAIL — `Cannot find module './changelog.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/changelog.js`:

```js
export function parseChangelog(markdown) {
  const entries = []
  let current = null
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    const head = line.match(/^##\s+(.+)$/)
    if (head) {
      const [version, ...rest] = head[1].split(/\s*[—-]\s*/)
      current = { version, date: rest.length ? rest.join(' ').trim() : null, items: [] }
      entries.push(current)
      continue
    }
    if (current && line.startsWith('- ')) {
      current.items.push(line.slice(2))
    }
  }
  return entries
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/changelog.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/changelog.js src/lib/changelog.test.js
git commit -m "feat: add changelog markdown parser"
```

---

### Task 3: Session-cached fetch in changelog.js

**Files:**
- Modify: `src/lib/changelog.js` (append below `parseChangelog`)
- Modify: `src/lib/changelog.test.js` (add a test for the fetch URL shape — no network in tests)

**Interfaces:**
- Produces: `fetchChangelog() -> Promise<Array<{ version, date, items }>>` — fetches the raw URL, rejects on non-OK response, resets the internal cache on failure so a later call retries. Repeated successful calls reuse the cached promise (session cache).

- [ ] **Step 1: Add a failing test asserting the URL constant is exported and correct**

Append to `src/lib/changelog.test.js`:

```js
import { parseChangelog, CHANGELOG_URL } from './changelog.js'

test('changelog URL points at the repo main branch', () => {
  assert.equal(CHANGELOG_URL, 'https://raw.githubusercontent.com/jankovskl/pulse/main/CHANGELOG.md')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/lib/changelog.test.js`
Expected: FAIL — `CHANGELOG_URL` is not exported

- [ ] **Step 3: Implement fetch with session cache**

Append to `src/lib/changelog.js`:

```js
export const CHANGELOG_URL = 'https://raw.githubusercontent.com/jankovskl/pulse/main/CHANGELOG.md'

let cache = null

export function fetchChangelog() {
  if (!cache) {
    cache = fetch(CHANGELOG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Changelog fetch failed: HTTP ${res.status}`)
        return res.text()
      })
      .then(parseChangelog)
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}
```

- [ ] **Step 4: Run all tests to verify pass**

Run: `node --test src/lib/changelog.test.js`
Expected: PASS, 5 tests (fetch is not called in tests — only the constant is asserted)

- [ ] **Step 5: Commit**

```bash
git add src/lib/changelog.js src/lib/changelog.test.js
git commit -m "feat: add session-cached changelog fetch"
```

---

### Task 4: SettingsScreen — live subtitle, bottom sheet, remove Changelog row

**Files:**
- Modify: `src/screens/SettingsScreen.jsx`

**Interfaces:**
- Consumes: `fetchChangelog()` from `../lib/changelog` (returns promise of `[{ version, date, items }]`, or rejects).

- [ ] **Step 1: Add imports and state**

At the top of `SettingsScreen.jsx`, add `useEffect, useState` to the existing react import, and `import { fetchChangelog } from '../lib/changelog'`. Inside the component, after `const fileRef = useRef(null)`:

```jsx
const [changelog, setChangelog] = useState(null)
const [failed, setFailed] = useState(false)
const [sheetOpen, setSheetOpen] = useState(false)

useEffect(() => {
  let cancelled = false
  fetchChangelog()
    .then((entries) => {
      if (!cancelled) {
        setChangelog(entries)
        setFailed(false)
      }
    })
    .catch(() => {
      if (!cancelled) setFailed(true)
    })
  return () => {
    cancelled = true
  }
}, [])
```

- [ ] **Step 2: Wire the "What's new" row and delete the "Changelog" row**

Replace the `SYNC & ABOUT` block (the two `Row` elements) with a single row:

```jsx
<div className="flex flex-col gap-2.5">
  <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">SYNC & ABOUT</div>
  <Row
    icon={<Rocket size={15} color="var(--color-accent)" />}
    title="What's new"
    subtitle={
      changelog?.length
        ? `v${changelog[0].version} · ${changelog[0].items[0] ?? 'recent changes'}`
        : 'Version 2.0.1 — rest timer, charts'
    }
    onClick={() => setSheetOpen(true)}
  />
</div>
```

- [ ] **Step 3: Add the bottom sheet JSX**

Append inside the `Screen` children, right after the closing `</div>` of the footer block (before the final `</Screen>`). Follow the HomeScreen date-picker pattern:

```jsx
{sheetOpen && (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
    onClick={() => setSheetOpen(false)}
  >
    <div
      className="flex max-h-[70dvh] w-full max-w-[420px] flex-col gap-4 rounded-t-[28px] bg-card p-5 pb-8"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-soft">What's new</span>
          <span className="text-[12px] text-muted">Changes from the latest pushes to GitHub</span>
        </div>
        <button
          onClick={() => setSheetOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
        >
          <X size={15} color="#A1A1AA" />
        </button>
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto">
        {failed ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="text-[13px] text-sub">Couldn't load updates</span>
            <button
              onClick={() => {
                setFailed(false)
                fetchChangelog()
                  .then(setChangelog)
                  .catch(() => setFailed(true))
              }}
              className="h-8 rounded-[24px] bg-accent px-4 text-[13px] text-white"
            >
              Try again
            </button>
          </div>
        ) : !changelog ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-tile border-t-accent" />
            <span className="text-[13px] text-sub">Loading updates…</span>
          </div>
        ) : changelog.length === 0 ? (
          <span className="py-8 text-center text-[13px] text-sub">No changes recorded yet.</span>
        ) : (
          changelog.map((entry) => (
            <div key={entry.version} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold tracking-[1.4px] text-accent-light">
                  v{entry.version}
                </span>
                {entry.date && (
                  <span className="text-[11px] text-faint">{entry.date}</span>
                )}
              </div>
              <ul className="flex flex-col gap-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-soft">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
```

Add `X` to the lucide-react import list in `SettingsScreen.jsx`.

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds, no warnings about missing exports.

Run: `node --test src/lib/changelog.test.js`
Expected: PASS, 5 tests.

Manual dev check: `npm run dev`, open Settings tab — subtitle shows `v2.0.2 · What's new panel shows live changes from GitHub` (the pushed file), tapping the row opens the sheet with both versions and bullets, overlay closes on backdrop tap and X.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.jsx
git commit -m "feat: wire up What's new changelog sheet in settings"
```

---

### Task 5: Push to GitHub and verify the live flow

**Files:**
- None (git operations only)

- [ ] **Step 1: Push main**

Run: `git push origin main`
Expected: remote accepts; GH Pages deploy workflow starts.

- [ ] **Step 2: Verify raw file is live**

Run: `Invoke-RestMethod "https://raw.githubusercontent.com/jankovskl/pulse/main/CHANGELOG.md"`
Expected: returns the changelog text starting with `# Pulse Changelog`.

- [ ] **Step 3: Verify fetch + parse end-to-end from Node**

Run: `node -e "import('./src/lib/changelog.js').then(m => m.fetchChangelog()).then(e => console.log(JSON.stringify(e, null, 2)))"`
Expected: JSON array with `{ version: '2.0.2', date: '2026-08-12', items: [...] }` first.

- [ ] **Step 4: Confirm deploy**

Run: `gh run list --limit 3` (or open the repo Actions tab)
Expected: latest run for `main` completed green; the live app at the GitHub Pages URL shows the working button after the deploy.