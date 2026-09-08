import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateDuration, formatDuration } from './data.js'

const day = (exercises) => ({ id: 'd1', name: 'push', exercises })

test('estimateDuration sums sets across exercises (4-5 min per set)', () => {
  assert.deepEqual(
    estimateDuration(day([{ sets: 3 }, { sets: 4 }, { sets: 2 }])),
    { min: 36, max: 45 },
  )
})

test('estimateDuration returns zeros for a day with no exercises', () => {
  assert.deepEqual(estimateDuration(day([])), { min: 0, max: 0 })
})

test('formatDuration renders ~min–max range', () => {
  assert.equal(formatDuration(day([{ sets: 9 }])), '~36–45 min')
})

test('formatDuration renders 0 min for an empty day', () => {
  assert.equal(formatDuration(day([])), '0 min')
})
