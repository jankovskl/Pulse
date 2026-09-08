# Sleep month heatmap with summary

## Description
Full-screen month view: a GitHub-style heatmap (small squares tinted by sleep hours) with weekly-score + average summary beneath. Reached by tapping the "Month" button on the week strip.

## Blocking edges
- [ ] Sleep data model (0001)
- [ ] Health screen with hero card (0002)

## Acceptance criteria
- Heatmap shows a compact grid of small squares, tinted by sleep hours
- Tapping a square opens the sleep log sheet for that night (edit)
- Summary beneath: weekly score + average hours this month
- Uses `health-month` route — separate from landing, leaves the landing compact
- Matches the GitHub-contribution-style heatmap requested

## Implementation notes
- Tint intensity scales with hours (≤4 faint, ~7 medium, ≥8 strong)
- Square coloring reuses the existing sleep color idea from `getSleepColor` [Calendar.jsx:41](../src/components/Calendar.jsx#L41)
- Weekly score = e.g. avg hours or nights ≥7h — keep it glanceable
- Route registered in the App router [App.jsx:62-63](../src/App.jsx#L62-L63)