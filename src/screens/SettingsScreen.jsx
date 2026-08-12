import { useEffect, useRef, useState } from 'react'
import {
  Cat,
  Check,
  ChevronRight,
  Database,
  Download,
  Pencil,
  Rocket,
  Upload,
  User,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { fetchChangelog } from '../lib/changelog'
import { useAuth } from '../lib/auth'
import AuthModal from '../components/AuthModal'
import { Avatar, initialsOf, Screen, Toggle, useDialog } from '../components/ui'

const THEMES = ['#F5A524', '#17C964', '#EC4899', '#FF383C', '#0485F7']

function Row({ icon, title, subtitle, right, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[16px] bg-card px-3.5 py-3 text-left shadow-[0px_2px_6px_0px_#0000000F]"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent/15">{icon}</div>
      <div className="flex flex-1 flex-col leading-tight">
        <span className="text-[14px] font-semibold text-ink">{title}</span>
        {subtitle && <span className="mt-0.5 text-[11px] text-faint">{subtitle}</span>}
      </div>
      {right ?? <ChevronRight size={14} color="#6E6E7A" />}
    </button>
  )
}

export default function SettingsScreen() {
  const store = useStore()
  const auth = useAuth()
  const fileRef = useRef(null)
  const authDialog = useDialog()
  const [changelog, setChangelog] = useState(null)
  const [failed, setFailed] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

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

  return (
    <Screen activeTab="settings">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold text-ink">Settings</h1>
          <span className="text-[12px] text-faint">Profile, data & preferences</span>
        </div>

        <div className="flex items-center gap-3 rounded-[20px] bg-surface p-4 outline outline-1 outline-white/10">
          <Avatar initials={initialsOf(auth.user?.email ?? 'You')} size={44} />
          <div className="flex flex-1 flex-col">
            {auth.user ? (
              <>
                <span className="text-[15px] font-semibold text-ink">
                  {auth.user.email.split('@')[0]}
                </span>
                <span className="text-[12px] text-faint">{auth.user.email}</span>
              </>
            ) : (
              <>
                <span className="text-[15px] font-semibold text-ink">Not signed in</span>
                <span className="text-[12px] text-faint">Tap Account to sync across devices</span>
              </>
            )}
          </div>
          {auth.user ? (
            <button
              onClick={() => auth.signOut()}
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
          <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">DATA & ACCOUNT</div>
          <Row
            icon={<User size={15} color="var(--color-accent)" />}
            title="Account"
            subtitle={auth.user ? 'Signed in · manage sync' : 'Sign in to sync your data'}
            onClick={authDialog.openDialog}
          />
          <Row
            icon={<Database size={15} color="var(--color-accent)" />}
            title="Back up my data"
            subtitle="Export everything as a JSON file"
            onClick={exportData}
            right={<Download size={14} color="#6E6E7A" />}
          />
          <Row
            icon={<Upload size={15} color="var(--color-accent)" />}
            title="Restore a backup"
            subtitle="Load data from a previous export"
            onClick={() => fileRef.current?.click()}
            right={<Upload size={14} color="#6E6E7A" />}
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
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
          <span className="text-[11px] font-semibold tracking-[1.4px] text-muted">APPEARANCE</span>
          <span className="text-[14px] font-semibold text-ink">Color themes</span>
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

        <div className="flex flex-col gap-2.5">
          <Row
            icon={<Cat size={15} color="var(--color-accent)" />}
            title="Neko pet"
            subtitle="A little cat keeps you company"
            right={<Toggle on={store.settings.neko} onChange={(v) => store.setSettings({ neko: v })} />}
          />
          <Row
            icon={<Check size={15} color="var(--color-accent)" />}
            title="Notifications"
            subtitle="Reminders for workouts and rest"
            right={<Toggle on={store.settings.notify} onChange={(v) => store.setSettings({ notify: v })} />}
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

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
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
                <X size={15} color="#A1A1AA" />
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
    </Screen>
  )
}
