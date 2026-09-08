// Utility functions for the SleepScreen – pure logic that can be unit‑tested
// These are deliberately kept in a plain .js file so the Node test runner can import them
// without needing to transpile JSX.

import { dateKey } from '../lib/data.js'

// Compute the key (YYYY‑MM‑DD) for "last night" based on the current time.
// Sleep is keyed by wake date (ADR 0004): the night you woke up from this
// morning belongs to today, whatever hour bedtime was. So the key is simply
// today's date — no noon roll-back.
export function lastNightKey(now = new Date()) {
  return dateKey(now)
}

// Split an "HH:MM" time into minutes since midnight; NaN when malformed.
function toMinutes(t) {
  const [h, m] = String(t).split(':').map(Number)
  if (!Number.isFinite(h)) return NaN
  return h * 60 + (m || 0)
}

// Timing alignment of a bedtime against the ideal onset, as a 0..1 multiplier.
// Bedtimes at or before the ideal onset are fully aligned (1.0); later bedtimes
// decay on a cosine curve — 1h late ≈ 0.98, 3h late ≈ 0.87, 6h late ≈ 0.50,
// 9h+ late ≈ 0 — the "gradually decreasing" rule of thumb, so 8h from 11 PM
// scores 100 while the same 8h from 1 AM scores ≈ 87.
export function sleepAlignment(bedtime, ideal = '23:00') {
  if (!bedtime) return 1 // legacy { date, hours } log: no timing info → neutral
  const b = toMinutes(bedtime)
  const i = toMinutes(ideal)
  if (!Number.isFinite(b) || !Number.isFinite(i)) return 1
  let offset = b - i
  // Bedtimes are times-of-day: normalize the offset into (−12h, +12h] so
  // 00:30 reads as "2.5h late", not "21.5h early".
  if (offset > 12 * 60) offset -= 24 * 60
  if (offset <= -12 * 60) offset += 24 * 60
  if (offset <= 0) return 1 // at or earlier than ideal → fully aligned
  const SPAN = 18 * 60 // minutes; cos(π·offset/SPAN) reaches 0 nine hours late
  // Clamp at 0: offsets past 9h would otherwise go negative (cos below zero),
  // and a "negative alignment" must never leak into the score.
  return Math.max(0, Math.round(Math.cos((offset / SPAN) * Math.PI) * 1000) / 1000)
}

// Sleep score: duration relative to the goal, damped by how far past the ideal
// onset the bedtime falls. Duration alone was the old score; timing is the
// "quality" axis — 8h from 11 PM is 100, the same 8h from 1 AM ≈ 87.
// Bedtime is optional: legacy logs without it keep the pure duration score.
export function sleepScore(hours, goal = 8, bedtime, idealBedtime = '23:00') {
  if (typeof hours !== 'number' || hours <= 0) return 0
  if (typeof goal !== 'number' || goal <= 0) return 0
  const duration = Math.min(100, (hours / goal) * 100)
  const alignment = sleepAlignment(bedtime, idealBedtime)
  return Math.min(100, Math.round(duration * alignment))
}

// Score a stored sleep log — the single entry point every surface uses
// (SleepCard, heatmap, Home card, month view): duration × timing, then
// damped by caffeine still aboard at bedtime (ADR 0005). Pass the store's
// caffeine list so all surfaces agree on the number; omit it (or pass []) to
// score without caffeine.
export function sleepScoreForLog(log, goal = 8, idealBedtime = '23:00', caffeineLogs = []) {
  if (!log || typeof log.hours !== 'number') return 0
  const base = sleepScore(log.hours, goal, log.bedtime, idealBedtime)
  return Math.round(base * caffeineImpact(caffeineLogs, log))
}

