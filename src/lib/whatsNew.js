// What's new notes: the structured, visual summary behind the What's new
// screen (see ADR 0009 and its amendment). One news item per NEW FEATURE —
// an icon, a headline, a short blurb, and optionally the id of the tutorial
// step that spotlights it. Authored per feature, in the same commit as the
// changelog bullet, with `since: UNRELEASED` until the release cut stamps the
// version (scripts/release.js rewrites the markers, exactly like tutorial
// steps).
//
// The notes are bundled into the build and are the ONLY trigger for the
// popup and the "New" pill — never fetched live, so a long-open web tab on an
// old build can't show a half-populated popup. The changelog stays the source
// of truth for what shipped; the drift check keeps the two in line (every
// release has items or an INTERNAL_ONLY mark).
//
// Standing rule: only new features become items. Bugfixes, tunings and other
// refinements get a changelog bullet only — they never pop, and are found
// under the popup's "Past releases" changelog. Internal changes never get an
// item or a bullet.
import { UNRELEASED, compareVersions } from './changelog.js'

export { UNRELEASED }

// Newest release first within each version group; UNRELEASED items sit at the
// top as the staging area (order is cosmetic — helpers compare versions).
export const WHATS_NEW_ITEMS = [
  // ── staged for the next cut ─────────────────────────────────────────────
  {
    since: UNRELEASED,
    icon: '🌫️',
    title: 'Twenty new gradients',
    body: 'Appearance now ships dark, muted gradients for every accent — Moss, Lawrencium and friends, no eye-searing neons.',
  },
  {
    since: UNRELEASED,
    icon: '🎉',
    title: 'What’s new finds you',
    body: 'The first launch after an update opens a visual summary of what changed — no more digging through Settings.',
  },
  {
    since: UNRELEASED,
    icon: '🧭',
    title: 'Show me, don’t tell me',
    body: 'Items with a guided tour carry a Show me button that spotlights the new control right in the app.',
  },
  {
    since: UNRELEASED,
    icon: '📜',
    title: 'Every release, one tap away',
    body: 'The full changelog now lives inside What’s new, under Past releases.',
  },

  // ── 2.2.0 ───────────────────────────────────────────────────────────────
  {
    since: '2.2.0',
    icon: '🗓️',
    title: 'Calendar',
    body: 'Plan workouts per date and browse your month-by-month history on the new Calendar screen.',
    tutorial: 'calendar-plan',
  },
  {
    since: '2.2.0',
    icon: '🔥',
    title: 'Streaks that forgive',
    body: 'Up to two rest days no longer reset your chain — recovery is training too.',
    tutorial: 'calendar-streak',
  },
  {
    since: '2.2.0',
    icon: '📈',
    title: 'Progress, searchable',
    body: 'Find any lift you’ve logged in the new exercise picker, and see capped weights explained.',
    tutorial: 'progress-charts',
  },
  {
    since: '2.2.0',
    icon: '✂️',
    title: 'Avatar cropping',
    body: 'Pan, zoom and rotate your photo before uploading — iPhone HEIC images convert automatically.',
  },

  // ── 2.1.0 ───────────────────────────────────────────────────────────────
  {
    since: '2.1.0',
    icon: '🪪',
    title: 'Public profiles',
    body: 'Tap any leaderboard entry to see a lifter’s bio, badges, widgets and lifts.',
  },
  {
    since: '2.1.0',
    icon: '🏆',
    title: '21 badges, 4 tiers',
    body: 'Earned via workouts, strength and consistency — with decorations to match.',
    tutorial: 'leaderboard-compete',
  },
  {
    since: '2.1.0',
    icon: '🛡️',
    title: 'Fair lifts only',
    body: 'Weights are clamped to plausible muscle-group progressions, on your device and on the server.',
  },

  // ── 2.0.3 ───────────────────────────────────────────────────────────────
  {
    since: '2.0.3',
    icon: '🎨',
    title: '16 themes',
    body: 'Six presets plus ten gradients, with a grouped theme and accent picker in Settings.',
    tutorial: 'settings-theme',
  },
  {
    since: '2.0.3',
    icon: '⏱️',
    title: 'Timer remembers',
    body: 'The rest timer resumes your last active exercise.',
    tutorial: 'timer-ring',
  },

  // ── 2.0.2 ───────────────────────────────────────────────────────────────
  {
    since: '2.0.2',
    icon: '🐈',
    title: 'Neko, awake',
    body: 'The pet stays awake between idle states.',
  },
  {
    since: '2.0.2',
    icon: '📡',
    title: 'Live What’s new',
    body: 'The panel shows changes straight from GitHub.',
  },

  // ── 2.0.1 ───────────────────────────────────────────────────────────────
  {
    since: '2.0.1',
    icon: '⏱️',
    title: 'Rest timer',
    body: 'Set countdowns between sets, with quick presets.',
    tutorial: 'timer-ring',
  },
  {
    since: '2.0.1',
    icon: '📈',
    title: 'Progress charts',
    body: 'Strength gains over time in the Progress tab.',
    tutorial: 'progress-charts',
  },
  {
    since: '2.0.1',
    icon: '🏋️',
    title: 'Library & leaderboard',
    body: 'An exercise library and a community leaderboard.',
    tutorial: 'leaderboard-compete',
  },
]

