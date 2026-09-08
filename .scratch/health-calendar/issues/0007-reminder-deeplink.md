# Sleep reminder deep-link to Health

## Description
The existing sleep reminder Notification [store.jsx:231-234](../src/lib/store.jsx#L231-L234) should deep-link into the Health dashboard so tapping it jumps to "log last night."

## Blocking edges
- [ ] Health screen with hero card (0002)
- [ ] Sleep log sheet (0004)

## Acceptance criteria
- Tapping the sleep reminder Notification navigates to the Health tab
- The Health dashboard is the destination — user lands on "log last night"
- Notification body stays "Remember to log your sleep!"
- Works on web and desktop

## Implementation notes
- Attach `onclick` to the Notification to navigate to Health
- Use the same NavProvider navigation as elsewhere
- Keep the existing timing/schedule logic in store.jsx