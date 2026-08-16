import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarCheck, Check, Dumbbell, Lock, Repeat, Search, ShieldCheck, Trophy, X } from 'lucide-react'
import { exerciseOptions, firstOfMonth, leaderboardFor } from '../lib/data'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchTopLifts, buildRows, fetchUserLift } from '../lib/leaderboard'
import { fetchProfiles } from '../lib/profile'
import { maxAllowedWeight, rulesFor } from '../lib/integrity'
import AuthModal from '../components/AuthModal'
import ProfileView from '../components/ProfileView'
import { WorkoutCalendar } from '../components/Calendar'
import { DecoratedAvatar, initialsOf, Modal, Screen, useDialog, useNav } from '../components/ui'

function WeightChart({ series }) {
  const boxRef = useRef(null)
  const [width, setWidth] = useState(320)
  useEffect(() => {
    if (!boxRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [])

  if (!series || series.length === 0) return null
  const W = width
  const H = 180
  const PAD_L = 30
  const PAD_B = 24
  const PAD_T = 14
  const PAD_R = 12

  // Ghost points = the weight the user actually typed when the progression
  // guard limited a session — only kept where it differs from the stored one.
  const hasGhost = series.some((p) => p.entered != null && p.entered !== p.v)
  const ghost = hasGhost ? series.map((p) => (p.entered != null && p.entered !== p.v ? p.entered : null)) : null

  const values = series.map((p) => p.v)
  const allValues = ghost ? values.concat(ghost) : values
  const lo = Math.min(...allValues) - 2
  const hi = Math.max(...allValues) + 2

  const x = (i) => (series.length === 1 ? (W - PAD_L - PAD_R) / 2 + PAD_L : PAD_L + (i * (W - PAD_L - PAD_R)) / (series.length - 1))
  const y = (v) => PAD_T + ((hi - v) / (hi - lo)) * (H - PAD_T - PAD_B)

  const head = series.length === 1 ? `M${x(0)},${y(values[0])}` : ''
  const line = series.length === 1 ? head : values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  const area = `${line} L${x(values.length - 1)},${H - PAD_B} L${x(0)},${H - PAD_B} Z`

  const ticks = [0, 1, 2, 3, 4].map((t) => lo + ((hi - lo) * t) / 4)

  return (
    <div ref={boxRef} className="w-full">
      <svg width={W} height={H} className="block max-w-full">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((g) => (
        <g key={g}>
          <line x1={PAD_L} y1={y(g)} x2={W - PAD_R} y2={y(g)} stroke="var(--color-line)" strokeOpacity="0.05" strokeWidth="1" />
          <text x={PAD_L - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="var(--color-muted)">
            {Math.round(g * 10) / 10}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#chartFill)" />
      {ghost &&
        ghost.map((v, i) => {
          if (v == null) return null
          return (
            <g key={`ghost-${i}`}>
              <line
                x1={x(i)}
                y1={y(v)}
                x2={x(i)}
                y2={y(values[i])}
                stroke="var(--color-sub)"
                strokeOpacity="0.35"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle cx={x(i)} cy={y(v)} r={3} fill="var(--color-sub)" opacity={0.3} />
              <text x={x(i)} y={y(v) - 7} textAnchor="middle" fontSize="9" fill="var(--color-muted)">
                {v}
              </text>
            </g>
          )
        })}
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === values.length - 1 ? 5 : 3.5}
          fill={i === values.length - 1 ? 'var(--color-accent)' : 'var(--color-bg)'}
          stroke="var(--color-accent)"
          strokeWidth="2"
        />
      ))}
      {series.map((p, i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 6}
          textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
          fontSize="9"
          fill="var(--color-muted)"
        >
          {p.label}
        </text>
      ))}
      <text
        x={x(values.length - 1)}
        y={y(values[values.length - 1]) - 10}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill="var(--color-ink)"
      >
        {values[values.length - 1]}
      </text>
      </svg>
    </div>
  )
}

