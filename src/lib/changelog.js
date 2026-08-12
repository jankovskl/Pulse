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
