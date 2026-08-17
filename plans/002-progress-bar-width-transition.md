# 002 — Animate progress bar fill width on exercise toggle

- **Status**: TODO
- **Commit**: no-git
- **Severity**: MEDIUM
- **Category**: Missed opportunities
- **Estimated scope**: 1 file, 1 line

## Problem

`src/screens/DayDetailScreen.jsx:163` — the progress bar fill div changes its
`width` via an inline `style` prop. The width jumps instantly on every exercise
toggle with no transition.

```jsx
// DayDetailScreen.jsx:161-165 — current
<div className="h-1 rounded bg-line/5">
  <div
    className="h-1 rounded bg-accent/15"
    style={{ width: `${pct}%`, background: pct === 100 ? '#17C964' : 'var(--color-accent)' }}
  />
</div>
```

Per AUDIT.md §5, animating `width` triggers layout + paint. This is a narrow
decorative bar (1px tall, percentage-based) — the layout cost is negligible and
there is no animation library in this repo, so a CSS `transition` on `width` is
the correct tool. The alternative (`transform: scaleX()`) would require
`transform-origin: left` and is harder to read.

## Target

Add `transition` to the inline style, animating `width` over 300ms with a strong
ease-out curve. Also transition `background` for the color swap at 100%.

```jsx
// target
<div className="h-1 rounded bg-line/5">
  <div
    className="h-1 rounded bg-accent/15"
    style={{
      width: `${pct}%`,
      background: pct === 100 ? '#17C964' : 'var(--color-accent)',
      transition: 'width 300ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms ease-out',
    }}
  />
</div>
```

`cubic-bezier(0.23, 1, 0.32, 1)` is the strong ease-out from AUDIT.md §2 —
starts fast, decelerates, communicates progress accumulating.

## Repo conventions to follow

- This div already uses inline `style` for dynamic values — extend it, don't
  switch to a className.
- Exemplar: `src/components/ui.jsx:462` —
  `style={{ transform: …, transition: 'transform 160ms ease-out' }}` —
  same inline style + transition pattern.

## Steps

1. Open `src/screens/DayDetailScreen.jsx`.
2. Lines 163–164: add a `transition` key to the existing inline style object.

   Before:
   ```jsx
   style={{ width: `${pct}%`, background: pct === 100 ? '#17C964' : 'var(--color-accent)' }}
   ```

   After:
   ```jsx
   style={{
     width: `${pct}%`,
     background: pct === 100 ? '#17C964' : 'var(--color-accent)',
     transition: 'width 300ms cubic-bezier(0.23, 1, 0.32, 1), background 200ms ease-out',
   }}
   ```

## Boundaries

- Do NOT touch the outer `div` (`bg-line/5`).
- Do NOT touch any other element in this file.
- Do NOT convert to a Tailwind class — keep inline style.
- Do NOT add any JS animation logic.

## Verification

- **Mechanical**: `npx oxlint src/screens/DayDetailScreen.jsx` — 0 errors.
- **Feel check**:
  - Open a workout day with 4+ exercises.
  - Toggle exercises one by one — the fill bar should grow smoothly each time,
    not jump.
  - At the last exercise, the bar should animate to full width AND crossfade
    from purple to green.
  - DevTools Animations panel at 10%: confirm `width` is animating with the
    custom cubic-bezier curve.
- **Done when**: progress bar fill visibly animates on every toggle, and turns
  green smoothly when the last exercise is checked.
