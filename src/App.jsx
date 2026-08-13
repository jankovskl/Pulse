import { useEffect } from 'react'
import { StoreProvider, useStore } from './lib/store'
import { AuthProvider } from './lib/auth'
import { TimerProvider } from './lib/timer'
import { DEFAULT_THEME } from './lib/themes'
import { NavProvider, useNav } from './components/ui'
import HomeScreen from './screens/HomeScreen'
import DayDetailScreen from './screens/DayDetailScreen'
import LibraryScreen from './screens/LibraryScreen'
import TimerScreen from './screens/TimerScreen'
import ProgressScreen from './screens/ProgressScreen'
import SettingsScreen from './screens/SettingsScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'

function Router() {
  const nav = useNav()
  switch (nav.name) {
    case 'day':
      return <DayDetailScreen />
    case 'library':
      return <LibraryScreen />
    case 'timer':
      return <TimerScreen />
    case 'progress':
      return <ProgressScreen />
    case 'settings':
      return <SettingsScreen />
    case 'leaderboard':
      return <LeaderboardScreen />
    case 'home':
    default:
      return <HomeScreen />
  }
}

const ACCENT_LIGHT = {
  '#0485F7': '#6BB6FF',
  '#F5A524': '#FFC966',
  '#17C964': '#6BE89F',
  '#EC4899': '#F58ABF',
  '#FF383C': '#FF7A7D',
}

function ThemeSync() {
  const store = useStore()
  useEffect(() => {
    document.documentElement.dataset.theme = store.settings.theme ?? DEFAULT_THEME
    const root = document.documentElement.style
    root.setProperty('--color-accent', store.settings.accent)
    root.setProperty('--color-accent-light', ACCENT_LIGHT[store.settings.accent] ?? '#6BB6FF')
  }, [store.settings.accent, store.settings.theme])
  return null
}

function NekoCat() {
  const store = useStore()
  useEffect(() => {
    let cancelled = false
    const spawn = () => {
      if (cancelled || window.neko || !window.createNeko) return
      const neko = window.createNeko({
        speed: 28,
        fps: 90,
        behaviorMode: 0,
        idleThreshold: 0,
        allowBehaviorChange: false,
        startX: 0,
        startY: 0,
      })
      const origTick = neko.processOriginalTick.bind(neko)
      neko.processOriginalTick = () => {
        origTick()
        if (window.NekoState && neko.state === window.NekoState.AWAKE) {
          neko.calcDirection(neko.moveDX, neko.moveDY)
        }
      }
      window.neko = neko
    }
    if (store.settings.neko) {
      if (window.createNeko) {
        spawn()
      } else if (!document.getElementById('neko-js')) {
        const s = document.createElement('script')
        s.id = 'neko-js'
        s.src = 'https://louisabraham.github.io/nekojs/neko.js'
        s.onload = spawn
        s.onerror = () => document.getElementById('neko-js')?.remove()
        document.body.appendChild(s)
      }
    } else {
      window.neko?.destroy?.()
      window.neko = undefined
      document.getElementById('neko-js')?.remove()
    }
    return () => {
      cancelled = true
      window.neko?.destroy?.()
      window.neko = undefined
      document.getElementById('neko-js')?.remove()
    }
  }, [store.settings.neko])
  return null
}

function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <ThemeSync />
        <NekoCat />
        <TimerProvider>
          <NavProvider>
            <Router />
          </NavProvider>
        </TimerProvider>
      </StoreProvider>
    </AuthProvider>
  )
}

export default App
