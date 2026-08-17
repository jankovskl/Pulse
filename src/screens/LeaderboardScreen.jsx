import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, Dumbbell, Lock, Search, ShieldCheck } from 'lucide-react'
import { exerciseOptions, leaderboardFor } from '../lib/data'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  fetchTopLifts,
  buildRows,
  fetchUserLifts,
  fetchDistinctExercises,
  notDoneExercises,
} from '../lib/leaderboard'
import { fetchProfiles, searchProfiles } from '../lib/profile'
import LeaderboardFilterBar from '../components/LeaderboardFilterBar'
import AuthModal from '../components/AuthModal'
import ProfileView from '../components/ProfileView'
import { DecoratedAvatar, initialsOf, Screen, useDialog, useNav } from '../components/ui'

export default function LeaderboardScreen() {
  const nav = useNav()
  const store = useStore()
  const auth = useAuth()
  const authDialog = useDialog()
  const [exercise, setExercise] = useState(nav.ex || '')
  const [exQuery, setExQuery] = useState('')
  const [exOpen, setExOpen] = useState(false)
  const [liveRows, setLiveRows] = useState(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [player, setPlayer] = useState(null) // { user_id, nickname, pfp } | null
  const [notDoing, setNotDoing] = useState(false)
  const [notDoingOptions, setNotDoingOptions] = useState(null) // null = loading/off
  const [filterTick, setFilterTick] = useState(0)
  const refreshTimer = useRef(null)

  const exOptions = useMemo(
    () => exerciseOptions(store.days, store.sessions),
    [store.days, store.sessions],
  )
  const options = useMemo(() => notDoing ? (notDoingOptions ?? []) : exOptions, [notDoing, notDoingOptions, exOptions])
  const exMatches = useMemo(() => {
    const q = exQuery.trim().toLowerCase()
    return q ? options.filter((e) => e.toLowerCase().includes(q)) : options
  }, [options, exQuery])
  const exitPlayer = () => {
    setPlayer(null)
    setQuery('')
    setSearchResults([])
  }
  const openProfile = (r) => {
    if (!r?.user_id) return
    setPlayer({ user_id: r.user_id, nickname: r.name, pfp: r.avatar })
  }
  const current = exercise || options[0] || 'Bench Press'

  const exSessions = useMemo(
    () => store.sessions.filter((s) => s.exercise === current),
    [store.sessions, current],
  )
  const userBest = useMemo(
    () => Math.max(0, ...exSessions.map((s) => s.weight ?? 0)),
    [exSessions],
  )

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!supabase || !auth.user || !debouncedQuery) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let active = true
    setSearching(true)
    searchProfiles(supabase, debouncedQuery)
      .then((res) => {
        if (active) setSearchResults(res)
      })
      .catch(() => {
        if (active) setSearchResults([])
      })
      .finally(() => {
        if (active) setSearching(false)
      })
    return () => {
      active = false
    }
  }, [debouncedQuery, auth.user])

  useEffect(() => {
    if (!supabase || !auth.user || !notDoing) {
      setNotDoingOptions(null)
      return
    }
    let active = true
    const load = async () => {
      try {
        const [all, mine] = await Promise.all([
          fetchDistinctExercises(supabase),
          fetchUserLifts(supabase, auth.user.id).then((l) => l.map((x) => x.exercise)),
        ])
        if (active) setNotDoingOptions(notDoneExercises(all, mine))
      } catch {
        if (active) setNotDoingOptions([])
      }
    }
    load()
    return () => {
      active = false
    }
  }, [notDoing, auth.user, filterTick])

  // When signed in, pull real lifts (and keep them live via realtime).
  useEffect(() => {
    if (!supabase || !auth.user) {
      setLiveRows(null)
      return
    }
    let active = true
    const load = async () => {
      try {
        const top = await fetchTopLifts(supabase, current)
        const ids = top.map((l) => l.user_id)
        const profileMap = await fetchProfiles(supabase, ids).catch(() => ({}))
        if (active) setLiveRows(buildRows(top, auth.user.id, profileMap))
      } catch {}
    }
    load()
    const channel = supabase
      .channel(`lifts:${current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lifts', filter: `exercise=eq.${current}` },
        () => load(),
      )
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [current, auth.user])

  useEffect(() => {
    if (notDoing && notDoingOptions?.length && !notDoingOptions.includes(current)) {
      setExercise(notDoingOptions[0])
    }
  }, [notDoing, notDoingOptions, current])

  useEffect(() => {
    if (!supabase || !auth.user || (!player && !notDoing)) return
    const channel = supabase
      .channel('lifts:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lifts' }, () => {
        clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => setFilterTick((t) => t + 1), 500)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [player, notDoing, auth.user])

  const rows = useMemo(
    () => (liveRows ? liveRows : leaderboardFor(current, userBest)),
    [liveRows, current, userBest],
  )
  const hasUser = rows.some((r) => r.you)
  const top3 = rows.slice(0, 3).filter(Boolean)
  const rest = rows.slice(3)

  return (
    <Screen activeTab="progress">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav.go('progress')}
            className="flex h-9 w-9 items-center justify-center rounded-3xl"
          >
            <ChevronLeft size={18} color="var(--color-ink)" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[26px] font-bold text-ink">Leaderboard</h1>
            <span className="text-[12px] text-faint">{current} · 1RM max lifts · Worldwide</span>
          </div>
        </div>

        {auth.user && (
          <LeaderboardFilterBar
            query={query}
            onQueryChange={setQuery}
            results={searchResults}
            onSelectPlayer={(p) => {
              setPlayer(p)
              setQuery('')
              setSearchResults([])
              setNotDoing(false)
              setNotDoingOptions(null)
            }}
            onClearQuery={() => {
              setQuery('')
              setSearchResults([])
            }}
            notDoing={notDoing}
            onToggleNotDoing={() => setNotDoing((v) => !v)}
            searching={searching}
          />
        )}

        <>
          <div className="relative">
              <span className="mb-1.5 block text-[14px] font-medium text-sub">Exercise</span>
              <div className="relative">
                <Search
                  size={15}
                  color="var(--color-faint)"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  value={exQuery}
                  placeholder={current}
                  onChange={(e) => {
                    setExQuery(e.target.value)
                    setExOpen(true)
                  }}
                  onFocus={() => setExOpen(true)}
                  onBlur={() => setExOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && exMatches[0]) {
                      setExercise(exMatches[0])
                      setExQuery('')
                      setExOpen(false)
                      e.currentTarget.blur()
                    } else if (e.key === 'Escape') {
                      setExOpen(false)
                      e.currentTarget.blur()
                    }
                  }}
                  className="h-9 w-full rounded-[12px] bg-card pl-9 pr-3 text-[13px] text-ink placeholder:text-sub shadow-[0px_2px_6px_0px_#0000000F] outline outline-1 outline-transparent focus:outline-accent/50"
                />
              </div>
              {exOpen && (
                <div className="glass-panel absolute inset-x-0 top-[70px] z-10 max-h-[280px] overflow-y-auto rounded-[24px] bg-card p-1.5 shadow-[0px_12px_32px_0px_#00000040] outline outline-1 outline-line/10">
                  {exMatches.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 px-3 py-4 text-center">
                      <Dumbbell size={16} color="var(--color-muted)" />
                      <span className="text-[12px] text-faint">
                        {options.length === 0
                          ? 'No workouts logged yet — finish one to see exercises here'
                          : `Nothing you've done matches "${exQuery.trim()}"`}
                      </span>
                    </div>
                  ) : (
                    exMatches.map((e) => {
                      const active = e === exercise
                      return (
                        <button
                          key={e}
                          onMouseDown={(ev) => {
                            ev.preventDefault()
                            setExercise(e)
                            setExQuery('')
                            setExOpen(false)
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-left text-[13px] ${
                            active ? 'bg-accent/15 text-accent' : 'text-sub'
                          }`}
                        >
                          {active ? (
                            <Check size={16} color="var(--color-accent)" strokeWidth={2.5} />
                          ) : (
                            <Dumbbell size={16} color="var(--color-faint)" />
                          )}
                          {e}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

          {!auth.user ? (
            <p className="text-[11px] leading-relaxed text-faint">
              Log in to see real lifts from athletes worldwide.
            </p>
          ) : notDoing ? (
            notDoingOptions !== null && !notDoingOptions.length ? (
              <p className="text-[11px] leading-relaxed text-faint">You're on every board.</p>
            ) : null
          ) : (
            !hasUser && (
              <p className="text-[11px] leading-relaxed text-faint">
                Log a {current} workout to place your best lift on this board.
              </p>
            )
          )}

          <div className="relative">
            <div
              className={`flex flex-col gap-5 ${
                !auth.user ? 'pointer-events-none select-none blur-[8px]' : ''
              }`}
              data-tutorial="leaderboard-list"
            >
              <div className="flex items-end justify-center gap-2.5 pt-4" data-tutorial="leaderboard-top3">
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((r) => (
                  <button
                    key={r.name}
                    onClick={() => openProfile(r)}
                    className="flex w-[92px] flex-col items-center"
                  >
                    <span className="mb-1.5 text-[11px] font-semibold text-faint">
                      {r.name.split(' ')[0]}
                    </span>
                    <div
                      className={`flex w-full flex-col items-center justify-end rounded-[20px] outline outline-1 ${
                        r.rank === 1
                          ? 'h-[104px] bg-gradient-to-b from-[#F5A52422] to-transparent outline-[#F5A52440]'
                          : r.rank === 2
                            ? 'h-[84px] bg-gradient-to-b from-[#A1A1AA22] to-transparent outline-[#A1A1AA40]'
                            : 'h-[64px] bg-gradient-to-b from-[#B08D5722] to-transparent outline-[#B08D5740]'
                      }`}
                    >
                      <DecoratedAvatar
                        decoration={r.decoration}
                        initials={initialsOf(r.name)}
                        color={r.color}
                        size={30}
                        src={r.avatar}
                      />
                      <span className="mt-1 text-[13px] font-bold text-ink">{r.weight}</span>
                    </div>
                    <span
                      className={`mt-1.5 text-[15px] ${
                        r.rank === 1 ? 'text-gold' : r.rank === 2 ? 'text-silver' : 'text-bronze'
                      }`}
                    >
                      {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {rest.map((r) => (
                  <button
                    key={r.name}
                    onClick={() => openProfile(r)}
                    className={`flex items-center gap-3 rounded-[16px] px-3.5 py-3 text-left ${
                      r.you
                        ? 'bg-accent/15 outline outline-1 outline-accent/40'
                        : 'bg-surface outline outline-1 outline-line/10'
                    }`}
                  >
                    <span
                      className={`w-5 text-center text-[13px] ${r.you ? 'font-bold text-accent' : 'text-faint'}`}
                    >
                      {r.rank}
                    </span>
                    <DecoratedAvatar
                      decoration={r.decoration}
                      initials={initialsOf(r.name)}
                      color={r.color}
                      size={30}
                      src={r.avatar}
                    />
                    <div className="flex flex-1 flex-col leading-tight">
                      <span className="flex items-center gap-1 text-[14px] font-medium text-ink">
                        {r.name}
                        {r.isAdmin && <ShieldCheck size={12} color="var(--color-accent)" />}
                      </span>
                      <span className="text-[11px] text-muted">{r.handle}</span>
                    </div>
                    <span className={`text-[14px] font-semibold ${r.you ? 'text-accent' : 'text-ink'}`}>
                      {r.weight} kg
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {!auth.user && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
                  <Lock size={20} color="var(--color-accent)" />
                </div>
                <span className="text-[14px] font-semibold text-ink">Log in to view the leaderboard</span>
                <span className="text-[12px] text-faint">See real lifts from athletes worldwide</span>
                <button
                  onClick={authDialog.openDialog}
                  className="mt-1 h-11 rounded-[14px] bg-accent px-6 text-[14px] font-semibold text-white"
                >
                  Log in
                </button>
              </div>
            )}
          </div>
        </>
        </div>

      {player && (
        <ProfileView
          user={player}
          isYou={player.user_id === auth.user?.id}
          onClose={exitPlayer}
          onPickExercise={(ex) => {
            setExercise(ex)
            exitPlayer()
          }}
        />
      )}

      <AuthModal open={authDialog.open} onClose={authDialog.closeDialog} />
    </Screen>
  )
}
