import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sleepScore, sleepAlignment, sleepScoreForLog, sleepColor, sleepHoursOf, lastNightKey } from '../screens/sleepUtils.js'
import { dateKey } from './data.js'

// --- lastNightKey: wake-date keying (ADR 0004) ------------------------------

test('lastNightKey: keys by wake date — always today, at any hour', () => {
  // Morning log right after waking: still today's key (pre-noon roll-back is gone).
  assert.equal(lastNightKey(new Date('2026-08-29T08:30:00')), '2026-08-29')
  // Same at 3am or in the afternoon — the key never depends on the clock hour.
  assert.equal(lastNightKey(new Date('2026-08-29T03:00:00')), '2026-08-29')
  assert.equal(lastNightKey(new Date('2026-08-29T15:00:00')), '2026-08-29')
  // Month/year boundaries stay plain calendar dates.
  assert.equal(lastNightKey(new Date('2026-09-01T07:00:00')), '2026-09-01')
  assert.equal(lastNightKey(new Date('2026-08-29T07:00:00')), dateKey(new Date('2026-08-29T07:00:00')))
})

// --- sleepScore: duration even when timing is perfect -----------------------

test('sleepScore: meeting the goal at the ideal bedtime scores 100', () => {
  assert.equal(sleepScore(8, 8, '22:00', '22:00'), 100)
})

test('sleepScore: hours are still the duration axis (early beddie stays aligned)', () => {
  // 7h from 21:00 (earlier than ideal) → alignment is 1; the duration axis
  // carries the doubled penalty, so 7/8 of the goal is 77, not the old 88.
  assert.equal(sleepScore(7, 8, '21:00', '22:00'), 77) // (7/8)² = 76.5625 → 77
})

test('sleepScore: overshooting the goal is still capped at a perfect duration', () => {
  // 11h on an 8h goal: the ratio is capped at 1 before squaring, so the
  // duration axis tops out at exactly 100 — the ceiling never shifts.
  assert.equal(sleepScore(11, 8, '22:00', '22:00'), 100)
})

test('sleepScore: the same 8h from 1am (3h late) takes the doubled hit on both axes', () => {
  // Old curve: duration 100 (capped), alignment 0.866 → 87. Squared penalty
  // on each axis: alignment cos(3h)² = 0.75 → 75.
  const score = sleepScore(8, 8, '01:00', '22:00')
  assert.equal(score, 75)
})

test('sleepScore: later bedtimes decay gradually, never below the duration floor', () => {
  const at = (b) => sleepScore(8, 8, b, '22:00')
  assert.ok(at('23:00') > at('00:00'))
  assert.ok(at('00:00') > at('01:00'))
  assert.ok(at('01:00') > at('03:00'))
  assert.ok(at('03:00') > at('06:00'))
})

test('sleepScore: legacy log without bedtime is pure duration', () => {
  assert.equal(sleepScore(8, 8, null, '22:00'), 100)
  assert.equal(sleepScore(7, 8, undefined, '22:00'), 77)
})

test('sleepScore: the duration penalty steepens below the goal', () => {
  // Half the goal on time: (4/8)² → 25, where the linear axis gave 50.
  assert.equal(sleepScore(4, 8, '21:00', '22:00'), 25)
  assert.equal(sleepScore(6, 8, '21:00', '22:00'), 56) // 0.75² = 56.25 → 56
})

test('sleepScore: invalid inputs score 0 (preserves old guard)', () => {
  assert.equal(sleepScore(0, 8, '22:00', '22:00'), 0)
  assert.equal(sleepScore(-2, 8, '22:00', '22:00'), 0)
  assert.equal(sleepScore('8', 8, '22:00', '22:00'), 0)
  assert.equal(sleepScore(8, 0, '22:00', '22:00'), 0)
})

// --- sleepAlignment ----------------------------------------------------------

test('sleepAlignment: 1.0 at or before the ideal onset', () => {
  assert.equal(sleepAlignment('22:00', '22:00'), 1)
  assert.equal(sleepAlignment('21:30', '22:00'), 1)
  assert.equal(sleepAlignment('20:00', '22:00'), 1)
})

test('sleepAlignment: neutral (1.0) when there is no bedtime', () => {
  assert.equal(sleepAlignment(null, '22:00'), 1)
  assert.equal(sleepAlignment(undefined, '22:00'), 1)
  assert.equal(sleepAlignment(''), 1)
})

test('sleepAlignment: 3h late = cos²(3h) = 0.75, the doubled penalty', () => {
  // cos(π·3/18) = √3/2 ≈ 0.866; the curve is squared, so 0.75.
  assert.equal(sleepAlignment('01:00', '22:00'), 0.75)
  // 1h late: cos(10°)² ≈ 0.970 (was 0.985).
  assert.equal(sleepAlignment('23:00', '22:00'), 0.97)
  // 6h late: cos(60°) = 0.5 → 0.25 (was 0.5).
  assert.equal(sleepAlignment('04:00', '22:00'), 0.25)
})

