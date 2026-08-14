import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { fmt, useTimer } from '../lib/timer'

export const NavCtx = createContext(null)

export function NavProvider({ children }) {
  const [view, setView] = useState({ name: 'home' })
  const nav = {
    ...view,
    go: (name, extra = {}) => setView({ name, ...extra }),
  }
  return <NavCtx.Provider value={nav}>{children}</NavCtx.Provider>
}

export function useNav() {
  return useContext(NavCtx)
}

const TABS = [
  { key: 'home', label: 'Home', icon: 'house' },
  { key: 'timer', label: 'Timer', icon: 'timer' },
  { key: 'progress', label: 'Progress', icon: 'trending-up' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

const ICON_PATHS = {
  house: <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />,
  timer: <path d="M10 2h4M12 14l3-3M13 6a7 7 0 1 0 0 12 7 7 0 0 0 0-12z" />,
  'trending-up': <path d="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6" />,
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  library: (
    <>
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </>
  ),
  leaderboard: (
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  ),
}

const SIDEBAR_TABS = [
  { key: 'home', label: 'Home', icon: 'house' },
  { key: 'timer', label: 'Timer', icon: 'timer' },
  { key: 'progress', label: 'Progress', icon: 'trending-up' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'library', label: 'Library', icon: 'library' },
  { key: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
]

export function TabDock({ active }) {
  const nav = useNav()
  return (
    <div className="px-4 pb-3 pt-0">
      <div className="flex h-[56px] items-center gap-0 rounded-[28px] bg-dock p-1.5 outline outline-1 outline-line/10 shadow-[0px_10px_24px_0px_#00000080]">
        {TABS.map((t) => {
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              onClick={() => nav.go(t.key === 'progress' ? 'progress' : t.key)}
              className={`flex h-fit flex-1 flex-col items-center justify-center gap-0.5 rounded-[9999px] p-[4px_10px] transition-colors ${
                isActive ? 'bg-accent/15' : ''
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                width={20}
                height={20}
                fill="none"
                stroke={isActive ? 'var(--color-accent)' : 'var(--color-faint)'}
                strokeWidth={isActive ? 2.4 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICON_PATHS[t.icon]}
              </svg>
              <span
                className={`text-[10px] ${
                  isActive ? 'font-semibold text-accent-light' : 'text-faint'
                }`}
              >
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar({ active }) {
  const nav = useNav()
  return (
    <aside className="hidden h-dvh w-[220px] shrink-0 flex-col gap-1 border-r border-line/10 bg-dock/40 p-3 backdrop-blur md:flex">
      <div className="mb-3 flex items-center gap-2 px-2 pt-2">
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="text-[14px] font-semibold text-soft">Pulse</span>
      </div>
      {SIDEBAR_TABS.map((t) => {
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            onClick={() => nav.go(t.key === 'progress' ? 'progress' : t.key)}
            className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
              isActive ? 'bg-accent/15' : 'hover:bg-tile/60'
            }`}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none"
              stroke={isActive ? 'var(--color-accent)' : 'var(--color-faint)'}
              strokeWidth={isActive ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
              {ICON_PATHS[t.icon]}
            </svg>
            <span className={`text-[13px] ${isActive ? 'font-semibold text-accent-light' : 'text-sub'}`}>
              {t.label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

export function Screen({ children, activeTab }) {
  const timer = useTimer()
  const nav = useNav()
  return (
    <div className="screen-bg relative mx-auto flex min-h-dvh w-full max-w-[420px] flex-col md:max-w-none md:flex-row">
      <Sidebar active={nav.name === 'day' ? 'home' : nav.name} />
      <div className="flex-1 px-5 pb-2 pt-3 md:mx-auto md:w-full md:max-w-[1100px]">{children}</div>
      <div className="sticky bottom-0 z-20 md:hidden">
        <TabDock active={activeTab} />
      </div>
      {timer.running && nav.name !== 'timer' && (
        <button
          onClick={() => nav.go('timer')}
          className="absolute right-4 top-3 z-50 flex h-[30px] items-center gap-1.5 rounded-full bg-tile px-3 shadow-[0px_4px_16px_#00000059] outline outline-1 outline-line/[0.08]"
        >
          <svg
            viewBox="0 0 24 24"
            width={13}
            height={13}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 2h4M12 14l3-3M13 6a7 7 0 1 0 0 12 7 7 0 0 0 0-12z" />
          </svg>
          <span className="text-[12px] font-semibold tabular-nums text-ink">{fmt(timer.left)}</span>
        </button>
      )}
    </div>
  )
}

export function SectionLabel({ children }) {
  return (
    <div className="text-[11px] font-semibold tracking-[1.4px] text-muted">{children}</div>
  )
}

export function Chip({ label, color = '#0485F7', icon: Icon = null, onClick, small = false }) {
  return (
    <button
      onClick={onClick}
      className="flex h-fit w-fit items-center gap-0.5 rounded-full px-1 py-0.5"
      style={{ background: `${color}26` }}
    >
      {Icon && <Icon size={small ? 11 : 12} color={color} />}
      <span className="text-[11px] font-medium" style={{ color }}>
        {label}
      </span>
    </button>
  )
}

export function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-[20px] w-[40px] rounded-full transition-colors ${
        on ? 'bg-accent' : 'bg-tile'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[18px] rounded-full bg-soft shadow-[0px_2px_4px_0px_#0000001A] transition-all ${
          on ? 'left-[20px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

export function IconButton({ children, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-3xl ${className}`}
    >
      {children}
    </button>
  )
}

export function Avatar({ initials, color, size = 28, className = '', src = null }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size, background: color }}
    >
      <span className="text-[11px] font-semibold text-soft">{initials}</span>
    </div>
  )
}

export function initialsOf(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function useDialog() {
  const [open, setOpen] = useState(false)
  return { open, setOpen, openDialog: () => setOpen(true), closeDialog: () => setOpen(false) }
}

export function useViewportShift(open) {
  const panelRef = useRef(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const fit = () => {
      const panel = panelRef.current
      if (!panel) return
      const margin = 12
      const visibleTop = vv.offsetTop
      const visibleBottom = vv.offsetTop + vv.height
      const rect = panel.getBoundingClientRect()
      let delta = 0
      if (rect.bottom > visibleBottom - margin) {
        delta = rect.bottom - (visibleBottom - margin)
      }
      if (rect.top - delta < visibleTop + margin) {
        delta = rect.top - (visibleTop + margin)
      }
      setShift(-delta)
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
      setShift(0)
    }
  }, [open])

  return [panelRef, shift]
}

export function Modal({ open, onClose, children }) {
  const [panelRef, shift] = useViewportShift(open)

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        style={{ transform: `translateY(${shift}px)`, transition: 'transform 160ms ease-out' }}
        className="max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-[28px] bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