// The components behind a night's score, each on a 0–100 scale:
// score ≈ duration × timing × caffeine / 10 000. UI shows all three so a
// dropped score explains itself (e.g. "Duration 100 · Timing 100 · Caffeine 84").
export function scoreBreakdown(log, goal = 8, idealBedtime = '23:00', caffeineLogs = []) {
  const duration =
    typeof log?.hours === 'number' && log.hours > 0 && typeof goal === 'number' && goal > 0
      ? Math.min(100, (log.hours / goal) * 100)
      : 0
  return {
    duration: Math.round(duration),
    timing: Math.round(sleepAlignment(log?.bedtime, idealBedtime) * 100),
    caffeine: Math.round(caffeineImpact(caffeineLogs, log) * 100),
    score: sleepScoreForLog(log, goal, idealBedtime, caffeineLogs),
  }
}

// --- Caffeine → sleep impact -------------------------------------------------
// Model (ADR 0005): each entry contributes its dose decayed by a 4-hour
// half-life; contributions sum to an effective dose still aboard at bedtime,
// and the sleep-score multiplier is exp(−D_eff / 400) — 400 mg active at
// bedtime costs ~63% of sleep quality. Fitted to the published dose/time
// sleep-loss table reproduced in docs/adr/0005; every row is a test vector in
// sleepUtils.caffeine.test.js. The formula is self-bounding in (0, 1), so the
// old 50% cap is gone.

export const CAFFEINE_DEFAULT_MG = { coffee: 95, energy: 160, preworkout: 200, tea: 45 }

// Resolve a sleep log's bedtime to a real datetime. Sleep is keyed by wake
// date (ADR 0004): a bedtime at or after noon belongs to the day *before* the
// wake date; an early-morning bedtime (< noon) belongs to the wake date
// itself. "12:XX" normalizes to "00:XX" (same 12 AM confusion as
// sleepHoursOf). Returns null for missing/malformed bedtimes.
export function bedtimeDatetime(log) {
  if (!log?.bedtime || !log?.date) return null
  const mins = toMinutes(log.bedtime)
  if (Number.isNaN(mins)) return null
  // Same 12 AM normalization as sleepHoursOf: "12:XX" means just past
  // midnight, not noon.
  const rawHour = Math.floor(mins / 60)
  const hour = rawHour === 12 ? 0 : rawHour
  const minute = mins % 60
  const [y, m, d] = String(log.date).split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const dayOffset = hour >= 12 ? -1 : 0
  return new Date(y, m - 1, d + dayOffset, hour, minute)
}

// The dose counted for a caffeine entry: its recorded mg, or the type's
// default when logged before doses existed (ADR 0005).
export function caffeineDose(entry) {
  return typeof entry?.amountMg === 'number' && entry.amountMg > 0
    ? entry.amountMg
    : (CAFFEINE_DEFAULT_MG[entry?.type] ?? 50)
}

// Multiplier (0..1) on a sleep log's score from caffeine in its window:
// entries whose timestamp falls in [bedtime − 24h, bedtime] — inclusive at
// bedtime, because a dose taken right as you get into bed is the table's
// worst case. (A boundary dose also decays to ~1/64 of itself by the next
// bedtime, so inclusivity costs the following night ~1.6% at most.) Caffeine
// after that night's bedtime belongs to the next night. No bedtime → no
// anchor → 1.
export function caffeineImpact(caffeineLogs, sleepLog) {
  const bed = bedtimeDatetime(sleepLog)
  if (!bed || !Array.isArray(caffeineLogs) || caffeineLogs.length === 0) return 1
  const bedTime = bed.getTime()
  const windowStart = bedTime - 24 * 60 * 60 * 1000

  let effectiveDose = 0
  for (const entry of caffeineLogs) {
    const t = new Date(entry.time).getTime()
    if (Number.isNaN(t) || t < windowStart || t > bedTime) continue
    const hoursBeforeBed = (bedTime - t) / (60 * 60 * 1000)
    effectiveDose += caffeineDose(entry) * Math.pow(0.5, hoursBeforeBed / 4)
  }
  if (effectiveDose === 0) return 1
  return Math.exp(-effectiveDose / 400)
}

