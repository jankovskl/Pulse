// Debug harness [DEBUG-wsum]
// Bug A: workout summary with 3+ exercises isn't scrollable / Done unclickable.
// Bug B: finishing the workout BY TIMER shows no summary popup.
//
// Runs the real dev server (vite :5173) in headless Chrome at a phone viewport
// (390x844). A 20x virtual clock compresses the 30s rest countdowns to ~1.5s
// so the timer flow is fast and deterministic.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(__dirname, 'shots')
mkdirSync(SHOTS, { recursive: true })

const BASE = process.env.PULSE_URL || 'http://localhost:5173/Pulse/'
const EX_COUNT = Number(process.env.EX_COUNT || 3)
const VP_H = Number(process.env.VP_H || 844)
const MODE = process.env.MODE || 'timer' // 'timer' | 'manual'

let firstAllDone = null
let laterSummary = false

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: VP_H },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
})
// 20x virtual clock: the rest timer reads Date.now() inside a 250ms interval,
// so accelerating the clock lands every countdown without waiting 30s.
await ctx.addInitScript(() => {
  const realNow = Date.now.bind(Date)
  const t0 = realNow()
  Date.now = () => t0 + (realNow() - t0) * 20
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

async function seed(n) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate((count) => {
    localStorage.clear()
    const exercises = Array.from({ length: count }, (_, i) => ({
      id: `ex-${i}`,
      name: `Exercise ${i + 1}`,
      muscle: 'chest',
      sets: 2,
      reps: 10,
      weight: 20,
      done: false,
    }))
    localStorage.setItem('pulse.state.v2', JSON.stringify({
      days: [{ id: 'day-1', name: 'Push Day', weekday: null, color: '#0485F7', muscles: ['chest'], exercises }],
      sessions: [], plan: {},
      settings: { notify: false, neko: false, accent: '#A855F7', theme: 'dark' },
      lastActiveExercise: null, totals: { sessions: 0, lastSessionDay: null },
    }))
  }, n)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
}

function summarize() {
  return page.evaluate(() => {
    const overlay = document.querySelector('div.fixed.inset-0.z-50')
    if (!overlay) return { present: false }
    const card = overlay.firstElementChild
    const cr = card.getBoundingClientRect()
    const done = [...overlay.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Done')
    const dr = done?.getBoundingClientRect()
    return {
      present: true,
      vh: window.innerHeight,
      card: { top: Math.round(cr.top), bottom: Math.round(cr.bottom), h: Math.round(cr.height) },
      cardOverflow: getComputedStyle(card).overflowY,
      cardMaxH: getComputedStyle(card).maxHeight,
      doneTop: dr ? Math.round(dr.top) : null,
      doneBottom: dr ? Math.round(dr.bottom) : null,
      doneInViewport: dr ? dr.top >= 0 && dr.bottom <= window.innerHeight : false,
      listInnerScroll: (() => {
        const l = card.querySelector('.overflow-y-auto')
        return l ? { scrollH: l.scrollHeight, clientH: l.clientHeight, clip: l.scrollHeight > l.clientHeight } : null
      })(),
    }
  })
}

// ------------------------------------------------------------------ MANUAL
async function runManual() {
  await seed(EX_COUNT)
  await page.getByText('Push Day', { exact: false }).first().tap()
  await page.waitForTimeout(400)
  await page.getByText('Start Workout').tap() // sets session.startedAt, goes to timer
  await page.waitForTimeout(400)
  await page.getByText('Continue').tap() // in-memory router: return to DayDetail
  await page.waitForTimeout(400)
  // Tap each exercise's "Mark done" check (the muted CircleCheck buttons).
  for (let i = 0; i < EX_COUNT; i++) {
    await page.getByTitle('Mark done').first().tap()
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(400) // DayDetail schedules setShowSummary after 100ms
}

// ------------------------------------------------------------------- TIMER
async function runTimer() {
  await seed(EX_COUNT)
  await page.getByText('Push Day', { exact: false }).first().tap()
  await page.waitForTimeout(400)
  await page.getByText('Start Workout').tap()
  await page.waitForTimeout(500)
  // On TimerScreen, complete every set via the 30s preset (starts instantly;
  // the 20x virtual clock lands it in ~1.5s). The 20x clock is the honest
  // analog of the phone's "rest elapses while screen is off, completes on
  // resume" path — either way completeTimer -> advanceSession runs.
  //
  // CRITICAL: we STOP the instant every exercise flips done. No extra taps.
  // That is the real user's last action. If the summary popup is absent at
  // that exact moment, Bug B is reproduced (advanceSession read a stale
  // `day` and skipped setShowSummary).
  const readTimer = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('pulse.timer.v1')) || {} } catch { return {} } })
  const doneFlags = () => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pulse.state.v2')).days[0]?.exercises || []).map((e) => e.done) } catch { return [] } })
  const summaryPresent = () => page.evaluate(() => !!document.querySelector('div.fixed.inset-0.z-50'))

  let guard = 0
  firstAllDone = null
  while (guard++ < 150) {
    const df = await doneFlags()
    if (df.length && df.every(Boolean)) {
      await page.waitForTimeout(400) // let React paint before checking popup
      firstAllDone = { summary: await summaryPresent(), guard }
      break
    }
    const t = await readTimer()
    if (!t.running) {
      await page.getByText('30s', { exact: true }).tap().catch(() => {})
      await page.waitForTimeout(400)
    } else {
      await page.waitForTimeout(250)
    }
  }
  // Keep watching a couple extra cycles to see if a LATER completion finally
  // raises the popup (the tell-tale of the stale-read bug).
  laterSummary = firstAllDone?.summary || false
  for (let k = 0; k < 3 && !laterSummary; k++) {
    await page.getByText('30s', { exact: true }).tap().catch(() => {})
    await page.waitForTimeout(1800)
    laterSummary = await summaryPresent()
  }
  console.log('[DEBUG-wsum] firstAllDone snapshot:', JSON.stringify(firstAllDone), ' summary-after-extra-taps:', laterSummary)
  await page.waitForTimeout(200)
}

