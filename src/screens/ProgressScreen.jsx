import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarCheck, Check, ChevronDown, Dumbbell, Lock, Repeat, Trophy } from 'lucide-react'
import { exerciseOptions, leaderboardFor } from '../lib/data'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchTopLifts, buildRows, fetchUserLift } from '../lib/leaderboard'
import { fetchProfiles } from '../lib/profile'
import AuthModal from '../components/AuthModal'
import { Avatar, initialsOf, Screen, useDialog, useNav } from '../components/ui'

function WeightChart({ series }) {
  if (!series || series.length === 0) return null
  const W = 320
  const H = 180
  const PAD_L = 30
  const PAD_B = 24
  const PAD_T = 14
  const PAD_R = 12

  const values = series.map((p) => p.v)
  const lo = Math.min(...values) - 2
  const hi = Math.max(...values) + 2

  const x = (i) => (series.length === 1 ? (W - PAD_L - PAD_R) / 2 + PAD_L : PAD_L + (i * (W - PAD_L - PAD_R)) / (series.length - 1))
  const y = (v) => PAD_T + ((hi - v) / (hi - lo)) * (H - PAD_T - PAD_B)

  const head = series.length === 1 ? `M${x(0)},${y(values[0])}` : ''
  const line = series.length === 1 ? head : values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  const area = `${line} L${x(values.length - 1)},${H - PAD_B} L${x(0)},${H - PAD_B} Z`

  const ticks = [0, 1, 2, 3, 4].map((t) => lo + ((hi - lo) * t) / 4)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
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
  )
}

export default function ProgressScreen() {
  const store = useStore()
  const nav = useNav()
  const auth = useAuth()
  const [exercise, setExercise] = useState('')
  const [open, setOpen] = useState(false)
  const [liveRows, setLiveRows] = useState(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const authDialog = useDialog()

  const sessions = store.sessions
  const exOptions = useMemo(
    () => exerciseOptions(store.days, sessions),
    [store.days, sessions],
  )
  const defaultExercise = (() => {
    const last = store.lastActiveExercise
    return last && exOptions.includes(last) ? last : ''
  })()
  const current = exercise || defaultExercise || exOptions[0] || 'Bench Press'

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
          <button
            onClick={() => setOpen(!open)}
            className="flex h-9 w-full items-center justify-between rounded-[12px] bg-card px-3 shadow-[0px_2px_6px_0px_#0000000F]"
          >
            <span className="text-[13px] text-sub">{current}</span>
            <ChevronDown size={16} color="var(--color-faint)" />
          </button>
          {open && (
            <div className="absolute inset-x-0 top-[70px] z-10 rounded-[24px] bg-card p-1.5 shadow-[0px_12px_32px_0px_#00000040] outline outline-1 outline-line/10">
              {exOptions.map((e) => {
                const active = e === current
                return (
                  <button
                    key={e}
                    onClick={() => {
                      setExercise(e)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-[13px] ${
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
              })}
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
            <WeightChart series={chart.map((s) => ({ label: s.date, v: s.weight }))} />
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
                  <div key={r.name} className="flex items-center gap-3">
                    <span className={`w-6 text-center text-[13px] ${r.you ? 'font-bold text-accent' : 'text-faint'}`}>
                      {r.rank}
                    </span>
                    <Avatar initials={initialsOf(r.name)} color={r.color} size={26} src={r.avatar} />
                    <div className="flex flex-1 flex-col leading-tight">
                      <span className="text-[13px] font-medium text-ink">{r.name}</span>
                      <span className="text-[11px] text-muted">{r.handle}</span>
                    </div>
                    <span className="text-[13px] font-semibold text-accent">{r.weight} kg</span>
                  </div>
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

        <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">Recent Sessions</span>
            <span className="text-[11px] text-faint">{current}</span>
          </div>
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

      <AuthModal open={authDialog.open} onClose={authDialog.closeDialog} />
    </Screen>
  )
}
