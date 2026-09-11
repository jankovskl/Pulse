import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TUTORIAL_STEPS, UNRELEASED, newStepsSince } from './tutorialSteps.js'

const steps = [
  { id: 'core', target: '[data-tutorial="a"]' },
  { id: 'old', since: '2.1.0' },
  { id: 'same', since: '2.2.0' },
  { id: 'newer', since: '2.3.0' },
  { id: 'pending', since: UNRELEASED },
]

test('newStepsSince returns only steps newer than the acknowledged version', () => {
  assert.deepEqual(
    newStepsSince(steps, '2.2.0').map((s) => s.id),
    ['newer'],
  )
})

test('a pending (Unreleased) step is never offered as news', () => {
  assert.deepEqual(
    newStepsSince(steps, '2.0.0').map((s) => s.id),
    ['old', 'same', 'newer'],
  )
})

test('no acknowledged version means nothing to show (avoids nagging on first run)', () => {
  assert.deepEqual(newStepsSince(steps, null), [])
})

test('a fixes-only release yields an empty tour', () => {
  assert.deepEqual(newStepsSince([{ id: 'core' }, { id: 'old', since: '2.1.0' }], '2.2.0'), [])
})

test('version comparison is numeric, not lexical', () => {
  assert.deepEqual(
    newStepsSince([{ id: 'x', since: '2.10.0' }], '2.9.0').map((s) => s.id),
    ['x'],
  )
})

test('every step has an id, title, description, tab and position', () => {
  for (const s of TUTORIAL_STEPS) {
    assert.ok(s.id && s.title && s.description, `step ${s.id} is missing copy`)
    assert.ok(s.tab, `step ${s.id} has no tab`)
    assert.ok(['top', 'center'].includes(s.position), `step ${s.id} has a bad position`)
    if (s.position === 'center') assert.equal(s.target, null)
    else assert.ok(s.target?.startsWith('[data-tutorial='), `step ${s.id} target is not an anchor selector`)
  }
})

test('step ids are unique', () => {
  const ids = TUTORIAL_STEPS.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length)
})
