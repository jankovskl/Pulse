import { Check, Clock, Dumbbell, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { dateKey } from '../lib/data'
import { countPlannedInWeek, workoutsInWeek } from '../lib/profile'

const CONFETTI_COLORS = ['#F5A524', '#17C964', 'var(--color-accent)', 'var(--color-accent-light)']

// Short burst fired from the trophy panel — only for *exceptional*
// completions (a PR today or the weekly goal hit). Plain completions get
// the spring entrance alone, so confetti never becomes wallpaper.
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        x: (Math.random() - 0.5) * 260,
        y: 140 + Math.random() * 180,
        r: 240 + Math.random() * 480,
        delay: 250 + Math.random() * 250,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[18px] z-10 flex justify-center" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            background: p.color,
            animationDelay: `${p.delay}ms`,
            '--cf-x': `${p.x}px`,
            '--cf-y': `${p.y}px`,
            '--cf-r': `${p.r}deg`,
          }}
        />
      ))}
    </div>
  )
}

export default function WorkoutSummary({ day, session, onClose }) {
  const [show, setShow] = useState(false)
  const store = useStore()

  useEffect(() => {
    // Animate in after mount
    setTimeout(() => setShow(true), 50)
  }, [])

  if (!day || !session) return null

  const startTime = session.startedAt ? new Date(session.startedAt) : null
  const endTime = new Date()
  const durationMs = startTime ? endTime - startTime : 0
  const durationMin = Math.floor(durationMs / 60000)
  const durationSec = Math.floor((durationMs % 60000) / 1000)

  const completedExercises = day.exercises.filter((e) => e.done)
  const totalSets = completedExercises.reduce((sum, e) => sum + e.sets, 0)

  // Get today's sessions to check for PRs — local date key, matching how
  // sessions are dated in the store.
  const today = dateKey(new Date())
  const todaysSessions = store.sessions.filter((s) => s.full === today)
  const prs = todaysSessions.filter((s) => s.pr)
  const hasPRs = prs.length > 0

  // Exceptional = this logged workout also filled the plan-derived weekly
  // goal (ADR 0001). Sessions are counted per distinct date, so today's
  // completion is already included. (Plain call — a hook here would sit
  // after the early return above and break the hook order.)
  const planned = countPlannedInWeek(store.plan)
  const goalHit = planned > 0 && workoutsInWeek(store.sessions) >= planned

  function handleClose() {
    setShow(false)
    setTimeout(onClose, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity duration-200 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-5 overflow-y-auto overscroll-contain rounded-[28px] bg-field p-6 shadow-2xl transition-transform duration-200 ${
          show ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {(hasPRs || goalHit) && show && <Confetti />}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-tile"
        >
          <X size={16} color="var(--color-sub)" />
        </button>

        <div className="flex flex-col items-center gap-3 pt-2">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-good/15 ${show ? 'animate-trophy-drop' : 'opacity-0'}`}>
            <Check size={32} color="#17C964" strokeWidth={2.5} />
          </div>
          <h2 className="text-[24px] font-bold text-ink">Workout Complete!</h2>
          <p className="text-center text-[14px] text-sub">
            Great work — you crushed {day.name}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-[16px] bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                <Clock size={18} color="var(--color-accent)" />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-ink">Duration</span>
                <span className="text-[11px] text-muted">Total time</span>
              </div>
            </div>
            <span className="text-[20px] font-bold text-ink">
              {durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`}
            </span>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-1 items-center justify-between rounded-[16px] bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                  <Dumbbell size={18} color="var(--color-accent)" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-ink">Exercises</span>
                  <span className="text-[11px] text-muted">Completed</span>
                </div>
              </div>
              <span className="text-[20px] font-bold text-ink">{completedExercises.length}</span>
            </div>

            <div className="flex flex-1 items-center justify-between rounded-[16px] bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                  <Check size={18} color="var(--color-accent)" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-ink">Total Sets</span>
                  <span className="text-[11px] text-muted">All exercises</span>
                </div>
              </div>
              <span className="text-[20px] font-bold text-ink">{totalSets}</span>
            </div>
          </div>

          {hasPRs && (
            <div className={`rounded-[16px] bg-gradient-to-br from-[#F5A524]/20 to-[#F5A524]/10 p-4 outline outline-1 outline-[#F5A524]/30 ${show ? 'animate-trophy-drop' : 'opacity-0'}`} style={{ animationDelay: '120ms' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5A524]/20">
                  <Trophy size={18} color="#F5A524" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-ink">New Personal Records!</span>
                  <span className="text-[11px] text-muted">{prs.length} PR{prs.length > 1 ? 's' : ''} today</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {prs.map((pr, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-[10px] bg-[#F5A524]/10 px-3 py-2">
                    <span className="text-[12px] font-medium text-soft">{pr.exercise}</span>
                    <span className="text-[12px] font-bold text-[#F5A524]">{pr.weight} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1px] text-muted">
            EXERCISES COMPLETED
          </span>
          <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto">
            {completedExercises.map((e, idx) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-[12px] bg-tile px-3 py-2 transition-all duration-200 ease-out"
                style={{
                  transitionDelay: `${idx * 40}ms`,
                  opacity: show ? 1 : 0,
                  transform: show ? 'translateY(0)' : 'translateY(6px)',
                }}
              >
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-soft">{e.name}</span>
                  <span className="text-[11px] text-muted">
                    {e.sets} × {e.reps} @ {e.weight}kg
                  </span>
                </div>
                <Check size={16} color="#17C964" />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleClose}
          className="flex h-12 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  )
}
