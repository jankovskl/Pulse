import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchTopLifts, fetchUserLift, buildRows } from './leaderboard.js'

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