// Rebuild why the progression guard limited a session's weight, so the
// "limited" chip can explain itself in a popup. Mirrors lib/integrity.js.
function capReason(s, sessions) {
  const prevBest = Math.max(
    0,
    ...sessions
      .filter((x) => x.exercise === s.exercise && x.full && x.full < s.full)
      .map((x) => x.weight ?? 0),
  )
  const rules = rulesFor(s.exercise)
  const cap = maxAllowedWeight(prevBest, s.exercise)
  if (!prevBest) {
    return {
      rules,
      prevBest,
      text: `This was your first logged session for ${s.exercise} — with no history to verify against, ${rules.label.toLowerCase()} entries start capped at ${rules.firstCap} kg. Keep training and the limit grows with you.`,
    }
  }
  if (cap === rules.ceiling) {
    return {
      rules,
      prevBest,
      text: `You've reached the absolute ceiling for ${rules.label.toLowerCase()} exercises (${rules.ceiling} kg) — that's world-record territory, so nothing beyond it counts.`,
    }
  }
  return {
    rules,
    prevBest,
    text: `Your previous best was ${prevBest} kg, and a single session can grow by at most +${rules.step} kg or +${Math.round((rules.factor - 1) * 100)}% (whichever is bigger). That capped this entry at ${cap} kg.`,
  }
}

