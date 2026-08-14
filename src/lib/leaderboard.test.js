import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchTopLifts, fetchUserLift, buildRows, fetchUserLifts, fetchLiftRanks, fetchDistinctExercises, notDoneExercises, buildPlayerExerciseList } from './leaderboard.js'

function makeClient(result) {
  const eqTarget = {
    maybeSingle: async () => result.maybe ?? { data: null, error: null },
    eq() {
      return eqTarget
    },
    order() {
      return { limit: async () => result.list ?? { data: null, error: null } }
    },
  }
  return {
    from(table) {
      return {
        select() {
          return {
            eq() {
              return eqTarget
            },
          }
        },
      }
    },
  }
}

test('fetchTopLifts returns ordered list', async () => {
  const client = makeClient({
    list: { data: [{ user_id: 'a', weight: 100 }, { user_id: 'b', weight: 80 }], error: null },
  })
  const out = await fetchTopLifts(client, 'Bench Press')
  assert.equal(out.length, 2)
  assert.equal(out[0].weight, 100)
})

test('fetchUserLift returns the weight', async () => {
  const client = makeClient({ maybe: { data: { weight: 120 }, error: null } })
  assert.equal(await fetchUserLift(client, 'u1', 'Squat'), 120)
})

test('fetchUserLift returns 0 when missing', async () => {
  const client = makeClient({ maybe: { data: null, error: null } })
  assert.equal(await fetchUserLift(client, 'u1', 'Squat'), 0)
})

test('buildRows ranks descending and marks the user', () => {
  const rows = buildRows(
    [{ user_id: 'other1', weight: 90 }, { user_id: 'me', weight: 110 }, { user_id: 'other2', weight: 70 }],
    'me',
  )
  assert.equal(rows[0].rank, 1)
  assert.equal(rows[0].name, 'You')
  assert.equal(rows[0].you, true)
  assert.equal(rows[2].rank, 3)
  assert.equal(rows[2].name, 'other2')
})

test('buildRows leaves names anonymous for other users', () => {
  const rows = buildRows([{ user_id: 'abcdef1234', weight: 50 }], null)
  assert.equal(rows[0].name, 'abcdef')
  assert.equal(rows[0].you, false)
})

test('notDoneExercises returns only exercises the user has not lifted in', () => {
  const all = ['Squat', 'Bench Press', 'Deadlift']
  const mine = ['Bench Press']
  assert.deepEqual(notDoneExercises(all, mine), ['Deadlift', 'Squat'])
})

test('notDoneExercises dedupes and sorts', () => {
  assert.deepEqual(notDoneExercises(['b', 'a', 'b', 'a'], ['b']), ['a'])
})

test('buildPlayerExerciseList sorts by rank ascending', () => {
  const lifts = [
    { exercise: 'Deadlift', weight: 180 },
    { exercise: 'Bench Press', weight: 100 },
    { exercise: 'Squat', weight: 140 },
  ]
  const ranks = { 'Bench Press': 3, Squat: 1, Deadlift: 2 }
  const out = buildPlayerExerciseList(lifts, ranks)
  assert.deepEqual(out, [
    { exercise: 'Squat', weight: 140, rank: 1 },
    { exercise: 'Deadlift', weight: 180, rank: 2 },
    { exercise: 'Bench Press', weight: 100, rank: 3 },
  ])
})

test('buildPlayerExerciseList falls back to weight order when ranks missing', () => {
  const lifts = [
    { exercise: 'A', weight: 50 },
    { exercise: 'B', weight: 80 },
  ]
  const out = buildPlayerExerciseList(lifts, {})
  assert.equal(out[0].exercise, 'B')
})

test('fetchUserLifts returns that user\'s lifts', async () => {
  const client = /* mock: select('exercise, weight') -> eq('user_id','u1') -> rows */
    { from: () => ({ select: () => ({ eq: async () => ({ data: [{ exercise: 'Squat', weight: 140 }], error: null }) }) }) }
  const out = await fetchUserLifts(client, 'u1')
  assert.equal(out[0].exercise, 'Squat')
})

test('fetchLiftRanks computes 1-based rank per exercise', async () => {
  const counts = [4, 9] // 4 heavier than Deadlift lift, 9 heavier than Bench lift
  const client = { from: () => ({ select: () => ({ eq: (c, e) => ({ gt: async (field, w) => ({ count: counts.shift(), error: null }) }) }) }) }
  const out = await fetchLiftRanks(client, [
    { exercise: 'Deadlift', weight: 180 },
    { exercise: 'Bench Press', weight: 100 },
  ])
  assert.deepEqual(out, { Deadlift: 5, 'Bench Press': 10 })
})

test('fetchDistinctExercises returns unique non-null exercises sorted', async () => {
  const client = { from: () => ({ select: async (c, opts) => ({ data: [{ exercise: 'Squat' }, { exercise: 'Squat' }, { exercise: 'Deadlift' }, { exercise: null }], error: null }) }) }
  const out = await fetchDistinctExercises(client)
  assert.deepEqual(out, ['Deadlift', 'Squat'])
})
