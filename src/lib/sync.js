// Cross-device sync primitives. Every function takes the Supabase client as
// its first argument so the logic stays pure and is unit-testable with a mock
// client — no network needed.

export async function loadRemote(supabase, userId) {
  const { data, error } = await supabase
    .from('user_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { data: data.data, updatedAt: new Date(data.updated_at).getTime() }
}

export async function pushState(supabase, userId, state) {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data: state }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function loginLift(supabase, userId, exercise, weight) {
  const { error } = await supabase
    .from('lifts')
    .upsert(
      { user_id: userId, exercise, weight, at: new Date().toISOString() },
      { onConflict: 'user_id,exercise' },
    )
  if (error) throw error
}

export async function clearLifts(supabase, userId) {
  const { error } = await supabase.from('lifts').delete().eq('user_id', userId)
  if (error) throw error
}

// Last-write-wins merge. `remote` is the {data, updatedAt} shape from
// loadRemote; `localUpdatedAt` is the timestamp of the last successful push.
export function mergeState(localState, remote, localUpdatedAt) {
  if (!remote) return localState
  const localTs = localUpdatedAt ?? 0
  return remote.updatedAt >= localTs ? remote.data : localState
}
