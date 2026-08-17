# 003 — Enter confirmation dialogs and Modal with a fade+scale

- **Status**: TODO
- **Commit**: no-git
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Physicality & origin
- **Estimated scope**: 1 file, ~3 edits

## Problem

`src/screens/HomeScreen.jsx:242` — the delete-confirmation overlay appears
instantly via conditional render `{confirmDelete && (…)}`. There is no entrance
transition; it just pops onto the screen.

```jsx
// HomeScreen.jsx:242-271 — current (start of overlay)
{confirmDelete && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
    <div className="glass-panel mx-4 flex w-[320px] flex-col gap-4 rounded-[24px] bg-card p-6">
      ...
    </div>
  </div>
)}
```

Similarly, `src/components/ui.jsx:451` — the `Modal` component has a backdrop
fade already (via `transition-opacity` implied on the outer div) but the inner
panel slides in via viewport-shift and has no opacity/scale entrance.

## Target

Follow the `WorkoutSummary.jsx:36-47` pattern: a 50ms mount delay, then flip a
`show` state to animate opacity + scale from 0.95 to 1.

```jsx
// HomeScreen.jsx — after
const [confirmDelete, setConfirmDelete] = useState(null)
const [confirmShow, setConfirmShow] = useState(false)

// When setting confirmDelete:
setConfirmDelete(d)
setConfirmShow(false)
setTimeout(() => setConfirmShow(true), 50)

// When clearing:
setConfirmShow(false)
setTimeout(() => setConfirmDelete(null), 200)

// In JSX:
{confirmDelete && (
  <div
    className={cn(
      "fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4",
      "transition-opacity duration-200 ease-out",
      confirmShow ? "opacity-100" : "opacity-0",
    )}
  >
    <div
      className="glass-panel mx-4 flex w-[320px] flex-col gap-4 rounded-[24px] bg-card p-6"
      style={{
        transition: "opacity 200ms ease-out, transform 200ms cubic-bezier(0.23, 1, 0.32, 1)",
      }}
      // Wait — use Tailwind classes for the panel too
    >
      ...
    </div>
  </div>
)}
```

Simplification — use Tailwind classes directly without a JS `show` state,
leveraging `@starting-style` for the entry:

```jsx
// Simplified target — @starting-style approach
{confirmDelete && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
    <div
      className="glass-panel mx-4 flex w-[320px] flex-col gap-4 rounded-[24px] bg-card p-6
                 transition-opacity duration-200 ease-out
                 data-[starting-style]:opacity-0 data-[starting-style]:scale-95
                 motion-reduce:data-[starting-style]:opacity-0"
    >
      ...
    </div>
  </div>
)}
```

**However**, `@starting-style` requires `appearance: auto` to be removed and
may not be fully supported in this Tailwind v4 setup without a PostCSS plugin
config. The safest, most compatible approach is the **same boolean-state
pattern already used in `WorkoutSummary.jsx`**.

### Final target (follow WorkoutSummary pattern exactly)

```jsx
// HomeScreen.jsx
const [confirmDelete, setConfirmDelete] = useState(null)
const [confirmShow, setConfirmShow] = useState(false) ← NEW

// handler when opening:
setConfirmDelete(d)
setConfirmShow(false)
setTimeout(() => setConfirmShow(true), 50)

// handler when closing:
setConfirmShow(false)
setTimeout(() => setConfirmDelete(null), 200)

// JSX:
{confirmDelete && (
  <div
    className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4
                transition-opacity duration-200 ${
      confirmShow ? 'opacity-100' : 'opacity-0'
    }`}
  >
    <div
      className={`glass-panel mx-4 flex w-[320px] flex-col gap-4 rounded-[24px] bg-card p-6
                  transition-all duration-200 ${
        confirmShow ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}
    >
      ...original children...
    </div>
  </div>
)}
```

Also update `ui.jsx` `Modal` — it already has a viewport-shift but lacks an
opacity fade on the panel:

```jsx
// ui.jsx:460-465 — current inner panel
<div
  ref={panelRef}
  style={{ transform: `translateY(${shift}px)`, transition: 'transform 160ms ease-out' }}
  className="glass-panel max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-[28px] bg-card p-5 pb-8"
>

// target — add opacity transition:
<div
  ref={panelRef}
  style={{ transform: `translateY(${shift}px)` }}
  className={`glass-panel max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-[28px] bg-card p-5 pb-8
              transition-all duration-200`}
>
```

## Repo conventions to follow

- Exemplar: `WorkoutSummary.jsx:36-47` — `show` state + `setTimeout` +
  `transition-opacity` + `transition-transform`. Copy this pattern.
- `ease-out` is the default Tailwind easing for `duration-200`.
- Scale from 0.95 (never 0 per AUDIT.md §3).

## Steps

### Part A — HomeScreen.jsx confirmation dialog

1. Add `const [confirmShow, setConfirmShow] = useState(false)` after line 48.
2. Find the `setConfirmDelete(d)` call (line 152). Replace:
   ```js
   setConfirmDelete(d)
   ```
   with:
   ```js
   setConfirmDelete(d)
   setConfirmShow(false)
   setTimeout(() => setConfirmShow(true), 50)
   ```
3. Find the "Keep" button handler `setConfirmDelete(null)` (line 254). Replace:
   ```js
   setConfirmDelete(null)
   ```
   with:
   ```js
   setConfirmShow(false)
   setTimeout(() => setConfirmDelete(null), 200)
   ```
4. Find the "Delete" button handler that calls `store.deleteDay` + `setConfirmDelete(null)` (lines 260-263). Replace `setConfirmDelete(null)` with `setConfirmShow(false); setTimeout(() => setConfirmDelete(null), 200)`.
5. Replace the overlay JSX (line 243) to include the transition classes per the Final target above.

### Part B — ui.jsx Modal (optional, lower priority)

1. In `src/components/ui.jsx`, line 462: move the inline `transition` to a
   Tailwind `transition-all duration-200` and remove the inline `style`.
   Keep the `transform: translateY(${shift}px)` on the ref.

## Boundaries

- Do NOT change the structure of the confirmation dialog beyond adding
  animation classes.
- Do NOT touch `ProfileView.jsx` modal — it's structurally different and
  already slides in via the same `Modal` component.
- Do NOT add `@starting-style` or any PostCSS-level config changes.
- Do NOT add new dependencies.

## Verification

- **Mechanical**: `npx oxlint src/screens/HomeScreen.jsx src/components/ui.jsx` —
  0 errors.
- **Feel check**:
  - Click the trash can icon on any workout day. The confirm dialog should
    fade+scale in from 0.95 after a 50ms delay.
  - Close it (Keep or Delete). It should fade+scale out over 200ms before
    unmounting.
  - Spam the trash icon + close rapidly — no jumping (the `setTimeout` cleanup
    in the unmount of WorkoutSummary pattern prevents mid-animation remount).
  - Modal in CalendarScreen: should also fade+scale on open/close.
- **Done when**: both confirmation dialogs and the Modal have a smooth
  enter/exit transition that never snaps.
