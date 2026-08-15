import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useStore } from './store'

const TKEY = 'pulse.timer.v1'
const SKEY = 'pulse.session.v1'

export const fmt = (sec) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const TimerCtx = createContext(null)

function load() {
  try {
    const raw = localStorage.getItem(TKEY)
    if (!raw) return null
    const t = JSON.parse(raw)
    if (typeof t.total !== 'number') return null
    return t
  } catch {
    return null
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SKEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (typeof s.dayId !== 'string') return null
    return { dayId: s.dayId, exIdx: typeof s.exIdx === 'number' ? s.exIdx : 0, set: typeof s.set === 'number' ? s.set : 1 }
  } catch {
    return null
  }
}

export function TimerProvider({ children }) {
  const store = useStore()
  const [total, setTotal] = useState(180)
  const [left, setLeft] = useState(180)
  const [endsAt, setEndsAt] = useState(null)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [notify, setNotifyState] = useState(store.settings.notify)
  const [session, setSession] = useState(loadSession)
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  const storeRef = useRef(store)
  useEffect(() => {
    storeRef.current = store
  }, [store])

  function fireNotification() {
    if (!('Notification' in window)) return
    const show = () =>
      new Notification('Rest over', { body: 'Time to lift. Next set ready.', tag: 'pulse-rest' })
    if (Notification.permission === 'granted') show()
    else if (Notification.permission === 'default')
      Notification.requestPermission().then((p) => p === 'granted' && show())
  }

  function advanceSession() {
    const s = sessionRef.current
    if (!s) return
    const day = storeRef.current.days.find((d) => d.id === s.dayId)
    if (!day || !day.exercises.length) return
    const ex = day.exercises[s.exIdx]
    if (ex && s.set < ex.sets) {
      setSession({ ...s, set: s.set + 1, justCompletedId: null })
      return
    }
    let justCompletedId = null
    if (ex && !ex.done) {
      storeRef.current.toggleExercise(s.dayId, ex.id)
      justCompletedId = ex.id
    }
    let next = s.exIdx + 1
    while (next < day.exercises.length && day.exercises[next].done) next++
    if (next >= day.exercises.length) {
      setSession({ dayId: s.dayId, exIdx: day.exercises.length, set: 1, justCompletedId })
      return
    }
    setSession({ dayId: s.dayId, exIdx: next, set: 1, justCompletedId })
    storeRef.current.setLastActiveExercise(day.exercises[next]?.name ?? null)
  }

  // Guards against completing the same countdown twice (e.g. a queued
  // interval tick AND the visibility handler both firing on resume).
  const finishedRef = useRef(null)
  function completeTimer(endVal) {
    if (finishedRef.current === endVal) return
    finishedRef.current = endVal
    setLeft(0)
    setRunning(false)
    setPaused(false)
    setEndsAt(null)
    advanceSession()
    if (notify) fireNotification()
  }

  useEffect(() => {
    const s = load()
    if (!s) return
    setTotal(s.total ?? 180)
    if (s.running && s.paused && typeof s.endsAt === 'number') {
      setLeft(s.left ?? s.total)
      setPaused(true)
      setRunning(true)
      setEndsAt(s.endsAt)
    } else if (s.running && typeof s.endsAt === 'number' && s.endsAt > Date.now()) {
      setLeft(Math.ceil((s.endsAt - Date.now()) / 1000))
      setEndsAt(s.endsAt)
      setRunning(true)
    } else if (s.running && !s.paused && typeof s.endsAt === 'number') {
      // The timer expired while the app was suspended (phone locked, tab
      // frozen/killed). The interval never got to fire, so finish the set
      // now — otherwise the exercise would never flip to done.
      completeTimer(s.endsAt)
    } else {
      setLeft(s.total)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Phones suspend JS entirely while locked/backgrounded, so the interval
  // can't count down. The moment the page comes back to the foreground,
  // finish any timer that expired while we were gone.
  const timerRef = useRef({ running, paused, endsAt })
  useEffect(() => {
    timerRef.current = { running, paused, endsAt }
  }, [running, paused, endsAt])
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      const t = timerRef.current
      if (!t.running || t.paused || typeof t.endsAt !== 'number') return
      if (t.endsAt > Date.now()) return
      completeTimer(t.endsAt)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify])

  useEffect(() => {
    localStorage.setItem(TKEY, JSON.stringify({ total, left, endsAt, running, paused }))
  }, [total, left, endsAt, running, paused])

  useEffect(() => {
    localStorage.setItem(SKEY, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    if (!session) return
    const day = store.days.find((d) => d.id === session.dayId)
    if (!day || !day.exercises.length) return
    const firstUndone = day.exercises.findIndex((e) => !e.done)
    const target = firstUndone === -1 ? day.exercises.length : firstUndone
    if (target !== session.exIdx) setSession({ ...session, exIdx: target, set: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.dayId, session?.exIdx, store.days])

  useEffect(() => {
    if (!running || paused) return
    const id = setInterval(() => {
      const rem = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setLeft(rem)
      if (rem <= 0) {
        clearInterval(id)
        completeTimer(endsAt)
      }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused, endsAt])

  useEffect(() => {
    document.title =
      running && !paused ? `Rest ${fmt(left)} — Pulse` : 'Pulse — Fitness Tracker'
    return () => {
      document.title = 'Pulse — Fitness Tracker'
    }
  }, [running, paused, left])

  function start(sec) {
    const t = sec > 0 ? sec : total
    finishedRef.current = null
    setTotal(t)
    setLeft(t)
    setEndsAt(Date.now() + t * 1000)
    setRunning(true)
    setPaused(false)
    setSession((s) => (s ? { ...s, startedAt: s.startedAt ?? Date.now(), justCompletedId: null } : s))
    if (notify && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  function toggle() {
    if (!running) {
      start(left || total)
      return
    }
    if (paused) {
      setEndsAt(Date.now() + left * 1000)
      setPaused(false)
    } else {
      setPaused(true)
    }
  }

  function reset() {
    setRunning(false)
    setPaused(false)
    setEndsAt(null)
    setLeft(total)
  }

  function endWorkout() {
    const s = sessionRef.current
    if (s) {
      const day = storeRef.current.days.find((d) => d.id === s.dayId)
      if (day) {
        storeRef.current.updateDay(s.dayId, {
          exercises: day.exercises.map((e) => (e.done ? { ...e, done: false } : e)),
        })
      }
    }
    setSession(null)
    setRunning(false)
    setPaused(false)
    setEndsAt(null)
    setLeft(total)
  }

  function setNotify(v) {
    setNotifyState(v)
    store.setSettings({ notify: v })
  }

   function setDay(dayId) {
    const day = storeRef.current.days.find((d) => d.id === dayId)
    if (!day || !day.exercises.length) {
      setSession({ dayId, exIdx: 0, set: 1, justCompletedId: null })
      return
    }
    const first = day.exercises.findIndex((e) => !e.done)
    const idx = first === -1 ? 0 : first
    setSession({ dayId, exIdx: idx, set: 1, justCompletedId: null })
    storeRef.current.setLastActiveExercise(day.exercises[idx]?.name ?? null)
  }

  return (
    <TimerCtx.Provider
      value={{ total, left, running, paused, notify, session, start, toggle, reset, setNotify, setDay, endWorkout }}
    >
      {children}
    </TimerCtx.Provider>
  )
}

export function useTimer() {
  return useContext(TimerCtx)
}
