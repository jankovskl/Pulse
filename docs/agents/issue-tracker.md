# Issue tracker: Obsidian vault

Issues for Pulse live in the Obsidian vault at `C:\Users\mateu\Documents\Obsidian Vault`, as one markdown note per issue under the `Pulse/` folder.

## Issue format

Each issue is a note with YAML frontmatter:

```yaml
---
title: One-line summary
status: needs-triage        # one of the five triage roles (see triage-labels.md)
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: []
---
```

The body holds the full description, acceptance criteria, and links to related notes (as Obsidian wikilinks).

## Conventions

- **Create an issue**: write `Pulse/<kebab-case-slug>.md` with the frontmatter above.
- **Read an issue**: open the note.
- **List issues**: glob `Pulse/*.md` in the vault, filter by the `status` field.
- **Change status / labels**: edit the `status` / `tags` frontmatter.
- **Close an issue**: set `status: wontfix` (won't action), or move a resolved note to `Pulse/Archive/`.
- **Link related issues**: Obsidian wikilinks (`[[slug]]`).

## When a skill says "publish to the issue tracker"

Create a new note under `Pulse/` in the vault.

## When a skill says "fetch the relevant ticket"

Read `Pulse/<slug>.md` for the issue in question.