export default function ProgressScreen() {
  const store = useStore()
  const nav = useNav()
  const auth = useAuth()
  const [exercise, setExercise] = useState('')
  const [exQuery, setExQuery] = useState('')
  const [exOpen, setExOpen] = useState(false)
  const [liveRows, setLiveRows] = useState(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [profileUser, setProfileUser] = useState(null)
  const [calCursor, setCalCursor] = useState(() => firstOfMonth(new Date()))
  const [capInfo, setCapInfo] = useState(null)
  const authDialog = useDialog()

  // Debug: set localStorage 'pulse.debug.fakeLimit' to '1' and reload to
  // preview the limiter UI without earning one — the newest weighted session
  // is DISPLAYED as capped (entered = cap + 30 kg). Nothing is written to the
  // store or Supabase; delete the flag to go back to normal.
  const fakeLimit =
    typeof localStorage !== 'undefined' && localStorage.getItem('pulse.debug.fakeLimit') === '1'
  const sessions = useMemo(() => {
    if (!fakeLimit || store.sessions.length === 0) return store.sessions
    const idx = Math.max(0, store.sessions.findIndex((x) => (x.weight ?? 0) > 0))
    const anchor = store.sessions[idx]
    const prevBest = Math.max(
      0,
      ...store.sessions
        .filter((x) => x.exercise === anchor.exercise && x.full < anchor.full)
        .map((x) => x.weight ?? 0),
    )
    const cap = maxAllowedWeight(prevBest, anchor.exercise)
    const fake = {
      ...anchor,
      weight: cap,
      capped: true,
      entered: Math.round(cap + 30),
      pr: cap >= prevBest && cap > 0,
    }
    return store.sessions.map((x, i) => (i === idx ? fake : x))
  }, [fakeLimit, store.sessions])
  const exOptions = useMemo(
    () => exerciseOptions(store.days, sessions),
    [store.days, sessions],
  )
  const defaultExercise = (() => {
    const last = store.lastActiveExercise
    return last && exOptions.includes(last) ? last : ''
  })()

  // Only exercises actually done (logged sessions), most recent first —
  // the picker is a search over this list, not the full plan.
  const doneOptions = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const s of sessions) {
      if (!s.exercise || seen.has(s.exercise)) continue
      seen.add(s.exercise)
      out.push(s.exercise)
    }
    return out
  }, [sessions])
  const exMatches = useMemo(() => {
    const q = exQuery.trim().toLowerCase()
    return q ? doneOptions.filter((e) => e.toLowerCase().includes(q)) : doneOptions
  }, [doneOptions, exQuery])

  const current = exercise || defaultExercise || doneOptions[0] || exOptions[0] || 'Bench Press'

  // Workout calendar: which days had a session logged. Session dates are
  // stored as 'YYYY-MM-DD' strings (see store.jsx), matching dayKey format.
  const doneDates = useMemo(() => new Set(sessions.map((s) => s.full).filter(Boolean)), [sessions])
  const monthDoneCount = useMemo(() => {
    const year = calCursor.getFullYear()
    const month = calCursor.getMonth()
    let n = 0
    for (const k of doneDates) {
      const t = new Date(`${k}T00:00:00`)
      if (t.getFullYear() === year && t.getMonth() === month) n += 1
    }
    return n
  }, [doneDates, calCursor])
  const monthLabel = calCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const exSessions = sessions.filter((s) => s.exercise === current)
  const chart = useMemo(() => [...exSessions].reverse(), [exSessions])
  const bestWeight = useMemo(
    () => Math.max(0, ...exSessions.map((s) => s.weight ?? 0)),
    [exSessions],
  )
  const bestReps = useMemo(() => {
    const w = Math.max(0, ...exSessions.map((s) => s.weight ?? 0))
    if (w === 0) return 0
    return Math.max(0, ...exSessions.filter((s) => (s.weight ?? 0) === w).map((s) => s.reps ?? 0))
  }, [exSessions])
  const first = exSessions.length ? exSessions[exSessions.length - 1].weight : 0
  const gain = bestWeight - first
  const gainPct = first > 0 ? Math.round((gain / first) * 1000) / 10 : 0

  useEffect(() => {
    if (!supabase || !auth.user) {
      setLiveRows(null)
      setLiveLoading(false)
      return
    }
    setLiveLoading(true)
    setLiveRows(null)
    let active = true
    const load = async () => {
      try {
        const top = await fetchTopLifts(supabase, current, 10)
        if (!top.find((l) => l.user_id === auth.user.id)) {
          const w = await fetchUserLift(supabase, auth.user.id, current)
          if (w > 0) top.push({ user_id: auth.user.id, weight: w })
        }
        const ids = [...new Set(top.map((l) => l.user_id))]
        const profileMap = await fetchProfiles(supabase, ids).catch(() => ({}))
        if (active) {
          setLiveRows(buildRows(top, auth.user.id, profileMap))
          setLiveLoading(false)
        }
      } catch {
        if (active) setLiveLoading(false)
      }
    }
    load()
    const channel = supabase
      .channel(`lifts:progress:${current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lifts', filter: `exercise=eq.${current}` },
        () => load(),
      )
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [current, auth.user])

  const lbRows = useMemo(() => {
    if (liveRows) return liveRows
    if (auth.user && liveLoading) return null
    return leaderboardFor(current, bestWeight)
  }, [liveRows, liveLoading, auth.user, current, bestWeight])

  return (
    <Screen activeTab="progress">
      <div className="relative">
        <div
          className={`flex flex-col gap-5 ${
            !auth.user ? 'pointer-events-none select-none blur-[10px]' : ''
          }`}
        >
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold text-ink">Progress</h1>
          <span className="text-[12px] text-faint">{current} · last {exSessions.length} {exSessions.length === 1 ? 'session' : 'sessions'}</span>
        </div>

        <div className="relative">
          <span className="mb-1.5 block text-[14px] font-medium text-sub">Exercise</span>
          <div className="relative">
            <Search
              size={15}
              color="var(--color-faint)"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              value={exQuery}
              placeholder={current}
              onChange={(e) => {
                setExQuery(e.target.value)
                setExOpen(true)
              }}
              onFocus={() => setExOpen(true)}
              onBlur={() => setExOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && exMatches[0]) {
                  setExercise(exMatches[0])
                  setExQuery('')
                  setExOpen(false)
                  e.currentTarget.blur()
                } else if (e.key === 'Escape') {
                  setExOpen(false)
                  e.currentTarget.blur()
                }
              }}
              className="h-9 w-full rounded-[12px] bg-card pl-9 pr-3 text-[13px] text-ink placeholder:text-sub shadow-[0px_2px_6px_0px_#0000000F] outline outline-1 outline-transparent focus:outline-accent/50"
            />
          </div>
          {exOpen && (
            <div className="glass-panel absolute inset-x-0 top-[70px] z-10 max-h-[280px] overflow-y-auto rounded-[24px] bg-card p-1.5 shadow-[0px_12px_32px_0px_#00000040] outline outline-1 outline-line/10">
              {exMatches.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-3 py-4 text-center">
                  <Dumbbell size={16} color="var(--color-muted)" />
                  <span className="text-[12px] text-faint">
                    {doneOptions.length === 0
                      ? 'No workouts logged yet — finish one to see exercises here'
                      : `Nothing you've done matches “${exQuery.trim()}”`}
                  </span>
                </div>
              ) : (
                exMatches.map((e) => {
                  const active = e === current
                  return (
                    <button
                      key={e}
                      onMouseDown={(ev) => {
                        ev.preventDefault()
                        setExercise(e)
                        setExQuery('')
                        setExOpen(false)
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-left text-[13px] ${
                        active ? 'bg-accent/15 text-accent' : 'text-sub'
                      }`}
                    >
                      {active ? (
                        <Check size={16} color="var(--color-accent)" strokeWidth={2.5} />
                      ) : (
                        <Dumbbell size={16} color="var(--color-faint)" />
                      )}
                      {e}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-accent/15">
              <Dumbbell size={13} color="var(--color-accent)" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-ink">{bestWeight} kg</span>
              <span className="text-[10px] text-faint">Best Weight</span>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-accent/15">
              <Repeat size={13} color="var(--color-accent)" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-ink">{bestReps} reps</span>
              <span className="text-[10px] text-faint">Best Reps</span>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-accent/15">
              <CalendarCheck size={13} color="var(--color-accent)" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-ink">{exSessions.length}</span>
              <span className="text-[10px] text-faint">Sessions</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">Weight (kg)</span>
            <span className="rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-medium text-good">
              +{gainPct}%
            </span>
          </div>
          <span className="text-[11px] text-faint">
            {first} → {bestWeight} across {exSessions.length} {exSessions.length === 1 ? 'session' : 'sessions'}
          </span>
          {chart.length > 0 ? (
            <WeightChart series={chart.map((s) => ({ label: s.date, v: s.weight, entered: s.entered }))} />
          ) : (
            <div className="flex flex-col items-center gap-1 py-6 text-center">
              <Dumbbell size={18} color="var(--color-muted)" />
              <span className="text-[12px] text-faint">
                No {current} sessions yet — finish a workout to log your first one
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface px-4 py-4 outline outline-1 outline-line/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
                <Trophy size={15} color="var(--color-accent)" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-ink">Leaderboard</span>
                <span className="text-[11px] text-faint">{current} · All time</span>
              </div>
            </div>
          </div>
          <div className="relative">
            <div
              className={`flex flex-col gap-2.5 ${
                !auth.user ? 'pointer-events-none select-none blur-[8px]' : ''
              }`}
            >
              {!lbRows ? (
                <div className="py-3 text-center">
                  <span className="text-[12px] text-faint">Loading leaderboard…</span>
                </div>
              ) : (
                lbRows.slice(0, 4).map((r) => (
                  <button
                    key={r.name}
                    onClick={() =>
                      r.user_id &&
                      setProfileUser({ user_id: r.user_id, nickname: r.name, pfp: r.avatar })
                    }
                    className="flex items-center gap-3 text-left"
                  >
                    <span className={`w-6 text-center text-[13px] ${r.you ? 'font-bold text-accent' : 'text-faint'}`}>
                      {r.rank}
                    </span>
                    <DecoratedAvatar
                      decoration={r.decoration}
                      initials={initialsOf(r.name)}
                      color={r.color}
                      size={26}
                      src={r.avatar}
                    />
                    <div className="flex flex-1 flex-col leading-tight">
                      <span className="flex items-center gap-1 text-[13px] font-medium text-ink">
                        {r.name}
                        {r.isAdmin && <ShieldCheck size={11} color="var(--color-accent)" />}
                      </span>
                      <span className="text-[11px] text-muted">{r.handle}</span>
                    </div>
                    <span className="text-[13px] font-semibold text-accent">{r.weight} kg</span>
                  </button>
                ))
              )}
            </div>

            {!auth.user && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                  <Lock size={16} color="var(--color-accent)" />
                </div>
                <span className="text-[13px] font-semibold text-ink">
                  Log in to view the leaderboard
                </span>
                <button
                  onClick={authDialog.openDialog}
                  className="mt-0.5 h-9 rounded-[12px] bg-accent px-4 text-[13px] font-semibold text-white"
                >
                  Log in
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => nav.go('leaderboard', { ex: current })}
            className="flex items-center gap-1 self-end text-[12px] text-accent"
          >
            View full leaderboard
            <ArrowRight size={12} color="var(--color-accent)" />
          </button>
        </div>

        <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10 md:w-0">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">Recent Sessions</span>
            <span className="text-[11px] text-faint">{current}</span>
          </div>
          <div className="flex max-h-[176px] flex-col gap-2.5 overflow-y-auto md:max-h-none md:min-h-0 md:flex-1">
          {exSessions.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-5 text-center">
              <CalendarCheck size={18} color="var(--color-muted)" />
              <span className="text-[12px] text-faint">No sessions yet for {current}</span>
            </div>
          )}
          {exSessions.map((s, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-line/5 pt-2.5 first:border-t-0 first:pt-0">
              <div className="flex flex-1 flex-col leading-tight">
                <span className="text-[13px] font-semibold text-ink">{s.date}</span>
                <span className="text-[11px] text-muted">
                  {s.sets} sets × {s.reps} reps @ {s.weight} kg
                </span>
              </div>
              {s.pr && (
                <span className="rounded-full bg-accent/15 px-1 py-0.5 text-[11px] font-medium text-accent">
                  PR
                </span>
              )}
              {s.capped && (
                <button
                  type="button"
                  onClick={() => setCapInfo(s)}
                  title="Why was this weight limited?"
                  className="flex cursor-pointer items-center gap-0.5 rounded-full bg-tile px-1 py-0.5 text-[10px] font-medium text-faint transition-colors active:bg-line/10"
                >
                  <ShieldCheck size={9} color="var(--color-faint)" />
                  limited
                </button>
              )}
              <div
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${
                  s.pr ? 'bg-good/15' : 'bg-line/5'
                }`}
              >
                <span className="text-[10px] text-good">✓</span>
              </div>
            </div>
          ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10 md:w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
                <CalendarCheck size={15} color="var(--color-accent)" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-ink">Workout Calendar</span>
                <span className="text-[11px] text-faint">
                  {monthDoneCount} workout {monthDoneCount === 1 ? 'day' : 'days'} in {monthLabel}
                </span>
              </div>
            </div>
            <button
              onClick={() => nav.go('calendar')}
              className="flex items-center gap-1 text-[12px] text-accent"
            >
              Full calendar
              <ArrowRight size={12} color="var(--color-accent)" />
            </button>
          </div>
          <WorkoutCalendar
            compact
            cursor={calCursor}
            onCursor={setCalCursor}
            doneDates={doneDates}
            lockNext
          />
        </div>
        </div>
        </div>

        {!auth.user && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
              <Lock size={20} color="var(--color-accent)" />
            </div>
            <span className="text-[14px] font-semibold text-ink">Log in to see your progress</span>
            <span className="text-[12px] text-faint">
              Your plan, lifts and stats are stored in your account
            </span>
            <button
              onClick={authDialog.openDialog}
              className="mt-1 h-11 rounded-[14px] bg-accent px-6 text-[14px] font-semibold text-white"
            >
              Log in
            </button>
          </div>
        )}
      </div>

      {profileUser && (
        <ProfileView
          user={profileUser}
          isYou={profileUser.user_id === auth.user?.id}
          onClose={() => setProfileUser(null)}
          onPickExercise={(ex) => {
            setProfileUser(null)
            nav.go('leaderboard', { ex })
          }}
        />
      )}

      <AuthModal open={authDialog.open} onClose={authDialog.closeDialog} />

      <Modal open={!!capInfo} onClose={() => setCapInfo(null)}>
        {capInfo && (() => {
          const reason = capReason(capInfo, sessions)
          return (
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                    <ShieldCheck size={17} color="var(--color-accent)" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[16px] font-semibold text-soft">Why was this weight limited?</span>
                    <span className="text-[12px] text-muted">
                      {capInfo.exercise} · {capInfo.date}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setCapInfo(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
                >
                  <X size={15} color="var(--color-sub)" />
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex flex-1 flex-col gap-0.5 rounded-[16px] bg-surface px-3.5 py-3 outline outline-1 outline-line/10">
                  <span className="text-[11px] text-muted">You entered</span>
                  <span className="text-[16px] font-bold text-soft line-through decoration-line/40">
                    {capInfo.entered ?? capInfo.weight} kg
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-0.5 rounded-[16px] bg-accent/10 px-3.5 py-3 outline outline-1 outline-accent/20">
                  <span className="text-[11px] text-accent">Counted as</span>
                  <span className="text-[16px] font-bold text-accent">{capInfo.weight} kg</span>
                </div>
              </div>

              <p className="text-[13px] leading-relaxed text-sub">{reason.text}</p>

              <div className="flex flex-col gap-1.5 rounded-[16px] bg-surface px-3.5 py-3 outline outline-1 outline-line/10">
                <span className="text-[11px] font-semibold tracking-[1.2px] text-muted">
                  {reason.rules.label.toUpperCase()} PROGRESSION RULES
                </span>
                <span className="text-[12px] text-sub">First entry cap: {reason.rules.firstCap} kg</span>
                <span className="text-[12px] text-sub">
                  Per-session growth: +{reason.rules.step} kg or +{Math.round((reason.rules.factor - 1) * 100)}%
                </span>
                <span className="text-[12px] text-sub">Absolute ceiling: {reason.rules.ceiling} kg</span>
              </div>

              <button
                onClick={() => setCapInfo(null)}
                className="h-11 rounded-[14px] bg-accent text-[14px] font-semibold text-white"
              >
                Got it
              </button>
            </div>
          )
        })()}
      </Modal>
    </Screen>
  )
}
