export const UNRELEASED = 'Unreleased'

export function parseChangelog(markdown) {
  const entries = []
  let current = null
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    if (line === '') {
      current = null
      continue
    }
    const head = line.match(/^##\s+(\S+)(?:\s*[—-]\s*(.+))?$/)
    if (head) {
      const [, version, date] = head
      // The Unreleased section is the staging area for the next release cut —
      // What's new promises only what the user can use now, so skip it (and
      // its bullets, by leaving `current` null).
      if (version.toLowerCase() === UNRELEASED.toLowerCase()) {
        current = null
        continue
      }
      current = { version, date: date ?? null, items: [] }
      entries.push(current)
      continue
    }
    if (current && line.startsWith('- ')) {
      current.items.push(line.slice(2))
    }
  }
  return entries
}

// Compare two dotted numeric versions (semver core only — Pulse has no
// prereleases). Returns <0, 0 or >0 like a sort comparator.
export function compareVersions(a, b) {
  const pa = String(a).split('.')
  const pb = String(b).split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (Number(pa[i]) || 0) - (Number(pb[i]) || 0)
    if (d) return d
  }
  return 0
}

export const CHANGELOG_URL = 'https://raw.githubusercontent.com/jankovskl/pulse/main/CHANGELOG.md'

let cache = null

export function fetchChangelog() {
  if (!cache) {
    cache = fetch(CHANGELOG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Changelog fetch failed: HTTP ${res.status}`)
        return res.text()
      })
      .then(parseChangelog)
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}
