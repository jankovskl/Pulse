import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseEnabled } from './supabase'
import { fetchProfile, saveProfile } from './profile'

// Module-level auth state so non-React code (the store) can read the current
// user id and react to changes without a React context.
let currentUser = null
const listeners = new Set()

function emit() {
  for (const cb of listeners) cb(currentUser)
}

// Non-hook accessor used inside store mutations.
export function getUserId() {
  return currentUser?.id ?? null
}

// Non-hook subscription used by the store to re-sync on login / logout.
export function subscribeUser(cb) {
  listeners.add(cb)
  cb(currentUser)
  return () => listeners.delete(cb)
}

function applySession(sessionUser) {
  currentUser = sessionUser ?? null
  emit()
}

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(currentUser)
  const [status, setStatus] = useState(isSupabaseEnabled ? 'loading' : 'anonymous')
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null)
      return
    }
    try {
      const p = await fetchProfile(supabase, userId)
      setProfile(p || {})
    } catch {
      setProfile({})
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setUser(null)
      setStatus('anonymous')
      return
    }
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      applySession(data.user ?? null)
      setUser(currentUser)
      setStatus(currentUser ? 'authed' : 'anonymous')
      loadProfile(currentUser?.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      applySession(session?.user ?? null)
      setUser(currentUser)
      setStatus(currentUser ? 'authed' : 'anonymous')
      loadProfile(currentUser?.id)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (email, password) => {
      if (!supabase) return false
      setError(null)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        return false
      }
      if (data.user) {
        applySession(data.user)
        setUser(currentUser)
        loadProfile(data.user.id)
      }
      return true
    },
    [loadProfile],
  )

  const signUp = useCallback(async (email, password) => {
    if (!supabase) return false
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      return false
    }
    return true
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    setError(null)
    setProfile(null)
    // Optimistically mark the user as signed out *now*. This matters because
    // `supabase.auth.signOut()` is async and only flips `auth.user` to null once
    // its network round-trip resolves — a window during which the UI still
    // thinks the user is signed in. If the user clicked "Sign out" then
    // immediately "Delete all data", that delete would otherwise run through
    // the *signed-in* path (password re-auth + cloud wipe) while the user
    // believes they are signed out. Setting null immediately makes the
    // signed-out "delete all data" path (local-only, cloud-safe) the one taken.
    setUser(null)
    applySession(null)
    supabase.auth.signOut().catch(() => {})
  }, [])

  const updateProfile = useCallback(
    async (patch) => {
      if (!supabase || !currentUser) return false
      setError(null)
      setProfile((prev) => ({ ...(prev || {}), ...patch }))
      try {
        await saveProfile(supabase, currentUser.id, patch)
        return true
      } catch (e) {
        setError(e.message || 'Could not save profile.')
        return false
      }
    },
    [],
  )

  return (
    <AuthCtx.Provider
      value={{ user, status, error, profile, signIn, signUp, signOut, updateProfile }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
