import { useState } from 'react'
import {
  ChevronLeft,
  CircleCheck,
  GripVertical,
  Minus,
  Play,
  Plus,
  Square,
  Trash2,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useTimer } from '../lib/timer'
import { Screen, useNav } from '../components/ui'
import WorkoutSummary from '../components/WorkoutSummary'

function Stepper({ label, value, min = 0, step = 1, onChange }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1)

  function commit() {
    const n = parseFloat(text)
    setEditing(false)
    if (!Number.isNaN(n)) onChange(Math.max(min, Math.round(n * 10) / 10))
  }

  return (
    <div className="flex items-center">
      <span className="mr-2 text-[11px] text-sub">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line/5 bg-line/5"
      >
        <Minus size={12} color="var(--color-sub)" />
      </button>
      {editing ? (
        <input
          autoFocus
          value={text}
          inputMode="decimal"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-12 border-b border-accent/50 bg-transparent text-center text-[14px] font-semibold text-soft outline-none"
        />
      ) : (
        <button
          onClick={() => {
            setText(shown)
            setEditing(true)
          }}
          title={`Type ${label}`}
          className="w-10 text-center text-[14px] font-semibold text-soft"
        >
          {shown}
        </button>
      )}
      <button
        onClick={() => onChange(Math.round((value + step) * 10) / 10)}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line/5 bg-line/5"
      >
        <Plus size={12} color="var(--color-sub)" />
      </button>
    </div>
  )
}

