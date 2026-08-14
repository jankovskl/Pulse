// Leaderboard data access. Async functions take the Supabase client so they
// are unit-testable with a mock; buildRows is a pure ranking helper.

export async function fetchTopLifts(supabase, exercise, limit = 50) {
  const { data, error } = await supabase
    .from('lifts')
    .select('user_id, weight')
    .eq('exercise', exercise)
    .order('weight', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function fetchUserLift(supabase, userId, exercise) {
  const { data, error } = await supabase
    .from('lifts')
    .select('weight')
    .eq('user_id', userId)
    .eq('exercise', exercise)
    .maybeSingle()
  if (error) throw error
  return Number(data?.weight ?? 0)
}

// Turn raw lift rows into ranked display rows. `userId` (when supplied) marks
// the current user's row with `you: true`. `profileMap` maps userId -> { nickname, pfp }.
export function buildRows(realLifts, userId, profileMap = {}) {
  const rows = (realLifts ?? []).map((l) => {
    const isYou = !!userId && l.user_id === userId
    const p = profileMap[l.user_id] || {}
    const name = isYou ? p.nickname || 'You' : p.nickname || l.user_id.slice(0, 6)
    return {
      name,
      handle: isYou ? 'your best' : p.nickname ? '' : l.user_id.slice(0, 8),
      avatar: p.pfp || null,
      color: isYou ? 'var(--color-accent)' : '#3B3B47',
      weight: Number(l.weight),
      you: isYou,
    }
  })
  rows.sort((a, b) => b.weight - a.weight)
  rows.forEach((r, i) => (r.rank = i + 1))
  return rows
}

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
