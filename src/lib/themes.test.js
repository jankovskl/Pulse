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

test('unknown id falls back to dark', () => {
  assert.equal(themeById('nope').id, DEFAULT_THEME)
})
