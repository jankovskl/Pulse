import { useEffect, useMemo, useState } from 'react'
import { Activity, CircleCheck, CloudCheck, CloudOff, MoonStar, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { dateKey, DAY_COLORS, WEEKDAY_NAMES } from '../lib/data'
import { Chip, Screen, useNav } from '../components/ui'

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

function DayTile({ date, marker, today, onOpen, planned }) {
  const labels = ['push', 'pull', 'legs', 'rest']
  const colors = { push: DAY_COLORS.push, pull: DAY_COLORS.pull, legs: DAY_COLORS.legs, rest: '#71717A' }
  const isToday = date.toDateString() === today.toDateString()
  const color = planned ? planned.color : (colors[marker] ?? '#71717A')
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

export default function HomeScreen() {
  const store = useStore()
  const nav = useNav()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [pickDate, setPickDate] = useState(null)

  const today = new Date()
  const days = store.days

  const week = useMemo(() => weekOf(today), [])
  const markers = useMemo(() => {
    const map = {}
    for (const d of days) {
      const idx = (d.weekday + 6) % 7
      map[idx] = d.color === DAY_COLORS.push ? 'push' : d.color === DAY_COLORS.pull ? 'pull' : 'legs'
    }
    return map
  }, [days])

  const totalExercises = days.reduce((n, d) => n + d.exercises.length, 0)
  const trainingDays = days.filter((d) => d.exercises.length > 0)
  const restWeekdays = WEEKDAY_NAMES.filter((_, i) => !markers[i]).map((n) => n.slice(0, 3))

  const weekStart = week[0]
  const weekEnd = week[6]
  const dateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const openDay = (d) => nav.go('day', { dayId: d.id })

  const planDay = (date) =>
    days.find((d) => d.id === store.plan[dateKey(date)]) ?? null

  const estMin = (d) =>
    Math.max(1, Math.round(d.exercises.reduce((n, e) => n + e.sets * 45 + 30, 0) / 60))

  function createDay() {
    if (!name.trim()) return
    store.addDay(name.trim(), 0)
    setCreating(false)
    setName('')
  }

  return (
    <Screen activeTab="home">
      <div className="flex flex-col gap-6">
        <div
          className={`flex items-center gap-3 rounded-[18px] px-4 py-3 ${online ? 'bg-good/10' : 'bg-gold/10'}`}
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${online ? 'bg-good/20' : 'bg-gold/20'}`}
          >
            {online ? (
              <CloudCheck size={17} color="#17C964" strokeWidth={2.2} />
            ) : (
              <CloudOff size={17} color="#F5A524" strokeWidth={2.2} />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-[1px]">
            <span className={`text-[14px] font-semibold ${online ? 'text-good' : 'text-gold'}`}>
              {online ? 'Synced' : 'Offline'}
            </span>
            <span className="text-[12px] text-muted">
              {online ? 'Everything is up to date' : 'Changes stay on this device'}
            </span>
          </div>
        </div>
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

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-soft">This Week</span>
            <span className="text-[12px] text-muted">{dateRange}</span>
          </div>
          <div className="flex h-[88px] gap-1.5">
            {week.map((date) => (
              <DayTile
                key={date.toISOString()}
                date={date}
                today={today}
                marker={markers[(date.getDay() + 6) % 7]}
                planned={planDay(date)}
                onOpen={() => setPickDate(date)}
              />
            ))}
          </div>
          <span className="text-center text-[11px] text-muted">
            Tap a day to pick your workout
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {days.map((d) => (
            <div
              key={d.id}
              onClick={() => openDay(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openDay(d)}
              className="flex cursor-pointer flex-col gap-3 rounded-[24px] bg-card p-4 shadow-[0px_2px_4px_0px_#0000000A] transition-colors active:bg-[#23242B]"
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
                    }}
                    aria-label={`Delete ${d.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-3xl"
                  >
                    <Trash2 size={16} color="#A1A1AA" />
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
            <MoonStar size={20} color="#71717A" />
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
          <Plus size={16} color="#FCFCFC" strokeWidth={2.5} />
          <span className="text-[14px] font-medium text-soft">Add Workout Day</span>
        </button>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[28vh]">
          <div className="mx-4 flex w-[358px] max-w-[92vw] flex-col gap-4 rounded-[24px] bg-card p-6 shadow-[0px_10px_40px_0px_#00000030]">
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
                <X size={16} color="#A1A1AA" />
              </button>
            </div>
            <label className="text-[12px] text-sub">Workout name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createDay()}
              placeholder="e.g. Upper Body"
              className="h-10 rounded-[12px] bg-[#262728] px-3.5 text-[13px] text-soft placeholder:text-sub shadow-[0px_2px_6px_0px_#0000000F] outline-none"
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
        </div>
      )}

      {pickDate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setPickDate(null)}
        >
          <div
            className="flex w-full max-w-[420px] flex-col gap-4 rounded-t-[28px] bg-card p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[16px] font-semibold text-soft">
                  {pickDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-[12px] text-muted">Pick what you'll train that day</span>
              </div>
              <button
                onClick={() => setPickDate(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
              >
                <X size={15} color="#A1A1AA" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {days.map((d) => {
                const active = store.plan[dateKey(pickDate)] === d.id
                const cap = d.name.replace(/^./, (c) => c.toUpperCase())
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      store.setPlan(dateKey(pickDate), d.id)
                      setPickDate(null)
                    }}
                    className={`flex items-center gap-3 rounded-[18px] p-3.5 text-left transition-colors ${
                      active ? 'bg-accent/10 outline outline-1 outline-accent/30' : 'bg-tile'
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: d.color }}
                    />
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="text-[14px] font-semibold text-soft">{cap}</span>
                      <span className="text-[12px] text-muted">
                        {d.exercises.length} exercises · ~{estMin(d)} min
                      </span>
                    </span>
                    {active && <CircleCheck size={18} color="var(--color-accent)" />}
                  </button>
                )
              })}
              <button
                onClick={() => {
                  store.setPlan(dateKey(pickDate), null)
                  setPickDate(null)
                }}
                className={`flex items-center gap-3 rounded-[18px] p-3.5 text-left transition-colors ${
                  !store.plan[dateKey(pickDate)] ? 'bg-tile' : 'bg-[#1C1C22]'
                }`}
              >
                <MoonStar size={14} color="#71717A" />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[14px] font-semibold text-soft">Rest day</span>
                  <span className="text-[12px] text-muted">No workout — recovery is training too</span>
                </span>
                {!store.plan[dateKey(pickDate)] && (
                  <CircleCheck size={18} color="var(--color-accent)" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 flex w-[320px] flex-col gap-4 rounded-[24px] bg-card p-6">
            <span className="text-[16px] font-semibold text-soft">
              Delete {confirmDelete.name}?
            </span>
            <span className="text-[13px] text-sub">
              This removes the day and its {confirmDelete.exercises.length} exercises. This can't
              be undone.
            </span>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="h-8 rounded-[24px] bg-tile px-4 text-[13px] text-soft"
              >
                Keep
              </button>
              <button
                onClick={() => {
                  store.deleteDay(confirmDelete.id)
                  setConfirmDelete(null)
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
