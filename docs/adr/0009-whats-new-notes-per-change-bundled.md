# What's new notes are authored per change and shipped bundled

The changelog (ADR 0007) is plain markdown bullets — right for a ledger, wrong for the visual What's new popup we now show on the first launch after an update. The popup needs structured items (icon, headline, blurb, optional tutorial link), which the changelog doesn't carry. We decided: those **What's new notes** are a separate structured list in `src/lib/whatsNew.js`, authored **per change** — the same commit that adds a changelog bullet and a tutorial step adds a notes item with `since: UNRELEASED` — and the release cut stamps versions across all three, exactly as it already does for tutorial steps. The notes are **bundled into the build**, never fetched: the popup and the "New" pill trigger purely from the app's own bundled notes, so a long-open web tab on an old build never shows a half-populated popup.

## Considered Options

- **Scaffold at release time** (`npm run release` generates items from the new changelog section, human tweaks): one batch to review, but copy is written cold from bullets, weeks after the feature was understood. Rejected in favor of per-change authoring, which matches the established tutorial-steps idiom and keeps the standing rule "one commit, all three artifacts".
- **Auto-derive items from changelog bullets** (heuristic icons): zero authoring, but icons would be generic and the phrasing is ledger-prose, not marketing-prose. Rejected.
- **Fetch notes live like the changelog**: news could ship without an app update — but the popup is a first-impression moment that must never fail or render partially on first paint, and it only ever fires right after an update, when the bundled copy is by definition current. Rejected.

## Consequences

- The trigger is the notes' **content fingerprint**, not the version number: any change to the notes — a release cut, an added or reworded item — announces itself on the next launch, so nothing the notes promise can go unheralded. Dismissal records both the acknowledged version and the seen fingerprint (`pulse.whatsnew.seen.<userId>`).
- The drift check gains teeth here: every released version must have ≥1 notes item (or be explicitly marked internal-only), every item's `tutorial` id must resolve to a real step, and every item needs icon + title + body. A release with no user-visible items adds no news, so it shows no popup and lights no pill — "news" is defined by notes items, not by changelog versions.
- The live-fetched changelog keeps its role inside the screen's collapsed "Past releases" section; only the *trigger* moved to bundled-only.
- State stays per-device localStorage, as before.
