# Caffeine sleep impact: exponential dose-time model, no cap

Status: accepted (supersedes the tiered-penalty model of the original caffeine logger)

Caffeine's effect on a night's sleep score was a hand-tuned tier table (8h+ → 0.95, …, <1h → 0.15) with a hard 50% cap and a "previous calendar day" window. We decided to replace it with a single pharmacokinetic formula fitted to a published dose/time sleep-loss table: each entry contributes its dose decayed by a 4-hour half-life, contributions sum to an *effective dose* still aboard at bedtime, and the sleep-score multiplier is `exp(−D_eff / 400)` — i.e. 400 mg still active at bedtime costs ~63% of sleep quality. The formula is self-bounding (0, 1), so the 50% cap is removed.

## Calibration source

The formula was fitted to this table (≈% sleep quality lost, dose × hours before bed):

| Caffeine (mg) | Time before bed (h) | Approx. % worse | Model |
|---|---|---|---|
| 50 | 8 | ~2–3 | 3.1 |
| 50 | 4 | ~5–7 | 6.1 |
| 100 | 8 | ~3–5 | 6.1 |
| 100 | 6 | ~7–10 | 8.5 |
| 100 | 4 | ~10–15 | 11.8 |
| 100 | 2 | ~15–20 | 16.2 |
| 200 | 8 | ~8–12 | 11.8 |
| 200 | 6 | ~12–18 | 16.2 |
| 200 | 4 | ~20–25 | 22.1 |
| 200 | 3 | ~25–30 | 25.7 |
| 200 | 2 | ~30–35 | 30.2 |
| 300 | 6 | ~18–25 | 23.2 |
| 300 | 4 | ~28–35 | 31.3 |
| 300 | 3 | ~35–40 | 35.9 |
| 300 | 2 | ~40–45 | 41.4 |
| 400 | 12 | ~10–15 | 11.8 |
| 400 | 8 | ~18–22 | 22.1 |
| 400 | 6 | ~25–30 | 30.2 |
| 400 | 4 | 34 (study) | 39.3 |
| 400 | 3 | ~38–42 | 44.8 |
| 400 | 2 | ~45–50 | 50.7 |
| 400 | 1 | ~50–60 | 57.1 |
| 400 | 0 | ~60–70 | 63.2 |

Every row is a test vector in `sleepUtils.caffeine.test.js` (band ± 6 pp). No single exponential fits the table exactly — the 400 mg @ 4 h study row (34%) is the largest deviation; the fit was preferred over table-lookup interpolation for clarity and smooth behavior between rows.

## Considered Options

- **Exponential decay + exponential dose response (chosen)** — one formula, two constants (4 h half-life, 400 mg reference dose), matches the table within a few points everywhere.
- **Keep the tiers, add dose weighting** — rejected: tiers were already inconsistent with the "half-life ~5–6 h" comment in the code, and interpolating dose into six buckets is more magic than less.
- **Table lookup with linear interpolation** — rejected: exact to the source but opaque, and needs defined behavior outside the table's boundaries.
- **Keep the 50% cap** — rejected: the table itself shows 400 mg near bedtime costing 50–70%, so the cap contradicts the calibration data. `exp` is naturally bounded, making the cap redundant.

## Consequences

- **Historical scores recolor.** Every sleep score with caffeine in its window changes; heatmap cells may shift red/green for existing users. Accepted deliberately.
- **Half-life is 4 h, not the 5–6 h in the old comment.** The comment described general pharmacokinetics; the table's decay fits ~4 h, and the table is the spec.
- **Legacy entries without `amountMg` score using their type's default dose** (coffee 95, energy 160, pre-workout 200, tea 45 mg) — previously they were guessed at a flat 50 mg-equivalent.
- **The window is timestamp-based, not calendar-day-based**: entries in `[bedtime − 24 h, bedtime]` count — inclusive at bedtime, so the table's "dose at bedtime" worst case scores — where bedtime is resolved to a real datetime via the wake-date keying of ADR 0004 (bedtime ≥ noon → the day before the wake date; < noon → the wake date itself). Monday 16:00 coffee correctly penalizes the Mon→Tue night; caffeine after a night's bedtime belongs to the *next* night (the boundary dose decays to ~1/64 of itself by then, costing it ~1.6% at most).
- **Both call sites converge.** The calendar heatmap previously passed *all* caffeine entries with clock-time-only comparison (a Monday coffee penalized every historical 4pm-ish bedtime); it now shares the single windowed `caffeineImpact(caffeineLogs, sleepLog)`. `caffeineLogsForSleep` is deleted.
- Sleep logs without a `bedtime` keep multiplier 1 — no anchor, no impact.
