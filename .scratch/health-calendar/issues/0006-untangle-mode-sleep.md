# Untangle mode="sleep" from WorkoutCalendar

## Description
The Health tab currently reuses the workout calendar with a `mode="sleep"` overlay [Calendar.jsx:26-53](../src/components/Calendar.jsx#L26-L53). Extract new components so the workout Calendar and the Health dashboard are cleanly separated.

## Blocking edges
- [ ] Sleep data model (0001)
- [ ] Health screen with hero card (0002)

## Acceptance criteria
- New `SleepScreen.jsx` + `SleepCalendar.jsx` components exist
- Health tab routes to SleepScreen, not `<CalendarScreen mode="sleep">`
- `mode="sleep"` path removed from `WorkoutCalendar`
- Workout Calendar tab (`calendar`) is untouched and still shows planned/done days
- `getSleepColor`/overlay logic moves out of WorkoutCalendar if still needed

## Implementation notes
- Router change in [App.jsx:47-67](../src/App.jsx#L47-L67): `case 'health'`
- Remove the `mode==='sleep'` conditional branches from WorkoutCalendar
- Old sleep overlay helpers move to the new SleepCalendar
- Keep calendar tab behavior identical — no regressions