if (MODE === 'manual') await runManual()
else await runTimer()

const s = await summarize()
await page.screenshot({ path: join(SHOTS, `${MODE}-${EX_COUNT}ex.png`) })

console.log(`[DEBUG-wsum] MODE=${MODE} EX_COUNT=${EX_COUNT}`)
console.log('[DEBUG-wsum] summary:', JSON.stringify(s, null, 2))

// Bug A probes: can the user scroll the card, and does a tap land on Done?
const aProbe = await page.evaluate(() => {
  const overlay = document.querySelector('div.fixed.inset-0.z-50')
  if (!overlay) return null
  const done = [...overlay.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Done')
  const dr = done?.getBoundingClientRect()
  const cx = dr.left + dr.width / 2
  const cy = Math.min(dr.top + dr.height / 2, window.innerHeight - 1)
  const hit = document.elementFromPoint(cx, cy)
  return {
    overlayScrollable: { scrollH: overlay.scrollHeight, clientH: overlay.clientHeight },
    docScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    doneCenterY: Math.round(dr?.top + dr.height / 2),
    hitElementIsDone: hit === done || done?.contains(hit) || false,
    hitTag: hit ? `${hit.tagName}.${(hit.className || '').toString().split(' ').slice(0, 3).join('.')}` : null,
  }
})
console.log('[DEBUG-wsum] Bug A probes:', JSON.stringify(aProbe, null, 2))

// User-level test for Bug A: swipe up on the card, then reach for Done.
const swipe = await (async () => {
  const overlay = await page.$('div.fixed.inset-0.z-50')
  if (!overlay) return { skipped: true }
  const before = await page.evaluate(() => {
    const card = document.querySelector('div.fixed.inset-0.z-50 > div')
    return { scrollTop: card.scrollTop, scrollable: card.scrollHeight > card.clientHeight }
  })
  if (!before.scrollable) return { scrollable: false, doneVisible: (await summarize()).doneInViewport }
  // Real touch swipe via CDP (mouse drag does not drive native scroll under
  // mobile emulation).
  const cdp = await ctx.newCDPSession(page)
  const card = await page.$('div.fixed.inset-0.z-50 > div')
  const cbox = await card.boundingBox()
  const x = cbox.x + cbox.width / 2
  const y0 = cbox.y + cbox.height * 0.75
  const y1 = cbox.y + cbox.height * 0.25
  const swipeUp = async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
    const STEPS = 14
    for (let i = 1; i <= STEPS; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / STEPS }],
      })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(250)
    return page.evaluate(() => document.querySelector('div.fixed.inset-0.z-50 > div').scrollTop)
  }
  // Swipe until Done is visible or the scroll position stops changing.
  let lastTop = -1
  let swipes = 0
  let doneVisible = false
  while (swipes++ < 8) {
    const top = await swipeUp()
    doneVisible = (await summarize()).doneInViewport
    if (doneVisible || top === lastTop) break
    lastTop = top
  }
  const afterScrollTop = await page.evaluate(() => document.querySelector('div.fixed.inset-0.z-50 > div').scrollTop)
  const s2 = await summarize()
  let dismissed = false
  if (s2.doneInViewport) {
    await page.getByText('Done', { exact: true }).tap({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(600) // 200ms exit animation + unmount
    dismissed = await page.evaluate(() => !document.querySelector('div.fixed.inset-0.z-50'))
  }
  return { scrollable: true, scrolledTo: afterScrollTop, doneVisibleAfterScroll: s2.doneInViewport, doneTapDismissedModal: dismissed }
})()
console.log('[DEBUG-wsum] Bug A swipe test:', JSON.stringify(swipe))

// Verdicts
let red = false
if (MODE === 'manual') {
  // Bug A: the user must be able to get to Done (visible outright or after
  // scrolling the card) and dismissing must work.
  const reachable = s.present && (s.doneInViewport || (swipe.doneVisibleAfterScroll && swipe.doneTapDismissedModal))
  if (!s.present) {
    console.log('>>> n/a/RED: no summary rendered for manual finish.')
    red = true
  } else if (reachable) {
    console.log('>>> green (Bug A): Done reachable (scrollable card) and tap dismisses the summary.')
  } else {
    console.log('>>> RED (Bug A): Done NOT reachable even after swipe. swipe=', JSON.stringify(swipe))
    red = true
  }
} else {
  // Bug B: the moment the LAST exercise flips done, the summary must be up.
  if (firstAllDone && !firstAllDone.summary) {
    console.log('>>> RED (Bug B): at the instant the workout finished via timer, NO summary popup. (Popup only appeared after extra timer completions:', laterSummary, ')')
    red = true
  } else if (!firstAllDone) {
    console.log('>>> harness did not reach all-done state (loop guard hit).')
    red = true
  } else {
    console.log('>>> green (Bug B): timer finish raised the summary immediately.')
  }
}

console.log('[DEBUG-wsum] errors:', errors.length ? errors : 'none')
await browser.close()
process.exit(red ? 1 : 0)
