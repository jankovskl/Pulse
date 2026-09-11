import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseChangelog, compareVersions, CHANGELOG_URL } from './changelog.js'

test('parses version heading with date and bullets', () => {
  const md = `# Pulse Changelog

## 2.0.2 — 2026-08-12
- First change
- Second change

## 2.0.1
- Old change`
  assert.deepEqual(parseChangelog(md), [
    { version: '2.0.2', date: '2026-08-12', items: ['First change', 'Second change'] },
    { version: '2.0.1', date: null, items: ['Old change'] },
  ])
})

test('ignores non-changelog lines and stray bullets', () => {
  const md = `# Title

Some intro paragraph that is ignored.

### Subheading ignored
## 1.0.0
- kept bullet

- bullet with no heading above is ignored
`
  assert.deepEqual(parseChangelog(md), [{ version: '1.0.0', date: null, items: ['kept bullet'] }])
})

test('empty input yields empty list', () => {
  assert.deepEqual(parseChangelog(''), [])
})

test('accepts plain hyphen as date separator', () => {
  const md = `## 1.1.0 - 2026-01-01
- thing`
  assert.deepEqual(parseChangelog(md), [
    { version: '1.1.0', date: '2026-01-01', items: ['thing'] },
  ])
})

test('changelog URL points at the repo main branch', () => {
  assert.equal(CHANGELOG_URL, 'https://raw.githubusercontent.com/jankovskl/pulse/main/CHANGELOG.md')
})

test('Unreleased section and its bullets are skipped', () => {
  const md = `# Pulse Changelog

## Unreleased
- not shipped yet

## 2.3.0 — 2026-09-01
- shipped
`
  assert.deepEqual(parseChangelog(md), [
    { version: '2.3.0', date: '2026-09-01', items: ['shipped'] },
  ])
})

test('compareVersions orders dotted numeric versions', () => {
  assert.ok(compareVersions('2.10.0', '2.9.9') > 0)
  assert.ok(compareVersions('2.2.0', '2.2.0') === 0)
  assert.ok(compareVersions('0.1.1', '2.2.0') < 0)
  assert.ok(compareVersions('2.2', '2.2.0') === 0)
})
