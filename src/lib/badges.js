// Profile badges, avatar decorations and stat widgets. Pure + Supabase-free so
// the logic stays unit-testable. Badges are computed from the public `stats`
// blob a profile publishes (see profile.js publishStats), never from private
// user_data.

// stats: { sessions, best, streak, bestStreak, exercises }

export const TIERS = {
  easy: { label: 'Easy', color: '#17C964' },
  medium: { label: 'Medium', color: '#0485F7' },
  hard: { label: 'Hard', color: '#F5A524' },
  legendary: { label: 'Legendary', color: '#F5D061' },
}

const BADGES = [
  {
    id: 'admin',
    label: 'Admin',
    test: ({ isAdmin }) => !!isAdmin,
  },

  // Easy — a week or two of showing up.
  {
    id: 'first-step',
    label: 'First Step',
    hint: 'Save your first session',
    tier: 'easy',
    test: ({ stats }) => (stats.sessions ?? 0) >= 1,
  },
  {
    id: 'streak-3',
    label: 'On a Roll',
    hint: 'Train 3 days in a row',
    tier: 'easy',
    test: ({ stats }) => (stats.bestStreak ?? 0) >= 3,
  },
  {
    id: 'explorer',
    label: 'Variety Pack',
    hint: 'Train 10 different exercises',
    tier: 'easy',
    test: ({ stats }) => (stats.exercises ?? 0) >= 10,
  },

  // Medium — a solid month or two of consistency.
  {
    id: 'sessions-25',
    label: 'Dedicated',
    hint: 'Save 25 sessions',
    tier: 'medium',
    test: ({ stats }) => (stats.sessions ?? 0) >= 25,
  },
  {
    id: 'streak-7',
    label: 'Iron Week',
    hint: 'Train 7 days in a row',
    tier: 'medium',
    test: ({ stats }) => (stats.bestStreak ?? 0) >= 7,
  },
  {
    id: 'heavy-100',
    label: 'Centurion',
    hint: 'Hit a 100 kg lift',
    tier: 'medium',
    test: ({ stats }) => (stats.best ?? 0) >= 100,
  },
  {
    id: 'sessions-50',
    label: 'Committed',
    hint: 'Save 50 sessions',
    tier: 'medium',
    test: ({ stats }) => (stats.sessions ?? 0) >= 50,
  },

  // Hard — months of grinding or serious strength.
  {
    id: 'streak-30',
    label: 'Iron Month',
    hint: 'Train 30 days in a row',
    tier: 'hard',
    test: ({ stats }) => (stats.bestStreak ?? 0) >= 30,
  },
  {
    id: 'sessions-100',
    label: 'Machine',
    hint: 'Save 100 sessions',
    tier: 'hard',
    test: ({ stats }) => (stats.sessions ?? 0) >= 100,
  },
  {
    id: 'heavy-150',
    label: 'Powerhouse',
    hint: 'Hit a 150 kg lift',
    tier: 'hard',
    test: ({ stats }) => (stats.best ?? 0) >= 150,
  },
  {
    id: 'exercises-25',
    label: 'Arsenal',
    hint: 'Train 25 different exercises',
    tier: 'hard',
    test: ({ stats }) => (stats.exercises ?? 0) >= 25,
  },

  // Legendary — the ones to brag about.
  {
    id: 'sessions-365',
    label: 'Year of Iron',
    hint: 'Save 365 sessions',
    tier: 'legendary',
    test: ({ stats }) => (stats.sessions ?? 0) >= 365,
  },
  {
    id: 'streak-100',
    label: 'Unstoppable',
    hint: 'Train 100 days in a row',
    tier: 'legendary',
    test: ({ stats }) => (stats.bestStreak ?? 0) >= 100,
  },
  {
    id: 'heavy-200',
    label: 'Titan',
    hint: 'Hit a 200 kg lift',
    tier: 'legendary',
    test: ({ stats }) => (stats.best ?? 0) >= 200,
  },

  // Muscle-group strength — best lift per muscle group (stats.groups), so a
  // strong lifter is judged by realistic standards for each body part.
  {
    id: 'arms-50',
    label: 'Guns',
    hint: 'Hit 50 kg on an arm lift',
    tier: 'medium',
    test: ({ stats }) => (stats.groups?.arms ?? 0) >= 50,
  },
  {
    id: 'shoulders-70',
    label: 'Cannon',
    hint: 'Hit 70 kg on a shoulder lift',
    tier: 'medium',
    test: ({ stats }) => (stats.groups?.shoulders ?? 0) >= 70,
  },
  {
    id: 'chest-100',
    label: 'Iron Chest',
    hint: 'Hit 100 kg on a chest lift',
    tier: 'medium',
    test: ({ stats }) => (stats.groups?.chest ?? 0) >= 100,
  },
  {
    id: 'back-120',
    label: 'Anchor',
    hint: 'Hit 120 kg on a back lift',
    tier: 'medium',
    test: ({ stats }) => (stats.groups?.back ?? 0) >= 120,
  },
  {
    id: 'chest-150',
    label: 'Heart of Steel',
    hint: 'Hit 150 kg on a chest lift',
    tier: 'hard',
    test: ({ stats }) => (stats.groups?.chest ?? 0) >= 150,
  },
  {
    id: 'legs-200',
    label: 'Colossus',
    hint: 'Hit 200 kg on a leg lift',
    tier: 'hard',
    test: ({ stats }) => (stats.groups?.legs ?? 0) >= 200,
  },
  {
    id: 'legs-300',
    label: 'Earthshaker',
    hint: 'Hit 300 kg on a leg lift',
    tier: 'legendary',
    test: ({ stats }) => (stats.groups?.legs ?? 0) >= 300,
  },
]

