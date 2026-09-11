// Tutorial steps as pure data (the coach-mark renderer lives in
// components/Tutorial.jsx). Importable by plain `node --test` — no React,
// no browser globals. Each step anchors to a `data-tutorial` attribute
// in some screen; the drift check (scripts/drift.js) fails the build if an
// anchor and a step ever come apart.
//
import { compareVersions } from './changelog.js'

// `since` is the release version that introduced the step. Steps without
// `since` belong to the first-run tour only; steps with `since` newer than a
// user's acknowledged version are offered as the What's new tour.
//
// A step written before its release exists says `since: UNRELEASED`; the
// release cut rewrites those markers to the version being cut, exactly like
// the Unreleased changelog section.
//
// Standing rule: a change that introduces a screen, control, or interaction
// the user can't discover on their own must add a step here AND its
// `data-tutorial` anchor in the target screen, in the same commit.
export const UNRELEASED = 'Unreleased'

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Pulse! 💪',
    description: 'Let\'s take a quick tour to get you started with your fitness journey.',
    target: null,
    position: 'center',
    tab: 'home',
  },
  {
    id: 'home-split',
    title: 'Your Workout Split',
    description: 'Create your workout days here. Each day can have multiple exercises targeting different muscle groups.',
    target: '[data-tutorial="home-split"]',
    position: 'top',
    tab: 'home',
  },
  {
    id: 'home-calendar',
    title: 'Weekly Calendar',
    description: 'See your week at a glance. Tap any day to schedule a workout from your split.',
    target: '[data-tutorial="home-week"]',
    position: 'top',
    tab: 'home',
  },
  {
    id: 'timer-ring',
    title: 'Rest Timer',
    description: 'Tap the ring to start timing your rest between sets. The circle fills up as time counts down.',
    target: '[data-tutorial="timer-ring"]',
    position: 'top',
    tab: 'timer',
  },
  {
    id: 'timer-presets',
    title: 'Quick Presets',
    description: 'Use preset buttons (30s, 60s, 90s, 2m, 3m) to instantly start common rest periods.',
    target: '[data-tutorial="timer-presets"]',
    position: 'top',
    tab: 'timer',
  },
  {
    id: 'progress-charts',
    title: 'Track Your Progress',
    description: 'View interactive charts showing your strength gains over time. See your PRs and workout history.',
    target: '[data-tutorial="progress-chart"]',
    position: 'top',
    tab: 'progress',
  },
  {
    id: 'leaderboard-compete',
    title: 'Compete & Connect',
    description: 'See top lifters in each exercise. Click profiles to view their stats and live workout status.',
    target: '[data-tutorial="leaderboard-top3"]',
    position: 'top',
    tab: 'leaderboard',
  },
  {
    id: 'leaderboard-status',
    title: 'Live Workout Status',
    description: 'When someone is working out, you\'ll see a 🟡 pulsing indicator showing their current exercise and progress in real-time!',
    target: '[data-tutorial="leaderboard-list"]',
    position: 'top',
    tab: 'leaderboard',
  },
  {
    id: 'calendar-plan',
    title: 'Plan Your Week',
    description: 'Schedule your workout days on the calendar. Tap any date to assign a workout from your split.',
    target: '[data-tutorial="calendar-grid"]',
    position: 'top',
    tab: 'calendar',
  },
  {
    id: 'calendar-streak',
    title: 'Track Consistency',
    description: 'See your training streak and patterns. Consistency is key to reaching your goals!',
    target: '[data-tutorial="calendar-grid"]',
    position: 'top',
    tab: 'calendar',
  },
  {
    id: 'health-sleep',
    title: 'Sleep & Recovery',
    description: 'Log last night\'s sleep and any caffeine — Pulse turns them into a sleep score so recovery shows up next to your training.',
    target: '[data-tutorial="health-screen"]',
    position: 'top',
    tab: 'health',
    since: UNRELEASED,
  },
  {
    id: 'settings-profile',
    title: 'Customize Your Profile',
    description: 'Set your nickname, avatar, and bio. Unlock badges and decorations by hitting milestones!',
    target: '[data-tutorial="settings-profile"]',
    position: 'top',
    tab: 'settings',
  },
  {
    id: 'settings-theme',
    title: 'Choose Your Theme',
    description: 'Pick your favorite color scheme and switch between light/dark mode.',
    target: '[data-tutorial="settings-theme"]',
    position: 'top',
    tab: 'settings',
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🎉',
    description: 'Start by creating your first workout day in the Home tab. Track your progress, compete with others, and crush your goals!',
    target: null,
    position: 'center',
    tab: 'home',
  },
]

// Steps newer than `acknowledged` — the What's new tour content. A step
// marked `since: UNRELEASED` is not shippable news yet, so it never counts.
// Returns [] when there is nothing to show (e.g. a fixes-only release).
export function newStepsSince(steps, acknowledged) {
  if (!acknowledged) return []
  return steps.filter(
    (s) => s.since && s.since !== UNRELEASED && compareVersions(s.since, acknowledged) > 0,
  )
}
