import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { getUserId, subscribeUser } from './auth'
import { loadRemote, pushState, loginLift, clearLifts } from './sync'

const KEY = 'pulse.state.v2'

// Set before a password re-auth so the SIGNED_IN event that fires cannot
// re-download the (soon-to-be-deleted) cloud state over local changes.
let suppressPull = false
export function suppressNextPull() {
  suppressPull = true
}
export function resetPullSuppression() {
  suppressPull = false
}

const DEFAULT = {
  days: [],
  sessions: [],
  plan: {},
  settings: { notify: true, neko: true, accent: '#0485F7', theme: 'dark' },
  lastActiveExercise: null,
}

function normalize(raw) {
  return {
    days: raw.days ?? DEFAULT.days,
    sessions: raw.sessions ?? DEFAULT.sessions,
    plan: raw.plan ?? {},
    settings: { ...DEFAULT.settings, ...(raw.settings ?? {}) },
    lastActiveExercise: raw.lastActiveExercise ?? DEFAULT.lastActiveExercise,
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    return normalize(JSON.parse(raw))
  } catch {
    return DEFAULT
  }
}

function backfillExercises(sessions, days) {
  const cands = days
    .flatMap((d) => d.exercises)
    .filter((e) => (e.weight ?? 0) > 0)
    .map((e) => ({ name: e.name, weight: e.weight }))
  const mainLift = days.flatMap((d) => d.exercises)[0]?.name ?? null
  let changed = false
  const out = sessions.map((s) => {
    if (s.exercise || !mainLift) return s
    changed = true
    if (!cands.length) return { ...s, exercise: mainLift }
    const best = cands.reduce((a, b) =>
      Math.abs(a.weight - s.weight) < Math.abs(b.weight - s.weight) ? a : b,
    )
    return { ...s, exercise: best.name }
  })
  return { out, changed }
}

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)
  const stateRef = useRef(state)
  const lastSynced = useRef(0)

  function recordLift(exercise, weight) {
    const userId = getUserId()
    if (!supabase || !userId || !weight) return
    loginLift(supabase, userId, exercise, weight).catch(() => {})
  }

  async function syncOnLogin(userId) {
    if (!supabase || !userId) return
    if (suppressPull) {
      suppressPull = false
      return
    }
    try {
      const remote = await loadRemote(supabase, userId)
      if (remote) {
        // Cloud is the source of truth on login: replace local state.
        setState(normalize(remote.data))
        lastSynced.current = Date.now()
      } else {
        // No cloud copy yet (first device): seed it with local state.
        lastSynced.current = Date.now()
        await pushState(supabase, userId, stateRef.current)
      }
    } catch {}
  }

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Pull-then-push when the user signs in or out.
  useEffect(() => {
    return subscribeUser((userId) => {
      if (userId) syncOnLogin(userId)
    })
  }, [])

  // Debounced push of every local change to the cloud while signed in.
  useEffect(() => {
    const userId = getUserId()
    if (!supabase || !userId) return
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      pushState(supabase, userId, state)
        .then(() => {
          lastSynced.current = Date.now()
        })
        .catch(() => {})
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [state])

  useEffect(() => {
    setState((s) => {
      const { out, changed } = backfillExercises(s.sessions, s.days)
      if (!changed) return s
      const next = { ...s, sessions: out }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  const api = useMemo(
    () => ({
      days: state.days,
      sessions: state.sessions,
      plan: state.plan,
      settings: state.settings,
      lastActiveExercise: state.lastActiveExercise,

      addDay(name, weekday) {
        const colors = ['#0485F7', '#17C964', '#F5A524', '#7C3AED', '#F2606E']
        const id = crypto.randomUUID()
        setState((s) => ({
          ...s,
          days: [
            ...s.days,
            {
              id,
              name,
              weekday,
              color: colors[s.days.length % colors.length],
              muscles: [],
              exercises: [],
            },
          ],
        }))
        return id
      },

      updateDay(id, patch) {
        setState((s) => ({
          ...s,
          days: s.days.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        }))
      },

      deleteDay(id) {
        setState((s) => {
          const plan = {}
          for (const [k, v] of Object.entries(s.plan)) if (v !== id) plan[k] = v
          return { ...s, days: s.days.filter((d) => d.id !== id), plan }
        })
      },

      addExercise(dayId, exercise) {
        setState((s) => ({
          ...s,
          days: s.days.map((d) =>
            d.id === dayId
              ? {
                  ...d,
                  exercises: [
                    ...d.exercises,
                    {
                      id: crypto.randomUUID(),
                      name: exercise.name,
                      muscle: exercise.muscle,
                      sets: 3,
                      reps: 10,
                      weight: 20,
                      done: false,
                    },
                  ],
                  muscles: [...new Set([...d.muscles, exercise.muscle])],
                }
              : d,
          ),
        }))
      },

      removeExercise(dayId, exId) {
        setState((s) => ({
          ...s,
          days: s.days.map((d) =>
            d.id === dayId
              ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) }
              : d,
          ),
        }))
      },

      toggleExercise(dayId, exId) {
        let fresh = []
        setState((s) => {
          const day = s.days.find((d) => d.id === dayId)
          if (!day) return s
          const ex = day.exercises.find((e) => e.id === exId)
          if (!ex) return s

          const willBeDone = !ex.done

          const days = s.days.map((d) =>
            d.id === dayId
              ? {
                  ...d,
                  exercises: d.exercises.map((e) =>
                    e.id === exId ? { ...e, done: !e.done } : e,
                  ),
                }
              : d,
          )

          const now = new Date()
          const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
          const full = now.toISOString().slice(0, 10)

          let sessions = s.sessions
          if (willBeDone) {
            const prevBest = Math.max(
              0,
              ...sessions
                .filter((x) => x.exercise === ex.name && x.full !== full)
                .map((x) => x.weight ?? 0),
            )
            const newSession = {
              date: dateStr,
              full,
              exercise: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight,
              pr: ex.weight >= prevBest && ex.weight > 0,
            }
            sessions = sessions
              .filter((x) => !(x.exercise === ex.name && x.full === full))
              .slice(0, 59)
            fresh = [newSession]
            sessions = [newSession, ...sessions].slice(0, 60)
          }

          return { ...s, days, sessions }
        })
        if (fresh.length) fresh.forEach((f) => recordLift(f.exercise, f.weight))
      },

      patchExercise(dayId, exId, patch) {
        setState((s) => ({
          ...s,
          days: s.days.map((d) =>
            d.id === dayId
              ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }
              : d,
          ),
        }))
      },

      logSession(exerciseName, sets, reps, weight, pr) {
        const now = new Date()
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
        const full = now.toISOString().slice(0, 10)
        setState((s) => {
          const newSession = { date: dateStr, full, exercise: exerciseName, sets, reps, weight, pr }
          const sessions = s.sessions
            .filter((x) => !(x.exercise === exerciseName && x.full === full))
            .slice(0, 59)
          return {
            ...s,
            sessions: [newSession, ...sessions].slice(0, 60),
          }
        })
        recordLift(exerciseName, weight)
      },

      setSettings(patch) {
        setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
      },

      setLastActiveExercise(name) {
        setState((s) => ({ ...s, lastActiveExercise: name }))
      },

      setPlan(dateKey, dayId) {
        setState((s) => {
          const plan = { ...s.plan }
          if (dayId === null) delete plan[dateKey]
          else plan[dateKey] = dayId
          return { ...s, plan }
        })
      },

      exportAll() {
        return {
          days: state.days,
          sessions: state.sessions,
          plan: state.plan,
          settings: state.settings,
        }
      },

      importAll(data) {
        if (!data || !Array.isArray(data.days)) return false
        setState({
          days: data.days,
          sessions: data.sessions ?? DEFAULT.sessions,
          plan: data.plan ?? {},
          settings: { ...DEFAULT.settings, ...data.settings },
        })
        return true
      },

      clearAllData() {
        const userId = getUserId()
        setState((s) => ({
          days: [],
          sessions: [],
          plan: {},
          settings: s.settings,
          lastActiveExercise: null,
        }))
        if (supabase && userId) clearLifts(supabase, userId).catch(() => {})
      },
    }),
    [state],
  )

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>
}

export function useStore() {
  return useContext(StoreCtx)
}
