import { useMemo, useState } from 'react'
import { Activity, CalendarDays, Check, Flame, MoonStar, Plus, Target, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { dateKey, WEEKDAY_NAMES } from '../lib/data'
import { countPlannedInWeek, currentStreakOf, workoutsInWeek } from '../lib/profile'
import { Chip, Modal, Screen, useNav } from '../components/ui'
import { PlanDayPicker } from '../components/Calendar'

function weekOf(today) {
  const monday = new Date(today)
  const day = (today.getDay() + 6) % 7
  monday.setDate(today.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function DayTile({ date, today, onOpen, planned }) {
  const isToday = date.toDateString() === today.toDateString()
  const color = planned ? planned.color : 'var(--color-muted)'
  return (
    <button
      onClick={onOpen}
      className={`flex h-full flex-1 flex-col items-center justify-center gap-[7px] rounded-[20px] ${
        isToday ? 'bg-accent' : 'bg-tile'
      }`}
    >
      <span className={`text-[10px] font-medium tracking-[0.8px] ${isToday ? 'text-white' : 'text-sub'}`}>
        {WEEKDAY_NAMES[(date.getDay() + 6) % 7]}
      </span>
      <span className={`text-[15px] font-semibold ${isToday ? 'text-white' : 'text-soft'}`}>
        {date.getDate()}
      </span>
      <span
        className="h-[4px] w-4 rounded-[2px]"
        style={{ background: color, opacity: isToday ? 0.4 : 1 }}
      />
    </button>
  )
}

const GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

function StreakCard({ streak, done, goal, onEditGoal }) {
  // The goal is plan-derived; training can exceed it, but the number caps at
  // the goal once hit (4/4 stays 4/4 even after 6 trained days).
  const shown = Math.min(done, goal)
  const pct = goal > 0 ? Math.min(1, done / goal) : 0
  const hit = goal > 0 && done >= goal
  return (
    <div className="flex items-center gap-4 rounded-[24px] bg-card p-4 shadow-[0px_2px_4px_0px_#0000000A]">
      <div className="flex shrink-0 items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${
            streak > 0 ? 'bg-accent/15' : 'bg-tile'
          }`}
        >
          <Flame
            size={20}
            color={streak > 0 ? 'var(--color-accent)' : 'var(--color-muted)'}
            strokeWidth={2.25}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold leading-none text-soft">
            {streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'days'}` : 'No streak'}
          </span>
          <span className="text-[11px] text-sub">
            {streak > 0 ? 'current streak' : 'train today to start one'}
          </span>
        </div>
      </div>
      <div className="h-9 w-px shrink-0 bg-line/10" />
      <button onClick={onEditGoal} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-sub">
            <Target size={12} color="var(--color-sub)" />
            Weekly goal
          </span>
          <span
            className={`flex items-center gap-1 text-[12px] font-semibold ${
              hit ? 'text-good' : 'text-soft'
            }`}
          >
            {hit && <Check size={12} color="var(--color-good)" strokeWidth={3} />}
            {shown}/{goal}
          </span>
        </div>
        <div className="h-[6px] w-full overflow-hidden rounded-full bg-tile">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              hit ? 'bg-good' : 'bg-accent'
            }`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <span className="text-[11px] text-sub">
          {goal} planned · {done} trained this week
        </span>
      </button>
    </div>
  )
}

export default function HomeScreen() {
  const store = useStore()
  const nav = useNav()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmShow, setConfirmShow] = useState(false)
  const [pickDate, setPickDate] = useState(null)
  const [editingGoal, setEditingGoal] = useState(false)

  const today = new Date()
  const days = store.days

  const week = useMemo(() => weekOf(new Date()), [])

  // Streak + weekly goal: same grace-day rules as the profile badges, so the
  // card and the achievements never disagree.
  const streak = useMemo(
    () => currentStreakOf(store.sessions.map((s) => s.full).filter(Boolean)),
    [store.sessions],
  )
  const weekDone = useMemo(() => workoutsInWeek(store.sessions), [store.sessions])
  // Plan-derived weekly goal: the count of Planned workouts on the calendar
  // this week (see ADR 0001). The 1–7 setting no longer drives the card.
  const weekPlanned = useMemo(() => countPlannedInWeek(store.plan), [store.plan])
  const weeklyGoal = store.settings.weeklyGoal ?? 4

  const totalExercises = days.reduce((n, d) => n + d.exercises.length, 0)
  const trainingDays = days.filter((d) => d.exercises.length > 0)

  const weekStart = week[0]
  const weekEnd = week[6]
  const dateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const openDay = (d) => nav.go('day', { dayId: d.id })

  const planDay = (date) =>
    days.find((d) => d.id === store.plan[dateKey(date)]) ?? null

  // Rest days = weekdays this week with no planned workout.
  const restWeekdays = week
    .filter((date) => !planDay(date))
    .map((date) => WEEKDAY_NAMES[(date.getDay() + 6) % 7].slice(0, 3))

  function createDay() {
    if (!name.trim()) return
    // weekday stays null — days are scheduled per-date via the calendar,
    // not pinned to a recurring weekday (0 would mean "every Sunday").
    store.addDay(name.trim(), null)
    setCreating(false)
    setName('')
  }

  return (
    <Screen activeTab="home">
      <div className="flex flex-col gap-6" data-tutorial="home-screen">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={18} color="var(--color-accent)" strokeWidth={2.5} />
              <span className="text-[13px] font-semibold text-soft">Pulse</span>
            </div>
          </div>
          <div className="flex flex-col gap-[3px]">
            <h1 className="text-[28px] font-semibold text-soft">My Split</h1>
            <p className="text-[13px] text-sub">
              {trainingDays.length} training days · {totalExercises} exercises this week
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3" data-tutorial="home-week">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-soft">This Week</span>
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] text-muted">{dateRange}</span>
              <button
                onClick={() => nav.go('calendar')}
                className="flex items-center gap-1.5 rounded-[24px] bg-tile px-3 py-1.5"
                title="Open full calendar"
              >
                <CalendarDays size={13} color="var(--color-accent)" />
                <span className="text-[12px] font-medium text-soft">Calendar</span>
              </button>
            </div>
          </div>
          <div className="flex h-[88px] gap-1.5 md:h-[110px] md:grid md:grid-cols-7 md:gap-2">
            {week.map((date) => (
              <DayTile
                key={date.toISOString()}
                date={date}
                today={today}
                planned={planDay(date)}
                onOpen={() => setPickDate(date)}
              />
            ))}
          </div>
          <span className="text-center text-[11px] text-muted">
            Tap a day to pick your workout
          </span>
        </div>

        <StreakCard
          streak={streak}
          done={weekDone}
          goal={weekPlanned}
          onEditGoal={() => setEditingGoal(true)}
        />

        <div className="flex flex-col gap-3" data-tutorial="home-split">
          {days.map((d) => (
            <div
              key={d.id}
              onClick={() => openDay(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openDay(d)}
              className="flex cursor-pointer flex-col gap-3 rounded-[24px] bg-card p-4 shadow-[0px_2px_4px_0px_#0000000A] transition-colors active:bg-tile md:flex-row md:items-center md:gap-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[16px] font-semibold text-soft">{d.name}</span>
                  <span className="text-[12px] text-sub">
                    {d.exercises.length} {d.exercises.length === 1 ? 'exercise' : 'exercises'}
                  </span>
                </div>
                <div className="flex gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete(d)
                      setConfirmShow(false)
                      setTimeout(() => setConfirmShow(true), 50)
                    }}
                    aria-label={`Delete ${d.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-3xl"
                  >
                    <Trash2 size={16} color="var(--color-sub)" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.muscles.map((m) => (
                  <Chip key={m} label={m} color={d.color} />
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 rounded-[24px] bg-tile p-4">
            <MoonStar size={20} color="var(--color-muted)" />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-soft">Rest Days</span>
              <span className="w-full text-[12px] text-sub">
                {restWeekdays.join(' · ')} — recovery is training too
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setCreating(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-[24px] bg-accent"
        >
          <Plus size={16} color="var(--color-soft)" strokeWidth={2.5} />
          <span className="text-[14px] font-medium text-soft">Add Workout Day</span>
        </button>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)}>
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                <Plus size={18} color="var(--color-accent)" />
              </div>
              <span className="text-[16px] font-medium text-soft">New Workout Day</span>
            </div>
            <button
              onClick={() => setCreating(false)}
              className="flex h-6 w-6 items-center justify-center rounded-[12px] bg-tile"
            >
              <X size={16} color="var(--color-sub)" />
            </button>
          </div>
          <label className="text-[12px] text-sub">Workout name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createDay()}
            placeholder="e.g. Upper Body"
            className="h-11 rounded-[12px] bg-field px-3.5 text-[13px] text-soft placeholder:text-sub shadow-[0px_2px_6px_0px_#0000000F] outline-none"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setCreating(false)}
              className="h-8 rounded-[24px] bg-tile px-4 text-[13px] text-soft"
            >
              Cancel
            </button>
            <button
              onClick={createDay}
              className="h-8 rounded-[24px] bg-accent px-4 text-[13px] text-white"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editingGoal} onClose={() => setEditingGoal(false)}>
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                <Target size={18} color="var(--color-accent)" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[16px] font-medium text-soft">Weekly goal</span>
                <span className="text-[12px] text-sub">How many days you aim to train</span>
              </div>
            </div>
            <button
              onClick={() => setEditingGoal(false)}
              className="flex h-6 w-6 items-center justify-center rounded-[12px] bg-tile"
            >
              <X size={16} color="var(--color-sub)" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {GOAL_OPTIONS.map((n) => {
              const active = n === weeklyGoal
              return (
                <button
                  key={n}
                  onClick={() => {
                    store.setSettings({ weeklyGoal: n })
                    setEditingGoal(false)
                  }}
                  className={`flex h-11 items-center justify-center rounded-[12px] text-[14px] font-semibold transition-colors ${
                    active ? 'bg-accent text-white' : 'bg-tile text-soft active:bg-line/10'
                  }`}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <span className="text-center text-[11px] text-muted">
            You've done {weekDone} {weekDone === 1 ? 'day' : 'days'} this week
          </span>
        </div>
      </Modal>

      <PlanDayPicker
        date={pickDate}
        days={days}
        currentId={pickDate ? store.plan[dateKey(pickDate)] ?? null : null}
        onPick={(dayId) => {
          if (pickDate) store.setPlan(dateKey(pickDate), dayId)
          setPickDate(null)
        }}
        onClose={() => setPickDate(null)}
      />

      {confirmDelete && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 transition-opacity duration-200 ${
            confirmShow ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={`glass-panel mx-4 flex w-[320px] flex-col gap-4 rounded-[24px] bg-card p-6 transition-all duration-200 ${
              confirmShow ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            <span className="text-[16px] font-semibold text-soft">
              Delete {confirmDelete.name}?
            </span>
            <span className="text-[13px] text-sub">
              This removes the day and its {confirmDelete.exercises.length} exercises. This can't
              be undone.
            </span>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setConfirmShow(false)
                  setTimeout(() => setConfirmDelete(null), 200)
                }}
                className="h-8 rounded-[24px] bg-tile px-4 text-[13px] text-soft"
              >
                Keep
              </button>
              <button
                onClick={() => {
                  store.deleteDay(confirmDelete.id)
                  setConfirmShow(false)
                  setTimeout(() => setConfirmDelete(null), 200)
                }}
                className="h-8 rounded-[24px] bg-[#F2606E] px-4 text-[13px] text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  )
}
