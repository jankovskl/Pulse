import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Cat,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudCheck,
  CloudOff,
  Database,
  Download,
  Lock,
  Palette,
  Pencil,
  Rocket,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useStore, suppressNextPull, resetPullSuppression, requestCloudWipe } from '../lib/store'
import { fetchChangelog } from '../lib/changelog'
import { getUserId } from '../lib/auth'
import { useAuth } from '../lib/auth'
import { isSupabaseEnabled, supabase } from '../lib/supabase'
import { THEMES as THEME_PRESETS, themeById } from '../lib/themes'
import {
  ACHIEVEMENTS,
  computeBadges,
  badgeById,
  DECORATIONS,
  DECORATION_TYPES,
  DEFAULT_WIDGETS,
  hasBadge,
  isDecorationUnlocked,
  TIERS,
  WIDGETS,
} from '../lib/badges'
import { deriveStats, fetchFullProfile, saveProfile } from '../lib/profile'
import AuthModal from '../components/AuthModal'
import AccountEditor from '../components/AccountEditor'
import { Avatar, DecoratedAvatar, DecorationTitle, DECORATION_FRAMES, initialsOf, Modal, Screen, Toggle, useDialog } from '../components/ui'

const THEMES = ['#F5A524', '#17C964', '#EC4899', '#A855F7', '#FF383C', '#0485F7']

