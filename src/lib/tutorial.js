import { useCallback } from 'react'

export function tutorialKey(userId) {
  return userId ? `pulse.tutorial.completed.${userId}` : ''
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
