import { Search, X } from 'lucide-react'
import { Avatar, initialsOf } from './ui'

export default function LeaderboardFilterBar({
  query,
  onQueryChange,
  results,
  onSelectPlayer,
  onClearQuery,
  notDoing,
  onToggleNotDoing,
  searching,
}) {
  const showDropdown = !searching && query.length > 0
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={15}
          color="var(--color-faint)"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search player"
          className="h-9 w-full rounded-[12px] bg-card pl-9 pr-9 text-[13px] text-ink shadow-[0px_2px_6px_0px_#0000000F] outline-none placeholder:text-faint"
        />
        {query && (
          <button
            onClick={onClearQuery}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X size={14} color="var(--color-faint)" />
          </button>
        )}
        {(searching || showDropdown) && (
          <div className="absolute inset-x-0 top-[40px] z-10 rounded-[24px] bg-card p-1.5 shadow-[0px_12px_32px_0px_#00000040] outline outline-1 outline-line/10">
            {searching ? (
              <span className="block px-3 py-2 text-[12px] text-faint">Searching…</span>
            ) : results.length ? (
              results.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => onSelectPlayer(p)}
                  className="flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-[13px] text-sub hover:bg-accent/15"
                >
                  <Avatar initials={initialsOf(p.nickname)} color="#3B3B47" size={22} src={p.pfp} />
                  <span className="truncate">{p.nickname}</span>
                </button>
              ))
            ) : (
              <span className="block px-3 py-2 text-[12px] text-faint">No players found</span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onToggleNotDoing}
        className={`flex h-9 items-center justify-center rounded-full px-4 text-[13px] font-medium ${
          notDoing ? 'bg-accent/15 text-accent' : 'bg-card text-sub shadow-[0px_2px_6px_0px_#0000000F]'
        }`}
      >
        Not doing
      </button>
    </div>
  )
}