import { Activity, Circle, Dumbbell } from 'lucide-react'
import { useEffect, useState } from 'react'

export function UserStatus({ status, workoutData }) {
  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5">
        <Circle size={8} fill="#6B7280" color="#6B7280" />
        <span className="text-[11px] text-muted">Offline</span>
      </div>
    )
  }

  if (status === 'working_out' && workoutData) {
    return (
      <div className="flex items-center gap-1.5">
        <Circle size={8} fill="#F5A524" color="#F5A524" className="animate-pulse" />
        <span className="text-[11px] text-[#F5A524] font-medium">Working out</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Circle size={8} fill="#17C964" color="#17C964" />
      <span className="text-[11px] text-good">Online</span>
    </div>
  )
}

export function WorkoutStatusCard({ workoutData }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!workoutData?.startedAt) return

    const update = () => {
      const now = Date.now()
      const start = new Date(workoutData.startedAt).getTime()
      setElapsed(Math.floor((now - start) / 1000))
    }

    update()
    const interval = setInterval(update, 1000)

    return () => clearInterval(interval)
  }, [workoutData?.startedAt])

  if (!workoutData) return null

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="rounded-[16px] bg-gradient-to-br from-[#F5A524]/15 to-[#F5A524]/5 p-4 outline outline-1 outline-[#F5A524]/20">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5A524]/20">
          <Dumbbell size={16} color="#F5A524" />
        </div>
        <span className="text-[13px] font-semibold text-ink">Currently Working Out</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-[12px] bg-[#F5A524]/10 px-3 py-2">
          <span className="text-[11px] text-muted">Workout</span>
          <span className="text-[13px] font-semibold text-soft">{workoutData.dayName}</span>
        </div>

        {workoutData.currentExercise && (
          <div className="flex items-center justify-between rounded-[12px] bg-[#F5A524]/10 px-3 py-2">
            <span className="text-[11px] text-muted">Current Exercise</span>
            <span className="text-[13px] font-semibold text-soft">{workoutData.currentExercise}</span>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1 rounded-[12px] bg-[#F5A524]/10 px-3 py-2">
            <span className="text-[10px] text-muted">Duration</span>
            <span className="text-[15px] font-bold text-[#F5A524]">{timeStr}</span>
          </div>

          <div className="flex flex-1 flex-col gap-1 rounded-[12px] bg-[#F5A524]/10 px-3 py-2">
            <span className="text-[10px] text-muted">Progress</span>
            <span className="text-[15px] font-bold text-[#F5A524]">
              {workoutData.exercisesDone}/{workoutData.exercisesTotal}
            </span>
          </div>
        </div>

        <div className="mt-1">
          <div className="h-1.5 rounded-full bg-line/10">
            <div
              className="h-1.5 rounded-full bg-[#F5A524] transition-all duration-300"
              style={{
                width: `${(workoutData.exercisesDone / workoutData.exercisesTotal) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
