import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseEnabled } from './supabase'

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
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      applySession(session?.user ?? null)
      setUser(currentUser)
      setStatus(currentUser ? 'authed' : 'anonymous')
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return false
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      return false
    }
    return true
  }, [])

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
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthCtx.Provider value={{ user, status, error, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
