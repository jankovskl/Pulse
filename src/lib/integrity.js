// Anti-cheat weight progression rules. Pure + Supabase-free so the logic is
// unit-testable; the same numbers are mirrored server-side by the
// "guard lifts" / "guard profile" triggers in supabase/schema.sql.
//
// The idea: a session weight is accepted only if it is physically plausible
// for that exercise AND reachable from the athlete's previous best. That
// means typing 200 kg on day one does nothing for a bench press — you have
// to actually grind through consecutive workouts to get there.
//
// Rules are per muscle group: legs/back genuinely jump in big plates, so a
// strong lifter isn't punished there, while arms stay strict.

// Classify an exercise name into a muscle group. Order matters: more specific
// families first (e.g. "leg press" is legs, not shoulders despite "press").
export function muscleGroupFor(exercise) {
  const name = String(exercise ?? '').toLowerCase()
  if (
    name.includes('squat') || name.includes('deadlift') || name.includes('leg') ||
    name.includes('lunge') || name.includes('calf') || name.includes('glute') ||
    name.includes('hip thrust')
  ) return 'legs'
  if (
    name.includes('bench') || name.includes('chest') || name.includes('fly') ||
    name.includes('push-up') || name.includes('push up')
  ) return 'chest'
  if (
    name.includes('row') || name.includes('pull-up') || name.includes('pull up') ||
    name.includes('pulldown') || name.includes('pull down') || name.includes('chin-up') ||
    name.includes('chin up') || name.includes('lat')
  ) return 'back'
  if (
    name.includes('press') || name.includes('shoulder') ||
    name.includes('raise') || name.includes('shrug')
  ) return 'shoulders'
  if (
    name.includes('curl') || name.includes('tricep') || name.includes('bicep') ||
    name.includes('dip') || name.includes('extension') || name.includes('kickback')
  ) return 'arms'
  return 'other'
}

// Progression rules per muscle group:
//   firstCap — max weight accepted with no history in that group's exercises
//   step     — flat per-session growth allowed (bigger machines = bigger steps)
//   factor   — percentage jump allowed per session
//   ceiling  — world-record-style absolute cap
export const MUSCLE_GROUPS = {
  legs: { label: 'Legs', firstCap: 200, step: 25, factor: 1.2, ceiling: 620 },
  back: { label: 'Back', firstCap: 140, step: 15, factor: 1.15, ceiling: 520 },
  chest: { label: 'Chest', firstCap: 110, step: 10, factor: 1.1, ceiling: 410 },
  shoulders: { label: 'Shoulders', firstCap: 80, step: 8, factor: 1.12, ceiling: 380 },
  arms: { label: 'Arms', firstCap: 60, step: 6, factor: 1.12, ceiling: 160 },
  other: { label: 'Other', firstCap: 100, step: 10, factor: 1.1, ceiling: 500 },
}

export function rulesFor(exercise) {
  return MUSCLE_GROUPS[muscleGroupFor(exercise)]
}

// Hard cap for an exercise, derived from its muscle group.
export function ceilingFor(exercise) {
  return rulesFor(exercise).ceiling
}

// Highest weight allowed for the next session of `exercise`, given the
// previous best (from other days).
export function maxAllowedWeight(prevBest, exercise) {
  const r = rulesFor(exercise)
  if (!prevBest || prevBest <= 0) return Math.min(r.firstCap, r.ceiling)
  const grown = Math.max(prevBest + r.step, prevBest * r.factor)
  return Math.min(grown, r.ceiling)
}

// Clamp an entered weight into the allowed range (never negative).
export function clampWeight(weight, prevBest, exercise) {
  const w = Math.max(0, Number(weight) || 0)
  return Math.min(w, maxAllowedWeight(prevBest, exercise))
}
