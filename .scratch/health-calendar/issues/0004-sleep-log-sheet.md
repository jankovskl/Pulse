# Sleep log sheet (add/edit/delete)

## Description
Bottom-sheet UI for adding a sleep log, editing an existing one, or deleting it. Reuses the app's existing bottom-sheet pattern.

## Blocking edges
- [ ] Sleep store API (0001)
- [ ] Health screen with hero card (0002)

## Acceptance criteria
- Sheet opens from hero card (log last night / edit) or from a day in the month
- Fields: bed time, wake time, optional note, optional 1-5 quality rating
- Hours auto-computed from bed/wake times (crosses midnight correctly)
- "Log last night" targets the bed date of yesterday
- Already-logged night → opens for edit (upsert), with a delete action in the sheet
- Uses existing bottom-sheet pattern from PlanDayPicker [Calendar.jsx:156](../src/components/Calendar.jsx#L156)

## Implementation notes
- Quality rating matches ADR-0003 (1-5 self-report, not a measurement)
- Delete calls new `removeSleepLog(date)` store API
- Edit reuses the same sheet — difference is just the pre-filled values
- Wake time may land on the date AFTER the bed date — handle midnight crossing