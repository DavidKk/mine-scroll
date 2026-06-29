import type { ModeSession } from '../../types.ts'

/** Arcade / local play — tuned for skilled human players. */
export type EndlessDifficultyPresetId = 'challenge' | 'expert'

export interface EndlessDifficultyPreset {
  id: EndlessDifficultyPresetId
  label: string
  scrollStepMs: number
  scrollIntervalTiersMs: readonly number[]
  scrollBatchTiers: readonly number[]
  lives: number
}

export const CHALLENGE_PRESET: EndlessDifficultyPreset = {
  id: 'challenge',
  label: 'Challenge',
  scrollStepMs: 50_000,
  scrollIntervalTiersMs: [9000, 7800, 6700, 5800, 5000, 4300, 3700, 3200, 2800, 3000],
  scrollBatchTiers: [1, 2, 3, 4, 4],
  lives: 5,
}

/** Ranked-only curve — faster tiers and ×5 batch; AI-calibrated, not default for humans. */
export const EXPERT_PRESET: EndlessDifficultyPreset = {
  id: 'expert',
  label: 'Expert',
  scrollStepMs: 50_000,
  scrollIntervalTiersMs: [9000, 7500, 6300, 5300, 4500, 3800, 3200, 2700, 2300, 2000, 1500],
  scrollBatchTiers: [1, 2, 3, 4, 5],
  lives: 5,
}

export const ENDLESS_DIFFICULTY_PRESETS: Record<EndlessDifficultyPresetId, EndlessDifficultyPreset> = {
  challenge: CHALLENGE_PRESET,
  expert: EXPERT_PRESET,
}

/** Default for local / arcade endless — human advanced tier. */
export const DEFAULT_ARCADE_PRESET_ID: EndlessDifficultyPresetId = 'challenge'

/** Ranked runs always replay and play on expert. */
export const RANKED_PRESET_ID: EndlessDifficultyPresetId = 'expert'

export function getEndlessDifficultyPreset(id: EndlessDifficultyPresetId): EndlessDifficultyPreset {
  return ENDLESS_DIFFICULTY_PRESETS[id]
}

export function resolveScrollPreset(presetOrId?: EndlessDifficultyPreset | EndlessDifficultyPresetId): EndlessDifficultyPreset {
  if (!presetOrId) return getEndlessDifficultyPreset(DEFAULT_ARCADE_PRESET_ID)
  if (typeof presetOrId === 'string') return getEndlessDifficultyPreset(presetOrId)
  return presetOrId
}

export function getEndlessPresetForSession(session: ModeSession): EndlessDifficultyPreset {
  const id = session.endlessPresetId ?? DEFAULT_ARCADE_PRESET_ID
  return getEndlessDifficultyPreset(id)
}

export function getPresetMinIntervalMs(preset: EndlessDifficultyPreset): number {
  return preset.scrollIntervalTiersMs[preset.scrollIntervalTiersMs.length - 1]!
}

export function getPresetMaxBatchRows(preset: EndlessDifficultyPreset): number {
  return preset.scrollBatchTiers[preset.scrollBatchTiers.length - 1]!
}
