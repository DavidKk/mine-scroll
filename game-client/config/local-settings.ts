/** User preferences persisted on this device (localStorage). */

export interface LocalSettings {
  bgmMuted: boolean
}

export const LOCAL_SETTINGS_STORAGE_KEY = 'chill-local-settings'

export const DEFAULT_LOCAL_SETTINGS: Readonly<LocalSettings> = {
  bgmMuted: false,
}

function normalizeLocalSettings(raw: unknown): LocalSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LOCAL_SETTINGS }
  }
  const parsed = raw as Partial<LocalSettings>
  return {
    bgmMuted: typeof parsed.bgmMuted === 'boolean' ? parsed.bgmMuted : DEFAULT_LOCAL_SETTINGS.bgmMuted,
  }
}

export function loadLocalSettings(): LocalSettings {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_LOCAL_SETTINGS }
  }
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LOCAL_SETTINGS }
    return normalizeLocalSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_LOCAL_SETTINGS }
  }
}

export function saveLocalSettings(settings: LocalSettings): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LOCAL_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeLocalSettings(settings)))
}

/** Merge partial updates, persist, and return the saved snapshot. */
export function patchLocalSettings(patch: Partial<LocalSettings>): LocalSettings {
  const next = normalizeLocalSettings({ ...loadLocalSettings(), ...patch })
  saveLocalSettings(next)
  return next
}
