import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_THEME, THEMES, themeById } from './themes.js'

const TOKEN_KEYS = ['bg', 'bg2', 'surface', 'card', 'tile', 'field', 'dock', 'ink', 'soft', 'sub', 'muted', 'faint', 'line', 'overlay', 'ring']

test('themes have unique ids', () => {
  const ids = THEMES.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('default theme exists', () => {
  assert.ok(THEMES.some((t) => t.id === DEFAULT_THEME))
})

test('every theme has every token key', () => {
  for (const t of THEMES) {
    for (const key of TOKEN_KEYS) {
      assert.ok(typeof t.colors[key] === 'string' && t.colors[key].length > 0, `${t.id}.${key} missing`)
    }
  }
})

test('every theme has a name and boolean glass flag', () => {
  for (const t of THEMES) {
    assert.ok(typeof t.name === 'string' && t.name.length > 0)
    assert.equal(typeof t.glass, 'boolean')
  }
})

test('light themes use dark line tokens, dark themes use light line tokens', () => {
  const light = themeById('light')
  const rose = themeById('rose')
  assert.equal(light.colors.line, '#000000')
  assert.equal(rose.colors.line, '#000000')
  assert.equal(themeById('dark').colors.line, '#FFFFFF')
})

test('unknown id falls back to the default theme', () => {
  assert.equal(themeById('nope').id, DEFAULT_THEME)
})

test('the default theme is the Lawrencium gradient', () => {
  assert.equal(DEFAULT_THEME, 'g-lawrencium')
})

test('gradient themes are glass with light ink', () => {
  const gradients = THEMES.filter((t) => t.id.startsWith('g-'))
  assert.ok(gradients.length >= 10, 'expected at least 10 gradient themes')
  for (const t of gradients) {
    assert.equal(t.glass, true, `${t.id} must be glass`)
    assert.equal(t.colors.ink, '#F4F4F6', `${t.id} must use light ink`)
    assert.ok(t.colors.bg.startsWith('#') && t.colors.bg2.startsWith('#'))
  }
})

test('three-stop themes declare a mid token between bg and bg2', () => {
  const withMid = THEMES.filter((t) => t.colors.mid)
  assert.deepEqual([...withMid.map((t) => t.id)].sort(), ['g-king-yna', 'g-lawrencium', 'g-moonlit-asteroid'])
  for (const t of withMid) assert.ok(t.colors.mid.startsWith('#'))
})

test('the muted gradient set stays dark enough for light ink to read', () => {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const muted = THEMES.filter((x) =>
    [
      'g-moss', 'g-under-the-lake', 'g-forest', 'g-royal', 'g-aubergine',
      'g-moonlit-asteroid', 'g-lawrencium', 'g-twitch', 'g-deep-purple', 'g-mauve',
      'g-frost', 'g-very-blue', 'g-clear-sky', 'g-terminal', 'g-vine', 'g-the-strain',
      'g-namn', 'g-flickr', 'g-dark-knight', 'g-army',
    ].includes(x.id))
  assert.equal(muted.length, 20)
  for (const t of muted) {
    const stops = [t.colors.bg, t.colors.mid, t.colors.bg2].filter(Boolean)
    const maxLum = Math.max(...stops.map(lum))
    // Mid-tone at most: Moss's #71B280 sits at ~0.63; anything past this is a
    // saturated neon color that fights the light gradient ink.
    assert.ok(maxLum <= 0.65, `${t.id} is too bright (peak stop luminance ${maxLum.toFixed(2)})`)
  }
})
