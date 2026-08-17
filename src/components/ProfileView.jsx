import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Dumbbell, Flame, Search, ShieldCheck, Trophy, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchFullProfile } from '../lib/profile'
import { fetchUserLifts, fetchLiftRanks, buildPlayerExerciseList } from '../lib/leaderboard'
import { computeBadges, widgetById, DEFAULT_WIDGETS, debugDecorationOverride, parseDecorations, TIERS } from '../lib/badges'
import { DecoratedAvatar, DecorationTitle, initialsOf, DECORATION_FRAMES, DECORATION_TITLES } from './ui'
import { UserStatus, WorkoutStatusCard } from './UserStatusDisplay'
import { fetchPresence, subscribeToPresence } from '../lib/presence'

const WIDGET_VALUE = {
  best: (s) => `${s.best ?? 0} kg`,
  sessions: (s) => `${s.sessions ?? 0}`,
  streak: (s) => `${s.streak ?? 0}d`,
}

const WIDGET_ICON = {
  best: { Icon: Trophy, color: '#F5D061' },
  sessions: { Icon: Dumbbell, color: '#0485F7' },
  streak: { Icon: Flame, color: '#FF383C', animated: true },
}

const WIDGET_DESCRIBE = {
  best: (s, you) => `${you ? 'Your' : "This athlete's"} heaviest lift is ${s.best ?? 0} kg`,
  sessions: (s, you) =>
    `${you ? 'You' : 'This athlete'} finished ${s.sessions ?? 0} workout ${(s.sessions ?? 0) === 1 ? 'day' : 'days'}`,
  streak: (s, you) => {
    const n = s.streak ?? 0
    return `${you ? 'You' : 'This athlete'} kept a streak of ${n} training ${n === 1 ? 'day' : 'days'} going — up to 2 rest days don't break it`
  },
}

// Compact stat pill: icon + value + label inline, with a hover/tap tooltip
// explaining the number.
function StatWidget({ w, stats, isYou }) {
  const [show, setShow] = useState(false)
  const meta = WIDGET_ICON[w.id]
  const Icon = meta?.Icon
  return (
    <div
      role="button"
      tabIndex={0}
      className="relative flex cursor-default items-center gap-2 rounded-full bg-surface px-3 py-1.5 outline outline-1 outline-line/10"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onClick={() => setShow((v) => !v)}
    >
      {Icon && (
        <Icon
          size={14}
          color={meta.color}
          className={meta.animated ? 'animate-flame shrink-0' : 'shrink-0'}
        />
      )}
      <span className="text-[13px] font-bold text-soft">{WIDGET_VALUE[w.id](stats)}</span>
      <span className="text-[11px] text-faint">{w.label}</span>
      {show && (
        <div className="absolute left-1/2 top-full z-20 mt-1.5 w-max max-w-[230px] -translate-x-1/2 rounded-[10px] bg-tile px-2.5 py-1.5 text-center text-[10px] leading-snug text-sub shadow-[0px_4px_14px_#00000066] outline outline-1 outline-line/10">
          {WIDGET_DESCRIBE[w.id]?.(stats, isYou)}
        </div>
      )}
    </div>
  )
}

// Show the 3 most impressive achievements first (legendary > hard > medium > easy).
const TIER_RANK = { legendary: 0, hard: 1, medium: 2, easy: 3 }

