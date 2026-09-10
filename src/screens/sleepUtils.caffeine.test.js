import { test } from 'node:test'
import assert from 'node:assert/strict'
import { caffeineImpact, bedtimeDatetime, caffeineTimestamp, caffeineClock, caffeineDose, sleepScoreForLog, scoreBreakdown, CAFFEINE_DEFAULT_MG } from './sleepUtils.js'

// --- Model (ADR 0005 + amendment) ---------------------------------------------
// multiplier = exp(−D_eff / 200), D_eff = Σ mg · 0.5^(hoursBeforeBed / 4),
// over entries in [bedtime − 24h, bedtime]. The published calibration table in
// docs/adr/0005 was fitted with /400; the real-world amendment doubled the
// penalty, so each table row's expected loss is now 1 − (1 − L)², where L is
// the table's loss. Bands checked ± 9 pp — the model/table fit deviation
// doubles along with the penalty (the study row 400 mg @ 4 h deviates most).

const BED = '23:00'
const SLEEP_DATE = '2024-01-10' // wake date; bedtime 23:00 → evening of 2024-01-09

// Caffeine entry at HH:MM on the evening of the night (day before wake date).
function at(hhmm, mg) {
  return { type: 'coffee', amountMg: mg, time: `2024-01-09T${hhmm}:00` }
}
function sleepLog(bedtime = BED, date = SLEEP_DATE) {
  return { date, hours: 7, bedtime }
}

// --- bedtimeDatetime ----------------------------------------------------------

test('bedtimeDatetime: evening bedtime belongs to the day before the wake date', () => {
  const d = bedtimeDatetime(sleepLog('23:00', '2024-01-10'))
  assert.equal(d.getFullYear(), 2024)
  assert.equal(d.getMonth(), 0)
  assert.equal(d.getDate(), 9)
  assert.equal(d.getHours(), 23)
})

test('bedtimeDatetime: after-midnight bedtime belongs to the wake date itself', () => {
  const d = bedtimeDatetime(sleepLog('01:30', '2024-01-10'))
  assert.equal(d.getDate(), 10)
  assert.equal(d.getHours(), 1)
  assert.equal(d.getMinutes(), 30)
})

test('bedtimeDatetime: "12:30" normalizes to just past midnight (not noon)', () => {
  const d = bedtimeDatetime(sleepLog('12:30', '2024-01-10'))
  assert.equal(d.getDate(), 10)
  assert.equal(d.getHours(), 0)
  assert.equal(d.getMinutes(), 30)
})

test('bedtimeDatetime: missing bedtime or date → null', () => {
  assert.equal(bedtimeDatetime({ date: '2024-01-10', hours: 7 }), null)
  assert.equal(bedtimeDatetime({ bedtime: '23:00', hours: 7 }), null)
})

// --- caffeineDose -------------------------------------------------------------

test('caffeineDose: recorded amount wins', () => {
  assert.equal(caffeineDose({ type: 'coffee', amountMg: 120 }), 120)
})

test('caffeineDose: legacy entries without a dose fall back to the type default', () => {
  assert.equal(caffeineDose({ type: 'coffee' }), CAFFEINE_DEFAULT_MG.coffee)
  assert.equal(caffeineDose({ type: 'energy', amountMg: null }), CAFFEINE_DEFAULT_MG.energy)
  assert.equal(caffeineDose({ type: 'preworkout' }), CAFFEINE_DEFAULT_MG.preworkout)
  assert.equal(caffeineDose({ type: 'tea' }), CAFFEINE_DEFAULT_MG.tea)
})

// --- caffeineImpact: basics ---------------------------------------------------

test('caffeineImpact: no entries → 1', () => {
  assert.equal(caffeineImpact([], sleepLog()), 1)
})

test('caffeineImpact: sleep log without a bedtime → 1 (no anchor, no impact)', () => {
  const logs = [at('21:00', 400)]
  assert.equal(caffeineImpact(logs, { date: SLEEP_DATE, hours: 7 }), 1)
})

test('caffeineImpact: entry after that night\'s bedtime is excluded (belongs to the next night)', () => {
  // 23:30 is after a 23:00 bedtime → counts for the NEXT night, not this one.
  const logs = [{ type: 'coffee', amountMg: 200, time: '2024-01-09T23:30:00' }]
  assert.equal(caffeineImpact(logs, sleepLog()), 1)
})

