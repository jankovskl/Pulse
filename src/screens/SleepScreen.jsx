import { useEffect, useMemo, useState } from 'react'
import { Coffee, MoonStar, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { Screen, Modal } from '../components/ui'
import SleepCalendar from '../components/SleepCalendar'
import { dateKey } from '../lib/data.js'
import { lastNightKey, sleepHoursOf, sleepColor, scoreBreakdown, sleepScoreForLog, caffeineTimestamp, caffeineClock, caffeineDose, CAFFEINE_DEFAULT_MG } from './sleepUtils'

// Filled card: shows score bar, hours, and bed/wake times.
function SleepCard({ log, goal, ideal, onTap, caffeineLogs }) {
  const hours = log.hours
  const { score, timing, caffeine, duration } = scoreBreakdown(log, goal, ideal, caffeineLogs)

  return (
    <button
      onClick={onTap}
      className="flex w-full flex-col gap-4 rounded-[24px] bg-card p-5 text-left shadow-[0px_2px_4px_0px_#0000000A]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
            <MoonStar size={20} color="var(--color-accent)" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-soft">Last night</span>
            <span className="text-[11px] text-sub">
              {hours}h of sleep
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[24px] font-bold leading-none text-soft tabular-nums">{score}</span>
          <span className="text-[10px] uppercase tracking-[1.4px] text-muted">score</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-[8px] w-full overflow-hidden rounded-full bg-tile">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${score}%`, backgroundColor: sleepColor(score) }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>0h</span>
          {log.bedtime && (
            <span className="tabular-nums">
              Duration {duration} · Timing {timing} · Caffeine {caffeine}
            </span>
          )}
          <span>Goal {goal}h</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line/10 pt-4">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">Bed</span>
          <span className="text-[14px] font-semibold text-soft tabular-nums">{log.bedtime ?? '—'}</span>
        </div>
        <div className="h-9 w-px shrink-0 bg-line/10" />
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">Wake</span>
          <span className="text-[14px] font-semibold text-soft tabular-nums">{log.wake ?? '—'}</span>
        </div>
        <div className="h-9 w-px shrink-0 bg-line/10" />
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">Sleep</span>
          <span className="text-[14px] font-semibold text-soft tabular-nums">{hours}h</span>
        </div>
      </div>
    </button>
  )
}

// Empty state: when there is no sleep log for last night.
function EmptyCard({ onLog }) {
  return (
    <button
      onClick={onLog}
      className="flex w-full items-center justify-between rounded-[24px] bg-card p-5 shadow-[0px_2px_4px_0px_#0000000A]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
          <MoonStar size={20} color="var(--color-accent)" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold text-soft">No sleep logged</span>
          <span className="text-[11px] text-sub">Tap to track your sleep</span>
        </div>
      </div>
      <Plus size={18} color="var(--color-sub)" />
    </button>
  )
}

// Caffeine types offered in the popup. Defaults double as the dose fallback
// for legacy entries logged before doses existed (ADR 0005).
const CAFFEINE_TYPES = [
  { type: 'coffee', label: 'Coffee', emoji: '☕' },
  { type: 'energy', label: 'Energy Drink', emoji: '⚡' },
  { type: 'preworkout', label: 'Pre-workout', emoji: '💪' },
  { type: 'tea', label: 'Tea', emoji: '🍵' },
]
const typeMeta = (t) => CAFFEINE_TYPES.find((c) => c.type === t) ?? CAFFEINE_TYPES[0]

// Caffeine card: mirrors the sleep card/empty-card pairing. Empty state is a
// single tappable card that opens the log popup; once today has entries the
// card becomes a summary + per-entry list, rows tappable to edit.
function CaffeineCard({ logs, onAdd, onEdit }) {
  const todayLogs = useMemo(() => {
    const today = dateKey(new Date())
    return logs.filter((l) => dateKey(new Date(l.time)) === today)
  }, [logs])
  const totalMg = todayLogs.reduce((sum, l) => sum + caffeineDose(l), 0)

  if (todayLogs.length === 0) {
    return (
      <button
        onClick={onAdd}
        className="flex w-full items-center justify-between rounded-[24px] bg-card p-5 shadow-[0px_2px_4px_0px_#0000000A]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
            <Coffee size={20} color="var(--color-accent)" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-soft">No caffeine logged</span>
            <span className="text-[11px] text-sub">Tap to track your caffeine</span>
          </div>
        </div>
        <Plus size={18} color="var(--color-sub)" />
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-[24px] bg-card p-5 shadow-[0px_2px_4px_0px_#0000000A]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
            <Coffee size={20} color="var(--color-accent)" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-soft">{todayLogs.length} logged today</span>
            <span className="text-[11px] text-sub tabular-nums">~{totalMg} mg caffeine</span>
          </div>
        </div>
        <button
          onClick={onAdd}
          aria-label="Log caffeine"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
        >
          <Plus size={16} color="var(--color-sub)" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line/10 pt-3">
        {todayLogs.map((log) => (
          <button
            key={log.id}
            onClick={() => onEdit(log)}
            className="flex items-center justify-between rounded-[12px] px-1 py-1 text-left text-[12px] text-sub transition-colors hover:bg-accent/10"
          >
            <span>{typeMeta(log.type).emoji} {typeMeta(log.type).label} · {caffeineDose(log)} mg</span>
            <span className="tabular-nums">{caffeineClock(log)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Caffeine log popup: presets, custom dose, time-of-day. No date picker —
// a time later than "now" is stamped yesterday (caffeineTimestamp), so
// backfill reaches the past only, never the future.
function CaffeineSheet({ open, entry, onClose, onSave, onDelete }) {
  const [type, setType] = useState('coffee')
  const [dose, setDose] = useState(String(CAFFEINE_DEFAULT_MG.coffee))
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5))
  // True once the user edits the dose field by hand, so tapping presets stops
  // overwriting a custom amount.
  const [doseTouched, setDoseTouched] = useState(false)

  // Reset local state to the entry being edited (or defaults for a new log)
  // every time the sheet opens.
  useEffect(() => {
    if (!open) return
    const t = entry?.type ?? 'coffee'
    setType(t)
    setDose(entry?.amountMg != null ? String(entry.amountMg) : String(CAFFEINE_DEFAULT_MG[t]))
    setDoseTouched(entry?.amountMg != null)
    setTime(entry ? new Date(entry.time).toTimeString().slice(0, 5) : new Date().toTimeString().slice(0, 5))
  }, [open, entry])

  function pickType(t) {
    setType(t)
    if (!doseTouched) setDose(String(CAFFEINE_DEFAULT_MG[t]))
  }

  function save() {
    onSave({ type, amountMg: Math.max(0, Number(dose) || 0), time })
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
              <Coffee size={18} color="var(--color-accent)" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[16px] font-medium text-soft">{entry ? 'Edit caffeine' : 'Log caffeine'}</span>
              <span className="text-[12px] text-muted">A time later than now counts as yesterday</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
          >
            <X size={15} color="var(--color-sub)" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {CAFFEINE_TYPES.map((opt) => (
            <button
              key={opt.type}
              onClick={() => pickType(opt.type)}
              className={`flex items-center gap-2 rounded-[16px] px-3 py-2 text-[12px] font-medium transition-colors ${
                type === opt.type ? 'bg-accent/15 text-soft' : 'bg-tile text-soft hover:bg-accent/15'
              }`}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-sub">Dose (mg)</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={dose}
              onChange={(e) => { setDose(e.target.value); setDoseTouched(true) }}
              className="h-11 rounded-[12px] bg-field px-3.5 text-[14px] text-soft outline outline-1 outline-line/10 focus:outline-accent/50"
            />
            <span className="text-[9px] text-faint">Defaults: ☕ {CAFFEINE_DEFAULT_MG.coffee} · ⚡ {CAFFEINE_DEFAULT_MG.energy} · 💪 {CAFFEINE_DEFAULT_MG.preworkout} · 🍵 {CAFFEINE_DEFAULT_MG.tea} mg</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-sub">Time</span>
            <input
              type="time"
              value={time}
              title="Time in 24‑hour format – 00:00 = midnight"
              onChange={(e) => setTime(e.target.value)}
              className="h-11 rounded-[12px] bg-field px-3.5 text-[14px] text-soft outline outline-1 outline-line/10 focus:outline-accent/50"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-10 rounded-[24px] bg-red/10 px-4 text-[13px] text-red flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="h-10 rounded-[24px] bg-tile px-4 text-[13px] text-soft"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="h-10 rounded-[24px] bg-accent px-4 text-[13px] font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function SleepSheet({ open, bedKey, bedtime, wake, onDelete, onClose, onSave }) {
  const [bedState, setBedState] = useState(bedtime)
  const [wakeState, setWakeState] = useState(wake)

  // Reset local state to props every time the modal opens so a previous open
  // doesn't leak stale edits into a new session.
  useEffect(() => {
    if (open) {
      setBedState(bedtime)
      setWakeState(wake)
    }
  }, [open, bedtime, wake])

  function save() {
    onSave({ bedtime: bedState, wake: wakeState })
    onClose()
  }

  // Compute hours from bedtime/wake time
  const computedHours = useMemo(() => {
    if (bedState && wakeState) {
      return sleepHoursOf(bedState, wakeState)
    }
    return null
  }, [bedState, wakeState])

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
              <MoonStar size={18} color="var(--color-accent)" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[16px] font-medium text-soft">Log sleep</span>
              <span className="text-[12px] text-muted">
                {new Date(`${bedKey}T12:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
          >
            <X size={15} color="var(--color-sub)" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-sub">Bedtime</span>
            <input
              type="time"
              value={bedState}
              onChange={(e) => setBedState(e.target.value)}
              title="Time in 24‑hour format – 00:00 = midnight"
              className="h-11 rounded-[12px] bg-field px-3.5 text-[14px] text-soft outline outline-1 outline-line/10 focus:outline-accent/50"
            />
            <span className="text-[9px] text-faint">12:00 = midnight</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-sub">Wake time</span>
            <input
              type="time"
              value={wakeState}
              onChange={(e) => setWakeState(e.target.value)}
              className="h-11 rounded-[12px] bg-field px-3.5 text-[14px] text-soft outline outline-1 outline-line/10 focus:outline-accent/50"
            />
          </label>

          {computedHours !== null && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-sub">Hours slept</span>
              <div className="h-11 rounded-[12px] bg-field px-3.5 text-[14px] text-soft flex items-center">
                {computedHours}h
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-10 rounded-[24px] bg-red/10 px-4 text-[13px] text-red flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="h-10 rounded-[24px] bg-tile px-4 text-[13px] text-soft"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="h-10 rounded-[24px] bg-accent px-4 text-[13px] font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function SleepScreen() {
  const store = useStore()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
  // Caffeine popup: open + the entry being edited (null = adding a new one).
  const [caffeineOpen, setCaffeineOpen] = useState(false)
  const [caffeineEntry, setCaffeineEntry] = useState(null)


  // Current view = last night's sleep.
  const key = useMemo(() => lastNightKey(), [])
  const goal = store.settings.sleepGoal ?? 8
  const ideal = store.settings.idealSleepOnset ?? '23:00'
  const log = useMemo(
    () => (Array.isArray(store.sleep) ? store.sleep.find((s) => s.date === key) : null),
    [store.sleep, key],
  )

  // Sleep map for calendar colors (reuse the util so both screens agree)
  const sm = useMemo(() => {
    const map = {}
    const scores = {}
    if (Array.isArray(store.sleep)) {
      store.sleep.forEach((s) => {
        const k = s.date
        if (s.hours != null) {
          map[k] = s.hours
          scores[k] = sleepScoreForLog(s, goal, ideal, store.caffeine)
        }
      })
    }
    return { hours: map, scores }
  }, [store.sleep, goal, ideal, store.caffeine])

  function saveLog({ bedtime, wake }) {
    const hours = sleepHoursOf(bedtime, wake)
    const entryKey = selectedKey || key
    if (log) {
      store.updateSleepLog(entryKey, {
        hours,
        bedtime,
        wake,
      })
    } else {
      store.addSleepLog(entryKey, {
        hours,
        bedtime,
        wake,
      })
    }
    setSheetOpen(false)
    setSelectedKey(null)
  }

  function deleteLog() {
    // Remove only the entry the sheet is editing (selected calendar day, or
    // last night when opened from the card) — never any other date.
    store.removeSleepLog(selectedKey || key)
    setSheetOpen(false)
    setSelectedKey(null)
  }

  function saveCaffeine({ type, amountMg, time }) {
    const when = caffeineTimestamp(time)
    if (caffeineEntry) {
      store.updateCaffeine(caffeineEntry.id, { type, amountMg, time: when.toISOString() })
    } else {
      store.addCaffeine({ type, amountMg, when })
    }
    setCaffeineOpen(false)
    setCaffeineEntry(null)
  }

  function deleteCaffeine() {
    if (caffeineEntry) store.deleteCaffeine(caffeineEntry.id)
    setCaffeineOpen(false)
    setCaffeineEntry(null)
  }

  // The log the sheet is editing: the selected calendar day when one is
  // picked, otherwise last night's entry.
  const sheetLog = selectedKey ? store.sleep.find((s) => s.date === selectedKey) : log

  const sheetProps = {
    open: sheetOpen,
    bedKey: selectedKey || key,
    bedtime: sheetLog?.bedtime ?? '23:00',
    wake: sheetLog?.wake ?? '07:00',
    onDelete: sheetLog ? deleteLog : null,
    onClose: () => { setSheetOpen(false); setSelectedKey(null); },
    onSave: saveLog,
  }

  return (
    <Screen activeTab="health">
      <div className="flex flex-col gap-5" data-tutorial="health-screen">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold text-ink">Sleep</h1>
          <span className="text-[12px] text-faint">Sleep & recovery</span>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-[14px] font-semibold text-soft">Sleep</span>
          {log ? (
            <SleepCard log={log} goal={goal} ideal={ideal} onTap={() => { setSelectedKey(null); setSheetOpen(true); }} caffeineLogs={store.caffeine} />
          ) : (
            <EmptyCard onLog={() => { setSelectedKey(null); setSheetOpen(true); }} />
          )}
                  </div>

        {/* Inline month heatmap using SleepCalendar */}
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold text-soft">Sleep overview</span>
          <SleepCalendar
            sleepMap={sm.hours}
            scoreMap={sm.scores}
          />
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-[14px] font-semibold text-soft">Caffeine & Stimulants</span>
          <CaffeineCard
            logs={store.caffeine}
            onAdd={() => { setCaffeineEntry(null); setCaffeineOpen(true) }}
            onEdit={(entry) => { setCaffeineEntry(entry); setCaffeineOpen(true) }}
          />
        </div>
      </div>
      <SleepSheet {...sheetProps} />
      <CaffeineSheet
        open={caffeineOpen}
        entry={caffeineEntry}
        onClose={() => { setCaffeineOpen(false); setCaffeineEntry(null) }}
        onSave={saveCaffeine}
        onDelete={caffeineEntry ? deleteCaffeine : null}
      />
    </Screen>
  )
}