# Create sleep data model

## Description
Create the new sleep data model with bed date, bed time, wake time, hours, note, and quality fields.

## Blocking edges
- [ ] Store API changes
- [ ] Sync API changes
- [ ] Profile logic changes (sleepStreakOf, deriveStats)

## Acceptance criteria
- Store has `sleepGoal` setting (default 8h)
- Sleep logs are `{ date, hours, bedtime, wake, note, quality }`
- Legacy `{ date, hours }` logs are handled gracefully
- Sleep data syncs to cloud via exportAll/importAll
- `sleepStreakOf` and `deriveStats` keep working with hours

## Implementation notes
- The `date` field is the bed date (not wake date)
- `hours` is computed from bedtime/wake time if present
- `quality` is optional (1-5 rating)