import { useMemo, useState } from 'react'
import { Check, ChevronLeft, Plus, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { CATEGORIES, LIBRARY } from '../lib/data'
import { Screen, useNav } from '../components/ui'

export default function LibraryScreen() {
  const store = useStore()
  const nav = useNav()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')

  const fromDay = nav.fromDayId ? store.days.find((d) => d.id === nav.fromDayId) : null
  const dayExerciseNames = useMemo(
    () => new Set((fromDay?.exercises ?? []).map((e) => e.name)),
    [fromDay],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LIBRARY.filter(
      (e) =>
        (cat === 'All' || e.muscle === cat) &&
        (!q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)),
    )
  }, [query, cat])

  const inDay = (name) => dayExerciseNames.has(name)

  function toggleAdd(ex) {
    if (!fromDay) return
    if (inDay(ex.name)) {
      const exId = fromDay.exercises.find((e) => e.name === ex.name)?.id
      if (exId) store.removeExercise(fromDay.id, exId)
    } else {
      store.addExercise(fromDay.id, ex)
    }
  }

  return (
    <Screen activeTab="home">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => (fromDay ? nav.go('day', { dayId: fromDay.id }) : nav.go('home'))}
            className="flex h-9 w-9 items-center justify-center rounded-3xl"
          >
            <ChevronLeft size={18} color="var(--color-ink)" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold text-ink">Exercise Library</h1>
            <span className="text-[12px] text-faint">{LIBRARY.length} exercises</span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[14px] bg-field p-2.5 outline outline-1 outline-line/10">
          <Search size={16} color="var(--color-sub)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-sub outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="flex h-5 w-5 items-center justify-center rounded-[12px] bg-field outline outline-1 outline-line/10"
            >
              <X size={14} color="var(--color-sub)" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                cat === c ? 'bg-accent text-white' : 'bg-tile text-sub'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[1.4px] text-muted">
            {cat === 'All' ? 'ALL EXERCISES' : cat.toUpperCase()}
          </span>
          <span className="text-[11px] text-muted">
            {filtered.length} of {LIBRARY.length}
          </span>
        </div>

        <div className="flex flex-col">
          {filtered.map((ex) => {
            const added = inDay(ex.name)
            return (
              <div
                key={ex.name}
                className="flex items-center justify-between border-b border-line/5 py-3 last:border-b-0"
              >
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium text-ink">{ex.name}</span>
                  <span className="text-[12px] text-muted">{ex.muscle}</span>
                </div>
                {fromDay ? (
                  <button
                    onClick={() => toggleAdd(ex)}
                    className={`flex h-8 items-center gap-1 rounded-[24px] px-3 outline outline-1 ${
                      added
                        ? 'bg-field text-good outline-line/10'
                        : 'bg-field text-ink outline-line/10'
                    }`}
                  >
                    {added ? (
                      <Check size={14} color="#17C964" strokeWidth={2.5} />
                    ) : (
                      <Plus size={14} color="var(--color-ink)" strokeWidth={2.5} />
                    )}
                    <span className={`text-[13px] ${added ? 'text-good' : 'text-ink'}`}>
                      {added ? 'Added' : 'Add'}
                    </span>
                  </button>
                ) : (
                  <span className="text-[12px] text-faint">{ex.muscle}</span>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-[13px] text-muted">
              No exercises match “{query}”
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}
