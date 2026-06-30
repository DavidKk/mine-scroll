import type { ModeSession } from '../../types.ts'
import { ENDLESS_SCROLL_BATCH_MAX, ENDLESS_SCROLL_DECAY, ENDLESS_SCROLL_MS_MIN, ENDLESS_SCROLL_MS_START } from './constants.ts'
import type { EndlessDifficultyPreset, EndlessDifficultyPresetId } from './presets.ts'
import { getEndlessPresetForSession, resolveScrollPreset } from './presets.ts'

export type EndlessScrollStepKind = 'speed' | 'batch'

export interface EndlessScrollProfile {
  intervalMs: number
  batchRows: number
  step: number
  nextStepKind: EndlessScrollStepKind
  nextStepInMs: number
  speedTier: number
  batchTier: number
  presetId: EndlessDifficultyPresetId
}

export function getEndlessScrollProfile(elapsedMs: number, presetOrId?: EndlessDifficultyPreset | EndlessDifficultyPresetId): EndlessScrollProfile {
  const preset = resolveScrollPreset(presetOrId)
  const elapsed = Math.max(0, elapsedMs)
  const { scrollStepMs, scrollIntervalTiersMs, scrollBatchTiers } = preset
  const step = Math.floor(elapsed / scrollStepMs)
  const speedTier = Math.min(scrollIntervalTiersMs.length - 1, Math.floor((step + 1) / 2))
  const batchTier = Math.min(scrollBatchTiers.length - 1, Math.floor(step / 2))
  const nextStep = step + 1
  const nextBatchTier = Math.min(scrollBatchTiers.length - 1, Math.floor(nextStep / 2))
  const nextStepKind: EndlessScrollStepKind = nextBatchTier > batchTier ? 'batch' : 'speed'

  return {
    intervalMs: scrollIntervalTiersMs[speedTier]!,
    batchRows: scrollBatchTiers[batchTier]!,
    step,
    nextStepKind,
    nextStepInMs: scrollStepMs - (elapsed % scrollStepMs),
    speedTier,
    batchTier,
    presetId: preset.id,
  }
}

export function getEndlessScrollProfileForSession(session: ModeSession, elapsedMs: number): EndlessScrollProfile {
  return getEndlessScrollProfile(elapsedMs, getEndlessPresetForSession(session))
}

/** Leaving-row width for the current scroll tier (client-synced or estimated from depth). */
export function resolveScrollBatchRowsForSession(session: ModeSession, elapsedMs?: number): number {
  if (session.scrollBatchRows != null && session.scrollBatchRows > 0) {
    return Math.max(1, Math.min(ENDLESS_SCROLL_BATCH_MAX, session.scrollBatchRows))
  }
  if (elapsedMs != null) {
    return getEndlessScrollProfileForSession(session, elapsedMs).batchRows
  }
  const preset = getEndlessPresetForSession(session)
  const step = session.scrollRowCount ?? 0
  const batchTier = Math.min(preset.scrollBatchTiers.length - 1, Math.floor(step / 2))
  return preset.scrollBatchTiers[batchTier]!
}

export function getEndlessScrollIntervalMsFromElapsed(elapsedMs: number, presetOrId?: EndlessDifficultyPreset | EndlessDifficultyPresetId): number {
  return getEndlessScrollProfile(elapsedMs, presetOrId).intervalMs
}

export function formatEndlessScrollHud(profile: EndlessScrollProfile): string {
  const sec = Math.ceil(profile.intervalMs / 1000)
  const batchNote = profile.batchRows > 1 ? `×${profile.batchRows}` : ''
  return `↑${String(sec).padStart(2, '0')}${batchNote}`
}

export function formatEndlessScrollBadge(profile: EndlessScrollProfile): string {
  const preset = resolveScrollPreset(profile.presetId)
  const nextSec = Math.ceil(profile.nextStepInMs / 1000)
  if (profile.nextStepKind === 'batch') {
    const nextBatch = preset.scrollBatchTiers[Math.min(profile.batchTier + 1, preset.scrollBatchTiers.length - 1)]!
    return `Next tier ${nextSec}s · batch → ×${nextBatch} rows`
  }
  const nextInterval = preset.scrollIntervalTiersMs[Math.min(profile.speedTier + 1, preset.scrollIntervalTiersMs.length - 1)]!
  return `Next tier ${nextSec}s · faster → ${(nextInterval / 1000).toFixed(1)}s`
}

/** @deprecated */
export function getEndlessScrollIntervalMs(scrollRowCount: number): number {
  const depth = Math.max(0, scrollRowCount)
  const raw = ENDLESS_SCROLL_MS_START * ENDLESS_SCROLL_DECAY ** depth
  return Math.max(ENDLESS_SCROLL_MS_MIN, Math.round(raw))
}

export function getEndlessScrollCountdownSeconds(deadlineAt: number, now = Date.now()): number {
  if (deadlineAt <= 0) return 0
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000))
}

export interface EndlessScrollPressure {
  seconds: number
  progress: number
  urgent: boolean
}

export function getEndlessScrollPressure(deadlineAt: number, intervalMs: number, now = Date.now()): EndlessScrollPressure | undefined {
  if (deadlineAt <= 0 || intervalMs <= 0) return undefined
  const remainingMs = deadlineAt - now
  if (remainingMs <= 0) return undefined

  const seconds = Math.max(1, Math.ceil(remainingMs / 1000))
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / intervalMs))

  return {
    seconds,
    progress,
    urgent: remainingMs <= 3000,
  }
}
