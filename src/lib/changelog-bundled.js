// Browser-only half of the changelog pipeline: a snapshot of CHANGELOG.md is
// bundled into the build (Vite `?raw`), so What's new works offline — the
// desktop app no longer shows a stale hardcoded fallback when GitHub is
// unreachable. Network wins when it answers; the snapshot is the floor.
//
// This module is deliberately separate from changelog.js so that file stays
// importable from plain `node --test` (no `?raw` support there).
import raw from '../../CHANGELOG.md?raw'
import { parseChangelog, fetchChangelog } from './changelog.js'

export const BUNDLED_ENTRIES = parseChangelog(raw)

export function loadChangelog() {
  return fetchChangelog().catch(() => BUNDLED_ENTRIES)
}