// --- Caffeine entry timestamps ------------------------------------------------
// The popup lets the user pick a time-of-day, never a date (backfill is
// "now or the past" only). A chosen time later than the current clock means
// "yesterday at that time" — stamping it today would put it in the future and
// apply it to the wrong night.

export function caffeineTimestamp(timeStr, now = new Date()) {
  const mins = toMinutes(timeStr)
  // Guard the empty string too: Number('') is 0, so toMinutes('') is midnight,
  // not NaN.
  if (!timeStr || Number.isNaN(mins)) return now
  const candidate = new Date(now)
  candidate.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  if (candidate.getTime() > now.getTime()) candidate.setDate(candidate.getDate() - 1)
  return candidate
}

// Display a stored entry's time as "HH:MM", with a "Yesterday" suffix when it
// is not from today.
export function caffeineClock(entry, now = new Date()) {
  const d = new Date(entry.time)
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return dateKey(d) === dateKey(now) ? hhmm : `Yesterday ${hhmm}`
}

// Color of a sleep score: 0 → red, 100 → green, a straight RGB mix in between.
// A 50 score is therefore a literal 50/50 red+green blend; 70 is 70% green +
// 30% red. Used by the score bar and both sleep heatmaps so every surface
// reads the same signal.
const SCORE_RED = [0xef, 0x44, 0x44] // tailwind red-500
const SCORE_GREEN = [0x17, 0xc9, 0x64] // --color-good
export function sleepColor(score, from = SCORE_RED, to = SCORE_GREEN) {
  // || 0 first: Math.min/max pass NaN through, so a NaN score would leak
  // rgb(NaN, NaN, NaN) instead of clamping to the red end.
  const t = Math.max(0, Math.min(100, Number(score) || 0)) / 100
  const mix = (x, y) => Math.round(x + (y - x) * t)
  return `rgb(${mix(from[0], to[0])}, ${mix(from[1], to[1])}, ${mix(from[2], to[2])})`
}

// Hours between two "HH:MM" times, handling a wake time that crosses midnight
// (bedtime 23:00 → wake 07:00 = 8h). Rounded to 0.1h.
//
// IMPORTANT: The HTML <input type="time"> returns 24-hour format (00:00–23:59).
// Users often type "12:00" meaning midnight, but in 24h that's noon!
// This function normalizes: "12:XX" → "00:XX" for bedtimes (since you don't
// go to bed at noon), fixing the common 12 AM = 00:00 confusion.
export function sleepHoursOf(bedtime, wake) {
  const toMin = (t) => {
    if (!t) return NaN
    const [h, m] = String(t).split(':').map(Number)
    if (!Number.isFinite(h)) return NaN
    // Normalize "12:XX" → "00:XX" because <input type="time"> uses 24h format
    // and 12 AM = 00:00, not 12:00. Bedtime at noon is nonsensical.
    const hour = h === 12 ? 0 : h
    return hour * 60 + (m || 0)
  }
  const b = toMin(bedtime)
  const w = toMin(wake)
  if (!Number.isFinite(b) || !Number.isFinite(w)) return NaN
  let diff = w - b
  if (diff < 0) diff += 24 * 60
  return Math.round(diff / 6) / 10
}

// Build the 7-day week starting on Monday for a given reference date.
export function weekOf(today) {
  const monday = new Date(today)
  const day = (today.getDay() + 6) % 7
  monday.setDate(today.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// Return a map of dateKey → sleep hours for fast lookup from the store's sleep array.
export function sleepMap(sleepLogs) {
  const map = {}
  if (Array.isArray(sleepLogs)) {
    sleepLogs.forEach((s) => {
      const key = typeof s.date === 'string' ? s.date : dateKey(s.date)
      if (s.hours != null) map[key] = s.hours
    })
  }
  return map
}