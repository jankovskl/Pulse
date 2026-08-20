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