test('caffeineImpact: a dose at exactly bedtime counts (table worst case, doubled)', () => {
  const logs = [{ type: 'coffee', amountMg: 400, time: '2024-01-09T23:00:00' }]
  const loss = (1 - caffeineImpact(logs, sleepLog())) * 100
  // Table said 60–70% at /400; the amendment doubles it → ~86%.
  assert.ok(loss >= 72 && loss <= 96, `Expected ~86% loss, got ${loss.toFixed(1)}%`)
})

test('caffeineImpact: entry older than 24h before bedtime is excluded', () => {
  // 22:00 on 2024-01-08 is 25h before the 23:00 bedtime on 2024-01-09.
  const logs = [{ type: 'coffee', amountMg: 400, time: '2024-01-08T22:00:00' }]
  assert.equal(caffeineImpact(logs, sleepLog()), 1)
})

test('caffeineImpact: Monday-afternoon coffee penalizes the Mon→Tue night', () => {
  // Wake date Tuesday 2024-01-09, bedtime Monday 23:00; coffee Monday 16:00.
  const logs = [{ type: 'coffee', amountMg: 95, time: '2024-01-08T16:00:00' }]
  const impact = caffeineImpact(logs, sleepLog('23:00', '2024-01-09'))
  // 95 mg, 7h → D_eff ≈ 28.3 → exp(−28.3/200) ≈ 0.868
  assert.ok(impact < 1 && impact > 0.8, `Expected ~0.87, got ${impact}`)
})

test('caffeineImpact: multiple entries accumulate', () => {
  const logs = [at('15:00', 100), at('20:00', 100)]
  const single = caffeineImpact([at('15:00', 100)], sleepLog())
  const both = caffeineImpact(logs, sleepLog())
  assert.ok(both < single, `Accumulation should deepen the penalty: ${both} < ${single}`)
})

test('caffeineImpact: higher dose at the same time is worse', () => {
  const heavy = caffeineImpact([at('21:00', 200)], sleepLog())
  const light = caffeineImpact([at('21:00', 50)], sleepLog())
  assert.ok(heavy < light, `200 mg should hurt more than 50 mg: ${heavy} < ${light}`)
})

test('caffeineImpact: no cap — an extreme dose can cost well over 50%', () => {
  // ADR 0005: the old 0.5 floor is gone; exp is the only bound.
  const impact = caffeineImpact([at('22:30', 800)], sleepLog())
  assert.ok(impact < 0.4, `800 mg at 22:30 should cost >60%: got ${impact}`)
  assert.ok(impact > 0, `Multiplier must stay positive: got ${impact}`)
})

// --- caffeineImpact: the calibration table (docs/adr/0005) --------------------
// Each row: [mg, hours before bed, low %, high %] from the source table.
// The model is checked inside the published range ± 6 pp.

const TABLE = [
  [50, 8, 2, 3],
  [50, 4, 5, 7],
  [100, 8, 3, 5],
  [100, 6, 7, 10],
  [100, 4, 10, 15],
  [100, 2, 15, 20],
  [200, 8, 8, 12],
  [200, 6, 12, 18],
  [200, 4, 20, 25],
  [200, 3, 25, 30],
  [200, 2, 30, 35],
  [300, 6, 18, 25],
  [300, 4, 28, 35],
  [300, 3, 35, 40],
  [300, 2, 40, 45],
  [400, 12, 10, 15],
  [400, 8, 18, 22],
  [400, 6, 25, 30],
  [400, 4, 34, 34], // the one directly-from-study row
  [400, 3, 38, 42],
  [400, 2, 45, 50],
  [400, 1, 50, 60],
  [400, 0, 60, 70],
]

const BAND = 9 // pp of tolerance around the (penalty-doubled) published range

// The amendment doubles the penalty on top of the table fit: a table loss L
// becomes 1 − (1 − L)². Each row's published band is transformed the same way.
const amend = (lossPct) => (1 - Math.pow(1 - lossPct / 100, 2)) * 100

for (const [mg, hours, low, high] of TABLE) {
  test(`table×2: ${mg} mg ${hours}h before bed → ${low}–${high}% table, doubled`, () => {
    // Bedtime 23:00 on 2024-01-09; the dose sits exactly `hours` before it.
    const bedMinutes = 23 * 60
    const d = new Date(2024, 0, 9, 0, bedMinutes - hours * 60) // may roll past midnight
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
    const impact = caffeineImpact([{ type: 'coffee', amountMg: mg, time: stamp }], sleepLog())
    const lossPct = (1 - impact) * 100
    assert.ok(
      lossPct >= amend(low) - BAND && lossPct <= amend(high) + BAND,
      `${mg} mg @ ${hours}h: expected ${amend(low).toFixed(1)}–${amend(high).toFixed(1)}% (±${BAND}), got ${lossPct.toFixed(1)}%`,
    )
  })
}

