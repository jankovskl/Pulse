import { Check, Clock, Dumbbell, Trophy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'

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

  // Get today's sessions to check for PRs
  const today = new Date().toISOString().slice(0, 10)
  const todaysSessions = store.sessions.filter((s) => s.full === today)
  const prs = todaysSessions.filter((s) => s.pr)
  const hasPRs = prs.length > 0

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
        className={`relative flex w-full max-w-md flex-col gap-5 rounded-[28px] bg-field p-6 shadow-2xl transition-transform duration-200 ${
          show ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-tile"
        >
          <X size={16} color="var(--color-sub)" />
        </button>

        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-good/15">
            <Check size={32} color="#17C964" strokeWidth={2.5} />
          </div>
          <h2 className="text-[24px] font-bold text-ink">Workout Complete!</h2>
          <p className="text-center text-[14px] text-sub">
            Great session — you crushed {day.name}
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
            <div className="rounded-[16px] bg-gradient-to-br from-[#F5A524]/20 to-[#F5A524]/10 p-4 outline outline-1 outline-[#F5A524]/30">
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
            {completedExercises.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-[12px] bg-tile px-3 py-2"
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
