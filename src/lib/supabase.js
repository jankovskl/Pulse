import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null when env vars are absent: every auth/sync path treats null as
// "anonymous mode" and stays a no-op, so the app keeps working locally.
export const supabase = url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseEnabled = supabase !== null
