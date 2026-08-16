import { createContext, useContext, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { getUserId } from './auth'
import { setOnline, setOffline, setWorkingOut } from './presence'

const PresenceCtx = createContext(null)

export function PresenceProvider({ children }) {
  const heartbeatRef = useRef(null)
  const isWorkingOutRef = useRef(false)
  const workoutDataRef = useRef(null)

  // Send presence heartbeat every 2 minutes
  useEffect(() => {
    const userId = getUserId()
    if (!supabase || !userId) return

    const sendHeartbeat = async () => {
      try {
        const userId = getUserId()
        if (!userId) return

        if (isWorkingOutRef.current && workoutDataRef.current) {
          await setWorkingOut(supabase, userId, workoutDataRef.current)
        } else {
          await setOnline(supabase, userId)
        }
      } catch (err) {
        console.error('Presence heartbeat failed:', err)
      }
    }

    // Initial heartbeat
    sendHeartbeat()

    // Set up interval
    heartbeatRef.current = setInterval(sendHeartbeat, 2 * 60 * 1000) // Every 2 minutes

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
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
