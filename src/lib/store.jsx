import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { getUserId, subscribeUser, registerBeforeSignOut } from './auth'
import { loadRemoteResilient, pushState, loginLift, clearLifts, hasWorkoutData, shouldPushState } from './sync'
import { publishStats } from './profile'
import { clampWeight, isNewPersonalRecord } from './integrity'
import { dateKey } from './data'
import { navigate } from '../components/ui'
import { scheduleDailyReminder, fireSleepReminder } from './notifications'
import { DEFAULT_THEME } from './themes'

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

// Set by the signed-in "delete all data" flow so the debounced push knows an
// empty state is an intentional cloud wipe, not an accidental one. Without
// this flag an empty state is never pushed, so deleting data while signed out
// (or with a silently restored session) can never destroy the cloud copy.
let wipeCloud = false;
// Holds the dateKey for the ongoing workout session to keep sessions unified across midnight.
let ongoingFull = null;
export function setOngoingFull(full) {
  ongoingFull = full;
}
export function clearOngoingFull() {
  ongoingFull = null;
}
export function getOngoingFull() {
  return ongoingFull;
}
export function requestCloudWipe() {
  wipeCloud = true
}

// Hours between two "HH:MM" times, handling a wake time that crosses midnight
// (bedtime 23:00 → wake 07:00 = 8h). Rounded to 0.1h.
//
// IMPORTANT: The HTML <input type="time"> returns 24-hour format (00:00–23:59).
// Users often type "12:00" meaning midnight, but in 24h that's noon!
// This function normalizes: "12:XX" → "00:XX" for bedtimes (since you don't
// go to bed at noon), fixing the common 12 AM = 00:00 confusion.
function sleepHoursOf(bedtime, wake) {
  const toMin = (t) => {
    if (!t) return NaN
    const [h, m] = String(t).split(':').map(Number)
    if (!Number.isFinite(h)) return NaN
    // Normalize "12:XX" → "00:XX" because <input type="time"> uses 24h format
    // and 12 AM = 00:00, not 12:00. Bedtime at noon is nonsensical.
    const hour = h === 12 ? 0 : h
    return hour * 60 + (m || 0)
  }
  const b = toMin(bedtime)
  const w = toMin(wake)
  if (!Number.isFinite(b) || !Number.isFinite(w)) return NaN
  let diff = w - b
  if (diff < 0) diff += 24 * 60
  return Math.round(diff / 6) / 10
}

const DEFAULT = {
  days: [],
  sessions: [],
  plan: {},
  settings: { notify: true, neko: true, accent: '#A855F7', theme: DEFAULT_THEME, pwaDismissed: false, sleepReminder: { enabled: false, time: '09:00' }, sleepGoal: 8, idealSleepOnset: '23:00' },
  lastActiveExercise: null,
  totals: { sessions: 0, lastSessionDay: null },
  sleep: [],
  caffeine: [],

}

