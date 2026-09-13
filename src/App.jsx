import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { StoreProvider, useStore } from './lib/store'
import { AuthProvider, useAuth } from './lib/auth'
import { TimerProvider, useTimer } from './lib/timer'
import { PresenceProvider } from './lib/presenceProvider'
import { PwaInstallProvider } from './lib/pwaProvider'
import { DEFAULT_THEME } from './lib/themes'
import { NavProvider, useNav } from './components/ui'
import Tutorial from './components/Tutorial'
import WhatsNewScreen from './components/WhatsNewScreen'
import { useTutorial, subscribeWhatsNewTour, getWhatsNewTour, startWhatsNewTour, subscribeWhatsNew, getWhatsNewTarget, showWhatsNew, getAcknowledged, getSeenNews } from './lib/tutorial'
import { newsToShow, WHATS_NEW_ITEMS } from './lib/whatsNew'
import HomeScreen from './screens/HomeScreen'
import DayDetailScreen from './screens/DayDetailScreen'
import LibraryScreen from './screens/LibraryScreen'
import TimerScreen from './screens/TimerScreen'
import ProgressScreen from './screens/ProgressScreen'
import SettingsScreen from './screens/SettingsScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import CalendarScreen from './screens/CalendarScreen'
import SleepScreen from './screens/SleepScreen'
import HealthMonthScreen from './screens/HealthMonthScreen'

function ScreenBody({ name }) {
  switch (name) {
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
    case 'calendar':
      return <CalendarScreen />
    case 'health':
      return <SleepScreen />
    case 'health-month':
      return <HealthMonthScreen />
    case 'home':
    default:
      return <HomeScreen />
  }
}

// Utility to detect low‑end mobile browsers (mid‑range Android/Chrome)
function isMobilePhone() {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|mobile|tablet/i.test(navigator.userAgent)
}

