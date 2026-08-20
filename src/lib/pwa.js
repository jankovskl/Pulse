// Web-install ("PWA install button") predicates. Pure and dependency-injected
// so the contract is testable with mocks — mirroring the sync.js pattern.
// The two install kinds are defined in CONTEXT.md: "web install" (browser
// add-to-home-screen of the web build) vs "desktop install" (the Tauri
// installer + auto-update). Everything here faces web install only.

// The Tauri 2 runtime injects __TAURI_INTERNALS__ into the window regardless
// of whether @tauri-apps/api is imported. Inside the desktop shell the browser
// install prompt does not exist and the app already owns its entry, so the
// web-install affordance must hide there.
export function isDesktop(window) {
  return Boolean(window && window.__TAURI_INTERNALS__)
}

// A web app is "installed" (display-mode: standalone) the moment it runs full-
// screen from a launcher icon — true on Android/desktop Chrome once added. This
// is derived at runtime from the media query, never persisted: an installed
// app needs no install button, and a user who uninstalls from the OS must see
// the prompt again without a stale flag contradicting reality. Browsers without
// window.matchMedia degrade to false (treated as not installed) — the affordance
// then shows redundantly but never wrongly. No UA fallback by design: the
// platforms that matter implement the query, and guessing invites false hits.
export function isInstalled(mediaMatch) {
  return typeof mediaMatch === 'function' && mediaMatch('(display-mode: standalone)')
}

// The whole affordance — banner + Settings row — only shows when web install is
// both relevant (not already done) and possible (not the native desktop shell).
export function shouldOffer(window, mediaMatch) {
  return !isDesktop(window) && !isInstalled(mediaMatch)
}