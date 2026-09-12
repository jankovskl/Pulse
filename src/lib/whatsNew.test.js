import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WHATS_NEW_ITEMS,
  UNRELEASED,
  latestNewsVersion,
  itemsForVersion,
  newsFingerprint,
  newsToShow,
} from './whatsNew.js'
import { TUTORIAL_STEPS } from './tutorialSteps.js'

const items = [
  { since: UNRELEASED, icon: '🧪', title: 'staged', body: 'not cut yet' },
  { since: '2.2.0', icon: '🗓️', title: 'calendar', body: 'plan per date' },
  { since: '2.10.0', icon: '🔥', title: 'streaks', body: 'forgiving' },
]
const fp = newsFingerprint(items)

test('latestNewsVersion ignores staged (Unreleased) items', () => {
  assert.equal(latestNewsVersion(items), '2.10.0')
  assert.equal(latestNewsVersion([items[0]]), null)
})

test('itemsForVersion selects one release group', () => {
  assert.deepEqual(itemsForVersion(items, '2.2.0').map((i) => i.title), ['calendar'])
})

test('the fingerprint changes with any edit to the notes — even staged ones', () => {
  assert.equal(newsFingerprint(items), fp)
  assert.notEqual(newsFingerprint(items.map((i) => ({ ...i, body: i.body + '!' }))), fp)
  const staged = { since: UNRELEASED, icon: '🆕', title: 'new', body: 'just landed' }
  assert.notEqual(newsFingerprint([...items, staged]), fp)
  // a version marker moving from UNRELEASED to a cut version is also a change
  assert.notEqual(
    newsFingerprint(items.map((i) => ({ ...i, since: i.since === UNRELEASED ? '2.11.0' : i.since }))),
    fp,
  )
})

test('seen fingerprint means nothing to show — until the notes change again', () => {
  assert.equal(newsToShow(items, fp, null, false), null)
  const next = newsToShow([...items, { since: UNRELEASED, icon: '🆕', title: 'new', body: 'b' }], fp, null, false)
  assert.ok(next, 'an added item must re-fire the popup')
  assert.equal(next.version, '2.10.0')
})

test('an upgrade from a pre-popup device announces the top release once', () => {
  const shown = newsToShow(items, null, null, false)
  assert.equal(shown.version, '2.10.0')
  assert.equal(shown.fingerprint, fp)
})

test('a genuine fresh install is never nagged with news it never missed', () => {
  assert.equal(newsToShow(items, null, null, true), null)
})

test('legacy version acks are honoured: unseen release fires, seen one does not', () => {
  const releasedOnly = items.filter((i) => i.since !== UNRELEASED)
  assert.equal(newsToShow(releasedOnly, null, '2.9.0', false).version, '2.10.0')
  assert.equal(newsToShow(releasedOnly, null, '2.10.0', false), null)
  // ...but staged news after that ack is still worth announcing
  assert.equal(newsToShow(items, null, '2.99.0', false).version, '2.10.0')
})

test('every real item has an icon, a headline and a body', () => {
  for (const it of WHATS_NEW_ITEMS) {
    assert.ok(it.icon, `item "${it.title}" has no icon`)
    assert.ok(it.title && it.title.length <= 40, `item "${it.title}" headline is missing or too long`)
    assert.ok(it.body && it.body.length <= 160, `item "${it.title}" body is missing or too long`)
  }
})

test('every tutorial link names a real step', () => {
  const ids = new Set(TUTORIAL_STEPS.map((s) => s.id))
  for (const it of WHATS_NEW_ITEMS) {
    if (it.tutorial) assert.ok(ids.has(it.tutorial), `item "${it.title}" links unknown step ${it.tutorial}`)
  }
})

test('every item is staged or names a real release format', () => {
  for (const it of WHATS_NEW_ITEMS) {
    assert.ok(
      it.since === UNRELEASED || /^\d+\.\d+\.\d+$/.test(it.since),
      `item "${it.title}" has since: ${it.since}`,
    )
  }
})
