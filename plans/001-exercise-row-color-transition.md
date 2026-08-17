# 001 — Transition exercise row background on done/undone toggle

- **Status**: TODO
- **Commit**: no-git
- **Severity**: MEDIUM
- **Category**: Easing & duration / Missed opportunities
- **Estimated scope**: 1 file, 1 line

## Problem

`src/screens/DayDetailScreen.jsx:255` — the exercise row switches its background
between `bg-surface outline outline-1 outline-line/10` (undone) and `bg-good/15`
(done) with only `transition-opacity` present. The background color snaps
instantly on every exercise toggle — the primary feedback loop of the whole app.

```jsx
// DayDetailScreen.jsx:255 — current
className={`flex flex-col gap-3 rounded-[20px] p-4 transition-opacity md:flex-row md:items-center md:justify-between ${
  dragIdx === i ? 'opacity-40' : ''
} ${
  e.done ? 'bg-good/15' : 'bg-surface outline outline-1 outline-line/10'
}`}
```

## Target

Add `transition-colors duration-200` alongside the existing `transition-opacity`.
Tailwind merges multiple `transition-*` utilities correctly. 200ms matches the
theme crossfade already used in `index.css`
(`.screen-bg, .bg-surface … { transition: background-color 180ms ease; }`).

```jsx
// target
className={`flex flex-col gap-3 rounded-[20px] p-4 transition-colors duration-200 transition-opacity md:flex-row md:items-center md:justify-between ${
  dragIdx === i ? 'opacity-40' : ''
} ${
  e.done ? 'bg-good/15' : 'bg-surface outline outline-1 outline-line/10'
}`}
```

## Repo conventions to follow

- Tailwind utility classes only — no inline `style` for transitions.
- Exemplar: `src/components/ui.jsx:78` — `transition-colors` on tab buttons.
- No shared CSS easing token exists; Tailwind's built-in `ease-out`
  (`cubic-bezier(0, 0, 0.2, 1)`) is correct for a color crossfade.

## Steps

1. Open `src/screens/DayDetailScreen.jsx`.
2. Line 255: replace `transition-opacity` with
   `transition-colors duration-200 transition-opacity`.

## Boundaries

- Do NOT touch any other className in this file.
- Do NOT change markup or structure.
- Do NOT add JS animation logic.
- Do NOT touch `WorkoutSummary.jsx`, `ui.jsx`, or `index.css`.

## Verification

- **Mechanical**: `npx oxlint src/screens/DayDetailScreen.jsx` — 0 errors.
- **Feel check**:
  - Tap checkmark on an exercise. Background should fade to green tint over
    ~200ms, not snap.
  - Tap again to uncheck — reverse fade equally smooth.
  - DevTools Animations panel at 10%: confirm `background-color` is animating.
- **Done when**: exercise row background visibly crossfades on every toggle.
