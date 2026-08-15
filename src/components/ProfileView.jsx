import { useEffect, useState } from 'react'
import { ChevronRight, ShieldCheck, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchFullProfile } from '../lib/profile'
import { fetchUserLifts, fetchLiftRanks, buildPlayerExerciseList } from '../lib/leaderboard'
import { computeBadges, widgetById, DEFAULT_WIDGETS } from '../lib/badges'
import { DecoratedAvatar, DecorationTitle, initialsOf, DECORATION_FRAMES, DECORATION_TITLES } from './ui'

const WIDGET_VALUE = {
  best: (s) => `${s.best ?? 0} kg`,
  sessions: (s) => `${s.sessions ?? 0}`,
  streak: (s) => `${s.streak ?? 0}d`,
}

// Full public profile preview. `user` needs at least { user_id }; nickname/pfp
// are used as placeholders until the full profile row loads.
export default function ProfileView({ user, isYou = false, onClose, onPickExercise }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [lifts, setLifts] = useState(null)

  useEffect(() => {
    if (!supabase || !user?.user_id) {
      setLoading(false)
      return
    }
    let active = true
    const load = async () => {
      try {
        const [full, liftList] = await Promise.all([
          fetchFullProfile(supabase, user.user_id),
          fetchUserLifts(supabase, user.user_id),
        ])
        const ranks = await fetchLiftRanks(supabase, liftList)
        if (!active) return
        setProfile(full)
        setLifts(buildPlayerExerciseList(liftList, ranks))
      } catch {
        if (active) {
          setProfile(null)
          setLifts([])
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

  const stats = profile?.stats ?? {}
  const badges = computeBadges({ stats, isAdmin: !!profile?.is_admin })
  const widgetIds = profile?.widgets?.length ? profile.widgets : DEFAULT_WIDGETS
  const nickname = profile?.nickname || user?.nickname || 'Athlete'
  const noStatsYet = isYou && !Object.keys(stats).length
  const frame = DECORATION_FRAMES[profile?.decoration]
  const title = DECORATION_TITLES[profile?.decoration]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay md:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-[420px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card p-5 pb-8 md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={frame ? 'rounded-[20px] p-4 pb-3' : undefined} style={frame}>
          <div className="flex items-start gap-3.5">
            <DecoratedAvatar
              decoration={profile?.decoration || null}
              initials={initialsOf(nickname)}
              color="#3B3B47"
              size={56}
              src={profile?.pfp ?? user?.pfp ?? null}
            />
            <div className="flex flex-1 flex-col gap-1 pt-1">
              <span className={`text-[17px] font-bold ${frame ? 'text-white' : 'text-soft'}`}>{nickname}</span>
              {title && <DecorationTitle decoration={profile.decoration} size="text-[10px]" />}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {badges.map((b) => (
                    <span
                      key={b.id}
                      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        b.id === 'admin'
                          ? 'bg-accent/20 text-accent-light'
                          : frame
                            ? 'bg-black/25 text-white'
                            : 'bg-tile text-sub'
                      }`}
                    >
                      {b.id === 'admin' && <ShieldCheck size={10} color="var(--color-accent)" />}
                      {b.label}
                    </span>
                  ))}
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
                <div className="grid grid-cols-2 gap-2">
                  {widgetIds
                    .map((id) => widgetById(id))
                    .filter(Boolean)
                    .map((w) => (
                      <div
                        key={w.id}
                        className="flex flex-col gap-0.5 rounded-[16px] bg-surface px-3.5 py-3 outline outline-1 outline-line/10"
                      >
                        <span className="text-[16px] font-bold text-soft">
                          {WIDGET_VALUE[w.id](stats)}
                        </span>
                        <span className="text-[11px] text-faint">{w.label}</span>
                      </div>
                    ))}
                </div>
              )
            )}

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold tracking-[1.4px] text-muted">LIFTS</span>
              {lifts === null || lifts.length === 0 ? (
                <span className="py-2 text-[12px] text-faint">This athlete has no lifts yet.</span>
              ) : (
                lifts.map((r) => (
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
