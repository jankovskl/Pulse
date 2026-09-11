# Tutorial & What's New

Two guided tours share one coach-mark renderer. The **first-run tour** shows every core feature once, to a signed-in user who has never completed it. The **What's new tour** shows only the steps newer than a release the user has already acknowledged — it never replays the whole app.

## The two tours

| | First-run tour | What's new tour |
|---|---|---|
| Trigger | First sign-in, no completion flag | User taps "Show what's new" in the What's new sheet |
| Steps | All steps without `since: <version>` | Steps whose `since` is newer than the acknowledged version |
| Completion key | `pulse.tutorial.completed.<userId>` | — (opening the sheet acks the news) |
| Ack key | — | `pulse.whatsnew.ack.<userId>` (global fallback when signed out) |

Skip counts as complete in both. Existing users with no ack key inherit the current top version, so shipping this never nags anyone with a tour of steps they've already seen.

## Files

- **`src/lib/tutorialSteps.js`** — the step data and the `since` convention. Pure, importable by `node --test`.
- **`src/components/Tutorial.jsx`** — the renderer. Takes `steps`, `onComplete`, and an optional `lastLabel`; navigates to each step's `tab`, spotlights its `target`, re-measures on scroll/resize.
- **`src/lib/tutorial.js`** — completion + acknowledged-version storage, and the module store (`startWhatsNewTour` / `subscribeWhatsNewTour`) that hands the What's new steps to `App`.
- **`src/App.jsx`** — mounts both tours **above the router**, because their steps navigate between tabs; a tour inside SettingsScreen would unmount the moment it leaves Settings.
- **`src/screens/SettingsScreen.jsx`** — the What's new row (with the "New" pill), the sheet, and the "Show what's new" button.

## Step shape

```javascript
{
  id: 'health-sleep',
  title: 'Sleep & Recovery',
  description: 'One or two sentences of coach-mark copy.',
  target: '[data-tutorial="health-screen"]', // CSS selector, or null for a centered step
  position: 'top',                            // 'top' or 'center'
  tab: 'health',                              // which screen to navigate to first
  since: UNRELEASED,                          // release that introduced it; omit for core steps
}
```

`since: UNRELEASED` is a pending marker — `npm run release <x.y.z>` rewrites it to the version being cut, exactly like the changelog's Unreleased section. A pending step is never offered as news.

## Adding a step (the standing rule)

A change that introduces a screen, control, or interaction the user can't discover on their own must, **in the same commit**:

1. add a step to `TUTORIAL_STEPS` with `since: UNRELEASED`;
2. add the matching `data-tutorial="<id>"` anchor to the target screen (or a `tutorial="<id>"` prop on a shared `Row`);
3. append a bullet under `## Unreleased` in `CHANGELOG.md`.

Fixes and refinements get a changelog bullet only — never a step. `npm run check:drift` enforces that anchors and steps agree in both directions and runs in CI.

## Restart

**Settings → Restart Tutorial** clears the completion flag and reloads, replaying the first-run tour. The What's new tour is always available from the sheet whenever unseen news exists.

## Testing

```bash
node --test src/lib/tutorialSteps.test.js   # the since / newStepsSince logic
npm run check:drift                          # anchors ↔ steps, versions, no hardcoded strings
```

To replay the first-run tour by hand: `localStorage.removeItem('pulse.tutorial.completed.<userId>')` and refresh. To re-arm the What's new pill: `localStorage.removeItem('pulse.whatsnew.ack.<userId>')`.
