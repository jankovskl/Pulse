import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { shouldOffer } from './pwa'

const PwaInstallCtx = createContext(null)

// Holds the web-install affordance (banner + Settings row) at a level that
// survives screen switches. The browser fires `beforeinstallprompt` once per
// page load, and the captured event object is the only handle to the deferred
// native prompt (event.prompt()). HomeScreen and the Settings row both need it,
// so it lives here, above the Router, not in a screen.
//
// Browsers without a native prompt (notably iOS Safari) never fire
// beforeinstallprompt — installPrompt stays null there, and the UI falls back
// to add-to-home-screen instructions instead of the native prompt. Null must
// not be read as "this is definitely iOS", so the manual copy is platform-
// neutral (see the isInstalled note about no UA detection in pwa.js).
export function PwaInstallProvider({ children }) {
  const [installPrompt, setInstallPrompt] = useState(null)

  // Derived at runtime (never persisted): hide the affordance inside the
  // desktop shell or once the PWA is already installed full-screen.
  const offerInstall = useMemo(() => {
    const mediaMatch = (query) => window.matchMedia?.(query)?.matches === true
    return shouldOffer(window, mediaMatch)
  }, [])

  useEffect(() => {
    if (!offerInstall) return
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault() // suppress the browser's own overlay; defer to us
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [offerInstall])

  const value = useMemo(
    () => ({
      offerInstall,
      // One interpretation of installPrompt, shared by both screens — the banner
      // and the Settings row never re-decide what null means themselves.
      installMode: installPrompt ? 'native' : 'manual',
      installPrompt,
      // The event is one-shot: prompt() resolves once the user chooses, then
      // the handle is spent. Clear it so a later click re-offers nothing. The
      // null-guard lives here, not at call sites.
      async promptInstall() {
        if (!installPrompt) return
        try {
          await installPrompt.prompt()
        } finally {
          setInstallPrompt(null)
        }
      },
    }),
    [offerInstall, installPrompt],
  )

  return <PwaInstallCtx.Provider value={value}>{children}</PwaInstallCtx.Provider>
}

export function usePwaInstall() {
  return useContext(PwaInstallCtx)
}