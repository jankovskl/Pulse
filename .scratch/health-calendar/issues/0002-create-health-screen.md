# Create Health screen with hero card

## Description
Create the main Health screen with a hero card showing last night's sleep score and duration.

## Blocking edges
- [ ] Sleep data model (0001)
- [ ] Sleep store API

## Acceptance criteria
- Health tab routes to new SleepScreen.jsx
- Hero card shows last night's sleep (score bar, duration, bed/wake times)
- Empty state shows "tap to track your sleep" CTA
- "Log last night" action targets yesterday's bed date
- Tapping the card opens the sleep log sheet for that night

## Implementation notes
- Hero card uses the new sleep score calculation (duration vs sleepGoal)
- Score bar shows 0-100 scale
- Card shows hours slept and bed/wake times
- Uses existing UI components (Chip, Modal, Screen)