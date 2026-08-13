# Appearance Screen Design

Moves the theme + accent picker out of the Settings screen into its own full-screen sub-page, so Settings stays short.

## Context

The Settings screen's APPEARANCE card now holds 16 theme swatches (6 solid + 10 gradient, split into two labeled groups) plus the accent color picker — roughly 50 lines of UI in the middle of the screen. The user wants that replaced by a single option that opens the picker on its own page, since the card takes too much space.

## Decision: full-screen sub-page inside SettingsScreen

Tapping a new "Appearance" row swaps SettingsScreen's rendered content to a full-screen picker page with a back button (Approach A — chosen explicitly over a new top-level Router route). This keeps:

- the TabDock visible with Settings active,
- the Settings screen mounted underneath (instant back, no state loss),
- no Router/App.jsx changes.

It mirrors the existing "What's new" pattern of Settings-owned overlays rather than a top-level destination.

## Settings screen changes

- The APPEARANCE card (theme groups + accent row) is removed from the main view.
- An APPEARANCE group replaces it, containing a single `Row`:
  - Palette icon (`bg-accent/15`), title **Appearance**,
  - subtitle = current theme name (`themeById(store.settings.theme).name`),
  - right side = a swatch chip (h-8 w-8, rounded-[10px], matching the Row icon shape) showing the current theme's gradient — same 2/3-stop formula as `ThemeSwatch` — instead of the chevron.
- Tapping the row opens the Appearance page.
- Section order stays: DATA & ACCOUNT → APPEARANCE → Neko → SYNC & ABOUT.

## Appearance page

Full-screen content rendered in place of the Settings list when the sub-view is active:

- Header: back button (ChevronLeft icon in a h-9 w-9 rounded-full bg-tile button, top-left, aria-label "Back") + title **Appearance** (26px bold, matching Settings) + subtitle "Theme, gradients & accent color".
- The picker content moved verbatim from the current card, in the same order: Theme label + current name, 6-theme grid, GRADIENTS label, 10-swatch grid, Accent color + 5 circles + "Saved on this device" note. `ThemeSwatch` and the accent-circle markup are reused unchanged.

## Implementation

- `src/screens/SettingsScreen.jsx` only — no Router, store, or lib changes (theme/accent are already persisted via `setSettings`).
- `const [view, setView] = useState('main')`; `view === 'appearance'` renders the page, back sets `'main'`.
- Modals (AuthModal, sign-out confirm) and the changelog sheet remain mounted regardless of the active sub-view (they are only reachable from the main view).

## Testing

No new lib surface — no `themes.js`/store changes, so no new unit tests. Verification:

- `npx oxlint` (no new warnings), `npx vite build` (clean).
- Manual pass: open Appearance from Settings; switch themes (all 16) and accent colors; back button returns to Settings with the row's swatch chip and name updated; gradient themes still render correctly on all screens.

## Known quirks (accepted)

- Returning from the page resets the Settings scroll position to the top (no scroll restoration — prototype-appropriate).

## Out of scope

- Scroll-position restoration on back.
- Router-level navigation for Appearance.
- Rearranging the remaining Settings groups.
