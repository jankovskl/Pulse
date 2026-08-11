import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, Dumbbell } from 'lucide-react'
import { exerciseOptions, leaderboardFor } from '../lib/data'
import { useStore } from '../lib/store'
import { Avatar, initialsOf, Screen, useNav } from '../components/ui'

export default function LeaderboardScreen() {
  const nav = useNav()
  const store = useStore()
  const [exercise, setExercise] = useState(nav.ex || '')
  const [open, setOpen] = useState(false)

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
  const rows = useMemo(() => leaderboardFor(current, userBest), [current, userBest])
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <Screen activeTab="progress">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav.go('progress')}
            className="flex h-9 w-9 items-center justify-center rounded-3xl"
          >
            <ChevronLeft size={18} color="#F4F4F6" />
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
            <span className="text-[13px] text-[#C9C9D6]">{current}</span>
            <ChevronDown size={16} color="#9C9CA8" />
          </button>
          {open && (
            <div className="absolute inset-x-0 top-[70px] z-10 rounded-[24px] bg-card p-1.5 shadow-[0px_12px_32px_0px_#00000040] outline outline-1 outline-white/10">
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
                      active ? 'bg-accent/15 text-accent' : 'text-[#C9C9D6]'
                    }`}
                  >
                    {active ? (
                      <Check size={16} color="var(--color-accent)" strokeWidth={2.5} />
                    ) : (
                      <Dumbbell size={16} color="#9C9CA8" />
                    )}
                    {e}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {userBest === 0 && (
          <p className="text-[11px] leading-relaxed text-faint">
            Log a {current} workout to place your best lift on this board — your rank updates
            automatically.
          </p>
        )}

        <div className="flex items-end justify-center gap-2.5 pt-4">
          {[top3[1], top3[0], top3[2]].map((r) => (
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
                <Avatar initials={initialsOf(r.name)} color={r.color} size={30} />
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
                  : 'bg-surface outline outline-1 outline-white/10'
              }`}
            >
              <span
                className={`w-5 text-center text-[13px] ${r.you ? 'font-bold text-accent' : 'text-faint'}`}
              >
                {r.rank}
              </span>
              <Avatar initials={initialsOf(r.name)} color={r.color} size={30} />
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
    </Screen>
  )
}