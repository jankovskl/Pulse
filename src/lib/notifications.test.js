import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  notificationsSupported,
  permissionState,
  requestPermission,
  show,
  fireSleepReminder,
  scheduleDailyReminder,
} from './notifications.js'

// A tiny window.Notification stand-in. `permission` is a static so tests can
// flip it; `seen` collects constructed notifications.
function installNotification(permission = 'granted') {
  const seen = []
  class FakeNotification {
    static permission = permission
    static requestPermission = async () => 'granted'
    constructor(title, opts) {
      this.title = title
      this.opts = opts
      seen.push(this)
    }
  }
  globalThis.window = { Notification: FakeNotification }
  return { seen, Notification: FakeNotification }
}

// --- environment + permission ---------------------------------------------

test('notificationsSupported/permissionState reflect the environment', () => {
  delete globalThis.window
  assert.equal(notificationsSupported(), false)
  assert.equal(permissionState(), 'unsupported')
  installNotification('granted')
  assert.equal(notificationsSupported(), true)
  assert.equal(permissionState(), 'granted')
  delete globalThis.window
})

test('requestPermission returns the current state without re-prompting', async () => {
  installNotification('granted')
  assert.equal(await requestPermission(), 'granted')
  delete globalThis.window
})

test('requestPermission prompts once when default, then grants', async () => {
  const { Notification } = installNotification('default')
  let prompted = 0
  Notification.requestPermission = async () => {
    prompted++
    Notification.permission = 'granted'
    return 'granted'
  }
  assert.equal(await requestPermission(), 'granted')
  assert.equal(prompted, 1)
  assert.equal(await requestPermission(), 'granted')
  assert.equal(prompted, 1) // no second prompt after grant
  delete globalThis.window
})

test('requestPermission collapses a throwing platform to denied', async () => {
  const { Notification } = installNotification('default')
  Notification.requestPermission = async () => {
    throw new Error('not available here')
  }
  assert.equal(await requestPermission(), 'denied')
  delete globalThis.window
})

// --- show ------------------------------------------------------------------

test('show no-ops without a grant', () => {
  const { seen } = installNotification('denied')
  assert.equal(show('hi', {}), false)
  assert.equal(seen.length, 0)
  delete globalThis.window
})

test('show constructs a notification when granted', () => {
  const { seen } = installNotification('granted')
  assert.equal(show('hi', { body: 'x' }), true)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].title, 'hi')
  assert.equal(seen[0].opts.body, 'x')
  delete globalThis.window
})

test('fireSleepReminder requests permission then shows', async () => {
  const { Notification } = installNotification('default')
  let prompted = false
  Notification.requestPermission = async () => {
    prompted = true
    Notification.permission = 'granted'
    return 'granted'
  }
  const shown = await fireSleepReminder()
  assert.equal(prompted, true)
  assert.equal(shown, true)
  delete globalThis.window
})

test('fireSleepReminder returns false when denied', async () => {
  const { Notification } = installNotification('default')
  Notification.requestPermission = async () => 'denied'
  assert.equal(await fireSleepReminder(), false)
  delete globalThis.window
})

// --- scheduleDailyReminder --------------------------------------------------

test('fires at the next HH:MM occurrence, then re-arms daily', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  t.mock.timers.setTime(new Date(2026, 8, 3, 10, 0, 0).getTime()) // Sep 3 10:00
  let fires = 0
  const cancel = scheduleDailyReminder({ enabled: true, time: '12:00', onFire: () => fires++ })

  t.mock.timers.tick(2 * 60 * 60 * 1000) // 12:00 today
  assert.equal(fires, 1)
  t.mock.timers.tick(2 * 60 * 60 * 1000) // 14:00 — same day, no second fire
  assert.equal(fires, 1)
  t.mock.timers.tick(22 * 60 * 60 * 1000) // 12:00 tomorrow
  assert.equal(fires, 2)

  cancel()
  t.mock.timers.tick(24 * 60 * 60 * 1000) // a further day
  assert.equal(fires, 2) // cancelled: no more
  t.mock.timers.reset()
})

test('fires tomorrow when the time already passed today', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  t.mock.timers.setTime(new Date(2026, 8, 3, 13, 0, 0).getTime()) // 13:00
  let fires = 0
  scheduleDailyReminder({ enabled: true, time: '12:00', onFire: () => fires++ })

  t.mock.timers.tick(23 * 60 * 60 * 1000) // 12:00 next day
  assert.equal(fires, 1)
  t.mock.timers.tick(23 * 60 * 60 * 1000) // 11:00 the day after — not yet
  assert.equal(fires, 1)
  t.mock.timers.tick(60 * 60 * 1000) // 12:00
  assert.equal(fires, 2)
  t.mock.timers.reset()
})

test('disabled / missing / malformed time is a no-op', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  t.mock.timers.setTime(new Date(2026, 8, 3, 10, 0, 0).getTime())
  let fires = 0
  scheduleDailyReminder({ enabled: false, time: '12:00', onFire: () => fires++ })
  scheduleDailyReminder({ enabled: true, time: '', onFire: () => fires++ })
  scheduleDailyReminder({ enabled: true, time: '25:99', onFire: () => fires++ })
  scheduleDailyReminder({ enabled: true, time: 'noon', onFire: () => fires++ })

  t.mock.timers.tick(48 * 60 * 60 * 1000)
  assert.equal(fires, 0)
  t.mock.timers.reset()
})