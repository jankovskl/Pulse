# Changelog is the source of truth for version and news

Status: accepted

Three surfaces used to restate the same feature list by hand — `CHANGELOG.md`, the tutorial steps, and the GitHub Release body — and four version numbers drifted independently (package.json `0.0.0`, tauri.conf.json `0.1.1`, Cargo.toml `0.1.0`, changelog `2.2.0`). We decided **`CHANGELOG.md` is authoritative**: its newest released section *is* Pulse's version, and every manifest, the What's new screen, and the GitHub Release body derive from it. A release is one act — `npm run release <x.y.z>` renames `## Unreleased`, rewrites `since: UNRELEASED` tutorial markers, and syncs the manifests — after which no version number is ever edited by hand.

## Considered Options

- **Feature registry** — one file defines each feature once and the changelog, tutorial, and release notes all generate from it. Rejected: tutorial steps need per-screen anchors, tab routing, and coach-mark copy that can't be generated from a changelog line, so the registry would still hold three parallel shapes while rewriting three working systems.
- **Release-time-only changelog editing** — bullets written when cutting a version. Rejected: contradicts "What's new updates every time I add something," since the sheet would show nothing between releases.
- **Keep manifests independent** — bump each by hand. Rejected: this is the drift being replaced.

## Consequences

- The `## Unreleased` section is a staging area, never shown in What's new (the parser skips it) — the sheet promises only what the user can use now.
- A **drift check** (`scripts/drift.js`, run in `deploy.yml` and `release.yml`) is the mechanical guarantee: tutorial anchors ↔ steps both ways, top changelog version ↔ all three manifests, and no hardcoded version strings in `src/`. It gates deploys, so a change that skipped the rule fails the build rather than shipping silently.
- The desktop app bundles a `CHANGELOG.md` snapshot (`?raw` import) as the offline fallback for What's new, replacing a stale hardcoded string; the live GitHub fetch still wins when online.
- Installed 0.1.1 desktop clients accept the jump to 2.x as a valid update (semver only compares greater-than), so the retroactive sync to `2.2.0` is safe.
- The rule is partly a *convention* Claude follows on every change (CLAUDE.md "Release & news pipeline"); the drift check only catches the mechanical half, not a missing changelog bullet for a change that touched no anchor or manifest.
