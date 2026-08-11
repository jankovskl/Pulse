export const CATEGORIES = [
  'All',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Full Body',
]

export { default as LIBRARY } from './exercises.json'

const KNOWN_EXERCISES = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press']

export function exerciseOptions(days, sessions, fallback = KNOWN_EXERCISES) {
  const set = new Set()
  for (const d of days) for (const e of d.exercises) set.add(e.name)
  for (const s of sessions) if (s.exercise) set.add(s.exercise)
  return set.size ? [...set] : fallback
}

const LB_COMMUNITY = [
  { name: 'Marcus Reid', handle: '@reid', color: '#1E3A5F' },
  { name: 'Sofia Laurent', handle: '@laurent', color: '#5A3B8C' },
  { name: 'Dmitri Volkov', handle: '@volkov', color: '#3B5F4A' },
  { name: 'Elena Petrova', handle: '@petrova', color: '#8C3B5A' },
  { name: 'Jayden Cole', handle: '@cole', color: '#4A4A5A' },
  { name: 'Hannah Wu', handle: '@wu', color: '#2E5A6E' },
  { name: 'Tomás Alvarez', handle: '@alvarez', color: '#6E4A2E' },
  { name: 'Nora Lindqvist', handle: '@lindqvist', color: '#4A3B6E' },
  { name: 'Chris Okafor', handle: '@okafor', color: '#3B6E5A' },
  { name: 'Priya Nair', handle: '@nair', color: '#6E3B4A' },
]

const LB_WEIGHTS = {
  'Bench Press': [143, 136, 134, 129, 125, 120, 116, 111, 107, 102],
  Squat: [205, 196, 189, 181, 172, 164, 155, 147, 138, 130],
  Deadlift: [230, 218, 209, 200, 191, 182, 172, 163, 153, 144],
  'Overhead Press': [92, 87, 84, 80, 76, 72, 68, 64, 60, 56],
}

export function leaderboardFor(exercise, userBest) {
  let weights = LB_WEIGHTS[exercise]
  if (!weights) {
    if (userBest > 0) {
      const fs = [1.16, 1.11, 1.07, 1.04, 1.01, 0.97, 0.93, 0.89, 0.85, 0.81]
      weights = fs.map((f) => Math.max(2.5, Math.round((userBest * f) / 2.5) * 2.5))
    } else weights = LB_WEIGHTS['Bench Press']
  }
  const rows = LB_COMMUNITY.map((c, i) => ({ ...c, rank: i + 1, weight: weights[i], you: false }))
  if (userBest > 0) {
    rows.push({
      name: 'You',
      handle: 'your best',
      color: 'var(--color-accent)',
      weight: userBest,
      you: true,
    })
    rows.sort((a, b) => b.weight - a.weight)
    rows.forEach((r, i) => (r.rank = i + 1))
  }
  return rows
}

export const REST_PRESETS = [
  { label: '30s', sec: 30 },
  { label: '60s', sec: 60 },
  { label: '90s', sec: 90 },
  { label: '2m', sec: 120 },
  { label: '3m', sec: 180 },
  { label: '5m', sec: 300 },
]

export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const WEEKDAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
export const DAY_COLORS = { push: '#0485F7', pull: '#17C964', legs: '#F5A524', rest: '#71717A' }
export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
