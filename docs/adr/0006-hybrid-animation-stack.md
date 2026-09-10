# Hybrid animation stack: CSS tokens plus Framer Motion

Status: accepted

Pulse had no animation library — motion was ad hoc Tailwind transitions following a house pattern (mount → `setTimeout` → toggle opacity/scale, 180–300 ms). Plans 001–005 (the `plans/` roadmap) exhausted what pure CSS does well. The next waves need screen enter/exit transitions, modal *exits*, and FLIP reordering (leaderboard), which are awkward or manual in CSS. We decided on a **hybrid**: keep the existing CSS-transition pattern for everything already working and for one-shot micro-interactions, and add Framer Motion *only* where it is structurally better — `AnimatePresence` for screen/modal transitions and `layout`/`layoutId` for reordering and shared-element motion.

## Considered Options

- **CSS-only** — no dependency, one paradigm, lean Tauri bundle. Rejected: enter/exit choreography and FLIP reordering would be hand-rolled anyway, reinventing `AnimatePresence` badly.
- **Framer Motion everywhere** — consistent paradigm. Rejected: ~50 KB spent reimplementing transitions that already work (`transition-colors`, the `WorkoutSummary` stagger), and the existing house pattern is readable without library knowledge.

## Consequences

- Two paradigms coexist deliberately — do not "unify" one into the other. New motion picks the tool per job: CSS keyframes/transitions for a defined start→end; Framer Motion when presence (mount/unmount) or layout identity is involved.
- Shared duration/easing tokens live as CSS custom properties (`--dur-*`, `--ease-*` in `src/index.css`); Framer Motion springs are tuned to feel of the same family, not numerically shared.
- Every animation, in either paradigm, must have a `prefers-reduced-motion` fallback — including the pre-existing infinite loops (glass wallpaper, streak flame, neko.js), which gained no hatch until this decision.
