import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft } from 'lucide-react'
import { useStore } from '../lib/store'
import { Screen, useNav } from '../components/ui'
import { dateKey, firstOfMonth } from '../lib/data'
import { WorkoutCalendar, PlanDayPicker } from '../components/Calendar'

export default function CalendarScreen() {
  const store = useStore()
  const nav = useNav()
  const [cursor, setCursor] = useState(() => firstOfMonth(new Date()))
  const [pickDate, setPickDate] = useState(null)

  const doneDates = useMemo(
    () => new Set(store.sessions.map((s) => s.full).filter(Boolean)),
    [store.sessions],
  )
  const daysById = useMemo(() => Object.fromEntries(store.days.map((d) => [d.id, d])), [store.days])

  const monthDoneCount = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    let n = 0
    for (const k of doneDates) {
      const t = new Date(`${k}T00:00:00`)
      if (t.getFullYear() === year && t.getMonth() === month) n += 1
    }
    return n
  }, [doneDates, cursor])

  return (
    <Screen activeTab="home">
      <div className="flex flex-col gap-5 md:mx-auto md:w-full md:max-w-[520px]">
        <div className="flex items-center gap-3">
          <button onClick={() => nav.go('home')} className="flex h-9 w-9 items-center justify-center rounded-3xl">
            <ChevronLeft size={18} color="var(--color-ink)" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold text-ink">Calendar</h1>
            <span className="text-[12px] text-faint">Plan workouts & see your history</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
              <CalendarDays size={15} color="var(--color-accent)" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-ink">
                {monthDoneCount} workout {monthDoneCount === 1 ? 'day' : 'days'} this month
              </span>
              <span className="text-[11px] text-faint">Tap any day to plan a workout for it</span>
            </div>
          </div>
          <WorkoutCalendar
            cursor={cursor}
            onCursor={setCursor}
            doneDates={doneDates}
            plan={store.plan}
            daysById={daysById}
            onPickDay={(date) => setPickDate(date)}
            tutorial="calendar-grid"
          />
        </div>

        <span className="text-center text-[11px] text-muted">
          Tap any date to plan which workout day you'll do
        </span>
      </div>

      <PlanDayPicker
        date={pickDate}
        days={store.days}
        currentId={pickDate ? store.plan[dateKey(pickDate)] ?? null : null}
        onPick={(dayId) => {
          if (pickDate) store.setPlan(dateKey(pickDate), dayId)
          setPickDate(null)
        }}
        onClose={() => setPickDate(null)}
      />
    </Screen>
  )
}
