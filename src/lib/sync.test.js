import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  loadRemote,
  pushState,
  loginLift,
  mergeState,
  hasWorkoutData,
  shouldPushState,
  loadRemoteResilient,
} from './sync.js'

function makeClient({ queryResult, onUpsert, onCall } = {}) {
  let calls = 0
  return {
    from(table) {
      return {
        select() {
          return {
            eq() {
              return {
                order() {
                  return {
                    limit: async () => (onCall ? onCall() : queryResult),
                  }
                },
              }
            },
          }
        },
        upsert(payload, opts) {
          if (onUpsert) onUpsert(table, payload, opts)
          return Promise.resolve({ error: null })
        },
      }
    },
  }
}

test('mergeState returns local when remote is null', () => {
  const local = { days: [{ id: 'a' }] }
  assert.equal(mergeState(local, null, 0), local)
})

test('mergeState returns remote when remote is newer', () => {
  const local = { days: [] }
  const remote = { data: { days: [{ id: 'b' }] }, updatedAt: 2000 }
  assert.deepEqual(mergeState(local, remote, 1000), { days: [{ id: 'b' }] })
})

test('mergeState returns local when local is newer', () => {
  const local = { days: [{ id: 'local' }] }
  const remote = { data: { days: [{ id: 'remote' }] }, updatedAt: 1000 }
  assert.equal(mergeState(local, remote, 2000), local)
})

test('loadRemote maps row into {data, updatedAt}', async () => {
  const client = makeClient({
    queryResult: {
      data: [{ data: { days: [] }, updated_at: '2026-01-01T00:00:00Z' }],
      error: null,
    },
  })
  const out = await loadRemote(client, 'u1')
  assert.deepEqual(out.data, { days: [] })
  assert.equal(out.updatedAt, Date.parse('2026-01-01T00:00:00Z'))
})

test('loadRemote returns null when no row exists', async () => {
  const client = makeClient({ queryResult: { data: [], error: null } })
  assert.equal(await loadRemote(client, 'u1'), null)
})

test('loadRemote returns the newest row when duplicates exist', async () => {
  const client = makeClient({
    queryResult: {
      data: [
        { data: { days: [{ id: 'newer' }] }, updated_at: '2026-02-01T00:00:00Z' },
        { data: { days: [{ id: 'older' }] }, updated_at: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    },
  })
  const out = await loadRemote(client, 'u1')
  assert.deepEqual(out.data, { days: [{ id: 'newer' }] })
})

test('loadRemote throws on query error', async () => {
  const client = makeClient({ queryResult: { data: null, error: new Error('boom') } })
  await assert.rejects(() => loadRemote(client, 'u1'))
})

test('loadRemoteResilient retries once when the first call returns null', async () => {
  const row = { data: { days: [{ id: 'x' }] }, updated_at: '2026-01-01T00:00:00Z' }
  let calls = 0
  const client = makeClient({
    onCall: () => {
      calls++
      return calls === 1
        ? { data: [], error: null }
        : { data: [{ data: row.data, updated_at: row.updated_at }], error: null }
    },
  })
  const out = await loadRemoteResilient(client, 'u1', { delayMs: 0 })
  assert.deepEqual(out.data, row.data)
  assert.equal(calls, 2)
})

test('loadRemoteResilient resolves null when the row never appears', async () => {
  const client = makeClient({ queryResult: { data: [], error: null } })
  assert.equal(await loadRemoteResilient(client, 'u1', { delayMs: 0 }), null)
})

test('hasWorkoutData is false for an empty state', () => {
  assert.equal(hasWorkoutData({ days: [], sessions: [], plan: {} }), false)
  assert.equal(hasWorkoutData(null), false)
})

test('hasWorkoutData is true when days, sessions or plan exist', () => {
  assert.equal(hasWorkoutData({ days: [{ id: 'a' }], sessions: [], plan: {} }), true)
  assert.equal(hasWorkoutData({ days: [], sessions: [{ id: 's' }], plan: {} }), true)
  assert.equal(hasWorkoutData({ days: [], sessions: [], plan: { a: 'b' } }), true)
})

test('shouldPushState blocks empty states unless a wipe was requested', () => {
  const empty = { days: [], sessions: [], plan: {}, settings: {} }
  assert.equal(shouldPushState(empty, false), false)
  assert.equal(shouldPushState(empty, true), true)
  assert.equal(shouldPushState({ days: [{ id: 'a' }] }, false), true)
})

test('pushState upserts the whole state under user_id', async () => {
  let captured
  const client = makeClient({ onUpsert: (t, p, o) => (captured = { t, p, o }) })
  const state = { days: [], sessions: [], plan: {}, settings: {} }
  await pushState(client, 'u1', state)
  assert.equal(captured.t, 'user_data')
  assert.deepEqual(captured.p, { user_id: 'u1', data: state })
  assert.deepEqual(captured.o, { onConflict: 'user_id' })
})

test('loginLift upserts into lifts with exercise conflict key', async () => {
  let captured
  const client = makeClient({ onUpsert: (t, p, o) => (captured = { t, p, o }) })
  await loginLift(client, 'u1', 'Bench Press', 100)
  assert.equal(captured.t, 'lifts')
  assert.equal(captured.p.exercise, 'Bench Press')
  assert.equal(captured.p.weight, 100)
  assert.deepEqual(captured.o, { onConflict: 'user_id,exercise' })
})
