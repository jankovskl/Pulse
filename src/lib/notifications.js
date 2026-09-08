// Web Notification API wrapper — permission handling + daily reminder
// scheduling. Deliberately DOM-light: only `setTimeout`/`clearTimeout` and
// the `window.Notification` constructor, so it can be unit-tested with
// `mock.timers` and a stubbed `window.Notification` (see
// notifications.test.js).
//
// Tauri note: the desktop shell renders a webview, so the Web Notification
// API path works there too (WebView2/WKWebView). A native OS-notification
// plugin would be a separate feature; this module is the web path for both.

export const UNAVAILABLE = 'unsupported'

// The Notification constructor lives on `window` (the global binding is an
// alias for it in browsers). Read it off `window` so this module also works
// in test runners and embeddings that only set `window.Notification`.
function notifier() {
  if (typeof window === 'undefined' || !('Notification' in window)) return null
  return window.Notification
}

// Whether the platform can show notifications at all.
export function notificationsSupported() {
  return notifier() !== null
}

// Current permission: 'granted' | 'denied' | 'default' | UNAVAILABLE.
export function permissionState() {
  const N = notifier()
  if (!N) return UNAVAILABLE
  return N.permission
}

// Ask the browser once (the permission prompt). Older iOS Safari throws
// when requestPermission is missing — collapse that to 'denied' so callers
// always get one of the four states.
export async function requestPermission() {
  const N = notifier()
  if (!N) return UNAVAILABLE
  if (N.permission !== 'default') return N.permission
  try {
    return (await N.requestPermission()) ?? 'denied'
  } catch {
    return 'denied'
  }
}

// Show one notification; silently no-ops without a grant. Returns whether
// it was actually shown. `onActivate` receives the notification and fires
// on click (deep-links from e.g. "remember to log your sleep").
export function show(title, opts = {}, onActivate = null) {
  const N = notifier()
  if (!N || N.permission !== 'granted') return false
  try {
    const n = new N(title, opts)
    if (onActivate && typeof n.onclick === 'function') n.onclick = () => onActivate(n)
    return true
  } catch {
    return false
  }
}

// Fire the sleep reminder, requesting permission first. Call this from a
// user gesture (the toggle flip) so the browser allows the prompt.
export async function fireSleepReminder(onActivate = null) {
  const permission = await requestPermission()
  if (permission !== 'granted') return false
  return show('Sleep Reminder', { body: 'Remember to log your sleep' }, onActivate)
}

// Next occurrence of `HH:MM` strictly after `base` (today if still ahead,
// otherwise tomorrow) — the drill the old store snippet did inline.
function nextOccurrence(base, h, m) {
  const target = new Date(base)
  target.setHours(h, m, 0, 0)
  if (target <= base) target.setDate(target.getDate() + 1)
  return target
}

// Schedule a daily fire at `time` ("HH:MM", 24-hour), re-arming itself for
// the following day after each fire. Malformed time or disabled reminder
// returns a no-op cancel. Returns the cancel function.
export function scheduleDailyReminder({ enabled, time, onFire }) {
  if (!enabled || !time) return () => {}
  const [h, m] = String(time).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return () => {}
  }

  let timer = null
  let cancelled = false

  const schedule = () => {
    if (cancelled) return
    const target = nextOccurrence(new Date(), h, m)
    timer = setTimeout(() => {
      if (cancelled) return
      try {
        onFire?.()
      } finally {
        schedule()
      }
    }, target - Date.now())
  }

  schedule()
  return () => {
    cancelled = true
    clearTimeout(timer)
  }
}