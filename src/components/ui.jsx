import { createContext, useContext, useState } from 'react'
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

export function TabDock({ active }) {
  const nav = useNav()
  const icons = {
    house: <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />,
    timer: <path d="M10 2h4M12 14l3-3M13 6a7 7 0 1 0 0 12 7 7 0 0 0 0-12z" />,
    'trending-up': <path d="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6" />,
    settings: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  }
  return (
    <div className="px-4 pb-3 pt-0">
      <div className="flex h-[56px] items-center gap-0 rounded-[28px] bg-[#17171FCC] p-1.5 outline outline-1 outline-white/10 shadow-[0px_10px_24px_0px_#00000080]">
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
                stroke={isActive ? 'var(--color-accent)' : '#9C9CA8'}
                strokeWidth={isActive ? 2.4 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icons[t.icon]}
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

export function Screen({ children, activeTab }) {
  const timer = useTimer()
  const nav = useNav()
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-[linear-gradient(-157deg,_#0B0B12_14.645%,_#131322_85.355%)]">
      <div className="flex-1 px-5 pb-2 pt-3">{children}</div>
      <div className="sticky bottom-0">
        <TabDock active={activeTab} />
      </div>
      {timer.running && nav.name !== 'timer' && (
        <button
          onClick={() => nav.go('timer')}
          className="absolute right-4 top-3 z-50 flex h-[30px] items-center gap-1.5 rounded-full bg-[#1F1F2A] px-3 shadow-[0px_4px_16px_#00000059] outline outline-1 outline-white/[0.08]"
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

export function Avatar({ initials, color, size = 28, className = '' }) {
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

export function Modal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-t-[28px] bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
