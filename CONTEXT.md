# Pulse

Pulse is a fitness tracker where users build workout "days" (lists of exercises), schedule them on a calendar, then run through them with a rest timer and log sessions. Two concepts sit at the heart of it: a **workout day** (the template of exercises) and its **scheduling** on the calendar — and the relationship between the two is what this glossary tightens.

## Language

**Workout day**:
A named collection of exercises a user can train (e.g. "Upper Body"). The unit the user builds and runs through.
_Avoid_: Workout template (implementation-y), split, routine

**Planned workout**:
A workout day a user has *scheduled* onto a specific calendar date. The calendar (plan) is the set of scheduled dates; scheduling is a forward-looking commitment.
_Avoid_: Scheduled day alone, plan entry

**Logged workout**:
A workout day a user has actually *trained* on a specific date, recorded as a session. History counts these.
_Avoid_: Session (fine in code, but "workout" keeps the pairing with Planned workout visible)

**Rest day**:
A weekday with no planned workout — inferred from the absence of a plan entry, not stored. Powerful enough to show on the home strip as "recovery is training too".
_Avoid_: Off day, free day

**Weekly goal**:
This week's training target. **It is derived from the plan, not set by the user**: the goal equals the number of workouts planned on the calendar in the current week, and a day counts toward it once it is trained (whether or not it was planned). "4 planned → 0/4 → 4/4 as you train."
_Avoid_: A fixed 1–7 setting (superseded — see the ADR)

**Install**:
The generic verb for getting the app onto a device. Pulse has two distinct installations, with different audiences and mechanics — never blur them under one word.

**Web install**:
Installing the *web* app (the GitHub Pages build at `/Pulse/`) to a device's home screen or desktop, mediated by the browser via the web manifest (add-to-home-screen). Reversible; the browser owns the entry, there is no native binary and no signature.
_Avoid_: "install" alone when the kind matters; "download" (no binary is fetched for web install)

**Desktop install**:
Installing the *Tauri* desktop app — a signed native NSIS installer fetched from GitHub Releases, with signature-verified auto-update via `latest.json`. The app owns its own entry and its own updates. Only the desktop build; the web build has no desktop-install path.
_Avoid_: "install" alone when the kind matters; conflating with web install

**Sleep log**:
A record of one night's sleep — bedtime, wake time and the hours between — keyed by the wake date (see the wake-date ADR). The unit of sleep history on the Sleep tab.
_Avoid_: night (ambiguous — a night spans two calendar dates), sleep entry

**Caffeine entry**:
A single logged caffeine dose: what (type), how much (milligrams), when (timestamp). A caffeine entry is an independent event, never part of a sleep log; it influences the sleep score of whichever night its timing falls into.
_Avoid_: "part of the sleep log" (caffeine is logged separately), caffeine log (collides with sleep log)

**Sleep score**:
The 0–100 quality measure of a sleep log: how long the sleep lasted relative to the goal, damped by a late bedtime, and further reduced by caffeine still active in the body at bedtime.
_Avoid_: rating, penalty (that's only the caffeine component)

**Changelog**:
The ledger of user-facing releases — one entry per release version — that the What's new screen renders live. It is the source of truth for what shipped and for version numbering.
_Avoid_: release notes (that's the GitHub Release text, which derives from it), "What's new" (that's the screen)

**Release version**:
Pulse's single public version number: the newest entry of the changelog. Every manifest (web, desktop, updater) derives from it; when copies disagree, the changelog is right.
_Avoid_: app version, bundle version (those are derived copies)

**First-run tour**:
The guided walkthrough a signed-in user sees once, covering the whole app.
_Avoid_: onboarding; "the tutorial" when the distinction from the What's new tour matters

**What's new tour**:
An incremental walkthrough showing only the steps newer than a user's acknowledged version — never a replay of the first-run tour.
_Avoid_: tutorial update, re-onboarding

**Acknowledged version**:
The newest release version whose news a user has seen. While the changelog is newer, the app signals unacknowledged news.
_Avoid_: seen flag, read state

**Unreleased**:
The changelog section where bullets accumulate as features land on `main`, before any version is cut. It is never shown in What's new — the sheet promises what the user can use now.
_Avoid_: WIP, staging (implementation-flavored); a `vUnreleased` entry

**Release cut**:
Renaming the Unreleased section to a new release version and propagating that version everywhere it is derived from. The only moment a version number changes.
_Avoid_: bump (ambiguous — manifests bump as a *consequence*, not the act), publish

**Drift check**:
The mechanical verification that the changelog, the tutorial steps and anchors, and the version manifests agree. It gates deploys and releases; it does not judge prose.
_Avoid_: lint (that's Oxlint), validation (vaguer)

## Motion

The vocabulary the animation roadmap uses. Four intents; each piece of motion belongs to exactly one, and the intent sets its personality (see ADR 0006).

**Celebration**:
Motion that marks a *rare, earned* moment — a day completed, a badge unlocked, a streak milestone. Allowed to be bouncy and linger; its job is memory, not feedback.
_Avoid_: confetti (one possible ingredient, not the category), reward (means in-game points elsewhere, which Pulse has none of)

**Feedback**:
Motion that confirms a *user action* the interface otherwise shows no change for — a checkmark pop, a press depression. Must be ≤200 ms and never overshoot: you repeat it dozens of times per workout.
_Avoid_: micro-interaction (vaguer), reaction

**Transition**:
Motion that carries the user *between states of the interface* — screens, modals, a leaderboard reshuffling. Should feel like it hides a cut, not like it is watched.
_Avoid_: animation (the whole category), navigation (the cause, not the motion)

**Ambient loop**:
Motion that runs *without being triggered*, to make the app feel alive — the glass wallpaper drift, the streak flame, the neko. The only intent that must stop outright under the reduced-motion hatch rather than degrade.
_Avoid_: background animation (collides with CSS background-*), idle animation

**Reduced-motion hatch**:
The one global rule by which any motion in Pulse yields to the OS setting `prefers-reduced-motion`: feedback and transitions shrink to a crossfade or nothing; ambient loops stop entirely.
_Avoid_: accessibility mode (broader, and it isn't a mode in-app), animation toggle (settings has none)
