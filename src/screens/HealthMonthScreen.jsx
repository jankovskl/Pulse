// Month view for sleep data – GitHub-style heatmap grid.
// Tinted squares per-night sleep score (red→green gradient, same as the
// overview calendar) with a weekly score and monthly average beneath.
// Tapping a square opens the sleep log sheet.

import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { dateKey } from '../lib/data'
import { useNav } from '../components/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { sleepMap, weekOf, sleepHoursOf, sleepScoreForLog, sleepColor } from '../screens/sleepUtils'

import { SleepSheet } from './SleepScreen'

function getSleepColor(hours) {
  if (hours === undefined) return undefined
  if (hours <= 4) return 'rgba(200,220,255,0.3)'
  if (hours <= 8) return 'rgba(150,190,255,0.5)'
  return 'rgba(100,150,255,0.7)'
}

export default function HealthMonthScreen() {
  const store = useStore()
  const nav = useNav()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetDate, setSheetDate] = useState(null)
  const today = new Date()

  // Navigable month cursor – starts at current month
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(monthStart)
    d.setDate(i + 1)
    return d
  })

  const sm = useMemo(() => sleepMap(store.sleep), [store.sleep])
  const goal = store.settings.sleepGoal ?? 8
  const ideal = store.settings.idealSleepOnset ?? '23:00'

  // Per-night combined score (duration × timing × caffeine) — feeds the
  // weekly score.
  const scoreMap = useMemo(() => {
    const m = {}
    if (Array.isArray(store.sleep)) {
      store.sleep.forEach((s) => {
        if (s && typeof s.hours === 'number') m[s.date] = sleepScoreForLog(s, goal, ideal, store.caffeine)
      })
    }
    return m
  }, [store.sleep, goal, ideal, store.caffeine])

  // Sums over the month for the summary card
  const monthStats = useMemo(() => {
    const localMonthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const inThisMonth = (d) =>
      d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()
    const count = dates.filter((d) => sm[dateKey(d)] != null).length
    const total = dates.reduce((s, d) => {
      const h = sm[dateKey(d)]
      return s + (typeof h === 'number' ? h : 0)
    }, 0)
    const avg = count > 0 ? total / count : 0

    // Weekly score: mean of each night's combined score (duration × timing)
    // across the weeks in this month; unlogged nights count as 0.
    const weeklyScores = []
    let weekStart = new Date(localMonthStart)
    while (weekStart.getMonth() === cursor.getMonth() || inThisMonth(weekStart)) {
      const days = weekOf(weekStart).filter(inThisMonth)
      const weekTotal = days.reduce((s, d) => s + (scoreMap[dateKey(d)] ?? 0), 0)
      const weekAvg = days.length > 0 ? weekTotal / days.length : 0
      weeklyScores.push(Math.round(weekAvg))
      weekStart = new Date(weekStart)
      weekStart.setDate(weekStart.getDate() + 7)
      if (days.length > 0 && !inThisMonth(days[days.length - 1])) break
    }
    const weeklyScore = weeklyScores.length > 0
      ? Math.round(weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length)
      : 0

    return { avg: Math.round(avg * 10) / 10, count, weeklyScore }
  }, [sm, scoreMap, dates, cursor])

  function openSheet(date, key) {
    setSheetDate(key)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setSheetDate(null)
  }

  function saveForDate(key, { bedtime, wake }) {
    const hours = sleepHoursOf(bedtime, wake)
    const existing = store.sleep.find((s) => s.date === key)
    if (existing) {
      store.updateSleepLog(key, { hours, bedtime, wake })
    } else {
      store.addSleepLog(key, { hours, bedtime, wake })
    }
  }

  function moveMonth(delta) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
  }

  const sheetLog = sheetDate
    ? store.sleep.find((s) => s.date === sheetDate) ?? null
    : null

  const sheetProps = sheetDate
    ? {
        open: sheetOpen,
        bedKey: sheetDate,
        bedtime: sheetLog?.bedtime ?? '23:00',
        wake: sheetLog?.wake ?? '07:00',
        onDelete: sheetLog ? () => store.removeSleepLog(sheetDate) : null,
        onClose: closeSheet,
        onSave: ({ bedtime, wake }) =>
          saveForDate(sheetDate, { bedtime, wake }),
      }
    : null

  const label = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-4 p-4" data-tutorial="health-month-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => nav.go('health')}
          className="flex items-center gap-1.5 rounded-[24px] bg-tile px-3 py-1"
        >
          <ChevronLeft size={13} color="var(--color-accent)" />
          <span className="text-[12px] font-medium text-soft">Back</span>
        </button>
        <h2 className="text-[18px] font-semibold text-soft">{label}</h2>
        <button
          onClick={() => moveMonth(1)}
          disabled={cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()}
          className="flex items-center justify-center rounded-full bg-tile disabled:opacity-40 h-7 w-7"
          title="Next month"
        >
          <ChevronRight size={13} color="var(--color-sub)" />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
          <span key={i} className="text-center text-[10px] font-semibold text-muted pb-0.5">{w}</span>
        ))}
      </div>

      {/* Heatmap grid – includes leading blanks for correct weekday alignment */}
      {(() => {
        const lead = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7
        const cells = []
        for (let i = 0; i < lead; i++) cells.push(null)
        dates.forEach((d) => cells.push(d))
        return (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) =>
              d ? (
                <button
                  key={dateKey(d)}
                  className="h-5 w-5 rounded-sm"
                  style={{
                    background: (() => {
                      const key = dateKey(d)
                      const score = scoreMap[key]
                      if (score != null) return sleepColor(score)
                      const c = getSleepColor(sm[key])
                      return c ?? 'var(--color-tile)'
                    })(),
                    border: sm[dateKey(d)] != null ? '1px solid var(--color-line)' : undefined,
                  }}
                  title={sm[dateKey(d)] != null
                    ? `${sm[dateKey(d)]}h · score ${scoreMap[dateKey(d)] ?? '—'}`
                    : 'No data'}
                  onClick={() => openSheet(d, dateKey(d))}
                />
              ) : (
                <div key={`pad-${i}`} />
              ),
            )}
          </div>
        )
      })()}

      {/* Summary */}
      <div className="flex flex-col gap-1 text-center">
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-[20px] font-bold text-soft">{monthStats.weeklyScore}</span>
            <span className="text-[10px] uppercase tracking-[1.2px] text-muted">Weekly score</span>
          </div>
          <div className="h-8 w-px bg-line/20" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[20px] font-bold text-soft">{monthStats.avg}h</span>
            <span className="text-[10px] uppercase tracking-[1.2px] text-muted">Avg sleep</span>
          </div>
          <div className="h-8 w-px bg-line/20" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[20px] font-bold text-soft">{monthStats.count}</span>
            <span className="text-[10px] uppercase tracking-[1.2px] text-muted">Nights logged</span>
          </div>
        </div>
      </div>

      {/* Sleep log sheet */}
      {sheetProps && <SleepSheet {...sheetProps} />}
    </div>
  )
}