test('sleepAlignment: monotone decay, and the square only ever hurts more', () => {
  const late = (h) => sleepAlignment(h, '22:00')
  assert.ok(late('23:00') > late('00:00'))
  assert.ok(late('00:00') > late('01:00'))
  assert.ok(late('01:00') > late('04:00'))
  assert.ok(late('04:00') > late('06:00'))
  // Every offset in (0, 9h) is strictly worse than before the amendment.
  for (const b of ['23:00', '23:30', '00:00', '01:00', '02:00', '04:00', '06:00']) {
    const cos = Math.cos(((sleepOffsetMinutes(b) % 1440) / 1080) * Math.PI)
    assert.ok(late(b) <= Math.max(0, cos) + 1e-9, `${b}: squared must not exceed the raw cosine`)
  }
})

function sleepOffsetMinutes(bedtime) {
  const [bh, bm] = bedtime.split(':').map(Number)
  return ((bh * 60 + bm) - 22 * 60 + 1440) % 1440
}

test('sleepAlignment: 9h+ late hits the zero floor', () => {
  assert.equal(sleepAlignment('07:00', '22:00'), 0) // 9h late
  // 10:00 with ideal 22:00 is 12h late after wrap-around — clamps to 0,
  // never goes negative.
  assert.equal(sleepAlignment('10:00', '22:00'), 0)
})

// --- sleepScoreForLog --------------------------------------------------------

test('sleepScoreForLog: score a stored log, 0 when absent/invalid', () => {
  assert.equal(sleepScoreForLog({ hours: 8, bedtime: '22:00' }, 8, '22:00'), 100)
  assert.equal(sleepScoreForLog({ hours: 8, bedtime: '01:00' }, 8, '22:00'), 75)
  assert.equal(sleepScoreForLog(null, 8, '22:00'), 0)
  assert.equal(sleepScoreForLog({}, 8, '22:00'), 0)
})

// --- sleepColor: red→green score gradient -------------------------------------

function parseRgb(color) {
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color)
  assert.ok(m, `expected rgb() string, got ${color}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

test('sleepColor: 0 is pure red, 100 is pure green', () => {
  assert.deepEqual(parseRgb(sleepColor(0)), [0xef, 0x44, 0x44]) // #EF4444
  assert.deepEqual(parseRgb(sleepColor(100)), [0x17, 0xc9, 0x64]) // #17C964
})

test('sleepColor: 50 is the literal midpoint between red and green', () => {
  const [r, g, b] = parseRgb(sleepColor(50))
  assert.equal(r, Math.round((0xef + 0x17) / 2))
  assert.equal(g, Math.round((0x44 + 0xc9) / 2))
  assert.equal(b, Math.round((0x44 + 0x64) / 2))
})

test('sleepColor: 70 is 70% of the way to green', () => {
  const [r, g, b] = parseRgb(sleepColor(70))
  const t = 0.7
  const mix = (x, y) => Math.round(x + (y - x) * t)
  assert.equal(r, mix(0xef, 0x17))
  assert.equal(g, mix(0x44, 0xc9))
  assert.equal(b, mix(0x44, 0x64))
})

test('sleepColor: clamps out-of-range scores and handles NaN', () => {
  assert.deepEqual(parseRgb(sleepColor(-20)), parseRgb(sleepColor(0)))
  assert.deepEqual(parseRgb(sleepColor(150)), parseRgb(sleepColor(100)))
  assert.deepEqual(parseRgb(sleepColor(Number.NaN)), parseRgb(sleepColor(0)))
})

// --- sleepHoursOf: midnight/12-hour parsing fix -----------------------------

test('sleepHoursOf: 12 AM (midnight) bedtime is normalized to 00:00', () => {
  // User sets 12:00 thinking midnight, but <input type="time"> returns "12:00" = noon.
  // The fix normalizes bedtime "12:XX" → "00:XX".
  assert.equal(sleepHoursOf('12:00', '08:00'), 8)    // 12 AM → 8 AM = 8h
  assert.equal(sleepHoursOf('12:30', '08:30'), 8)    // 12:30 AM → 8:30 AM = 8h
  assert.equal(sleepHoursOf('12:45', '07:45'), 7)    // 12:45 AM → 7:45 AM = 7h
})

test('sleepHoursOf: normal times still work', () => {
  assert.equal(sleepHoursOf('23:00', '07:00'), 8)   // 11 PM → 7 AM = 8h
  assert.equal(sleepHoursOf('22:30', '06:30'), 8)   // 10:30 PM → 6:30 AM = 8h
  assert.equal(sleepHoursOf('01:00', '09:00'), 8)   // 1 AM → 9 AM = 8h
  assert.equal(sleepHoursOf('20:00', '04:00'), 8)   // 8 PM → 4 AM = 8h
})

test('sleepHoursOf: edge cases around midnight', () => {
  assert.equal(sleepHoursOf('00:00', '08:00'), 8)   // explicit 00:00 = 8h
  assert.equal(sleepHoursOf('00:30', '08:30'), 8)   // 00:30 → 8:30 = 8h
  assert.equal(sleepHoursOf('23:59', '07:59'), 8)   // 23:59 → 7:59 = 8h
})