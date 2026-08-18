// Profile + avatar storage helpers. Kept Supabase-free at the call sites so
// the pure parts (fetchProfile / buildRows mapping) stay unit-testable.

import { muscleGroupFor } from './integrity.js'

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

// Full public profile row, used by the profile preview.
export async function fetchFullProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, nickname, pfp, bio, decoration, decorations, widgets, stats, is_admin')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

// Fetch a map of userId -> { nickname, pfp } for the given ids. Public read.
export async function fetchProfiles(supabase, userIds) {
  if (!userIds?.length) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, nickname, pfp, decoration, decorations, is_admin')
    .in('user_id', userIds)
  if (error) throw error
  const map = {}
  for (const row of data ?? []) {
    map[row.user_id] = {
      nickname: row.nickname,
      pfp: row.pfp,
      decoration: row.decoration ?? null,
      decorations: row.decorations ?? null,
      isAdmin: !!row.is_admin,
    }
  }
  return map
}

// Search profiles by nickname (case-insensitive substring). Used by the
// leaderboard player search.
export async function searchProfiles(supabase, query, limit = 8) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, nickname, pfp, decoration, decorations')
    .ilike('nickname', `%${query}%`)
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Nobody trains every single day: up to REST_GRACE_DAYS consecutive rest
// days keep the chain alive. Streaks still count only actual training days,
// so a streak can never exceed the session count (the server relies on that).
const REST_GRACE_DAYS = 2
const DAY_MS = 86400000

// Longest chain of training days where gaps of at most REST_GRACE_DAYS + 1
// calendar days don't break the run. Dates are local YYYY-MM-DD keys (see
// localKey below), so gaps are measured in calendar days, not UTC instants.
export function bestStreakOf(dates) {
  const days = [...new Set(dates)].sort()
  const maxGapDays = REST_GRACE_DAYS + 1
  let best = 0
  let run = 0
  let prev = null
  for (const d of days) {
    const t = Date.parse(`${d}T12:00:00`)
    if (Number.isNaN(t)) continue
    const gapDays = prev !== null ? Math.round((t - prev) / DAY_MS) : Infinity
    run = gapDays <= maxGapDays ? run + 1 : 1
    if (run > best) best = run
    prev = t
  }
  return best
}

// Current streak: chain of training days ending today or yesterday, walking
// back through at most REST_GRACE_DAYS rest days between workouts. Session
// dates are local YYYY-MM-DD keys, so the cursor walks local calendar days —
// a late-evening workout still counts for "today".
export function currentStreakOf(dates, today = new Date()) {
  const set = new Set(dates)
  const cursor = new Date(today)
  if (!set.has(localKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  let rest = 0
  while (rest <= REST_GRACE_DAYS) {
    if (set.has(localKey(cursor))) {
      streak += 1
      rest = 0
      cursor.setDate(cursor.getDate() - 1)
    } else {
      // Potential rest day — only kept if training resumes within the grace.
      rest += 1
      cursor.setDate(cursor.getDate() - 1)
    }
  }
  return streak
}

// Local YYYY-MM-DD key for a Date (matches data.js dateKey, i.e. the keys the
// calendar plan and session history use). Kept private here so the
// streak/week helpers stay self-contained and unit-testable.
const localKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// The 7 local date keys (Mon..Sun) of the week containing `today` — the same
// week the Home screen strip shows.
export function weekKeysOf(today = new Date()) {
  const monday = new Date(today)
  const offset = (today.getDay() + 6) % 7
  monday.setDate(today.getDate() - offset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return localKey(d)
  })
}

// Unique training days logged inside the current week (feeds the weekly goal
// card). Sessions carry their date in `full` (YYYY-MM-DD).
export function workoutsInWeek(sessions, today = new Date()) {
  const keys = new Set(weekKeysOf(today))
  return new Set(
    (sessions ?? []).map((s) => s.full).filter((d) => d && keys.has(d)),
  ).size
}

// Derive the public stats blob from local state (pure, unit-testable).
export function deriveStats(state) {
  const sessions = state?.sessions ?? []
  const dates = sessions.map((s) => s.full).filter(Boolean)
  // Best lift per muscle group (excluding "other") — powers the group
  // achievements and lets the server validate them against the lifts table.
  const groups = {}
  for (const s of sessions) {
    const g = muscleGroupFor(s.exercise)
    if (g === 'other') continue
    groups[g] = Math.max(groups[g] ?? 0, s.weight ?? 0)
  }
  return {
    sessions: state?.totals?.sessions ?? new Set(dates).size,
    best: Math.max(0, ...sessions.map((s) => s.weight ?? 0)),
    exercises: new Set(sessions.map((s) => s.exercise).filter(Boolean)).size,
    streak: currentStreakOf(dates),
    bestStreak: bestStreakOf(dates),
    groups,
  }
}

// Publish the owner's public stats onto their profile row so other users can
// see badges/widgets. Never overwrites bio/decoration/etc. Safe to fail
// silently at the call site (stats are cosmetic).
export async function publishStats(supabase, userId, state) {
  const stats = deriveStats(state)
  // Make sure lifts rows exist before publishing: the server cross-checks
  // stats.best against them. seed_lifts() replays the stored history through
  // the progression rules and is a no-op once lifts exist (or on old schemas).
  await supabase.rpc('seed_lifts').then(() => {}, () => {})
  const { data, error } = await supabase
    .from('profiles')
    .update({ stats, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('user_id')
  if (error) throw error
  if (!data?.length) {
    // No profile row yet (never set a nickname) — create a minimal one.
    const { error: insertError } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, stats, updated_at: new Date().toISOString() })
    if (insertError) throw insertError
  }
}
