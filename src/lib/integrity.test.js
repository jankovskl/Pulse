import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNewPersonalRecord } from './integrity.js'

test('isNewPersonalRecord: tying the previous best is NOT a PR', () => {
  // Bug trace: last session 100 kg, this session 100 kg. Equalling it is a
  // tie, not an improvement — must not be flagged as a new personal record.
  assert.equal(isNewPersonalRecord(100, 100), false)
})

test('isNewPersonalRecord: a larger weight is a PR', () => {
  assert.equal(isNewPersonalRecord(110, 100), true)
})

test('isNewPersonalRecord: a smaller weight is not a PR', () => {
  assert.equal(isNewPersonalRecord(90, 100), false)
})

test('isNewPersonalRecord: the first ever lift is a PR', () => {
  assert.equal(isNewPersonalRecord(50, 0), true)
})

test('isNewPersonalRecord: a zero-weight session is never a PR', () => {
  assert.equal(isNewPersonalRecord(0, 0), false)
  assert.equal(isNewPersonalRecord(0, 50), false)
})