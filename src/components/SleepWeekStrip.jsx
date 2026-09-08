// Flat, compact week strip for sleep tracking.
// Mirrors the home-page week strip layout but shows goal-met dots instead
// of workout-plan color bars.

import { useMemo } from 'react'
import { useStore } from '../lib/store'
import { CalendarDays } from 'lucide-react'
import { useNav } from './ui'
import { dateKey, WEEKDAY_NAMES } from '../lib/data'
import { weekOf, sleepMap } from '../screens/sleepUtils'

function SleepTile({ date, today, goalMet }) {
  const isToday = date.toDateString() === today.toDateString()
  return (
    <button
      className={`flex h-full flex-1 flex-col items-center justify-center gap-[6px] rounded-[16px] ${
        isToday ? 'bg-tile' : 'bg-transparent'
      }`}
    >
      <span className={`text-[9px] font-medium tracking-[0.5px] ${isToday ? 'text-soft' : 'text-sub'}`}>
        {WEEKDAY_NAMES[(date.getDay() + 6) % 7]}
      </span>
      <span className={`text-[14px] font-semibold tabular-nums ${isToday ? 'text-soft' : 'text-sub'}`}>
        {date.getDate()}
      </span>
      <span
        className="h-[5px] w-1.5 rounded-full"
        style={{
          background: goalMet ? 'var(--color-good)' : 'var(--color-muted)',
          opacity: goalMet ? 1 : 0.25,
        }}
      />
    </button>
  )
}

export default function SleepWeekStrip() {
  const store = useStore()
  const nav = useNav()
  const today = new Date()
  const goal = store.settings.sleepGoal ?? 8

  const week = useMemo(() => weekOf(today), [])

  const sm = useMemo(() => sleepMap(store.sleep), [store.sleep])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-soft">Sleep This Week</span>
        <button
          onClick={() => nav.go('health-month')}
          className="flex items-center gap-1.5 rounded-[24px] bg-tile px-3 py-1"
          title="Open month view"
        >
          <CalendarDays size={13} color="var(--color-accent)" />
          <span className="text-[12px] font-medium text-soft">Month</span>
        </button>
      </div>
      <div className="flex h-[72px] gap-1.5 md:h-[90px] md:grid md:grid-cols-7 md:gap-1.5">
        {week.map((date) => {
          const key = dateKey(date)
          const hours = sm[key]
          const goalMet = hours != null && hours >= goal
          return (
            <SleepTile
              key={date.toISOString()}
              date={date}
              today={today}
              goalMet={goalMet}
            />
          )
        })}
      </div>
    </div>
  )
}