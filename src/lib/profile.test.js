import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchProfile,
  saveProfile,
  uploadAvatar,
  fetchProfiles,
  searchProfiles,
  weekKeysOf,
  workoutsInWeek,
  currentStreakOf,
  bestStreakOf,
} from './profile.js'

const ok = (data) => ({
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data, error: null }) }),
    }),
  }),
})

const storeOk = () => ({
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://cdn/avatars/u1' } }),
    }),
  },
})

test('fetchProfile returns the profile row', async () => {
  const supa = ok({ nickname: 'Cat', pfp: 'https://x/y.png' })
  const p = await fetchProfile(supa, 'u1')
  assert.equal(p.nickname, 'Cat')
  assert.equal(p.pfp, 'https://x/y.png')
})

test('fetchProfile returns null on empty', async () => {
  const supa = ok(null)
  assert.equal(await fetchProfile(supa, 'u1'), null)
})

test('saveProfile upserts the row', async () => {
  let captured = null
  const supa = {
    from: () => ({
      upsert: async (row) => {
        captured = row
        return { error: null }
      },
    }),
  }
  await saveProfile(supa, 'u1', { nickname: 'Sam' })
  assert.equal(captured.user_id, 'u1')
  assert.equal(captured.nickname, 'Sam')
  assert.equal(typeof captured.updated_at, 'string')
})

test('uploadAvatar uploads then returns the public URL', async () => {
  const url = await uploadAvatar(storeOk(), 'u1', { type: 'image/png', name: 'me.png' })
  assert.equal(url, 'https://cdn/avatars/u1')
})

test('fetchProfiles maps user ids to profiles', async () => {
  const supa = {
    from: () => ({
      select: () => ({
        in: async () => ({
          data: [
            { user_id: 'a', nickname: 'Anna', pfp: null },
            { user_id: 'b', nickname: 'Bo', pfp: 'https://x/b.png' },
          ],
          error: null,
        }),
      }),
    }),
  }
  const map = await fetchProfiles(supa, ['a', 'b'])
  assert.equal(map.a.nickname, 'Anna')
  assert.equal(map.b.pfp, 'https://x/b.png')
})

test('searchProfiles finds nicknames by substring (case-insensitive)', async () => {
  const supa = {
    from: () => ({
      select: () => ({
        ilike: () => ({
          limit: async () => ({
            data: [
              { user_id: 'u1', nickname: 'Marcus', pfp: null },
              { user_id: 'u2', nickname: 'Marco', pfp: 'https://x/m.png' },
            ],
            error: null,
          }),
        }),
      }),
    }),
  }
  const out = await searchProfiles(supa, 'mar')
  assert.equal(out.length, 2)
  assert.equal(out[0].nickname, 'Marcus')
})

// 2026-08-12 is a Wednesday, so its week runs Mon 2026-08-10 .. Sun 2026-08-16.
const MID_WEEK = new Date(2026, 7, 12)

test('weekKeysOf returns Mon..Sun of the week containing today', () => {
  assert.deepEqual(weekKeysOf(MID_WEEK), [
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
    '2026-08-14',
    '2026-08-15',
    '2026-08-16',
  ])
})

test('weekKeysOf anchors a Sunday to the week that started the previous Monday', () => {
  const keys = weekKeysOf(new Date(2026, 7, 16)) // Sunday
  assert.equal(keys[0], '2026-08-10')
  assert.equal(keys[6], '2026-08-16')
})

test('workoutsInWeek counts unique training days inside the week', () => {
  const sessions = [
    { full: '2026-08-10' },
    { full: '2026-08-10' }, // same day, two exercises — counts once
    { full: '2026-08-12' },
    { full: '2026-08-01' }, // previous week — ignored
    { full: '2026-08-17' }, // next week — ignored
    {},
  ]
  assert.equal(workoutsInWeek(sessions, MID_WEEK), 2)
})

test('workoutsInWeek is 0 with no sessions', () => {
  assert.equal(workoutsInWeek([], MID_WEEK), 0)
  assert.equal(workoutsInWeek(undefined, MID_WEEK), 0)
})

// currentStreakOf works on local YYYY-MM-DD keys, so pin "today" at local
// noon to keep the date stable regardless of the runner's timezone.
const TODAY_NOON = new Date(2026, 7, 12, 12)

test('currentStreakOf counts consecutive training days ending today', () => {
  const dates = ['2026-08-10', '2026-08-11', '2026-08-12']
  assert.equal(currentStreakOf(dates, TODAY_NOON), 3)
})

test('currentStreakOf survives up to 2 rest days', () => {
  // Trained Sun, skipped Mon+Tue, trained Wed — the chain holds.
  const dates = ['2026-08-09', '2026-08-12']
  assert.equal(currentStreakOf(dates, TODAY_NOON), 2)
})

test('currentStreakOf breaks after 3 missed days', () => {
  const dates = ['2026-08-08', '2026-08-12']
  assert.equal(currentStreakOf(dates, TODAY_NOON), 1)
})

test('currentStreakOf anchors on yesterday when today is not logged yet', () => {
  assert.equal(currentStreakOf(['2026-08-11'], TODAY_NOON), 1)
  // Sunday's session still counts on Wednesday: two rest days after the last
  // workout stay inside the grace window.
  assert.equal(currentStreakOf(['2026-08-09'], TODAY_NOON), 1)
  // Three missed days since the last workout breaks the chain.
  assert.equal(currentStreakOf(['2026-08-08'], TODAY_NOON), 0)
})

test('currentStreakOf counts a late-evening workout as today (local dating)', () => {
  // 23:30 local time — with the old UTC dating this key would have rolled
  // over to the next calendar day in most timezones and broken the streak.
  const lateEvening = new Date(2026, 7, 12, 23, 30)
  assert.equal(currentStreakOf(['2026-08-12'], lateEvening), 1)
})

test('bestStreakOf measures gaps in calendar days', () => {
  // Two rest days between workouts stay inside the grace window.
  assert.equal(bestStreakOf(['2026-08-09', '2026-08-12']), 2)
  // Three missed days break the run.
  assert.equal(bestStreakOf(['2026-08-08', '2026-08-12']), 1)
  // Consecutive days chain up.
  assert.equal(bestStreakOf(['2026-08-10', '2026-08-11', '2026-08-12']), 3)
})
