# Design: "What's new" live changelog

Date: 2026-08-12
Status: Approved

## Problem

The Settings tab has a "What's new" row that does nothing. After each push to GitHub, users should be able to see what changed.

## Decision

Fetch `CHANGELOG.md` from the GitHub repo on demand, parse it with a tiny hand-rolled markdown subset parser (no new dependencies), and show it in a bottom sheet. Delete the redundant "Changelog" row.

## 1. Data source

`CHANGELOG.md` lives at the repo root (`jankovskl/pulse`, branch `main`). Format — one heading per version, bullets under it:

```markdown
# Pulse Changelog

## 2.0.2 — 2026-08-12
- Rest timer auto-starts the next set
- Progress charts 2-week window

## 2.0.1
- ...
```

Appended per meaningful push; the app picks it up automatically.

## 2. Fetch + parse — `src/lib/changelog.js`

- Fetch `https://raw.githubusercontent.com/jankovskl/pulse/main/CHANGELOG.md` (raw GitHub sends `Access-Control-Allow-Origin: *`, works from GH Pages).
- ~40-line parser converts markdown to `[{ version, date, items: [] }]`, newest first. No new dependencies.
- Result cached for the session (module-level state) so repeated opens don't refetch.

## 3. UI — Settings tab

- Delete the "Changelog" row; keep only "What's new".
- Row subtitle becomes live: `v{latest} · {first item hint}` once fetched (e.g. "v2.0.2 · rest timer auto-starts next set"); keeps the current static text ("Version 2.0.1 — rest timer, charts") while loading or on failure.
- Tap opens a bottom sheet (same pattern as HomeScreen's date picker):
  - Overlay `fixed inset-0 z-50`, sheet `rounded-t-[28px] bg-card`, close X button, `max-w-[420px]`.
  - Title "What's new", then scrollable version blocks: version + date as section labels, items as bullets with accent dot markers in `text-soft`.

## 4. Error handling

- Fetch failure (offline, missing file, GH unavailable) → sheet shows "Couldn't load updates" + "Try again" button that refetches.
- Subtitle untouched on failure (stays static text).
- No persistence / localStorage caching (YAGNI — file is small, session cache sufficient).

## 5. Verification

- `npm run lint` (oxlint)
- `npm run build`
- Manual dev check against the real URL.
- Push to `main` so the live GH Pages deploy reflects the new changelog + app code.