function normalize(raw) {
  const sessions = raw.sessions ?? DEFAULT.sessions
  return {
    // Legacy: addDay used to pin every new day to weekday 0 (= "every
    // Sunday"), painting phantom dots on the calendar. There was never a UI
    // to choose a weekday, so wipe the field — scheduling is date-based now.
    days: (raw.days ?? DEFAULT.days).map((d) =>
      d.weekday == null ? d : { ...d, weekday: null },
    ),
    sessions,
    plan: raw.plan ?? {},
    settings: { ...DEFAULT.settings, ...(raw.settings ?? {}) },
    lastActiveExercise: raw.lastActiveExercise ?? DEFAULT.lastActiveExercise,
    // Include sleep logs if present
    sleep: raw.sleep ?? DEFAULT.sleep,
    caffeine: raw.caffeine ?? DEFAULT.caffeine,
    // Lifetime counter feeds profile badges; older states lack it, so
    // backfill from the (capped) session list on first sight. A session is a
    // workout DAY, not an exercise, so count unique dates.
    totals: raw.totals
      ? { lastSessionDay: null, ...raw.totals }
      : {
          sessions: new Set(sessions.map((s) => s.full).filter(Boolean)).size,
          lastSessionDay: sessions.reduce((max, s) => (s.full > max ? s.full : max), null),
        },
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
      const remote = await loadRemoteResilient(supabase, userId)
      if (remote) {
        // Cloud is the source of truth on login: replace local state.
        setState(normalize(remote.data))
        lastSynced.current = Date.now()
      } else if (hasWorkoutData(stateRef.current)) {
        // No cloud copy yet (first device): seed it with local state.
        // Never seed an empty state (e.g. after "delete all data" while
        // signed out) — that would wipe a real cloud copy.
        lastSynced.current = Date.now()
        await pushState(supabase, userId, stateRef.current)
        publishStats(supabase, userId, stateRef.current).catch(() => {})
      }
    } catch {}
  }

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Register a flush that runs BEFORE the session is torn down on sign-out.
  // This pushes any pending local changes (saved within the last debounce
  // window) to the cloud so they are not lost when `currentUser` becomes null
  // and the session cookie is revoked.
  useEffect(() => {
    registerBeforeSignOut(async () => {
      const userId = getUserId()
      if (!supabase || !userId) return
      // Abort a pending cloud wipe — signing out before the wipe push fired
      // means the user abandoned the wipe, so preserve the cloud copy.
      if (wipeCloud) {
        wipeCloud = false
        return
      }
      // Flush pending workout data so it is not lost on sign-out.
      if (!hasWorkoutData(stateRef.current)) return
      try {
        await pushState(supabase, userId, stateRef.current)
        publishStats(supabase, userId, stateRef.current).catch(() => {})
        lastSynced.current = Date.now()
      } catch {}
    })
  }, [])

  // Pull-then-push when the user signs in or out.
  useEffect(() => {
    return subscribeUser((user) => {
      const userId = user?.id ?? null
      if (userId) {
        syncOnLogin(userId)
      } else {
        // Reset wipe flag on sign-out to prevent leakage across sessions.
        wipeCloud = false
      }
    })
  }, [])

  // Debounced push of every local change to the cloud while signed in.
  // Empty states are only pushed when a cloud wipe was explicitly requested;
  // otherwise an empty state (signed-out delete, cleared device) is left
  // alone so the real cloud copy survives.
  useEffect(() => {
    const userId = getUserId()
    if (!supabase || !userId) return
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      if (!shouldPushState(state, wipeCloud)) return
      wipeCloud = false
      pushState(supabase, userId, state)
        .then(() => {
          lastSynced.current = Date.now()
          publishStats(supabase, userId, state).catch(() => {})
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
  // Scheduler for sleep reminders: fires one notification at the chosen time,
  // re-arming daily. The fire deep-links to the Health (sleep) screen.
  useEffect(() => {
    const { enabled, time } = state.settings.sleepReminder || {}
    return scheduleDailyReminder({
      enabled: !!enabled,
      time,
      onFire: () => fireSleepReminder(() => navigate('health')),
    })
  }, [state.settings.sleepReminder])

  const api = useMemo(
    () => ({
      days: state.days,
      sessions: state.sessions,
      plan: state.plan,
      settings: state.settings,
      lastActiveExercise: state.lastActiveExercise,
      totals: state.totals,
      sleep: state.sleep,
      caffeine: state.caffeine,

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
            d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d,
          ),
        }))
      },

      // Re-insert a removed exercise at its old position (undo). No-op if the
      // exercise is already back (e.g. a stale undo firing twice).
      restoreExercise(dayId, exercise, index) {
        setState((s) => ({
          ...s,
          days: s.days.map((d) => {
            if (d.id !== dayId) return d;
            if (d.exercises.some((e) => e.id === exercise.id)) return d;
            const exercises = [...d.exercises];
            exercises.splice(Math.max(0, Math.min(index, exercises.length)), 0, exercise);
            return {
              ...d,
              exercises,
              muscles: [...new Set([...d.muscles, exercise.muscle])],
            };
          }),
        }));
      },

      toggleExercise(dayId, exId) {
        const now = new Date()
        // Local calendar date, not UTC: a late-evening set must land on the
        // day the user is actually training (same keys the calendar plan and
        // streak helpers use).
        const full = getOngoingFull() ?? dateKey(now)
        // Derive the lift to push from the latest committed state BEFORE the
        // state update. React may defer a setState updater until the next
        // render, so side effects inside it can silently never run — that
        // made the last exercise of a day never reach the leaderboard.
        const snap = stateRef.current
        const snapDay = snap.days.find((d) => d.id === dayId)
        const snapEx = snapDay?.exercises.find((e) => e.id === exId)
        let lift = null
        if (snapDay && snapEx && !snapEx.done) {
          const prevBest = Math.max(
            0,
            ...snap.sessions
              .filter((x) => x.exercise === snapEx.name && x.full !== full)
              .map((x) => x.weight ?? 0),
          )
          lift = { exercise: snapEx.name, weight: clampWeight(snapEx.weight, prevBest, snapEx.name) }
        }
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

          const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })

          let sessions = s.sessions
          let totals = s.totals
          if (willBeDone) {
            const prevBest = Math.max(
              0,
              ...sessions
                .filter((x) => x.exercise === ex.name && x.full !== full)
                .map((x) => x.weight ?? 0),
            )
            // Anti-cheat: the stored weight is clamped to a plausible
            // progression from the previous best (see lib/integrity.js), so
            // typing 200 kg out of nowhere can't unlock strength achievements.
            const weight = clampWeight(ex.weight, prevBest, ex.name)
            const newSession = {
              date: dateStr,
              full,
              exercise: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              weight,
              pr: isNewPersonalRecord(weight, prevBest),
              // Keep what was actually typed so the Progress screen can show
              // the ghost line + explain the limit in a popup.
              ...(weight < ex.weight ? { capped: true, entered: ex.weight } : {}),
            }
            // A "session" is a whole workout day: only the first completed
            // exercise of a day bumps the lifetime counter. `lastSessionDay`
            // is remembered even if the day's sessions get unchecked again,
            // so toggling on/off can't farm extra sessions.
            const newDay = totals.lastSessionDay !== full
            if (newDay) {
              totals = { sessions: totals.sessions + 1, lastSessionDay: full }
            }
            sessions = sessions
              .filter((x) => !(x.exercise === ex.name && x.full === full))
              .slice(0, 359)
            sessions = [newSession, ...sessions].slice(0, 360)
          }

          return { ...s, days, sessions, totals }
        })
        if (lift) recordLift(lift.exercise, lift.weight)
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
        const full = getOngoingFull() ?? dateKey(now)
        setState((s) => {
          const newSession = { date: dateStr, full, exercise: exerciseName, sets, reps, weight, pr }
          const sessions = s.sessions
            .filter((x) => !(x.exercise === exerciseName && x.full === full))
            .slice(0, 359)
          return {
            ...s,
            sessions: [newSession, ...sessions].slice(0, 360),
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

      // Sleep tracking API. A log is keyed by wake date (the morning the
      // night ended — ADR 0004). `hours` is stored as given or computed from
      // bedtime+wake when both are present. Legacy { date, hours } logs (no
      // detail fields) keep working: they carry hours and simply have no
      // bedtime/wake/etc.
      addSleepLog(date, { hours, bedtime, wake, note, quality } = {}) {
        const computedHours =
          typeof hours === 'number'
            ? hours
            : bedtime && wake
              ? sleepHoursOf(bedtime, wake)
              : undefined
        setState((s) => ({
          ...s,
          sleep: [
            ...s.sleep,
            {
              date,
              hours: computedHours,
              ...(bedtime != null && { bedtime }),
              ...(wake != null && { wake }),
              ...(note != null && { note }),
              ...(quality != null && { quality }),
            },
          ],
        }))
      },
      // Log one caffeine dose. `when` is a Date (resolved by the caller from
      // the popup's time-of-day, incl. the "future time means yesterday"
      // rule); the entry's date key always derives from it, never from now,
      // so backfilled entries land on the right night.
      addCaffeine({ type = 'coffee', amountMg = null, when = new Date() } = {}) {
        setState((s) => ({
          ...s,
          caffeine: [
            ...s.caffeine,
            {
              id: crypto.randomUUID(),
              type,
              amountMg,
              time: when.toISOString(),
              date: dateKey(when),
            },
          ],
        }))
      },

      updateCaffeine(id, patch = {}) {
        setState((s) => ({
          ...s,
          caffeine: s.caffeine.map((c) => {
            if (c.id !== id) return c
            const next = { ...c, ...patch }
            // Keep the date key in sync with the timestamp — the popup can
            // move an entry across a day boundary.
            if (patch.time) next.date = dateKey(new Date(patch.time))
            return next
          }),
        }))
      },

      deleteCaffeine(id) {
        setState((s) => ({
          ...s,
          caffeine: s.caffeine.filter((c) => c.id !== id),
        }))
      },

      updateSleepLog(date, { hours, bedtime, wake, note, quality } = {}) {
        const computedHours =
          typeof hours === 'number'
            ? hours
            : bedtime && wake
              ? sleepHoursOf(bedtime, wake)
              : hours
        setState((s) => ({
          ...s,
          sleep: s.sleep.map((log) =>
            log.date === date
              ? {
                  ...log,
                  ...(typeof computedHours !== 'undefined' && { hours: computedHours }),
                  ...(bedtime != null && { bedtime }),
                  ...(wake != null && { wake }),
                  ...(note != null && { note }),
                  ...(quality != null && { quality }),
                }
              : log,
          ),
        }))
      },

      // Delete the log for a single wake date. Only the matching entry is
      // removed; the rest of the sleep history stays untouched.
      removeSleepLog(date) {
        setState((s) => ({
          ...s,
          sleep: s.sleep.filter((log) => log.date !== date),
        }))
      },

      exportAll() {
        return {
          days: state.days,
          sessions: state.sessions,
          plan: state.plan,
          settings: state.settings,
          totals: state.totals,
          sleep: state.sleep,
        }
      },

      importAll(data) {
        if (!data || !Array.isArray(data.days)) return false
        const sessions = data.sessions ?? DEFAULT.sessions
        setState({
          days: data.days,
          sessions,
          plan: data.plan ?? {},
          settings: { ...DEFAULT.settings, ...data.settings },
          sleep: data.sleep ?? [],
          // Never trust totals from an import file — it can be hand-edited to
          // fake achievements. Recompute from the imported session history.
          totals: {
            sessions: new Set(sessions.map((s) => s.full).filter(Boolean)).size,
            lastSessionDay: sessions.reduce((max, s) => (s.full > max ? s.full : max), null),
          },
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
          totals: { sessions: 0, lastSessionDay: null },
        }))
        if (supabase && userId) clearLifts(supabase, userId).catch(() => {})
      },
    }),
    [state],
  )

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>
}

export function useStore() {
  // Export control over ongoing session full key
  // Ongoing session full key helpers are exported at top level
  return useContext(StoreCtx)
}
