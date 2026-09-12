import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractAnchors, extractStepTargets, extractRowTutorials, checkAnchors, checkVersions, extractNewsItems, extractInternalOnly, checkWhatsNew } from './drift.js'

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

const CHANGELOG = `# Pulse Changelog\n\n## Unreleased\n- pending\n\n## 2.3.0 — 2026-09-11\n- shipped\n\n## 2.2.0 — 2026-08-15\n- old thing\n`

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

const NEWS = `export const WHATS_NEW_ITEMS = [
  {
    since: UNRELEASED,
    icon: '🎉',
    title: 'staged news',
    body: 'not cut yet',
  },
  {
    since: '2.3.0',
    icon: '🗓️',
    title: 'calendar',
    body: 'plan per date',
    tutorial: 'calendar-plan',
  },
]

export const INTERNAL_ONLY = ['2.2.0']
`

test('extractNewsItems reads the notes source as text', () => {
  const items = extractNewsItems(NEWS)
  assert.equal(items.length, 2)
  assert.equal(items[0].since, 'Unreleased')
  assert.equal(items[0].icon, '🎉')
  assert.equal(items[1].since, '2.3.0')
  assert.equal(items[1].tutorial, 'calendar-plan')
})

test('extractInternalOnly reads the internal-only list', () => {
  assert.deepEqual(extractInternalOnly(NEWS), ['2.2.0'])
})

test('checkWhatsNew passes when every release has items or an INTERNAL_ONLY mark', () => {
  const problems = checkWhatsNew({
    changelog: CHANGELOG,
    newsSource: NEWS,
    stepIds: new Set(['calendar-plan']),
  })
  assert.deepEqual(problems, [])
})

test('checkWhatsNew flags a release with no items and no INTERNAL_ONLY mark', () => {
  const problems = checkWhatsNew({
    changelog: CHANGELOG,
    newsSource: NEWS.replace(`export const INTERNAL_ONLY = ['2.2.0']`, 'export const INTERNAL_ONLY = []'),
    stepIds: new Set(['calendar-plan']),
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /release 2.2.0 has no What's new item/)
})

test('checkWhatsNew flags incomplete items and dangling links', () => {
  const broken = NEWS.replace("title: 'calendar',", "title: '',").replace("tutorial: 'calendar-plan',", "tutorial: 'no-such-step',")
  const problems = checkWhatsNew({
    changelog: CHANGELOG,
    newsSource: broken,
    stepIds: new Set(['calendar-plan']),
  })
  assert.ok(problems.some((p) => /has no title/.test(p)))
  assert.ok(problems.some((p) => /links tutorial "no-such-step"/.test(p)))
})

test('checkWhatsNew flags a since that names no release and a bogus INTERNAL_ONLY entry', () => {
  const problems = checkWhatsNew({
    changelog: CHANGELOG,
    newsSource: NEWS.replace("since: '2.3.0',", "since: '9.9.9',").replace("INTERNAL_ONLY = ['2.2.0']", "INTERNAL_ONLY = ['8.8.8']"),
    stepIds: new Set(),
  })
  assert.ok(problems.some((p) => /says since: 9\.9\.9 but the changelog has no such release/.test(p)))
  assert.ok(problems.some((p) => /INTERNAL_ONLY lists 8\.8\.8/.test(p)))
})
