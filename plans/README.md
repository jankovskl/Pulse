# Animation Improvement Plans

## Overview

Five targeted animation improvements identified through audit. Prioritized by
leverage (impact ÷ effort). All plans follow the existing `WorkoutSummary.jsx`
entrance pattern and use Tailwind utilities / inline styles consistent with
the repo.

## Plan Index

| # | Title | File | Severity | Status |
|---|---|---|---|---|
| [001](001-exercise-row-color-transition.md) | Exercise row background color transition on toggle | `DayDetailScreen.jsx` | MEDIUM | TODO |
| [002](002-progress-bar-width-transition.md) | Progress bar fill animates on exercise toggle | `DayDetailScreen.jsx` | MEDIUM | TODO |
| [003](003-dialog-enter-exit.md) | Confirmation dialog + Modal fade + scale enter/exit | `HomeScreen.jsx`, `ui.jsx` | MEDIUM | TODO |
| [004](004-toggle-press-feedback.md) | Press feedback on Toggle component | `ui.jsx` | LOW | TODO |
| [005](005-workout-summary-stagger.md) | Stagger completed exercise list in WorkoutSummary | `WorkoutSummary.jsx` | LOW | TODO |

## Recommended Execution Order

1. **001** — Exercise row color transition (highest frequency after start/stop,
   every toggle should feel confirmed)
2. **002** — Progress bar width animation (pairs with 001 — same toggle event)
3. **003** — Dialog enter/exit (occasional, high visibility when it happens)
4. **004** — Toggle press feedback (settings screen polish)
5. **005** — Workout summary stagger (rare, high-emotion moment — save for last)

Plans **001** and **002** touch the same toggle action — execute them together
so the visual feedback is cohesive (row color + progress bar move at once).

## Dependencies

- None. All plans are independent.
- Plan 003 touches `ui.jsx` (Modal) and `HomeScreen.jsx`. Plan 004 also touches
  `ui.jsx` but on different lines — safe to execute in parallel.
