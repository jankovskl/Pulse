import { createContext, useContext, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { getUserId } from './auth'
import { setOnline, setOffline, setWorkingOut } from './presence'

const PresenceCtx = createContext(null)

export function PresenceProvider({ children }) {
  const heartbeatRef = useRef(null)
  const isWorkingOutRef = useRef(false)
  const workoutDataRef = useRef(null)

  // Send presence heartbeat every 2 minutes.
  // The interval tick is skipped when the window is hidden so we stop
  // refreshing last_seen while the user is away — after 5 minutes with no
  // heartbeat, friends will see the stale-presence check kick in and show
  // the user as offline. When the window comes back into focus we fire
  // immediately so the status updates without waiting for the next tick.
  useEffect(() => {
    const userId = getUserId()
    if (!supabase || !userId) return

    const sendHeartbeat = async () => {
      try {
        const uid = getUserId()
        if (!uid) return
        if (isWorkingOutRef.current && workoutDataRef.current) {
          await setWorkingOut(supabase, uid, workoutDataRef.current)
        } else {
          await setOnline(supabase, uid)
        }
      } catch (err) {
        console.error('Presence heartbeat failed:', err)
      }
    }

    // Skip the tick if the window is hidden — don't refresh last_seen
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      sendHeartbeat()
    }

    // Fire immediately when the window becomes visible again
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sendHeartbeat()
    }

    sendHeartbeat()
    heartbeatRef.current = setInterval(tick, 2 * 60 * 1000)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(heartbeatRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Mark offline on unmount or page close
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const userId = getUserId()
      if (supabase && userId) {
        // Use sendBeacon for reliable delivery on page close
        const payload = {
          user_id: userId,
          status: 'offline',
          last_seen: new Date().toISOString(),
          workout_data: null,
          updated_at: new Date().toISOString(),
        }

        // Attempt to send via beacon (more reliable on page close)
        navigator.sendBeacon?.(
          `${supabase.supabaseUrl}/rest/v1/presence`,
          JSON.stringify(payload)
        )
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      handleBeforeUnload()
    }
  }, [])

  const updateWorkoutStatus = async (workoutData) => {
    const userId = getUserId()
    if (!supabase || !userId) return

    try {
      if (workoutData) {
        isWorkingOutRef.current = true
        workoutDataRef.current = workoutData
        await setWorkingOut(supabase, userId, workoutData)
      } else {
        isWorkingOutRef.current = false
        workoutDataRef.current = null
        await setOnline(supabase, userId)
      }
    } catch (err) {
      console.error('Failed to update workout status:', err)
    }
  }

  return (
    <PresenceCtx.Provider value={{ updateWorkoutStatus }}>
      {children}
    </PresenceCtx.Provider>
  )
}

export function usePresence() {
  return useContext(PresenceCtx)
}