// The achievement list shown in Settings (admin flag is not an achievement).
export const ACHIEVEMENTS = BADGES.filter((b) => b.id !== 'admin')

// Returns the badges earned for the given public stats + admin flag.
export function computeBadges({ stats = {}, isAdmin = false } = {}) {
  return BADGES.filter((b) => b.test({ stats, isAdmin })).map((b) => ({
    id: b.id,
    label: b.label,
    tier: b.tier ?? null,
  }))
}

export function hasBadge(badges, id) {
  return badges.some((b) => b.id === id)
}

export function badgeById(id) {
  return BADGES.find((b) => b.id === id) ?? null
}

// Avatar & profile decorations. `type` decides where they render:
//   ring      — colored ring around the avatar (DECORATION_RINGS in ui.jsx)
//   accessory — an attachment on the avatar, e.g. cat ears, crown, halo
//   title     — a prestige nameplate under the nickname on the profile
//   frame     — a banner decorating the whole public profile popup
// `requires` names a badge id that unlocks it; null means always available.
// Unlock checks are client-side only.
export const DECORATIONS = [
  // Rings
  { id: 'none', label: 'None', type: 'ring', requires: null },
  { id: 'accent', label: 'Accent Ring', type: 'ring', requires: null },
  { id: 'glow', label: 'Gradient Glow', type: 'ring', requires: 'sessions-25' },
  { id: 'flame', label: 'Flame Ring', type: 'ring', requires: 'streak-7' },
  { id: 'gold', label: 'Gold Ring', type: 'ring', requires: 'sessions-100' },
  { id: 'plate', label: 'Plate Ring', type: 'ring', requires: 'chest-100' },
  // Accessories
  { id: 'cat-ears', label: 'Cat Ears', type: 'accessory', requires: 'explorer' },
  { id: 'crown', label: 'Crown', type: 'accessory', requires: 'heavy-150' },
  { id: 'halo', label: 'Halo', type: 'accessory', requires: 'streak-30' },
  { id: 'wings', label: 'Wings', type: 'accessory', requires: 'back-120' },
  // Titles (nameplate under the nickname)
  { id: 'title-iron-arms', label: 'Iron Arms', type: 'title', requires: 'arms-50' },
  { id: 'title-cannon', label: 'Cannon', type: 'title', requires: 'shoulders-70' },
  { id: 'title-colossus', label: 'Colossus', type: 'title', requires: 'legs-200' },
  { id: 'title-earthshaker', label: 'Earthshaker', type: 'title', requires: 'legs-300' },
  // Full-profile frames
  { id: 'aurora', label: 'Aurora', type: 'frame', requires: 'sessions-50' },
  { id: 'neon', label: 'Neon', type: 'frame', requires: 'heavy-100' },
  { id: 'forge', label: 'Forge', type: 'frame', requires: 'chest-150' },
  { id: 'starfall', label: 'Starfall', type: 'frame', requires: 'sessions-365' },
]

export const DECORATION_TYPES = [
  { type: 'ring', label: 'Rings' },
  { type: 'accessory', label: 'Accessories' },
  { type: 'title', label: 'Titles' },
  { type: 'frame', label: 'Profile frames' },
]

export function decorationById(id) {
  return DECORATIONS.find((d) => d.id === id) ?? DECORATIONS[0]
}

// Decorations the given earned badges allow (always includes the free ones).
export function availableDecorations(badges) {
  return DECORATIONS.filter((d) => !d.requires || hasBadge(badges, d.requires))
}

export function isDecorationUnlocked(badges, decorationId) {
  const d = decorationById(decorationId)
  return !d.requires || hasBadge(badges, d.requires)
}

// Stat widgets a user can pin to their profile (stored ordered in
// profiles.widgets).
export const WIDGETS = [
  { id: 'best', label: 'Top lift' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'streak', label: 'Day streak' },
]

export const DEFAULT_WIDGETS = ['best', 'sessions', 'streak']

export function widgetById(id) {
  return WIDGETS.find((w) => w.id === id) ?? null
}
