# Sleep is logged by wake date, not bed date

Status: accepted (supersedes 0002)

ADR 0002 keyed each night by the date the user went to bed, with a noon heuristic to guess that date ("logging before noon → the night started yesterday"). Real usage broke this: bedtimes vary wildly (1 a.m., 3 a.m., even afternoon naps), so the heuristic regularly miskeyed nights — e.g. bed at 3 a.m. Friday, logged Friday morning, saved under Thursday. The wake-up morning, by contrast, is stable and always on the day the user is living in when they log. Decided: each night is stored under **the date the user wakes up (the wake date)**.

## Considered Options

- **Wake date (chosen)** — the user always wakes on one unambiguous day, and "the sleep I just had" maps to today's calendar cell with zero inference. `lastNightKey` becomes simply today's date; no noon heuristic at all. The month grid's cells are colored by wake date: the cell says "the night that ended on this morning".
- **Bed date with smarter inference** — keep bed-date keying but derive the bed date from the entered bedtime (before noon + early-morning bedtime → today). Keeps the "night of Saturday" intuition, but still needs inference and keeps the bed-date edge cases. Rejected: more logic for a weaker anchor.
- **Bed date (ADR 0002, superseded)** — the noon roll-back heuristic described above; miskeys any after-midnight bedtime logged before noon.

## Consequences

- An entry's stored date is a local `YYYY-MM-DD` wake date; bedtime is optional metadata, never the key.
- "Last night" on the Health screen is the entry keyed by **today**, at any hour — logging right after waking fills today's heatmap cell.
- Existing entries written under the old bed-date convention remain as stored (they may sit one day earlier than the new convention would place them); no migration is performed.
- The wake time normally falls on the entry's own date; a bedtime in the small hours (e.g. 03:00) belongs to the calendar day *before* the entry's date — consumers must not assume bedtime and entry share a date either.
- The word "score" and all stage-related constraints of ADR 0003 are unaffected.
