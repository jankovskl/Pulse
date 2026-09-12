import { useCallback } from 'react'

export function tutorialKey(userId) {
  return userId ? `pulse.tutorial.completed.${userId}` : ''
}

// Acknowledged version: the newest release version whose news the user has
// seen (opened the What's new sheet, or finished/skipped the What's new tour).
// Keyed per user like the first-run tour, with a global fallback so
// signed-out / anonymous mode still stops nagging after one read.
export function ackKey(userId) {
  return userId ? `pulse.whatsnew.ack.${userId}` : 'pulse.whatsnew.ack'
}

export function getAcknowledged(userId) {
  try {
    return localStorage.getItem(ackKey(userId))
  } catch {
    return null
  }
}

export function setAcknowledged(userId, version) {
  try {
    localStorage.setItem(ackKey(userId), version)
  } catch {}
}

// The fingerprint of the exact What's new content the user last dismissed.
// While the bundled notes' fingerprint differs, there is unseen news — this
// is what re-fires the popup when the notes themselves change between
// releases, not only at release cuts (see newsToShow in lib/whatsNew.js).
export function seenKey(userId) {
  return userId ? `pulse.whatsnew.seen.${userId}` : 'pulse.whatsnew.seen'
}

export function getSeenNews(userId) {
  try {
    return localStorage.getItem(seenKey(userId))
  } catch {
    return null
  }
}

export function setSeenNews(userId, fingerprint) {
  try {
    localStorage.setItem(seenKey(userId), fingerprint)
  } catch {}
}

// The What's new tour is rendered by App (outside the screen router) because
// its steps navigate between tabs — a tour mounted inside SettingsScreen would
// unmount the moment it leaves Settings. Module-level store, same pattern as
// auth's subscribeUser: the sheet calls startWhatsNewTour(steps), App reacts.
let activeTourSteps = null
const tourListeners = new Set()

export function startWhatsNewTour(steps) {
  activeTourSteps = steps && steps.length ? steps : null
  for (const fn of tourListeners) fn()
}

export function subscribeWhatsNewTour(fn) {
  tourListeners.add(fn)
  return () => tourListeners.delete(fn)
}

export function getWhatsNewTour() {
  return activeTourSteps
}

// The shared What's new screen is rendered by App (above the router) so the
// auto-popup and the Settings row open the same instance. Module store, same
// pattern as the What's new tour: the value is the payload from newsToShow
// ({ version, fingerprint }) to show, or null when the screen is closed.
let whatsNewTarget = null
const whatsNewListeners = new Set()

export function showWhatsNew(payload) {
  whatsNewTarget = payload || null
  for (const fn of whatsNewListeners) fn()
}

export function subscribeWhatsNew(fn) {
  whatsNewListeners.add(fn)
  return () => whatsNewListeners.delete(fn)
}

export function getWhatsNewTarget() {
  return whatsNewTarget
}

// Hook to check if tutorial should be shown. Tutorial state is keyed by user id
// so it only appears for signed-in users and only once per account (unless reset).
export function useTutorial() {
  const shouldShowTutorial = useCallback((userId) => {
    if (!userId) return false
    try {
      return !localStorage.getItem(tutorialKey(userId))
    } catch {
      return false
    }
  }, [])

  const completeTutorial = useCallback((userId) => {
    if (!userId) return
    try {
      localStorage.setItem(tutorialKey(userId), 'true')
    } catch {}
  }, [])

  const resetTutorial = useCallback((userId) => {
    if (!userId) return
    try {
      localStorage.removeItem(tutorialKey(userId))
    } catch {}
  }, [])

  return { shouldShowTutorial, completeTutorial, resetTutorial }
}