// --- caffeineTimestamp: "now or the past, never the future" --------------------

test('caffeineTimestamp: a time earlier than now stays today', () => {
  const now = new Date(2024, 0, 10, 16, 30)
  const t = caffeineTimestamp('14:00', now)
  assert.equal(t.getDate(), 10)
  assert.equal(t.getHours(), 14)
})

test('caffeineTimestamp: a future time-of-day is stamped yesterday', () => {
  const now = new Date(2024, 0, 10, 16, 0)
  const t = caffeineTimestamp('18:00', now)
  assert.equal(t.getDate(), 9)
  assert.equal(t.getHours(), 18)
})

test('caffeineTimestamp: exactly now stays now', () => {
  const now = new Date(2024, 0, 10, 16, 0)
  const t = caffeineTimestamp('16:00', now)
  assert.equal(t.getDate(), 10)
  assert.equal(t.getHours(), 16)
})

test('caffeineTimestamp: malformed time falls back to now', () => {
  const now = new Date(2024, 0, 10, 16, 0)
  assert.equal(caffeineTimestamp('', now), now)
})

// --- caffeineClock --------------------------------------------------------------

test('caffeineClock: today shows HH:MM, older shows "Yesterday HH:MM"', () => {
  const now = new Date(2024, 0, 10, 20, 0)
  assert.equal(caffeineClock({ time: '2024-01-10T14:30:00' }, now), '14:30')
  assert.equal(caffeineClock({ time: '2024-01-09T14:30:00' }, now), 'Yesterday 14:30')
})

// --- sleepScoreForLog / scoreBreakdown: one scoring path for every surface -----

test('sleepScoreForLog: perfect night with a modest late coffee drops into the 70s', () => {
  // The reported scenario: 8h at the goal, perfect timing, ~67 mg still aboard
  // at bed. The old /400 fit gave 84 ("pretty good" for a bad night); the
  // amendment doubles the penalty → 100 × 100 × exp(−67/200) ≈ 72.
  const log = sleepLog('23:00', '2024-01-10')
  log.hours = 8
  const logs = [at('21:00', 95)] // 2h before bed: 95·0.5^(0.5) ≈ 67 mg aboard
  const score = sleepScoreForLog(log, 8, '23:00', logs)
  assert.ok(score >= 68 && score <= 76, `expected ~72, got ${score}`)
})

test('sleepScoreForLog: an early coffee barely dents a good night', () => {
  // The curve stays exponential: distance still buys forgiveness. 8h at the
  // goal, perfect timing, coffee at 13:00 (10h before a 23:00 bedtime) →
  // 95·0.5^2.5 ≈ 17 mg aboard → multiplier ≈ 0.92 → high-80s/low-90s.
  const log = sleepLog('23:00', '2024-01-10')
  log.hours = 8
  const score = sleepScoreForLog(log, 8, '23:00', [at('13:00', 95)])
  assert.ok(score >= 88 && score <= 95, `expected ~92, got ${score}`)
})

test('sleepScoreForLog: same night without caffeine scores 100', () => {
  const log = sleepLog('23:00', '2024-01-10')
  log.hours = 8
  assert.equal(sleepScoreForLog(log, 8, '23:00', []), 100)
})

test('sleepScoreForLog: caffeineLogs omitted (legacy callers) scores without caffeine', () => {
  const log = sleepLog('23:00', '2024-01-10')
  log.hours = 8
  assert.equal(sleepScoreForLog(log, 8, '23:00'), 100)
})

test('scoreBreakdown: all three components on 0–100, score matches their product', () => {
  const log = sleepLog('01:00', '2024-01-10') // 2h late
  log.hours = 7
  const logs = [at('21:00', 95)]
  const b = scoreBreakdown(log, 8, '23:00', logs)
  for (const key of ['duration', 'timing', 'caffeine', 'score']) {
    assert.ok(b[key] >= 0 && b[key] <= 100, `${key} out of range: ${b[key]}`)
  }
  const product = (b.duration * b.timing * b.caffeine) / 10000
  assert.ok(Math.abs(b.score - product) <= 1, `score ${b.score} vs product ${product.toFixed(1)}`)
})

test('scoreBreakdown: legacy log without bedtime has neutral timing', () => {
  const b = scoreBreakdown({ date: '2024-01-10', hours: 8 }, 8, '23:00', [])
  assert.equal(b.duration, 100)
  assert.equal(b.timing, 100)
  assert.equal(b.caffeine, 100)
  assert.equal(b.score, 100)
})
