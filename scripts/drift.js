// Drift check: the mechanical guarantee behind the changelog-as-source-of-truth
// system (ADR 0007). Fails when the three artifacts a feature touches have
// come apart:
//   1. every tutorial step's anchor exists in src/, and every data-tutorial
//      attribute in src/ has a step (both directions)
//   2. the top released CHANGELOG version equals the version in package.json,
//      tauri.conf.json and Cargo.toml
//   3. no hardcoded "Version x.y.z" strings in src/ (the changelog renders
//      versions live; a literal one is stale by definition)
//
// Runs in CI (deploy.yml, release.yml) and locally via `npm run check:drift`.
// Pure functions over strings so `node --test` can cover them without disk.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { parseChangelog } from '../src/lib/changelog.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function extractAnchors(source) {
  const found = []
  const attrRe = /data-tutorial=(?:"([^"]+)"|\{`([^`]+)`\}|'([^']+)')/g
  let m
  while ((m = attrRe.exec(source))) {
    const v = m[1] ?? m[2] ?? m[3]
    // Dynamic anchors (e.g. `${t.key}-tab` on the tab dock) are generated at
    // runtime and can't be matched statically — skip rather than false-flag.
    if (v.includes('${')) continue
    found.push(v)
  }
  return found
}

export function extractStepTargets(stepsSource) {
  const targets = []
  const re = /target:\s*'\[data-tutorial="([^"]+)"\]'/g
  let m
  while ((m = re.exec(stepsSource))) targets.push(m[1])
  return targets
}

// SettingsScreen passes `tutorial="settings-profile"` through Row, which
// renders data-tutorial={tutorial} — count those too.
export function extractRowTutorials(source) {
  const found = []
  const re = /\btutorial="([^"]+)"/g
  let m
  while ((m = re.exec(source))) found.push(m[1])
  return found
}

export function checkAnchors(anchors, stepTargets) {
  const problems = []
  const anchorSet = new Set(anchors)
  const stepSet = new Set(stepTargets)
  for (const t of stepSet) {
    if (!anchorSet.has(t)) problems.push(`tutorial step targets [data-tutorial="${t}"] but no screen renders that anchor`)
  }
  for (const a of anchorSet) {
    if (!stepSet.has(a)) problems.push(`anchor data-tutorial="${a}" exists but no tutorial step uses it`)
  }
  return problems
}

export function checkVersions({ changelog, packageJson, tauriConf, cargoToml, srcFiles }) {
  const problems = []
  const entries = parseChangelog(changelog)
  if (entries.length === 0) return ['CHANGELOG.md has no released version sections']
  const top = entries[0].version
  const manifests = {
    'package.json': packageJson.match(/"version":\s*"([^"]+)"/)?.[1],
    'src-tauri/tauri.conf.json': tauriConf.match(/"version":\s*"([^"]+)"/)?.[1],
    'src-tauri/Cargo.toml': cargoToml.match(/^version = "([^"]+)"/m)?.[1],
  }
  for (const [file, v] of Object.entries(manifests)) {
    if (v !== top) problems.push(`${file} says ${v ?? '(no version)'} but the changelog's latest release is ${top}`)
  }
  for (const [name, source] of Object.entries(srcFiles)) {
    const stale = source.match(/\bVersion \d+\.\d+\.\d+\b/g)
    if (stale) problems.push(`${name} hardcodes ${stale.join(', ')} — render it from the changelog instead`)
  }
  return problems
}

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(jsx?|tsx?)$/.test(e) && !e.endsWith('.test.js')) out.push(p)
  }
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = []

  const srcFiles = {}
  for (const p of walk(join(ROOT, 'src'))) {
    srcFiles[relative(ROOT, p).replaceAll('\\', '/')] = readFileSync(p, 'utf8')
  }

  // The steps file itself contains `data-tutorial="..."` strings (inside the
  // step targets) — scanning it for anchors would make every orphan invisible.
  const stepsFile = 'src/lib/tutorialSteps.js'
  const anchors = []
  for (const [name, source] of Object.entries(srcFiles)) {
    if (name === stepsFile) continue
    anchors.push(...extractAnchors(source), ...extractRowTutorials(source))
  }
  const stepsSource = srcFiles[stepsFile]
  problems.push(...checkAnchors(anchors, extractStepTargets(stepsSource)))

  problems.push(
    ...checkVersions({
      changelog: readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'),
      packageJson: readFileSync(join(ROOT, 'package.json'), 'utf8'),
      tauriConf: readFileSync(join(ROOT, 'src-tauri/tauri.conf.json'), 'utf8'),
      cargoToml: readFileSync(join(ROOT, 'src-tauri/Cargo.toml'), 'utf8'),
      srcFiles,
    }),
  )

  if (problems.length) {
    console.error('Drift check FAILED:')
    for (const p of problems) console.error(`  - ${p}`)
    console.error('\nEvery user-facing change must update CHANGELOG.md (Unreleased bullet),')
    console.error('and a discoverable new feature must add a tutorial step + anchor. See CLAUDE.md.')
    process.exit(1)
  }
  console.log('Drift check passed: anchors, steps and versions agree.')
}