function Router() {
  const nav = useNav()
  const auth = useAuth()
  const timer = useTimer()
  const reduce = useReducedMotion()
  const { shouldShowTutorial, completeTutorial } = useTutorial()
  const [showTutorial, setShowTutorial] = useState(false)
  // What's new tour: launched from the What's new screen via the module store
  // (its steps navigate between tabs, so it must live above the router).
  const [tourSteps, setTourSteps] = useState(() => getWhatsNewTour())
  useEffect(() => subscribeWhatsNewTour(() => setTourSteps(getWhatsNewTour())), [])
  // The shared What's new screen: opened by the auto-popup below or by the
  // Settings row, one instance for both (see ADR 0009).
  const [whatsNew, setWhatsNew] = useState(() => getWhatsNewTarget())
  // Keep the last opened version so the Modal can play its exit animation
  // after the target goes null.
  const lastWhatsNew = useRef(whatsNew)
  useEffect(
    () =>
      subscribeWhatsNew(() => {
        const t = getWhatsNewTarget()
        if (t) lastWhatsNew.current = t
        setWhatsNew(t)
      }),
    [],
  )
  // The popup is a launch-time event: checked once per session, never
  // re-fired after it has been seen or deferred.
  const newsChecked = useRef(false)

  useEffect(() => {
    // Tutorial is account‑scoped: only show for signed‑in users who haven't
    // completed it yet (e.g. right after first login on a new account).
    if (!auth.user) {
      setShowTutorial(false)
      return
    }
    if (shouldShowTutorial(auth.user.id)) {
      setShowTutorial(true)
    }
  }, [auth.user, shouldShowTutorial])

  useEffect(() => {
    // Auto‑popup: the first launch after an update opens What's new by
    // itself, once the UI has settled. Bundled notes are the only trigger
    // (ADR 0009). One check per launch: when it defers — the first‑run tour
    // owns the screen, a tour is running, a workout session is active or
    // restored, or auth is still resolving (the ack is user‑scoped) — news
    // waits for the next launch rather than interrupting a set or a
    // celebration.
    if (newsChecked.current) return
    if (auth.status === 'loading') return
    // shouldShowTutorial reads localStorage directly — the showTutorial
    // state set by the effect above isn't visible in this commit yet.
    if ((auth.user && shouldShowTutorial(auth.user.id)) || tourSteps || timer.session) {
      newsChecked.current = true
      return
    }
    newsChecked.current = true
    // Content-fingerprint trigger (see newsToShow): the popup returns
    // whenever the What's new notes changed since the last dismissal — a
    // release cut, a new item, or edited copy — not only on a new version.
    const unseen = newsToShow(
      WHATS_NEW_ITEMS,
      getSeenNews(auth.user?.id),
      getAcknowledged(auth.user?.id),
    )
    if (!unseen) return
    // No cleanup on this timeout on purpose: supabase-js can fire several
    // auth events in a row (each with a fresh user object), and a cleanup
    // would cancel the popup that was already scheduled. showWhatsNew is
    // idempotent, so a stray double fire is harmless.
    setTimeout(() => showWhatsNew(unseen), 600)
  }, [auth.status, auth.user, tourSteps, timer.session, shouldShowTutorial])

  const handleTutorialComplete = () => {
    if (auth.user) completeTutorial(auth.user.id)
    setShowTutorial(false)
  }

  const navDir = nav.dir > 0 ? 1 : nav.dir < 0 ? -1 : 0
  const enterX = reduce || !navDir ? 0 : navDir * 28

  // Mobile‑specific tweak: shorter duration on mid‑range phones to reduce jank.
  const mobile = isMobilePhone()
  const transitionDuration = mobile ? 0.12 : navDir ? 0.2 : 0.16

  // Tab‑switch jump fix: the window scrolls and screens differ wildly in
  // height, so navigating deep into a long screen could leave the new (often
  // shorter) screen starting mid‑scroll — the browser then clamps back, and
  // that snap paints as a jump. Layout effect = before paint, so the
  // transition always starts from the top of the newcomer. (Back with
  // browser history still restores its own scroll; this only governs in‑app
  // navigation.)
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [nav.name])

  return (
    <>
      {showTutorial && <Tutorial onComplete={handleTutorialComplete} />}
      {tourSteps && (
        <Tutorial
          steps={tourSteps}
          lastLabel="Done"
          onComplete={() => startWhatsNewTour(null)}
        />
      )}
      <WhatsNewScreen
        open={!!whatsNew}
        payload={whatsNew ?? lastWhatsNew.current}
        onClose={() => showWhatsNew(null)}
      />
      {/* Clip the ±28px slide sideways: mid-transition the incoming screen
          overhangs the viewport, which makes the browser spawn a horizontal
          scrollbar for the animation's lifetime (~200ms). That scrollbar eats
          ~15px of viewport height, so the tab bar visibly hops — desktop and
          installed PWA alike. overflow-x-clip (not hidden) so sticky elements
          inside the screens keep working. */}
      <div className="overflow-x-clip">
        <AnimatePresence initial={false} mode="popLayout" custom={navDir}>
          <motion.div
            key={nav.name}
            initial={{ opacity: 0, x: enterX }}
            animate={{ opacity: 1, x: 0 }}
            exit={(dir) => ({ opacity: 0, x: reduce || !dir ? 0 : -dir * 28 })}
            // Apply hardware‑acceleration hint via will‑change
            style={{ willChange: 'opacity, transform' }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: transitionDuration, ease: [0.23, 1, 0.32, 1] }
            }
          >
            <ScreenBody name={nav.name} />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}

const ACCENT_LIGHT = {
  '#0485F7': '#6BB6FF',
  '#F5A524': '#FFC966',
  '#17C964': '#6BE89F',
  '#EC4899': '#F58ABF',
  '#FF383C': '#FF7A7D',
  '#A855F7': '#C084FC',
};

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
    // The neko is an ambient loop — under reduced motion it stops outright
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
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
        <PresenceProvider>
          <TimerProvider>
            <NavProvider>
              <PwaInstallProvider>
                <Router />
              </PwaInstallProvider>
            </NavProvider>
          </TimerProvider>
        </PresenceProvider>
      </StoreProvider>
    </AuthProvider>
  )
}

export default App
