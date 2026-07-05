import assert from 'node:assert/strict'

import { DEFAULT_LOCAL_SETTINGS, loadLocalSettings, LOCAL_SETTINGS_STORAGE_KEY, patchLocalSettings, saveLocalSettings } from '../game-client/config/local-settings.ts'

function withMockStorage(run: () => void): void {
  const store = new Map<string, string>()
  const original = (globalThis as Record<string, unknown>).localStorage
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
  try {
    run()
  } finally {
    if (original === undefined) {
      delete (globalThis as Record<string, unknown>).localStorage
    } else {
      ;(globalThis as Record<string, unknown>).localStorage = original
    }
  }
}

export function testLocalSettingsDefaultsWhenMissing(): void {
  withMockStorage(() => {
    assert.deepEqual(loadLocalSettings(), { ...DEFAULT_LOCAL_SETTINGS })
  })
}

export function testLocalSettingsRoundTrip(): void {
  withMockStorage(() => {
    saveLocalSettings({ bgmMuted: true, soundMuted: true })
    assert.deepEqual(loadLocalSettings(), { bgmMuted: true, soundMuted: true })
    const raw = localStorage.getItem(LOCAL_SETTINGS_STORAGE_KEY)
    assert.ok(raw)
    assert.equal(JSON.parse(raw!).bgmMuted, true)
    assert.equal(JSON.parse(raw!).soundMuted, true)
  })
}

export function testLocalSettingsPatchPersists(): void {
  withMockStorage(() => {
    const saved = patchLocalSettings({ bgmMuted: true })
    assert.deepEqual(saved, { bgmMuted: true })
    assert.deepEqual(loadLocalSettings(), { bgmMuted: true })
    patchLocalSettings({ bgmMuted: false })
    assert.deepEqual(loadLocalSettings(), { bgmMuted: false })
  })
}

export function testLocalSettingsIgnoresInvalidPayload(): void {
  withMockStorage(() => {
    localStorage.setItem(LOCAL_SETTINGS_STORAGE_KEY, '{"bgmMuted":"yes","soundMuted":"no"}')
    assert.deepEqual(loadLocalSettings(), { ...DEFAULT_LOCAL_SETTINGS })
    localStorage.setItem(LOCAL_SETTINGS_STORAGE_KEY, 'not-json')
    assert.deepEqual(loadLocalSettings(), { ...DEFAULT_LOCAL_SETTINGS })
  })
}
