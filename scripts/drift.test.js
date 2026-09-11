import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractAnchors, extractStepTargets, extractRowTutorials, checkAnchors, checkVersions } from './drift.js'

test('extractAnchors finds literal and skips dynamic anchors', () => {
  const src = `
    <div data-tutorial="home-split" />
    <button data-tutorial={\`\${t.key}-tab\`} />
    <div data-tutorial={tutorial} />
  `
  assert.deepEqual(extractAnchors(src), ['home-split'])
})

test('extractStepTargets reads selectors from the steps file', () => {
  const src = `target: '[data-tutorial="home-split"]',\n  target: null,\n  target: '[data-tutorial="timer-ring"]'`
  assert.deepEqual(extractStepTargets(src), ['home-split', 'timer-ring'])
})

test('extractRowTutorials finds tutorial props passed to shared rows', () => {
  assert.deepEqual(extractRowTutorials(`<Row tutorial="settings-profile" />`), ['settings-profile'])
})

test('checkAnchors reports both directions of drift', () => {
  assert.deepEqual(checkAnchors(['a', 'b'], ['a']), [
    'anchor data-tutorial="b" exists but no tutorial step uses it',
  ])
  assert.deepEqual(checkAnchors(['a'], ['a', 'c']), [
    'tutorial step targets [data-tutorial="c"] but no screen renders that anchor',
  ])
  assert.deepEqual(checkAnchors(['a'], ['a']), [])
})

const CHANGELOG = `# Pulse Changelog\n\n## Unreleased\n- pending\n\n## 2.3.0 — 2026-09-11\n- shipped\n`

test('checkVersions passes when all manifests match the top release', () => {
  const problems = checkVersions({
    changelog: CHANGELOG,
    packageJson: `{"version": "2.3.0"}`,
    tauriConf: `{"version": "2.3.0"}`,
    cargoToml: `version = "2.3.0"`,
    srcFiles: { 'src/x.jsx': `const a = 1` },
  })
  assert.deepEqual(problems, [])
})

test('checkVersions ignores Unreleased when picking the top release', () => {
  const problems = checkVersions({
    changelog: CHANGELOG,
    packageJson: `{"version": "2.2.0"}`,
    tauriConf: `{"version": "2.3.0"}`,
    cargoToml: `version = "2.3.0"`,
    srcFiles: {},
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /package.json says 2.2.0 but the changelog's latest release is 2.3.0/)
})

test('checkVersions flags hardcoded version strings in src', () => {
  const problems = checkVersions({
    changelog: CHANGELOG,
    packageJson: `{"version": "2.3.0"}`,
    tauriConf: `{"version": "2.3.0"}`,
    cargoToml: `version = "2.3.0"`,
    srcFiles: { 'src/screens/S.jsx': `subtitle = 'Version 2.0.1 — rest timer'` },
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /hardcodes Version 2.0.1/)
})
