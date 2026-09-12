// Release cut: renames the changelog's `## Unreleased` section to a new
// version dated today, rewrites `since: UNRELEASED` markers in the tutorial
// steps and the What's new notes to the same version, and syncs every version
// manifest from it. The changelog is the source of truth for the version
// (see ADR 0007) — these manifests are derived copies and must never be
// hand-edited.
//
// Usage: npm run release 2.3.0
// It does not touch git: it prints the commit/tag/push commands to run.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function cutChangelog(md, version, date) {
  if (!/^## Unreleased\s*$/im.test(md)) {
    throw new Error('CHANGELOG.md has no `## Unreleased` section to cut')
  }
  if (new RegExp(`^## ${escapeRe(version)}\\b`, 'm').test(md)) {
    throw new Error(`CHANGELOG.md already has a ${version} section`)
  }
  const bullets = md
    .split(/^## Unreleased\s*$/im)[1]
    .split(/^## /m)[0]
    .split('\n')
    .filter((l) => l.trim().startsWith('- '))
  if (bullets.length === 0) {
    throw new Error('The Unreleased section has no bullets — nothing to cut')
  }
  return md.replace(/^## Unreleased\s*$/im, `## ${version} — ${date}`)
}

export function rewriteSinceMarkers(source, version) {
  // Comma-anchored: real markers are `since: UNRELEASED,` inside step
  // objects; the doc comment that explains the convention mentions the
  // constant without a trailing comma and must survive every cut.
  return source.replaceAll('since: UNRELEASED,', `since: '${version}',`)
}

export function setJsonVersion(text, version) {
  return text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`)
}

export function setTomlVersion(text, version) {
  return text.replace(/^(version = ")[^"]+(")/m, `$1${version}$2`)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function planRelease({ changelog, tutorialSteps, whatsNew, packageJson, tauriConf, cargoToml }, version, date) {
  return {
    changelog: cutChangelog(changelog, version, date),
    tutorialSteps: rewriteSinceMarkers(tutorialSteps, version),
    whatsNew: rewriteSinceMarkers(whatsNew, version),
    packageJson: setJsonVersion(packageJson, version),
    tauriConf: setJsonVersion(tauriConf, version),
    cargoToml: setTomlVersion(cargoToml, version),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2]
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('Usage: npm run release <x.y.z>   (e.g. npm run release 2.3.0)')
    process.exit(1)
  }
  const date = new Date().toISOString().slice(0, 10)
  const files = {
    changelog: join(ROOT, 'CHANGELOG.md'),
    tutorialSteps: join(ROOT, 'src/lib/tutorialSteps.js'),
    whatsNew: join(ROOT, 'src/lib/whatsNew.js'),
    packageJson: join(ROOT, 'package.json'),
    tauriConf: join(ROOT, 'src-tauri/tauri.conf.json'),
    cargoToml: join(ROOT, 'src-tauri/Cargo.toml'),
  }
  let next
  try {
    next = planRelease(
      Object.fromEntries(
        Object.entries(files).map(([k, p]) => [k, readFileSync(p, 'utf8')]),
      ),
      version,
      date,
    )
  } catch (err) {
    console.error(`Release cut failed: ${err.message}`)
    process.exit(1)
  }
  for (const [k, content] of Object.entries(next)) {
    writeFileSync(files[k], content)
  }
  console.log(`Cut ${version} (${date}): CHANGELOG.md, tutorialSteps + whatsNew since-markers, package.json, tauri.conf.json, Cargo.toml`)
  console.log('\nNext:')
  console.log(`  git add CHANGELOG.md src/lib/tutorialSteps.js src/lib/whatsNew.js package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`)
  console.log(`  git commit -m "release: ${version}"`)
  console.log(`  git tag v${version} && git push && git push --tags`)
  console.log(`\nThe v${version} tag triggers release.yml, which builds the desktop bundle`)
  console.log('and names the GitHub Release after this changelog section.')
}