// Full public profile preview. `user` needs at least { user_id }; nickname/pfp
// are used as placeholders until the full profile row loads.
export default function ProfileView({ user, isYou = false, onClose, onPickExercise }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [lifts, setLifts] = useState(null)
  const [liftQuery, setLiftQuery] = useState('')
  const [presence, setPresence] = useState(null)

  useEffect(() => {
    setLiftQuery('')
  }, [user?.user_id])

  useEffect(() => {
    if (!supabase || !user?.user_id) {
      setLoading(false)
      return
    }
    let active = true
    const load = async () => {
      try {
        const [full, liftList, presenceData] = await Promise.all([
          fetchFullProfile(supabase, user.user_id),
          fetchUserLifts(supabase, user.user_id),
          fetchPresence(supabase, [user.user_id]),
        ])
        const ranks = await fetchLiftRanks(supabase, liftList)
        if (!active) return
        setProfile(full)
        setLifts(buildPlayerExerciseList(liftList, ranks))
        // Check if presence is stale (>5 minutes old) - force offline
        const presenceRow = presenceData[user.user_id]
        if (presenceRow) {
          const lastSeen = new Date(presenceRow.lastSeen)
          const isStale = Date.now() - lastSeen.getTime() > 5 * 60 * 1000
          setPresence({
            status: isStale ? 'offline' : presenceRow.status,
            lastSeen: presenceRow.lastSeen,
            workoutData: presenceRow.workoutData,
          })
        } else {
          setPresence(null)
        }
      } catch {
        if (active) {
          setProfile(null)
          setLifts([])
          setPresence(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [user?.user_id])

  // Subscribe to real-time presence updates
  useEffect(() => {
    if (!supabase || !user?.user_id) return

    const unsubscribe = subscribeToPresence(supabase, [user.user_id], (newPresence) => {
      if (newPresence.user_id === user.user_id) {
        // Check if presence is stale (>5 minutes old) - force offline
        const lastSeen = new Date(newPresence.last_seen)
        const isStale = Date.now() - lastSeen.getTime() > 5 * 60 * 1000
        const status = isStale ? 'offline' : newPresence.status
        
        setPresence({
          status,
          lastSeen: newPresence.last_seen,
          workoutData: newPresence.workout_data,
        })
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [user?.user_id])

  const stats = profile?.stats ?? {}
  // Lifts are searched instead of dumped as one long list: the input
  // filters them, and without a query only the top 5 are shown.
  const liftMatches = useMemo(() => {
    const list = lifts ?? []
    const q = liftQuery.trim().toLowerCase()
    const filtered = q ? list.filter((r) => r.exercise.toLowerCase().includes(q)) : list
    return filtered.slice(0, 5)
  }, [lifts, liftQuery])
  const badges = computeBadges({ stats, isAdmin: !!profile?.is_admin })
  const adminBadge = badges.find((b) => b.id === 'admin')
  const topAchievements = [...badges.filter((b) => b.id !== 'admin')]
    .sort((a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9))
    .slice(0, 3)
  const widgetIds = profile?.widgets?.length ? profile.widgets : DEFAULT_WIDGETS
  const nickname = profile?.nickname || user?.nickname || 'Athlete'
  const noStatsYet = isYou && !Object.keys(stats).length
  const equipped = debugDecorationOverride(isYou) ?? parseDecorations(profile)
  const frame = DECORATION_FRAMES[equipped.frame]
  const title = DECORATION_TITLES[equipped.title]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay md:items-center"
      onClick={onClose}
    >
      <div
        className="glass-panel flex max-h-[85dvh] w-full max-w-[420px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 pb-8 md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={frame ? 'rounded-[20px] p-4 pb-3' : undefined} style={frame}>
          <div className="flex items-start gap-3.5">
            <DecoratedAvatar
              decoration={equipped}
              initials={initialsOf(nickname)}
              color="#3B3B47"
              size={72}
              src={profile?.pfp ?? user?.pfp ?? null}
            />
            <div className="flex flex-1 flex-col gap-1 pt-1">
              <span className={`text-[17px] font-bold ${frame ? 'text-white' : 'text-soft'}`}>{nickname}</span>
              {title && <DecorationTitle decoration={equipped.title} size="text-[10px]" />}
              {adminBadge && (
                <div className="flex flex-wrap gap-1">
                  <span className="flex items-center gap-1 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-light">
                    <ShieldCheck size={10} color="var(--color-accent)" />
                    {adminBadge.label}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close profile"
              className={`flex h-8 w-8 items-center justify-center rounded-full ${frame ? 'bg-black/25' : 'bg-tile'}`}
            >
              <X size={15} color={frame ? '#FFFFFF' : 'var(--color-sub)'} />
            </button>
          </div>
        </div>

        {profile?.bio ? (
          <p className="text-[13px] leading-relaxed text-sub">{profile.bio}</p>
        ) : isYou ? (
          <p className="text-[12px] leading-relaxed text-faint">
            Add a bio to your profile in Settings.
          </p>
        ) : null}

        {/* Show status for everyone (including yourself) if presence data exists */}
        <UserStatus
          status={presence?.status || 'offline'}
          lastSeen={presence?.lastSeen}
          workoutData={presence?.workoutData}
        />

        {presence?.status === 'working_out' && presence?.workoutData && (
          <WorkoutStatusCard workoutData={presence.workoutData} />
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-tile border-t-accent" />
            <span className="text-[13px] text-sub">Loading profile…</span>
          </div>
        ) : (
          <>
            {noStatsYet ? (
              <p className="rounded-[16px] bg-surface p-3 text-center text-[12px] text-faint">
                Log workouts and stay signed in to publish your stats, badges and widgets here.
              </p>
            ) : (
              widgetIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {widgetIds
                    .map((id) => widgetById(id))
                    .filter(Boolean)
                    .map((w) => (
                      <StatWidget key={w.id} w={w} stats={stats} isYou={isYou} />
                    ))}
                </div>
              )
            )}

            {topAchievements.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-[1.4px] text-muted">TOP ACHIEVEMENTS</span>
                <div className="flex flex-wrap gap-1.5">
                  {topAchievements.map((b) => (
                    <span
                      key={b.id}
                      title={b.hint}
                      className="rounded-full px-2 py-1 text-[10px] font-semibold"
                      style={{ background: `${TIERS[b.tier]?.color}22`, color: TIERS[b.tier]?.color }}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[1.4px] text-muted">LIFTS</span>
              {lifts === null || lifts.length === 0 ? (
                <span className="py-2 text-[12px] text-faint">This athlete has no lifts yet.</span>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      size={14}
                      color="var(--color-faint)"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                    />
                    <input
                      value={liftQuery}
                      onChange={(e) => setLiftQuery(e.target.value)}
                      placeholder="Search exercise…"
                      className="h-9 w-full rounded-[12px] bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-faint outline outline-1 outline-line/10 focus:outline-accent/50"
                    />
                  </div>
                  {liftMatches.length === 0 ? (
                    <span className="py-2 text-[12px] text-faint">
                      No lifts match “{liftQuery.trim()}”.
                    </span>
                  ) : (
                    liftMatches.map((r) => (
                      <button
                        key={r.exercise}
                        disabled={!onPickExercise}
                        onClick={() => onPickExercise?.(r.exercise)}
                        className="flex items-center gap-3 rounded-[16px] bg-surface px-3.5 py-3 text-left outline outline-1 outline-line/10 disabled:cursor-default"
                      >
                        <div className="flex flex-1 flex-col">
                          <span className="text-[14px] font-medium text-soft">{r.exercise}</span>
                          <span className="text-[11px] text-muted">{r.weight} kg</span>
                        </div>
                        <span className="text-[13px] font-semibold text-soft">
                          {r.rank <= 3 ? (r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉') : `#${r.rank}`}
                        </span>
                        {onPickExercise && <ChevronRight size={16} color="var(--color-faint)" />}
                      </button>
                    ))
                  )}
                  {!liftQuery.trim() && lifts.length > 5 && (
                    <span className="text-center text-[11px] text-faint">
                      Top 5 shown — search to find the rest
                    </span>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
