---
title: Mobile-specific transition timing & deferral
status: accepted
---

## Context
Screen transitions use Framer Motion with a 0.2s/0.16s duration. On mid‑range Android/Chrome devices the animation feels janky.

## Decision
- Detect low‑end mobile browsers via `isMobilePhone()` (user‑agent regex) in `src/App.jsx`.
- Apply a shorter transition duration of **0.12 s** on those devices.
- Add `will-change: opacity, transform` style to the `<motion.div>` to promote compositor.
- Keep the existing reduced‑motion handling unchanged.
- No changes to desktop timing to preserve the current feel.

## Consequences
- Improves perceived smoothness on target phones without affecting desktop UX.
- Introduces a small platform‑specific branch; future changes to the transition must respect the `mobile` flag.
- Documented as ADR 0008; changelog bullet added.
