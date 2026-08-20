import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDesktop, isInstalled, shouldOffer } from './pwa.js'

test('isDesktop is true only when the Tauri runtime marks the window', () => {
  assert.equal(isDesktop(null), false)
  assert.equal(isDesktop({}), false)
  assert.equal(isDesktop({ __TAURI_INTERNALS__: {} }), true)
})

test('isInstalled derives from the display-mode media query, not a stored flag', () => {
  // A standalone PWA (installed on Android/desktop Chrome) matches
  // (display-mode: standalone); an in-browser tab does not.
  assert.equal(isInstalled(() => true), true)
  assert.equal(isInstalled(() => false), false)
  assert.equal(isInstalled(undefined), false)
})

test('shouldOffer hides anywhere install is impossible or already done', () => {
  // Desktop Tauri shell: no browser install prompt, hide.
  assert.equal(shouldOffer({ __TAURI_INTERNALS__: {} }, () => false), false)
  // Already installed: display-mode is standalone, hide.
  assert.equal(shouldOffer({}, () => true), false)
  // Plain web tab, not installed: offer the button/banner.
  assert.equal(shouldOffer({}, () => false), true)
})