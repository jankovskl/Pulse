# Create sleep week strip with month button

## Description
Add a compact week strip to the Health dashboard, styled like the home-page workout week. Tiles are flat, with a subtle dot when goal-met. A "Month" button (like home's "Calendar" button) opens the full month heatmap screen.

## Blocking edges
- [ ] Health screen with hero card (0002)
- [ ] Sleep data model (0001)

## Acceptance criteria
- Week strip shows Mon-Sun tiles (flat, no heatmap)
- Each tile shows a filled dot if that night met the sleep goal
- "Month" button sits on the strip, opens `health-month` route
- Same idea/style as the home week strip layout
- Week strip is compact — leaves room for future health widgets

## Implementation notes
- Reuse `weekOf()` from HomeScreen [HomeScreen.jsx:54](../src/screens/HomeScreen.jsx#L54)
- Month button is `nav.go('health-month')`
- Dot is tinted by goal-met (hours >= sleepGoal), not by exact hours
- This is deliberately NOT the tinted heatmap — keep tiles flat, same as home