# Sleep is logged by bed date, never wake date

Status: superseded by 0004 (wake-date keying)

A night's sleep can cross midnight — bed at 23:00 Saturday, wake at 07:00 Sunday. Decided: each night is stored under **the date you go to sleep (the bed date)**, not the morning you wake. So "the night of Saturday" belongs to Saturday, and the Health dashboard's "last night" is the night whose bed date is yesterday.

## Considered Options

- **Bed date (chosen)** — matches the intuitive "the night of the 1st," keeps "log tonight/last night" a simple zero-arg action (default = yesterday's date), and the wake time is allowed to land on the next calendar day. The month grid's cells are colored by bed date.
- **Wake date** — store the night under the date you woke. Rejected: a user tapping today's date thoughtfully logs *tonight's* upcoming sleep, and "what sleep did I get last night" would require stepping back mentally. It inverts the tap-to-log mental model.

## Consequences

- An entry's stored date is a local `YYYY-MM-DD` bed date; bed time is optional metadata, never the key.
- The wake time may fall on the date *after* the entry's date — consumers must not assume same-day.
- Legacy `{ date, hours }` logs already keyed by bed date stay compatible; they just lack times.