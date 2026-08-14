import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchProfile, saveProfile, uploadAvatar, fetchProfiles, searchProfiles } from './profile.js'

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
