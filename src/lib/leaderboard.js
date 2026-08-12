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
// the current user's row with `you: true`.
export function buildRows(realLifts, userId) {
  const rows = (realLifts ?? []).map((l) => {
    const isYou = !!userId && l.user_id === userId
    return {
      name: isYou ? 'You' : l.user_id.slice(0, 6),
      handle: isYou ? 'your best' : l.user_id.slice(0, 8),
      color: isYou ? 'var(--color-accent)' : '#3B3B47',
      weight: Number(l.weight),
      you: isYou,
    }
  })
  rows.sort((a, b) => b.weight - a.weight)
  rows.forEach((r, i) => (r.rank = i + 1))
  return rows
}
