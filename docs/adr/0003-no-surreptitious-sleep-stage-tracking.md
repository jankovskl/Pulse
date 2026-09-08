# Sleep staging is deliberately out of scope — duration and self-rated quality only

Status: accepted

Pulse is a manual-log fitness tracker: it has no sleep sensor, and the Health calendar logs what the user *tells it*. We decided **not** to show REM / light / deep "cycles" anywhere. Any such widget would have to be fabricated from hours slept — that is invented measurement presented as fact, so we will not build it.

## Considered Options

- **Manual REM self-report** — the user types estimated REM/stage hours by hand. Rejected: even framed as a guess, a stage split implies measurement the user can't actually do; it invites fake precision into the record.
- **Wearable/OS import** — pull real sleep stages from Apple Health / Google Fit / Samsung Health. Genuinely real data, but a large, platform-specific integration across web + Tauri; not something to bolt into the current calendar. Tracked as future scope, deliberately not this.
- **Self-rated + duration (chosen)** — a 1–5 "how did you sleep" rating plus real bed/wake times. Everything the app records is truthful and within the user's knowledge. A sleep `score` can only be a duration-vs-goal derived number, never a physiological claim.

## Consequences

- The only sleep datapoints are: entry date (the wake date, per ADR 0004), bed time, wake time, computed hours, optional note, optional quality rating.
- The "Consistent Sleeper" achievement stays strictly duration-based (≥7h streak) — it makes no stage claims.
- The UI uses the word "score" only for duration-vs-goal, never "stages", "REM", "deep". If a wearable path lands, it will be a separate feature with its own data source field.