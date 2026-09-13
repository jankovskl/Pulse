# Pulse Changelog

## Unreleased
- The little jump when switching tabs is gone — the tab bar no longer hops while a screen slides in, and every tab opens from the top
- 20 new muted gradient themes in Appearance — including Moss and Lawrencium-style picks matched to every accent color, now sorted by hue family
- Lawrencium is the new default theme for fresh installs — existing picks are never overwritten
- Profile popups open instantly at full size — no more three-second wait, and no shrunken panel with a stray scrollbar
- What's new now finds you: the first launch after an update opens a visual summary of what changed, with icons and headlines instead of a wall of text
- New features you might miss carry a "Show me" button that spotlights the control right in the app
- Past releases fold into What's new, so the whole history is one tap away
- New features get their own mini-tour, launched from What's new
- The Sleep tab now appears in the first-run tour
- Improve screen‑transition performance on low‑end mobile browsers by shortening transition duration, adding a `will‑change` hint, and gating the tweak to Android/iOS devices

## 2.2.0 — 2026-08-15
- New Calendar screen: plan workouts per date and browse your month-by-month history
- Streaks now weather up to 2 rest days — a missed day no longer resets your chain
- Progress overhaul: exercise picker is now a searchable list of lifts you've actually logged
- "Limited" weights are explained — tap the chip to see the exact progression rule that capped a lift
- Charts show a ghost line for the weight you entered when the guard capped it
- Avatar cropping: pan, zoom and rotate your picture before uploading
- iPhone HEIC/HEIF photos are converted automatically before upload
- Profile lifts are searchable, with the top 5 shown at a glance
- Fixes: the rest timer now finishes even if the app was locked or in the background, and the last exercise of a day reaches the leaderboard

## 2.1.0 — 2026-08-15
- Public profiles: tap any leaderboard entry to preview a player's bio, badges, widgets and lifts
- Profile customization: set a nickname, bio, avatar, widgets and avatar decorations in Settings
- Achievements: 21 badges across 4 tiers (Easy → Legendary) unlocked by workouts, strength and consistency
- Decorations: rings, accessories (cat ears, crown, halo, wings), titles and profile frames earned via achievements
- Stat widgets: pin best lift, sessions, and day streak to your public profile, reorderable
- Admin badges: verified admins get a shield icon on leaderboards and profiles
- Anti-cheat progression: weights clamped to plausible muscle-group progressions (server + client side)
- Server guards on profile stats: sessions, streaks, best lifts and decorations validated by DB triggers
- Responsive progress charts: WeightChart now adapts to container width with ResizeObserver
- "Limited" badge on lifts capped by the progression guard

## 2.0.3 — 2026-08-13
- 16 themes: 6 presets plus 10 new gradient themes
- Appearance screen with grouped theme and accent picker in Settings
- Profile nicknames and avatars shown on the leaderboard
- Timer resumes your last active exercise

## 2.0.2 — 2026-08-12
- What's new panel shows live changes from GitHub
- Neko pet stays awake between idle states

## 2.0.1
- Rest timer with set countdowns
- Progress charts in the Progress tab
- Exercise library and leaderboard
