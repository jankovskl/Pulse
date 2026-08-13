import { useEffect } from 'react'
import { ArrowRight, CircleCheck, MoonStar, RotateCcw } from 'lucide-react'
import { dateKey, REST_PRESETS } from '../lib/data'
import { fmt, useTimer } from '../lib/timer'
import { useStore } from '../lib/store'
import { Screen, SectionLabel, useNav } from '../components/ui'

export default function TimerScreen() {
  const timer = useTimer()
  const store = useStore()
  const nav = useNav()
  const { total, left, running, paused, session, start, toggle, reset, setDay } = timer

  useEffect(() => {
    if (nav.dayId && session?.dayId !== nav.dayId) setDay(nav.dayId)
  }, [nav.dayId, session, setDay])

  const todayIdx = (new Date().getDay() + 6) % 7
  const scheduledDay = store.days.find((d) => d.weekday && (d.weekday + 6) % 7 === todayIdx)
  const plannedDay =
    store.days.find((d) => d.id === store.plan[dateKey(new Date())]) ?? null
  const sessionDay = session ? store.days.find((d) => d.id === session?.dayId) : null
  const day = sessionDay ?? plannedDay ?? scheduledDay
  const allDone = !!day && !!session && session.exIdx >= day.exercises.length
  const raw = day?.exercises[session?.exIdx]
  const ex = raw && !raw.done ? raw : day?.exercises.find((e) => !e.done)
  const justDone = session?.justCompletedId
    ? day?.exercises.find((e) => e.id === session.justCompletedId)
    : null
  const hint = !session
    ? 'Tap ring to start'
    : !running
      ? 'Tap ring to start'
      : allDone
        ? 'Next: All done · Great session'
        : ex
          ? `Next: ${ex.name} · Set ${session.set} of ${ex.sets}`
          : 'Next set ready'

  const R = 134.75
  const SW = 10.5
  const C = 2 * Math.PI * R
  const frac = total > 0 ? left / total : 0

  return (
    <Screen activeTab="timer">
      <div className="flex flex-col items-center gap-5">
        <h1 className="self-start text-[26px] font-bold text-ink">Rest Timer</h1>

        {day ? (
          <button
            onClick={() => nav.go('day', { dayId: day.id })}
            className="flex w-full items-center gap-3 rounded-[20px] bg-field px-3.5 py-3 text-left outline outline-1 outline-line/10 shadow-[0px_8px_20px_0px_#00000059]"
          >
            <span className="h-10 w-[3px] shrink-0 rounded-full bg-gradient-to-b from-accent to-accent-light" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-[1px] text-muted">TODAY'S SESSION</span>
              <span className="flex items-center gap-2">
                <span className="text-[17px] font-bold text-ink">{day.name}</span>
                <span className="flex items-center gap-1">
                  {day.exercises.map((e) => (
                    <span
                      key={e.id}
                      className={`h-[6px] w-[6px] rounded-full ${e.done ? 'bg-good' : 'bg-line/10'}`}
                    />
                  ))}
                </span>
              </span>
              <span className="text-[11px] font-medium text-sub">
                {day.exercises.filter((e) => e.done).length} of {day.exercises.length} done
              </span>
            </span>
            <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4">
              <ArrowRight size={14} color="#FFFFFF" strokeWidth={2.5} />
              <span className="text-[14px] font-medium text-white">
                {sessionDay ? 'Continue' : 'Start'}
              </span>
            </span>
          </button>
        ) : (
          <div className="flex w-full items-center gap-3 rounded-[20px] bg-field px-3.5 py-3 outline outline-1 outline-line/10 shadow-[0px_8px_20px_0px_#00000059]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-tile">
              <MoonStar size={18} color="var(--color-sub)" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-[1px] text-muted">TODAY</span>
              <span className="text-[17px] font-bold text-ink">Rest day</span>
              <span className="text-[11px] font-medium text-sub">
                No workout scheduled — recovery is training too
              </span>
            </span>
            <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-tile px-4">
              <MoonStar size={14} color="var(--color-sub)" />
              <span className="text-[14px] font-medium text-sub">Rest</span>
            </span>
          </div>
        )}

        <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-hidden rounded-full">
          <svg width="280" height="280" viewBox="0 0 280 280" className="-rotate-90">
            <defs>
              <radialGradient id="ringHalo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.07" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="arcGrad" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-accent)" />
                <stop offset="100%" stopColor="var(--color-accent-light)" />
              </linearGradient>
            </defs>
            <circle cx="140" cy="140" r="140" fill="url(#ringHalo)" />
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--color-ring)" strokeWidth={SW} />
            <circle
              cx="140"
              cy="140"
              r={R}
              fill="none"
              stroke={running ? 'url(#arcGrad)' : 'color-mix(in srgb, var(--color-accent) 15%, transparent)'}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
              style={running ? { filter: 'drop-shadow(0px 0px 16px color-mix(in srgb, var(--color-accent) 40%, transparent))' } : undefined}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <button
            onClick={toggle}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5"
          >
            <span className="rounded-full bg-accent/15 px-3 py-1.5 text-[10px] font-bold tracking-[2px] text-accent">
              {running ? (paused ? 'PAUSED' : 'REST') : left === 0 ? 'DONE' : 'READY'}
            </span>
            <span className="text-[68px] font-semibold leading-none tracking-[-2px] text-ink">{fmt(left)}</span>
            <span className="max-w-[240px] text-center text-[12px] text-faint">{hint}</span>
            {!running && left === 0 && justDone && (
              <span className="mt-0.5 flex items-center gap-1.5 rounded-full bg-good/15 px-3 py-1.5">
                <CircleCheck size={12} color="#17C964" />
                <span className="text-[10px] font-semibold text-good">
                  {justDone.name} done
                </span>
              </span>
            )}
          </button>
        </div>
        <span className="-mt-2 text-[11px] text-muted">
          {running
            ? paused
              ? 'Tap the ring to resume'
              : 'Tap the ring to pause · tap a preset to restart'
            : 'Tap the ring to start · tap a preset to restart'}
        </span>

        <div className="flex w-full flex-col gap-2.5">
          <SectionLabel>QUICK PRESETS</SectionLabel>
          <div className="flex w-full items-center justify-between">
            {REST_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => start(p.sec)}
                className={`flex h-9 items-center justify-center rounded-full px-3.5 outline outline-1 ${
                  total === p.sec && running
                    ? 'bg-accent outline-transparent'
                    : 'bg-tile outline-line/[0.08]'
                }`}
              >
                <span
                  className={`text-[13px] font-semibold ${total === p.sec && running ? 'text-white' : 'text-sub'}`}
                >
                  {p.label}
                </span>
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted">Picking a preset starts the countdown instantly</span>
        </div>

        <div className="flex w-full items-center justify-center">
          <button
            onClick={reset}
            className="flex h-11 items-center gap-2 rounded-full px-6 text-[14px] font-medium text-faint"
          >
            <RotateCcw size={16} color="var(--color-faint)" />
            Reset
          </button>
        </div>
      </div>
    </Screen>
  )
}
