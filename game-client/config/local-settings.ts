/** User preferences persisted on this device (localStorage). */

export interface LocalSettings {
  bgmMuted: boolean
  /** Landing attract demo + page-level SFX mute (separate from in-game BGM HUD). */
  soundMuted: boolean
}

export const LOCAL_SETTINGS_STORAGE_KEY = 'chill-local-settings'

export const LOCAL_SETTINGS_CHANGE_EVENT = 'chill-local-settings-change'

/** User gesture on landing sound toggle — unlock Web Audio / HTMLAudio playback. */
export const LANDING_AUDIO_UNLOCK_EVENT = 'chill-landing-audio-unlock'

export const DEFAULT_LOCAL_SETTINGS: Readonly<LocalSettings> = {
  bgmMuted: false,
  soundMuted: false,
}

function normalizeLocalSettings(raw: unknown): LocalSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LOCAL_SETTINGS }
  }
  const parsed = raw as Partial<LocalSettings>
  return {
    bgmMuted: typeof parsed.bgmMuted === 'boolean' ? parsed.bgmMuted : DEFAULT_LOCAL_SETTINGS.bgmMuted,
    soundMuted: typeof parsed.soundMuted === 'boolean' ? parsed.soundMuted : DEFAULT_LOCAL_SETTINGS.soundMuted,
  }
}

function dispatchLocalSettingsChange(settings: LocalSettings): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<LocalSettings>(LOCAL_SETTINGS_CHANGE_EVENT, { detail: settings }))
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
  const next = normalizeLocalSettings(settings)
  localStorage.setItem(LOCAL_SETTINGS_STORAGE_KEY, JSON.stringify(next))
  dispatchLocalSettingsChange(next)
}

/** Merge partial updates, persist, and return the saved snapshot. */
export function patchLocalSettings(patch: Partial<LocalSettings>): LocalSettings {
  const next = normalizeLocalSettings({ ...loadLocalSettings(), ...patch })
  saveLocalSettings(next)
  return next
}