export default function DayDetailScreen() {
  const store = useStore()
  const nav = useNav()
  const timer = useTimer()
  const day = store.days.find((d) => d.id === nav.dayId) ?? store.days[0]
  const [dragIdx, setDragIdx] = useState(null)
  const [dropIdx, setDropIdx] = useState(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  if (!day) return <Screen activeTab="home" />

  const workoutActive = timer.session?.dayId === day.id && timer.session.exIdx < day.exercises.length
  const allDone = day.exercises.length > 0 && day.exercises.every((e) => e.done)
  const showDone = allDone
  const showStop = workoutActive && !allDone

  const done = day.exercises.filter((e) => e.done).length
  const pct = day.exercises.length ? Math.round((done / day.exercises.length) * 100) : 0

  function move(from, to) {
    const list = [...day.exercises]
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    store.updateDay(day.id, { exercises: list })
  }

  function restartDay() {
    setConfirmStop(false)
    store.updateDay(day.id, {
      exercises: day.exercises.map((e) => ({ ...e, done: false })),
    })
    nav.go('timer', { dayId: day.id })
  }

  function toggle(e) {
    const wasAllDone = day.exercises.every((ex) => ex.done)

    // Check if this toggle will complete the workout (before toggling)
    const willBeAllDone = day.exercises.every((ex) =>
      ex.id === e.id ? !ex.done : ex.done
    )

    store.toggleExercise(day.id, e.id)

    // Show summary if we just completed all exercises and have an active session
    if (!wasAllDone && willBeAllDone && timer.session?.dayId === day.id && timer.session?.startedAt) {
      // Use setTimeout to ensure state updates have processed
      setTimeout(() => setShowSummary(true), 100)
    }
  }

  return (
    <Screen activeTab="home">
      {showSummary && day && timer.session && (
        <WorkoutSummary day={day} session={timer.session} onClose={() => setShowSummary(false)} />
      )}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav.go('home')}
            className="flex h-9 items-center gap-2 rounded-3xl px-2"
          >
            <ChevronLeft size={16} color="var(--color-soft)" />
            <span className="text-[13px] text-soft">My Split</span>
          </button>
          <div className="flex flex-1 flex-col gap-0">
            <h1 className="text-[22px] font-semibold capitalize text-soft">{day.name}</h1>
            <span className="text-[13px] text-muted">
              {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-bold text-soft">Today's session</span>
            <span className="text-[12px] text-sub">
              {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
            </span>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[11px] text-sub">
              <span>Completed</span>
              <span>
                {done}/{day.exercises.length}
              </span>
            </div>
            <div className="h-1 rounded bg-line/5">
              <div
                className="h-1 rounded bg-accent/15"
                style={{ width: `${pct}%`, background: pct === 100 ? '#17C964' : 'var(--color-accent)' }}
              />
            </div>
          </div>
          {confirmStop && showStop ? (
            <div className="mt-1 flex flex-col gap-2">
              <span className="text-center text-[12px] text-sub">
                You sure? This ends the workout.
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmStop(false)}
                  className="flex h-11 flex-1 items-center justify-center rounded-[24px] bg-tile text-[14px] font-medium text-sub"
                >
                  No
                </button>
                <button
                  onClick={() => {
                    setConfirmStop(false)
                    timer.endWorkout()
                  }}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[24px] bg-[#DB3B3E]/15"
                >
                  <Square size={15} color="#DB3B3E" />
                  <span className="text-[14px] font-medium text-[#DB3B3E]">Yes, stop</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={
                showDone
                  ? restartDay
                  : showStop
                    ? () => setConfirmStop(true)
                    : () => {
                        setConfirmStop(false)
                        nav.go('timer', { dayId: day.id })
                      }
              }
              className={`mt-1 flex h-11 items-center justify-center gap-2 rounded-[24px] ${
                showStop ? 'bg-[#DB3B3E]/15' : showDone ? 'bg-good/15' : 'bg-accent'
              }`}
            >
              {showStop ? (
                <Square size={15} color="#DB3B3E" />
              ) : showDone ? (
                <CircleCheck size={17} color="#17C964" strokeWidth={2.5} />
              ) : (
                <Play size={15} color="var(--color-soft)" fill="var(--color-soft)" />
              )}
              <span
                className={`text-[14px] font-medium ${
                  showStop ? 'text-[#DB3B3E]' : showDone ? 'text-good' : 'text-soft'
                }`}
              >
                {showStop
                  ? 'Stop Workout'
                  : showDone
                    ? 'Workout Done · Start Again'
                    : 'Start Workout'}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-soft">Exercises</h2>
          <span className="text-[12px] text-sub">
            {done} of {day.exercises.length} done
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {day.exercises.map((e, i) => (
            <div
              key={e.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(ev) => {
                ev.preventDefault()
                setDropIdx(i)
              }}
              onDrop={() => {
                if (dragIdx !== null && dragIdx !== dropIdx) move(dragIdx, dropIdx)
                setDragIdx(null)
                setDropIdx(null)
              }}
              onDragEnd={() => {
                setDragIdx(null)
                setDropIdx(null)
              }}
              className={`flex flex-col gap-3 rounded-[20px] p-4 transition-opacity md:flex-row md:items-center md:justify-between ${
                dragIdx === i ? 'opacity-40' : ''
              } ${
                e.done ? 'bg-good/15' : 'bg-surface outline outline-1 outline-line/10'
              }`}
            >
              <div className="flex items-center gap-2">
                {e.done ? (
                  <button
                    onClick={() => toggle(e)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center"
                    title="Mark not done"
                  >
                    <CircleCheck size={16} color="#17C964" />
                  </button>
                ) : (
                  <GripVertical size={16} color="var(--color-muted)" className="cursor-grab shrink-0" />
                )}
                <div className="flex flex-1 flex-col">
                  <span className="text-[14px] font-medium text-soft">{e.name}</span>
                  <span className="text-[11px] text-muted">{e.muscle}</span>
                </div>
                {!e.done && (
                  <button
                    onClick={() => toggle(e)}
                    className="flex h-9 w-9 items-center justify-center"
                    title="Mark done"
                  >
                    <CircleCheck size={22} color="var(--color-muted)" className="opacity-40" />
                  </button>
                )}
                <button
                  onClick={() => store.removeExercise(day.id, e.id)}
                  className="flex h-9 w-9 items-center justify-center"
                >
                  <Trash2 size={15} color="var(--color-sub)" />
                </button>
              </div>
              <div
                className={`flex flex-wrap items-center gap-3 pl-6 md:pl-0 md:justify-end ${
                  e.done ? 'pointer-events-none select-none opacity-55' : ''
                }`}
              >
                <Stepper label="Sets" value={e.sets} min={1} onChange={(v) => store.patchExercise(day.id, e.id, { sets: v })} />
                <Stepper label="Reps" value={e.reps} min={1} onChange={(v) => store.patchExercise(day.id, e.id, { reps: v })} />
                <Stepper label="KG" value={e.weight} min={0} step={0.5} onChange={(v) => store.patchExercise(day.id, e.id, { weight: v })} />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => nav.go('library', { fromDayId: day.id })}
          className="flex h-11 items-center justify-center gap-2 rounded-[24px] bg-tile"
        >
          <Plus size={16} color="var(--color-accent)" strokeWidth={2.5} />
          <span className="text-[14px] text-accent">Add Exercise</span>
        </button>

        <div className="flex justify-center pb-1">
          <span className="text-[11px] text-muted">Hold the grip to reorder</span>
        </div>
      </div>
    </Screen>
  )
}