function Row({ icon, title, subtitle, right, onClick, iconBg = 'bg-accent/15' }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[16px] bg-card px-3.5 py-3 text-left shadow-[0px_2px_6px_0px_#0000000F]"
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${iconBg}`}>{icon}</div>
      <div className="flex flex-1 flex-col leading-tight">
        <span className="text-[14px] font-semibold text-ink">{title}</span>
        {subtitle && <span className="mt-0.5 text-[11px] text-faint">{subtitle}</span>}
      </div>
      {right ?? <ChevronRight size={14} color="var(--color-muted)" />}
    </button>
  )
}

function themeGradient(t) {
  return t.colors.mid
    ? `linear-gradient(-157deg, ${t.colors.bg} 14.645%, ${t.colors.mid} 50%, ${t.colors.bg2} 85.355%)`
    : `linear-gradient(-157deg, ${t.colors.bg} 14.645%, ${t.colors.bg2} 85.355%)`
}

function ThemeSwatch({ t, active, onPick }) {
  return (
    <button
      onClick={onPick}
      aria-pressed={active}
      className={`flex h-[72px] flex-col justify-between rounded-[14px] p-2.5 outline outline-1 transition-transform active:scale-[0.97] ${
        active ? 'outline-2 outline-accent' : 'outline-line/10'
      }`}
      style={{ background: themeGradient(t) }}
    >
      <span
        className="h-3 w-3 rounded-full"
        style={{ background: t.colors.surface, outline: `1px solid ${t.colors.line}26` }}
      />
      <span className="text-left text-[11px] font-medium" style={{ color: t.colors.ink }}>
        {t.name}
      </span>
    </button>
  )
}

export default function SettingsScreen() {
  const store = useStore()
  const auth = useAuth()
  const fileRef = useRef(null)
  const authDialog = useDialog()
  const signOutDialog = useDialog()
  const deleteDialog = useDialog()
  const [deletePw, setDeletePw] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [changelog, setChangelog] = useState(null)
  const [failed, setFailed] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [view, setView] = useState('main')
  const [myProfile, setMyProfile] = useState(null)
  const [bio, setBio] = useState('')
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS)
  const [decoration, setDecoration] = useState('none')
  const [achievementsOpen, setAchievementsOpen] = useState(true)

  // Badges are computed from local (unpublished) stats so unlocks react to
  // fresh workouts immediately, not only after the next cloud push.
  const myBadges = useMemo(
    () =>
      computeBadges({
        stats: deriveStats({ sessions: store.sessions, totals: store.totals }),
        isAdmin: !!myProfile?.is_admin,
      }),
    [store.sessions, store.totals, myProfile?.is_admin],
  )

  // Load the full profile row whenever the profile editor opens.
  useEffect(() => {
    if (view !== 'profile' || !supabase || !auth.user) return
    let active = true
    fetchFullProfile(supabase, auth.user.id)
      .then((p) => {
        if (!active) return
        setMyProfile(p)
        setBio(p?.bio ?? '')
        setWidgets(p?.widgets?.length ? p.widgets : DEFAULT_WIDGETS)
        setDecoration(p?.decoration ?? 'none')
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [view, auth.user])

  function saveProfilePatch(patch) {
    if (!supabase || !auth.user) return
    saveProfile(supabase, auth.user.id, patch).catch(() => {})
  }

  function toggleWidget(id) {
    const next = widgets.includes(id) ? widgets.filter((w) => w !== id) : [...widgets, id]
    setWidgets(next)
    saveProfilePatch({ widgets: next })
  }

  function moveWidget(id, dir) {
    const i = widgets.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= widgets.length) return
    const next = [...widgets]
    ;[next[i], next[j]] = [next[j], next[i]]
    setWidgets(next)
    saveProfilePatch({ widgets: next })
  }

  function pickDecoration(id) {
    if (!isDecorationUnlocked(myBadges, id)) return
    setDecoration(id)
    saveProfilePatch({ decoration: id })
  }

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchChangelog()
      .then((entries) => {
        if (!cancelled) {
          setChangelog(entries)
          setFailed(false)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function exportData() {
    const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pulse-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        store.importAll(JSON.parse(reader.result))
        alert('Backup imported successfully')
      } catch {
        alert('That file does not look like a Pulse backup')
      }
    }
    reader.readAsText(file)
  }

  async function deleteAllData() {
    if (deleteBusy) return
    setDeleteBusy(true)
    setDeleteError(null)
    // Use getUserId() (module-level, updated synchronously on sign-out) instead
    // of `auth.user` (React context, stale until re-render). After a sign-out
    // the React context value lags ~1 frame, so reading `auth.user` during that
    // window would take the wrong (signed-in, cloud-wiping) code path.
    const userId = getUserId()
    if (userId) suppressNextPull()
    try {
      if (userId) {
        // Re-fetch the session user to get a guaranteed-fresh email for the
        // password re-auth prompt (the React context value may be stale).
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          resetPullSuppression()
          setDeleteBusy(false)
          return
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: deletePw,
        })
        if (error) {
          resetPullSuppression()
          setDeleteError('Incorrect password')
          setDeleteBusy(false)
          return
        }
      }
      // The user is genuinely signed in: the delete is password-confirmed, so
      // wiping the cloud copy is intended. Flag it so the debounced push is
      // allowed to send the empty state.
      if (userId) requestCloudWipe()
      store.clearAllData()
      deleteDialog.closeDialog()
      setDeletePw('')
    } catch {
      setDeleteError('Something went wrong. Try again.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <Screen activeTab="settings">
      {view === 'profile' ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('main')}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-tile"
            >
              <ChevronLeft size={16} color="var(--color-sub)" />
            </button>
            <div className="flex flex-col gap-1">
              <h1 className="text-[26px] font-bold text-ink">Profile</h1>
              <span className="text-[12px] text-faint">Account, bio, widgets & decoration</span>
            </div>
          </div>

          {!auth.user ? (
            <div className="flex flex-col items-center gap-2.5 rounded-[20px] bg-surface p-6 text-center outline outline-1 outline-line/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
                <Lock size={16} color="var(--color-accent)" />
              </div>
              <span className="text-[13px] font-semibold text-ink">Sign in to customize your profile</span>
              <span className="text-[12px] text-faint">Your bio, widgets and decoration are shared publicly</span>
              <button
                onClick={authDialog.openDialog}
                className="mt-1 h-9 rounded-[12px] bg-accent px-4 text-[13px] font-semibold text-white"
              >
                Sign in
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
                <span className="text-[14px] font-semibold text-ink">Account</span>
                <AccountEditor />
              </div>

              <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
                <span className="text-[14px] font-semibold text-ink">Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={3}
                  placeholder="Tell other athletes about yourself…"
                  className="w-full resize-none rounded-[12px] bg-field px-3 py-2.5 text-[13px] text-ink outline outline-1 outline-line/10 placeholder:text-faint"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tabular-nums text-faint">{bio.length}/160</span>
                  <button
                    onClick={() => saveProfilePatch({ bio })}
                    disabled={bio === (myProfile?.bio ?? '')}
                    className="h-8 rounded-[10px] bg-accent px-3.5 text-[12px] font-semibold text-white disabled:opacity-40"
                  >
                    Save bio
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold text-ink">Profile widgets</span>
                  <span className="text-[11px] text-faint">Pick the stats shown on your public profile, in order</span>
                </div>
                {WIDGETS.map((w) => {
                  const on = widgets.includes(w.id)
                  const idx = widgets.indexOf(w.id)
                  return (
                    <div key={w.id} className="flex items-center gap-2.5 rounded-[14px] bg-card px-3 py-2.5">
                      <span className={`flex-1 text-[13px] ${on ? 'font-medium text-ink' : 'text-faint'}`}>
                        {w.label}
                      </span>
                      {on && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveWidget(w.id, -1)}
                            disabled={idx === 0}
                            aria-label={`Move ${w.label} up`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-tile disabled:opacity-30"
                          >
                            <ArrowUp size={13} color="var(--color-sub)" />
                          </button>
                          <button
                            onClick={() => moveWidget(w.id, 1)}
                            disabled={idx === widgets.length - 1}
                            aria-label={`Move ${w.label} down`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-tile disabled:opacity-30"
                          >
                            <ArrowDown size={13} color="var(--color-sub)" />
                          </button>
                        </div>
                      )}
                      <Toggle on={on} onChange={() => toggleWidget(w.id)} />
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold text-ink">Decorations</span>
                  <span className="text-[11px] text-faint">Rings, accessories, titles and profile frames — unlocked by achievements</span>
                </div>
                {DECORATION_TYPES.map(({ type, label }) => (
                  <div key={type} className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold tracking-[1.4px] text-muted">{label.toUpperCase()}</span>
                    <div className={`grid gap-2 ${type === 'frame' || type === 'title' ? 'grid-cols-3' : 'grid-cols-3 md:grid-cols-5'}`}>
                      {DECORATIONS.filter((d) => d.type === type).map((d) => {
                        const unlocked = isDecorationUnlocked(myBadges, d.id)
                        const active = decoration === d.id
                        const required = d.requires ? badgeById(d.requires) : null
                        return (
                          <button
                            key={d.id}
                            onClick={() => pickDecoration(d.id)}
                            aria-pressed={active}
                            className={`flex flex-col items-center gap-1.5 rounded-[14px] p-3 outline outline-1 transition-transform active:scale-[0.97] ${
                              active ? 'outline-2 outline-accent' : 'outline-line/10'
                            } ${unlocked ? '' : 'opacity-60'}`}
                          >
                            {type === 'frame' ? (
                              <div
                                className="h-9 w-full rounded-[10px] outline outline-1 outline-line/10"
                                style={DECORATION_FRAMES[d.id]}
                              />
                            ) : type === 'title' ? (
                              <div className="flex h-9 w-full items-center justify-center rounded-[10px] bg-card outline outline-1 outline-line/10">
                                <DecorationTitle decoration={d.id} size="text-[9px]" />
                              </div>
                            ) : (
                              <DecoratedAvatar
                                decoration={d.id === 'none' ? null : d.id}
                                initials={initialsOf(auth.profile?.nickname || auth.user.email || 'You')}
                                color="#3B3B47"
                                size={36}
                                src={auth.profile?.pfp || null}
                              />
                            )}
                            <span className="text-center text-[10px] font-medium text-sub">{d.label}</span>
                            {!unlocked && required && (
                              <span className="flex items-center gap-0.5 text-[9px] text-faint">
                                <Lock size={8} color="var(--color-faint)" />
                                {required.label}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
                <button
                  onClick={() => setAchievementsOpen((v) => !v)}
                  aria-expanded={achievementsOpen}
                  className="flex w-full items-center justify-between gap-2"
                >
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[14px] font-semibold text-ink">Achievements</span>
                    <span className="text-[11px] text-faint">
                      {myBadges.filter((b) => b.id !== 'admin').length}/{ACHIEVEMENTS.length} earned — they unlock decorations
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    color="var(--color-muted)"
                    className={`shrink-0 transition-transform ${achievementsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {achievementsOpen && (
                  <div className="grid grid-cols-2 gap-2">
                    {ACHIEVEMENTS.map((a) => {
                      const earned = hasBadge(myBadges, a.id)
                      const tier = TIERS[a.tier]
                      return (
                        <div
                          key={a.id}
                          className={`flex flex-col gap-1 rounded-[14px] bg-card px-3 py-2.5 outline outline-1 outline-line/10 ${
                            earned ? '' : 'opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`truncate text-[12px] ${earned ? 'font-semibold text-ink' : 'text-faint'}`}>
                              {a.label}
                            </span>
                            {earned ? (
                              <Check size={13} color={tier.color} className="shrink-0" />
                            ) : (
                              <Lock size={11} color="var(--color-faint)" className="shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] leading-snug text-faint">{a.hint}</span>
                          <span
                            className="mt-0.5 text-[8px] font-bold uppercase tracking-[1px]"
                            style={{ color: earned ? tier.color : 'var(--color-faint)' }}
                          >
                            {tier.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : view === 'appearance' ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('main')}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-tile"
            >
              <ChevronLeft size={16} color="var(--color-sub)" />
            </button>
            <div className="flex flex-col gap-1">
              <h1 className="text-[26px] font-bold text-ink">Appearance</h1>
              <span className="text-[12px] text-faint">Theme, gradients & accent color</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink">Theme</span>
              <span className="text-[12px] text-muted">{themeById(store.settings.theme).name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {THEME_PRESETS.filter((t) => !t.id.startsWith('g-')).map((t) => (
                <ThemeSwatch
                  key={t.id}
                  t={t}
                  active={store.settings.theme === t.id}
                  onPick={() => store.setSettings({ theme: t.id })}
                />
              ))}
            </div>
            <span className="mt-3 text-[10px] font-semibold tracking-[1.4px] text-muted">GRADIENTS</span>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {THEME_PRESETS.filter((t) => t.id.startsWith('g-')).map((t) => (
                <ThemeSwatch
                  key={t.id}
                  t={t}
                  active={store.settings.theme === t.id}
                  onPick={() => store.setSettings({ theme: t.id })}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink">Accent color</span>
              <span className="text-[12px] text-muted">{store.settings.accent}</span>
            </div>
            <div className="flex items-center gap-3.5">
              {THEMES.map((t) => {
                const active = store.settings.accent === t
                return (
                  <button
                    key={t}
                    onClick={() => store.setSettings({ accent: t })}
                    title={`Set accent ${t}`}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform ${
                      active ? 'scale-105 outline outline-2 outline-white/25 outline-offset-2' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: t }}
                  >
                    {active && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
            <span className="text-[11px] text-faint">Saved on this device — accent updates everywhere</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold text-ink">Settings</h1>
          <span className="text-[12px] text-faint">Profile, data & preferences</span>
        </div>

        <div className="flex items-center gap-3 rounded-[20px] bg-surface p-4 outline outline-1 outline-line/10">
          <Avatar
            initials={initialsOf(auth.profile?.nickname || auth.user?.email || 'You')}
            src={auth.profile?.pfp || null}
            size={44}
          />
          <div className="flex flex-1 flex-col">
            {auth.user ? (
              <>
                <span className="text-[15px] font-semibold text-ink">
                  {auth.profile?.nickname || auth.user.email.split('@')[0]}
                </span>
                <span className="text-[12px] text-faint">{auth.user.email}</span>
              </>
            ) : (
              <>
                <span className="text-[15px] font-semibold text-ink">Not signed in</span>
                <span className="text-[12px] text-faint">Sign in under Customize profile to sync across devices</span>
              </>
            )}
          </div>
          {auth.user ? (
            <button
              onClick={signOutDialog.openDialog}
              className="flex h-9 items-center rounded-full bg-accent/15 px-3 text-[12px] font-semibold text-accent"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={authDialog.openDialog}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15"
            >
              <Pencil size={14} color="var(--color-accent)" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">PROFILE</div>
          <Row
            icon={<Sparkles size={15} color="var(--color-accent)" />}
            title="Customize profile"
            subtitle="Account, bio, widgets & avatar decoration"
            onClick={() => setView('profile')}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">DATA</div>
          <Row
            icon={
              !isSupabaseEnabled ? (
                <CloudOff size={15} color="var(--color-muted)" />
              ) : auth.status === 'loading' ? (
                <Cloud size={15} color="var(--color-muted)" />
              ) : auth.user && online ? (
                <CloudCheck size={15} color="#17C964" />
              ) : (
                <CloudOff size={15} color="#F5A524" />
              )
            }
            iconBg="bg-tile"
            title="Cloud sync"
            subtitle={
              !isSupabaseEnabled
                ? 'Supabase not configured'
                : auth.status === 'loading'
                  ? 'Checking connection…'
                  : auth.user && online
                    ? 'Synced with cloud'
                    : auth.user
                      ? 'Waiting to sync'
                      : 'Sign in to sync your data'
            }
            onClick={!auth.user ? authDialog.openDialog : undefined}
            right={!auth.user ? <ChevronRight size={14} color="var(--color-muted)" /> : false}
          />
          <Row
            icon={<Database size={15} color="var(--color-accent)" />}
            title="Back up my data"
            subtitle="Export everything as a JSON file"
            onClick={exportData}
            right={<Download size={14} color="var(--color-muted)" />}
          />
          <Row
            icon={<Upload size={15} color="var(--color-accent)" />}
            title="Restore a backup"
            subtitle="Load data from a previous export"
            onClick={() => fileRef.current?.click()}
            right={<Upload size={14} color="var(--color-muted)" />}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importData(f)
              e.target.value = ''
            }}
          />
          <Row
            icon={<Trash2 size={15} color="#DB3B3E" />}
            iconBg="bg-[#DB3B3E]/15"
            title="Delete all workout data"
            subtitle={auth.user ? 'Erases workouts, stats & cloud copy' : 'Erases workouts & stats from this device'}
            onClick={deleteDialog.openDialog}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">APPEARANCE</div>
          <Row
            icon={<Palette size={15} color="var(--color-accent)" />}
            title="Appearance"
            subtitle={themeById(store.settings.theme).name}
            onClick={() => setView('appearance')}
            right={
              <span
                className="h-8 w-8 rounded-[10px]"
                style={{ background: themeGradient(themeById(store.settings.theme)) }}
              />
            }
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <Row
            icon={<Cat size={15} color="var(--color-accent)" />}
            title="Neko pet"
            subtitle="A little cat keeps you company"
            right={<Toggle on={store.settings.neko} onChange={(v) => store.setSettings({ neko: v })} />}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">SYNC & ABOUT</div>
          <Row
            icon={<Rocket size={15} color="var(--color-accent)" />}
            title="What's new"
            subtitle={
              changelog?.length
                ? `v${changelog[0].version} · ${changelog[0].items[0] ?? 'recent changes'}`
                : 'Version 2.0.1 — rest timer, charts'
            }
            onClick={() => setSheetOpen(true)}
          />
        </div>

        <div className="flex flex-col gap-1 pt-1 text-center">
          <span className="text-[11px] text-faint">Pulse Fitness Tracker</span>
          <span className="text-[10px] text-faint/60">Local prototype · data stays in your browser</span>
        </div>
      </div>
      )}

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-overlay"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="flex max-h-[70dvh] w-full max-w-[420px] flex-col gap-4 rounded-t-[28px] bg-card p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[16px] font-semibold text-soft">What's new</span>
                <span className="text-[12px] text-muted">Changes from the latest pushes to GitHub</span>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-tile"
              >
                <X size={15} color="var(--color-sub)" />
              </button>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto">
              {failed ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <span className="text-[13px] text-sub">Couldn't load updates</span>
                  <button
                    onClick={() => {
                      setFailed(false)
                      fetchChangelog()
                        .then(setChangelog)
                        .catch(() => setFailed(true))
                    }}
                    className="h-8 rounded-[24px] bg-accent px-4 text-[13px] text-white"
                  >
                    Try again
                  </button>
                </div>
              ) : !changelog ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-tile border-t-accent" />
                  <span className="text-[13px] text-sub">Loading updates…</span>
                </div>
              ) : changelog.length === 0 ? (
                <span className="py-8 text-center text-[13px] text-sub">No changes recorded yet.</span>
              ) : (
                changelog.map((entry) => (
                  <div key={entry.version} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold tracking-[1.4px] text-accent-light">
                        v{entry.version}
                      </span>
                      {entry.date && <span className="text-[11px] text-faint">{entry.date}</span>}
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {entry.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-soft">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <AuthModal open={authDialog.open} onClose={authDialog.closeDialog} />

      <Modal open={deleteDialog.open} onClose={deleteDialog.closeDialog}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-soft">Delete all workout data?</span>
            <span className="text-[12px] text-muted">
              {auth.user
                ? 'This permanently erases your workouts, stats and the cloud copy. This cannot be undone.'
                : 'This permanently erases all workouts and stats on this device. This cannot be undone.'}
            </span>
          </div>

          {auth.user && (
            <input
              type="password"
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="h-11 rounded-[12px] bg-field px-3 text-[14px] text-ink outline outline-1 outline-line/10 placeholder:text-faint"
            />
          )}

          {deleteError && <span className="text-[12px] text-[#FF7A7D]">{deleteError}</span>}

          <div className="flex gap-2.5">
            <button
              onClick={() => {
                deleteDialog.closeDialog()
                setDeletePw('')
                setDeleteError(null)
              }}
              className="h-11 flex-1 rounded-[14px] bg-tile text-[14px] font-semibold text-ink"
            >
              Cancel
            </button>
            <button
              onClick={deleteAllData}
              disabled={deleteBusy || (auth.user && !deletePw)}
              className="h-11 flex-1 rounded-[14px] bg-[#DB3B3E] text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {deleteBusy ? 'Deleting…' : 'Delete everything'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={signOutDialog.open} onClose={signOutDialog.closeDialog}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold text-soft">Sign out?</span>
            <span className="text-[12px] text-muted">
              Your workouts stay on this device, but you'll stop syncing until you sign back in.
            </span>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={signOutDialog.closeDialog}
              className="h-11 flex-1 rounded-[14px] bg-tile text-[14px] font-semibold text-ink"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                signOutDialog.closeDialog()
                auth.signOut()
              }}
              className="h-11 flex-1 rounded-[14px] bg-[#DB3B3E] text-[14px] font-semibold text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </Modal>
    </Screen>
  )
}
