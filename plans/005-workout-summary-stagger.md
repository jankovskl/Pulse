# 005 — Stagger completed exercise list in WorkoutSummary

- **Status**: TODO
- **Commit**: no-git
- **Severity**: LOW
- **Category**: Cohesion & tokens / Missed opportunities
- **Estimated scope**: 1 file, ~10 lines

## Problem

`src/components/WorkoutSummary.jsx:138-151` — the completed exercise list
renders all rows simultaneously with no entrance animation or stagger. This is
the **rare, high-emotion moment** in the entire app — the workout completion
screen. It's the one place that deserves the delight budget.

```jsx
// WorkoutSummary.jsx:138-152 — current
<div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto">
  {completedExercises.map((e) => (
    <div
      key={e.id}
      className="flex items-center justify-between rounded-[12px] bg-tile px-3 py-2"
    >
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-soft">{e.name}</span>
        <span className="text-[11px] text-muted">
          {e.sets} × {e.reps} @ {e.weight}kg
        </span>
      </div>
      <Check size={16} color="#17C964" />
    </div>
  ))}
</div>
```

The `WorkoutSummary` component itself already has a `show` state pattern
(lines 6-12, 36-47) that controls the panel's opacity + scale entrance. But the
individual list items inside have no delay — they all appear at once when the
panel scales in.

## Target

Add a per-row `transitionDelay` that staggers the entrance. Follow the
`WorkoutSummary` pattern — the panel uses `setShow(true)` after 50ms, then
flips classes. Each list item should fade in with a 40ms offset between rows,
starting after the panel has entered.

Maximum 8 rows × 40ms = 320ms stagger — all well under budget.

```jsx
// target
<div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto">
  {completedExercises.map((e, idx) => (
    <div
      key={e.id}
      className={`flex items-center justify-between rounded-[12px] bg-tile px-3 py-2
                  transition-all duration-200 ease-out`}
      style={{
        transitionDelay: `${idx * 40}ms`,
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(6px)',
      }}
    >
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-soft">{e.name}</span>
        <span className="text-[11px] text-muted">
          {e.sets} × {e.reps} @ {e.weight}kg
        </span>
      </div>
      <Check size={16} color="#17C964" />
    </div>
  ))}
</div>
```

Note: `show` is already defined in the component scope (line 6) and is set to
`true` after 50ms via `useEffect`. This stagger builds on the existing
entrance pattern.

The `easing` must be `ease-out` (starts fast, feels responsive). Duration is
`duration-200` to match the panel entrance. Stagger is `idx * 40ms` per AUDIT.md
§7.

## Repo conventions to follow

- Exemplar: `WorkoutSummary.jsx:44-46` — the panel uses
  `transition-opacity duration-200` + `transition-transform duration-200` with
  a `show` boolean. This plan follows the same `show` pattern for child items.
- Inline `style` for per-item `transitionDelay` is already used elsewhere
  (e.g. `ui.jsx:462` `translateY`).

## Steps

1. Open `src/components/WorkoutSummary.jsx`.
2. Replace lines 137-152 with the target code above.

   Key changes:
   - Add `(e, idx)` to the `.map()` callback.
   - Add `transition-all duration-200 ease-out` to the className.
   - Add inline `style` with `transitionDelay`, conditional `opacity`, and
     conditional `transform` based on `show`.

3. Save.

## Boundaries

- Do NOT change the panel-level entrance animation (it already works).
- Do NOT change any other section of `WorkoutSummary.jsx`.
- Do NOT add JS animation libraries — use CSS transitions + inline delays.
- Do NOT stagger the PR table or the duration/exercises summary cards — only
  the completed exercise list.

## Verification

- **Mechanical**: `npx oxlint src/components/WorkoutSummary.jsx` — 0 errors.
- **Feel check**:
  - Complete a workout with 5+ exercises.
  - The panel should scale/fade in first (existing behavior).
  - Then each exercise row should fade+slide up one at a time, each 40ms after
    the previous, completing within ~320ms.
  - DevTools Animations panel: confirm each row has a different
    `transition-delay`.
  - Spam-open the summary (if possible) — each row should reset cleanly
    (no stuck delays) because `show` resets on every fresh mount.
- **Done when**: the completed exercise list enters with a visible stagger
  that makes the completion feel rewarding, not flat.
