import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cutChangelog, rewriteSinceMarkers, setJsonVersion, setTomlVersion, planRelease } from './release.js'

const MD = `# Pulse Changelog

## Unreleased
- a new thing
- a fix

## 2.2.0 — 2026-08-15
- old thing
`

test('cutChangelog renames Unreleased to the version with a date', () => {
  const out = cutChangelog(MD, '2.3.0', '2026-09-11')
  assert.ok(out.includes('## 2.3.0 — 2026-09-11'))
  assert.ok(!out.includes('Unreleased'))
  assert.ok(out.includes('- a new thing'))
  assert.ok(out.includes('## 2.2.0 — 2026-08-15'))
})

test('cutChangelog refuses when there is nothing to cut', () => {
  assert.throws(() => cutChangelog('## 2.2.0\n- x', '2.3.0', '2026-09-11'), /no `## Unreleased`/)
  assert.throws(() => cutChangelog('## Unreleased\n\n## 2.2.0\n- x', '2.3.0', '2026-09-11'), /no bullets/)
})

test('cutChangelog refuses a version that already exists', () => {
  assert.throws(() => cutChangelog(MD, '2.2.0', '2026-09-11'), /already has a 2.2.0/)
})

test('rewriteSinceMarkers pins pending steps to the cut version', () => {
  const src = `{ since: UNRELEASED,\n  tab: 'home' },\n{ since: '2.2.0' }`
  assert.equal(
    rewriteSinceMarkers(src, '2.3.0'),
    `{ since: '2.3.0',\n  tab: 'home' },\n{ since: '2.2.0' }`,
  )
})

test('rewriteSinceMarkers leaves the doc comment explaining the convention intact', () => {
  const src = 'A step written before its release exists says `since: UNRELEASED`; the cut\n  since: UNRELEASED,'
  const out = rewriteSinceMarkers(src, '2.3.0')
  assert.ok(out.includes('says `since: UNRELEASED`;'), 'comment must not be rewritten')
  assert.ok(out.includes("since: '2.3.0',"), 'the real marker must be rewritten')
})

test('setJsonVersion replaces only the version field', () => {
  const json = `{\n  "name": "webapp",\n  "version": "0.0.0"\n}`
  assert.ok(setJsonVersion(json, '2.3.0').includes('"version": "2.3.0"'))
  assert.ok(setJsonVersion(json, '2.3.0').includes('"name": "webapp"'))
})

test('setTomlVersion replaces the package version, not dependencies', () => {
  const toml = `[package]\nname = "app"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1.0"`
  const out = setTomlVersion(toml, '2.3.0')
  assert.ok(out.includes('version = "2.3.0"'))
  assert.ok(out.includes('serde = "1.0"'))
})

test('planRelease moves every artifact to the same version', () => {
  const out = planRelease(
    {
      changelog: MD,
      tutorialSteps: `  since: UNRELEASED,\n`,
      whatsNew: `  since: UNRELEASED,\n`,
      packageJson: `{"version": "2.2.0"}`,
      tauriConf: `{"version": "2.2.0"}`,
      cargoToml: `version = "2.2.0"`,
    },
    '2.3.0',
    '2026-09-11',
  )
  assert.ok(out.changelog.includes('## 2.3.0 — 2026-09-11'))
  assert.ok(out.tutorialSteps.includes(`since: '2.3.0'`))
  assert.ok(out.whatsNew.includes(`since: '2.3.0'`))
  assert.ok(out.packageJson.includes('"version": "2.3.0"'))
  assert.ok(out.tauriConf.includes('"version": "2.3.0"'))
  assert.ok(out.cargoToml.includes('version = "2.3.0"'))
})
