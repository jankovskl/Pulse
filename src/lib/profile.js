// Profile + avatar storage helpers. Kept Supabase-free at the call sites so
// the pure parts (fetchProfile / buildRows mapping) stay unit-testable.

export async function fetchProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, pfp')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function saveProfile(supabase, userId, patch) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    })
  if (error) throw error
}

export async function uploadAvatar(supabase, userId, file) {
  const path = `${userId}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function removeAvatar(supabase, userId) {
  const { error } = await supabase.storage.from('avatars').remove([`${userId}`])
  if (error) throw error
}

// Fetch a map of userId -> { nickname, pfp } for the given ids. Public read.
export async function fetchProfiles(supabase, userIds) {
  if (!userIds?.length) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, nickname, pfp')
    .in('user_id', userIds)
  if (error) throw error
  const map = {}
  for (const row of data ?? []) {
    map[row.user_id] = { nickname: row.nickname, pfp: row.pfp }
  }
  return map
}

// Search profiles by nickname (case-insensitive substring). Used by the
// leaderboard player search.
export async function searchProfiles(supabase, query, limit = 8) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, nickname, pfp')
    .ilike('nickname', `%${query}%`)
    .limit(limit)
  if (error) throw error
  return data ?? []
}
