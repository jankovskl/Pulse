import { Check, ChevronLeft, ChevronRight, CircleCheck, MoonStar, X } from 'lucide-react'
import { dateKey } from '../lib/data'

// Month grid of workout history + planned days.
//   doneDates  — Set of dateKey strings with a logged session
//   plan       — store.plan map (dateKey -> workout day id)
//   daysById   — workout days by id (for names/colors)
//   onPickDay  — when set, days become tappable (planning mode)
//   compact    — smaller cells for the Progress tab card
export function WorkoutCalendar({
  cursor,
  onCursor,
  doneDates,
  plan = {},
  daysById = {},
  onPickDay,
  compact = false,
  lockNext = false,
  tutorial,
}) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const lead = (new Date(year, month, 1).getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const now = new Date()
  const todayKey = dateKey(now)
  const atCurrentMonth = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth()

  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const key = dateKey(date)
    cells.push({
      key,
      d,
      date,
      done: doneDates.has(key),
      planned: daysById[plan[key]] ?? null,
    })
  }

  const moveMonth = (delta) => onCursor(new Date(year, month + delta, 1))
  const label = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const Cell = onPickDay ? 'button' : 'div'

  return (
    // Compact mode caps its width on desktop — otherwise the wide Progress
    // column stretches the square cells into huge blocks.
    <div className={`flex flex-col gap-2 ${compact ? 'md:mx-auto md:w-full md:max-w-[380px]' : ''}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={() => moveMonth(-1)}
          className={`flex items-center justify-center rounded-full bg-tile ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}
          title="Previous month"
        >
          <ChevronLeft size={compact ? 12 : 14} color="var(--color-sub)" />
        </button>
        <span className={`font-semibold text-ink ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{label}</span>
        <button
          onClick={() => moveMonth(1)}
          disabled={lockNext && atCurrentMonth}
          className={`flex items-center justify-center rounded-full bg-tile disabled:opacity-40 ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}
          title="Next month"
        >
          <ChevronRight size={compact ? 12 : 14} color="var(--color-sub)" />
        </button>
      </div>
      <div className={`grid grid-cols-7 ${compact ? 'gap-0.5' : 'gap-1'}`} data-tutorial={tutorial}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
          <span key={i} className={`pb-0.5 text-center font-semibold text-muted ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            {w}
          </span>
        ))}
        {cells.map((c, i) =>
          c ? (
            <Cell
              key={c.key}
              onClick={onPickDay ? () => onPickDay(c.date, c.key) : undefined}
              title={c.done ? `${c.key} — workout logged` : c.planned ? `${c.key} — planned: ${c.planned.name}` : c.key}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-[10px] ${
                compact ? 'text-[10px]' : 'text-[12px]'
              } ${
                c.done
                  ? 'bg-accent/20 font-bold text-accent'
                  : c.key === todayKey
                    ? 'bg-tile font-semibold text-ink outline outline-1 outline-accent/60'
                    : 'bg-tile text-sub'
              } ${onPickDay ? 'cursor-pointer transition-colors hover:outline hover:outline-1 hover:outline-accent/40' : ''}`}
            >
              {c.done ? <Check size={compact ? 11 : 13} color="var(--color-accent)" strokeWidth={3} /> : c.d}
              {!c.done && c.planned && (
                <span
                  className={`absolute rounded-full ${compact ? 'bottom-[3px] h-1 w-1' : 'bottom-[5px] h-1.5 w-1.5'}`}
                  style={{ background: c.planned.color }}
                />
              )}
            </Cell>
          ) : (
            <div key={`pad-${i}`} />
          ),
        )}
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-accent/40" /> Workout done
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-accent" /> Planned
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-tile outline outline-1 outline-line/10" /> Rest / free
          </span>
        </div>
      )}
    </div>
  )
}

// Bottom sheet for assigning a workout day to a specific date (or resting).
export function PlanDayPicker({ date, days, currentId, onPick, onClose }) {
  if (!date) return null
  const estMin = (d) => Math.max(1, Math.round(d.exercises.reduce((n, e) => n + e.sets * 45 + 30, 0) / 60))
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay" onClick={onClose}>
      <div
        className="glass-panel flex w-full max-w-[420px] flex-col gap-4 rounded-t-[28px] bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-soft">
              {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <span className="text-[12px] text-muted">Pick what you'll train that day</span>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-tile">
            <X size={15} color="var(--color-sub)" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {days.map((d) => {
            const active = currentId === d.id
            const cap = d.name.replace(/^./, (c) => c.toUpperCase())
            return (
              <button
                key={d.id}
                onClick={() => onPick(d.id)}
                className={`flex items-center gap-3 rounded-[18px] p-3.5 text-left transition-colors ${
                  active ? 'bg-accent/10 outline outline-1 outline-accent/30' : 'bg-tile'
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.color }} />
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
            onClick={() => onPick(null)}
            className={`flex items-center gap-3 rounded-[18px] p-3.5 text-left transition-colors ${
              !currentId ? 'bg-tile' : 'bg-card'
            }`}
          >
            <MoonStar size={14} color="var(--color-muted)" />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-soft">Rest day</span>
              <span className="text-[12px] text-muted">No workout — recovery is training too</span>
            </span>
            {!currentId && <CircleCheck size={18} color="var(--color-accent)" />}
          </button>
        </div>
      </div>
    </div>
  )
}
