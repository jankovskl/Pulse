// Real-time presence and workout status tracking using Supabase

export async function updatePresence(supabase, userId, status, workoutData = null) {
  if (!supabase || !userId) return

  const payload = {
    user_id: userId,
    status, // 'online', 'offline', 'working_out'
    last_seen: new Date().toISOString(),
    workout_data: workoutData, // { dayId, dayName, currentExercise, startedAt, exercisesDone, exercisesTotal }
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('presence')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) throw error
}

export async function setOnline(supabase, userId) {
  return updatePresence(supabase, userId, 'online', null)
}

export async function setOffline(supabase, userId) {
  return updatePresence(supabase, userId, 'offline', null)
}

export async function setWorkingOut(supabase, userId, workoutData) {
  return updatePresence(supabase, userId, 'working_out', workoutData)
}

// Fetch presence for multiple users
export async function fetchPresence(supabase, userIds) {
  if (!supabase || !userIds?.length) return {}

  const { data, error } = await supabase
    .from('presence')
    .select('*')
    .in('user_id', userIds)

  if (error) throw error

  const map = {}
  for (const row of data ?? []) {
    map[row.user_id] = {
      status: row.status,
      lastSeen: row.last_seen,
      workoutData: row.workout_data,
    }
  }
  return map
}

// Subscribe to presence changes for specific users
export function subscribeToPresence(supabase, userIds, callback) {
  if (!supabase || !userIds?.length) return null

  const channel = supabase
    .channel('presence-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'presence',
        filter: `user_id=in.(${userIds.join(',')})`,
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// Clean up stale presence (mark as offline if last_seen > 5 minutes ago)
export async function cleanStalePresence(supabase) {
  if (!supabase) return

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  await supabase
    .from('presence')
    .update({ status: 'offline', workout_data: null })
    .lt('last_seen', fiveMinutesAgo)
    .neq('status', 'offline')
}
