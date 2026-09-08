# Workout Duration Estimate — Design

## Goal

Show an estimated workout duration next to every place a workout day is summarized, so users know roughly how long a session will take before starting it. The estimate is derived from total sets: each set (including rest between sets) takes about 4–5 minutes, so a day with 9 sets shows `~36–45 min`.

This replaces the old per-exercise formula (`sets * 45s + 30s`) currently used in the Calendar plan picker, and restores an estimate on the day detail screen (an earlier, differently-computed estimate was intentionally removed there).

## Helpers (`src/lib/data.js`)

Add two exported helpers alongside the existing `dateKey` / `firstOfMonth` utilities:

1. `estimateDuration(day)` → `{ min, max }`
   - `totalSets = Σ e.sets` across `day.exercises` (each exercise already stores a numeric `sets` field).
   - `min = totalSets * 4`, `max = totalSets * 5`.
   - For a day with no exercises, returns `{ min: 0, max: 0 }`.
2. `formatDuration(day)` → string
   - With exercises: `"~{min}–{max} min"` (e.g. `"~36–45 min"`).
   - With no exercises: `"0 min"` (call sites below only render it where exercises exist, but keep it total-safe).

No warm-up or overhead buffer beyond per-set time (YAGNI).

## Display Locations

1. **DayDetailScreen** (`src/screens/DayDetailScreen.jsx`) — subtitle under the day name currently reads `"{n} exercises"`. Append the estimate: `"{n} exercises · ~36–45 min"` (singular `exercise` still handled). Only append when `day.exercises.length > 0`.
2. **HomeScreen day list** (`src/screens/HomeScreen.jsx`) — the sub-label under each day name currently reads `"{n} exercises"`. Same change: append `" · ~36–45 min"` when the day has exercises; days with 0 exercises keep the plain label.
3. **Calendar PlanDayPicker** (`src/components/Calendar.jsx`) — remove the local `estMin` function and replace the `"{n} exercises · ~{estMin(d)} min"` label with `"{n} exercises · {formatDuration(d)}"`, so the plan picker uses the shared formula.

## Behavior Notes

- Estimates update live with the Sets stepper / exercise add-remove, since they derive from the store's day data on render.
- No persistence: duration is always computed, never stored.

## Out of Scope

- No per-user configurable minutes-per-set.
- No duration on calendar day cells (only the plan picker list), no duration in TimerScreen or workout summaries.
- No data model or server changes.
