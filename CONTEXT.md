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
