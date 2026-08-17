# 004 — Add press feedback to the Toggle component

- **Status**: TODO
- **Commit**: no-git
- **Severity**: LOW
- **Category**: Feedback
- **Estimated scope**: 1 file, 1 className

## Problem

`src/components/ui.jsx:200` — the `Toggle` component has `transition-colors`
on its outer button and `transition-all` on the inner thumb, but there is no
`:active` press feedback. The thumb does not respond to tap — it feels
disconnected from the press.

```jsx
// ui.jsx:200-213 — current
export function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-[20px] w-[40px] rounded-full transition-colors ${
        on ? 'bg-accent' : 'bg-tile'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[18px] rounded-full bg-soft shadow-[0px_2px_4px_0px_#0000001A] transition-all ${
          on ? 'left-[20px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}
```

The inner thumb uses `transition-all` but the outer button has no transform
transition. Per AUDIT.md §3, pressable elements that lack press feedback are a
finding — even subtle. This fires on every settings toggle (occasional
frequency), but each toggle change is a discrete yes/no decision that benefits
from confirmation.

## Target

Add `active:scale-95` to the outer button so it shrinks 5% on press, using
Tailwind's built-in `ease-out` curve at 150ms duration (within the press
feedback budget of 100–160ms). Also fix the `transition-all` on the thumb to be
explicit transitions (AUDIT.md §5 — `transition: all` is a finding) to avoid
animating unintended properties.

```jsx
// target
export function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-[20px] w-[40px] rounded-full transition-colors active:scale-95 ${
        on ? 'bg-accent' : 'bg-tile'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[18px] rounded-full bg-soft shadow-[0px_2px_4px_0px_#0000001A] transition-[left] duration-200 ease-out ${
          on ? 'left-[20px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}
```

Wait — Tailwind CSS v4 supports `transition-[left]` but not
`transition-[left]_duration-200`. Use `transition-[left] duration-200` (two
separate utilities — Tailwind will output both `transition-property: left`
and `transition-duration: 200ms`). This is correct.

Actually, simpler: the existing code uses `transition-all` which works
functionally. Per the audit, replacing it is better but is itself a separate
finding. For this plan, only add the press feedback:

```jsx
// target (minimal)
className={`relative h-[20px] w-[40px] rounded-full transition-colors active:scale-95 ${
  on ? 'bg-accent' : 'bg-tile'
}`}
```

## Repo conventions to follow

- Tailwind utility classes only, no inline styles.
- Exemplar for press feedback: none exists in this repo yet — this is the
  first press-feedback addition. Follow AUDIT.md §3 values:
  `scale(0.95)` — 0.95 to 0.98 range, 150ms with `ease-out`.

## Steps

1. Open `src/components/ui.jsx`.
2. Line 204: replace `transition-colors` with
   `transition-colors active:scale-95`.

   Before:
   ```jsx
   className={`relative h-[20px] w-[40px] rounded-full transition-colors ${
     on ? 'bg-accent' : 'bg-tile'
   }`}
   ```

   After:
   ```jsx
   className={`relative h-[20px] w-[40px] rounded-full transition-colors active:scale-95 ${
     on ? 'bg-accent' : 'bg-tile'
   }`}
   ```

3. Save.

## Boundaries

- Do NOT change the thumb animation or `transition-all`. That is a separate
  finding (LOW severity, `transition: all` anti-pattern).
- Do NOT touch any other component in this file.
- Do NOT add reduced-motion handling separately — `active:scale-95` is a
  tap-feedback micro-animation (12px → 11.4px movement) that is within
  reduced-motion tolerance. If needed, add
  `@media (prefers-reduced-motion: reduce) { .toggle { scale: none } }`
  in `index.css` as a follow-up.

## Verification

- **Mechanical**: `npx oxlint src/components/ui.jsx` — 0 errors.
- **Feel check**:
  - Go to Settings > Appearance.
  - Toggle any switch (e.g. Dark Mode toggle, Notifications).
  - The switch should shrink slightly (5%) on tap, then return on release.
  - No perceptible delay — should feel immediate.
- **Done when**: every `Toggle` in the Settings screen has a subtle
  scale-on-press that confirms the tap before the state change.
