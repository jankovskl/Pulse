import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, Dumbbell, Lock } from 'lucide-react'
import { exerciseOptions, leaderboardFor } from '../lib/data'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchTopLifts, buildRows } from '../lib/leaderboard'
import { fetchProfiles } from '../lib/profile'
import AuthModal from '../components/AuthModal'
import { Avatar, initialsOf, Screen, useDialog, useNav } from '../components/ui'

export default function LeaderboardScreen() {
  const nav = useNav()
  const store = useStore()
  const auth = useAuth()
  const authDialog = useDialog()
  const [exercise, setExercise] = useState(nav.ex || '')
  const [open, setOpen] = useState(false)
  const [liveRows, setLiveRows] = useState(null)

  const exOptions = useMemo(
    () => exerciseOptions(store.days, store.sessions),
    [store.days, store.sessions],
  )
  const current = exercise || exOptions[0] || 'Bench Press'

  const exSessions = useMemo(
    () => store.sessions.filter((s) => s.exercise === current),
    [store.sessions, current],
  )
  const userBest = useMemo(
    () => Math.max(0, ...exSessions.map((s) => s.weight ?? 0)),
    [exSessions],
  )

  // When signed in, pull real lifts (and keep them live via realtime).
  useEffect(() => {
    if (!supabase || !auth.user) {
      setLiveRows(null)
      return
    }
    let active = true
    const load = async () => {
      try {
        const top = await fetchTopLifts(supabase, current)
        const ids = top.map((l) => l.user_id)
        const profileMap = await fetchProfiles(supabase, ids).catch(() => ({}))
        if (active) setLiveRows(buildRows(top, auth.user.id, profileMap))
      } catch {}
    }
    load()
    const channel = supabase
      .channel(`lifts:${current}`)
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

  const rows = useMemo(
    () => (liveRows ? liveRows : leaderboardFor(current, userBest)),
    [liveRows, current, userBest],
  )
  const hasUser = rows.some((r) => r.you)
  const top3 = rows.slice(0, 3).filter(Boolean)
  const rest = rows.slice(3)

  return (
    <Screen activeTab="progress">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav.go('progress')}
            className="flex h-9 w-9 items-center justify-center rounded-3xl"
          >
            <ChevronLeft size={18} color="var(--color-ink)" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold text-ink">Leaderboard</h1>
            <span className="text-[12px] text-faint">{current} · 1RM max lifts · Worldwide</span>
          </div>
        </div>

        <div className="relative">
          <span className="mb-1.5 block text-[10px] font-semibold tracking-[1px] text-muted">
            EXERCISE
          </span>
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

        {!auth.user ? (
          <p className="text-[11px] leading-relaxed text-faint">
            Log in to see real lifts from athletes worldwide.
          </p>
        ) : (
          !hasUser && (
            <p className="text-[11px] leading-relaxed text-faint">
              Log a {current} workout to place your best lift on this board.
            </p>
          )
        )}

        <div className="relative">
          <div
            className={`flex flex-col gap-5 ${
              !auth.user ? 'pointer-events-none select-none blur-[8px]' : ''
            }`}
          >
            <div className="flex items-end justify-center gap-2.5 pt-4">
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((r) => (
                <div key={r.name} className="flex w-[92px] flex-col items-center">
                  <span className="mb-1.5 text-[11px] font-semibold text-faint">
                    {r.name.split(' ')[0]}
                  </span>
                  <div
                    className={`flex w-full flex-col items-center justify-end rounded-[20px] outline outline-1 ${
                      r.rank === 1
                        ? 'h-[104px] bg-gradient-to-b from-[#F5A52422] to-transparent outline-[#F5A52440]'
                        : r.rank === 2
                          ? 'h-[84px] bg-gradient-to-b from-[#A1A1AA22] to-transparent outline-[#A1A1AA40]'
                          : 'h-[64px] bg-gradient-to-b from-[#B08D5722] to-transparent outline-[#B08D5740]'
                    }`}
                  >
                    <Avatar initials={initialsOf(r.name)} color={r.color} size={30} src={r.avatar} />
                    <span className="mt-1 text-[13px] font-bold text-ink">{r.weight}</span>
                  </div>
                  <span
                    className={`mt-1.5 text-[15px] ${
                      r.rank === 1 ? 'text-gold' : r.rank === 2 ? 'text-silver' : 'text-bronze'
                    }`}
                  >
                    {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {rest.map((r) => (
                <div
                  key={r.name}
                  className={`flex items-center gap-3 rounded-[16px] px-3.5 py-3 ${
                    r.you
                      ? 'bg-accent/15 outline outline-1 outline-accent/40'
                      : 'bg-surface outline outline-1 outline-line/10'
                  }`}
                >
                  <span
                    className={`w-5 text-center text-[13px] ${r.you ? 'font-bold text-accent' : 'text-faint'}`}
                  >
                    {r.rank}
                  </span>
                  <Avatar initials={initialsOf(r.name)} color={r.color} size={30} src={r.avatar} />
                  <div className="flex flex-1 flex-col leading-tight">
                    <span className="text-[14px] font-medium text-ink">{r.name}</span>
                    <span className="text-[11px] text-muted">{r.handle}</span>
                  </div>
                  <span className={`text-[14px] font-semibold ${r.you ? 'text-accent' : 'text-ink'}`}>
                    {r.weight} kg
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!auth.user && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
                <Lock size={20} color="var(--color-accent)" />
              </div>
              <span className="text-[14px] font-semibold text-ink">Log in to view the leaderboard</span>
              <span className="text-[12px] text-faint">See real lifts from athletes worldwide</span>
              <button
                onClick={authDialog.openDialog}
                className="mt-1 h-11 rounded-[14px] bg-accent px-6 text-[14px] font-semibold text-white"
              >
                Log in
              </button>
            </div>
          )}
        </div>
      </div>

      <AuthModal open={authDialog.open} onClose={authDialog.closeDialog} />
    </Screen>
  )
}