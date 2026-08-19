# Weekly goal is derived from the calendar plan, not a user setting

Status: accepted

The weekly goal was a static 1–7 target the user picked once (default 4), and the home card counted only days actually trained. It is now **plan-derived**: the goal equals the number of workouts scheduled on the calendar in the current Mon–Sun week, and any day trained — planned or not — fills it. So scheduling four workouts shows 0/4 and ticking each one off reaches 4/4. The 1–7 setting is removed and no longer read.

## Considered Options

- **Union model** — a day counts if it was planned *or* trained, so planning alone could hit the goal with zero training. Walked back in grilling: the goal should be *set* by planning but only *filled* by training.
- **Plan-only completion** — only planned-then-trained days fill the bar, so an unplanned workout is "wasted." Rejected: spontaneous training should still count toward the goal.
- **Keep static setting** — goal stays a user-set number independent of the calendar. Rejected: this is the behavior being replaced; the calendar is the commitment.

## Consequences

- `settings.weeklyGoal` is orphaned for existing users' persisted state — harmless dead data, ignored going forward.
- The goal can legitimately be *exceeded* (train 6 days against a 4-day plan); the card caps the number at the goal and shows the true counts in a subtitle.
- A week with nothing planned has no goal (0 planned) — the card shows a scheduling prompt rather than a goal.