// Releases that genuinely have no user-visible news: no popup, no pill.
// Listing a version here is the explicit, drift-checked way to say so.
export const INTERNAL_ONLY = []

// The newest release the notes can announce (null if there are none yet).
// `since: UNRELEASED` items are staged news — not shippable until cut.
export function latestNewsVersion(items = WHATS_NEW_ITEMS) {
  let top = null
  for (const it of items) {
    if (!it.since || it.since === UNRELEASED) continue
    if (!top || compareVersions(it.since, top) > 0) top = it.since
  }
  return top
}

export function itemsForVersion(items = WHATS_NEW_ITEMS, version) {
  return items.filter((it) => it.since === version)
}

// A device that has never stored app state is a genuine fresh install; one
// with state but no seen-marker is an upgrade from a build that predated
// the What's new popup — its user has never seen any news. Must be captured
// at module evaluation: the store persists `pulse.state.v2` on its first
// mount, so a later read would call every install an upgrade.
const FRESH_AT_BOOT = (() => {
  try {
    return typeof localStorage !== 'undefined' && !localStorage.getItem('pulse.state.v2')
  } catch {
    return false
  }
})()

export function isFreshInstall() {
  return FRESH_AT_BOOT
}

// Fingerprint of the notes' exact content. The popup re-fires whenever it
// changes — a new release, edited copy, or a staged (UNRELEASED) item — so
// every update to What's new announces itself on the next launch instead of
// waiting for the next release cut. A release cut never changes the shipped
// build's fingerprint by surprise: the cut happens before the build exists.
export function newsFingerprint(items = WHATS_NEW_ITEMS) {
  const raw = items
    .map((i) => `${i.since}|${i.icon}|${i.title}|${i.body}|${i.tutorial ?? ''}`)
    .join('\n')
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0
  return `${h.toString(36)}.${items.length}`
}

// The news to announce, or null when there is nothing this device should see.
//  - seen (the fingerprint last dismissed) matches → nothing changed
//  - never dismissed but a legacy version ack exists → the device ran the
//    pre-fingerprint build: announce only a newer release or staged items
//  - no ack at all: a genuine fresh install sees nothing (nobody is nagged
//    with news they never missed); an upgrade from a pre-popup build catches
//    up once.
// `fresh` is read lazily so pure tests don't need localStorage.
export function newsToShow(items = WHATS_NEW_ITEMS, seen = null, ack = null, fresh = isFreshInstall()) {
  const fingerprint = newsFingerprint(items)
  if (seen === fingerprint) return null
  const version = latestNewsVersion(items)
  const staged = items.some((i) => i.since === UNRELEASED)
  if (!seen) {
    if (ack) {
      const newer = !!version && compareVersions(version, ack) > 0
      if (!newer && !staged) return null
    } else if (fresh) {
      return null
    }
  }
  return { version, fingerprint }
}
