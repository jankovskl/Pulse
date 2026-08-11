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
    } else {
      setLeft(s.total)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(TKEY, JSON.stringify({ total, left, endsAt, running, paused }))
  }, [total, left, endsAt, running, paused])

  useEffect(() => {
    localStorage.setItem(SKEY, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    if (!running || paused) return
    const id = setInterval(() => {
      const rem = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setLeft(rem)
      if (rem <= 0) {
        clearInterval(id)
        setRunning(false)
        setPaused(false)
        setEndsAt(null)
        advanceSession()
        if (notify) fireNotification()
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

  function fireNotification() {
    if (!('Notification' in window)) return
    const show = () =>
      new Notification('Rest over', { body: 'Time to lift. Next set ready.', tag: 'pulse-rest' })
    if (Notification.permission === 'granted') show()
    else if (Notification.permission === 'default')
      Notification.requestPermission().then((p) => p === 'granted' && show())
  }

  function start(sec) {
    const t = sec > 0 ? sec : total
    setTotal(t)
    setLeft(t)
    setEndsAt(Date.now() + t * 1000)
    setRunning(true)
    setPaused(false)
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

  function useDay(dayId) {
    const day = storeRef.current.days.find((d) => d.id === dayId)
    if (!day || !day.exercises.length) {
      setSession({ dayId, exIdx: 0, set: 1 })
      return
    }
    const first = day.exercises.findIndex((e) => !e.done)
    setSession({ dayId, exIdx: first === -1 ? 0 : first, set: 1 })
  }

  function advanceSession() {
    const s = sessionRef.current
    if (!s) return
    const day = storeRef.current.days.find((d) => d.id === s.dayId)
    if (!day || !day.exercises.length) return
    const ex = day.exercises[s.exIdx]
    if (ex && s.set < ex.sets) {
      setSession({ ...s, set: s.set + 1 })
      return
    }
    if (ex && !ex.done) {
      storeRef.current.toggleExercise(s.dayId, ex.id)
    }
    let next = s.exIdx + 1
    while (next < day.exercises.length && day.exercises[next].done) next++
    if (next >= day.exercises.length) {
      setSession({ ...s, exIdx: day.exercises.length })
      return
    }
    setSession({ dayId: s.dayId, exIdx: next, set: 1 })
  }

  return (
    <TimerCtx.Provider
      value={{ total, left, running, paused, notify, session, start, toggle, reset, setNotify, useDay, endWorkout }}
    >
      {children}
    </TimerCtx.Provider>
  )
}

export function useTimer() {
  return useContext(TimerCtx)
}
