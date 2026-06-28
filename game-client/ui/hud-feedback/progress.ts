import { GAME_ASSET_TUNING } from '../game-assets.ts'
import { clamp01, easeOutBack, easeOutCubic } from '../primitives/index.ts'
import { getComboHudTier } from './combo-palette.ts'
import type { ComboBurstFxProgress, ScorePopFxProgress } from './types.ts'

export const SCORE_POP_FX_MS = GAME_ASSET_TUNING.fx.scorePop.durationMs
export const COMBO_BURST_FX_MS = GAME_ASSET_TUNING.fx.comboBurst.durationMs

/** Hold through ~55%, then smooth fade to zero by t=1. */
function comboBurstFadeAlpha(t: number, exitStart = 0.55): number {
  if (t <= exitStart) return 1
  return 1 - easeOutCubic((t - exitStart) / (1 - exitStart))
}

export function scorePopRuntimeProgress(elapsedMs: number, durationMs = SCORE_POP_FX_MS): ScorePopFxProgress {
  const t = clamp01(elapsedMs / durationMs)
  const alpha = Math.max(0, 1 - t)
  const pop = 1 + Math.sin(Math.min(1, t * 2.2) * Math.PI) * 0.12
  return { t, alpha, pop, fireflyFade: alpha * Math.min(1, t * 4.5) }
}

export function scorePopPreviewProgress(tMs: number, durationMs = SCORE_POP_FX_MS): ScorePopFxProgress {
  const t = (tMs % durationMs) / durationMs
  const alpha = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28
  const pop = 0.88 + Math.sin(t * Math.PI) * 0.08
  return { t, alpha, pop, fireflyFade: alpha * Math.min(1, t * 4.5) }
}

export function comboBurstRuntimeProgress(elapsedMs: number, _combo: number, durationMs = COMBO_BURST_FX_MS): ComboBurstFxProgress {
  const t = clamp01(elapsedMs / durationMs)
  const alpha = comboBurstFadeAlpha(t)
  const maxScale = GAME_ASSET_TUNING.fx.comboBurst.maxScale
  const pop = 1.12 + Math.sin(Math.min(1, t * 2.5) * Math.PI) * (maxScale - 1)
  const exitScale = alpha < 1 ? 0.9 + alpha * 0.1 : 1
  const burstScale = Math.max(0.9, Math.min(maxScale, pop)) * exitScale
  return {
    t,
    alpha,
    fade: alpha,
    hit: clamp01(t / 0.24),
    burstScale,
    shakeX: 0,
    fireflyFade: alpha,
  }
}

export function comboBurstPreviewProgress(tMs: number, combo: number, durationMs = COMBO_BURST_FX_MS, canvasMin = 240): ComboBurstFxProgress {
  const t = (tMs % durationMs) / durationMs
  const hit = clamp01(t / 0.24)
  const fade = comboBurstFadeAlpha(t)
  const burstScale = (0.82 + easeOutBack(hit) * 0.28) * (fade < 1 ? 0.9 + fade * 0.1 : 1)
  const shakeX = getComboHudTier(combo) >= 2 && t < 0.25 ? Math.sin(t * Math.PI * 32) * (1 - t / 0.25) * canvasMin * 0.012 : 0
  return {
    t,
    alpha: fade,
    fade,
    hit,
    burstScale,
    shakeX,
    fireflyFade: fade,
  }
}

export function isScorePopFxVisible(progress: ScorePopFxProgress): boolean {
  return progress.alpha > 0.008
}

export function isComboBurstFxVisible(progress: ComboBurstFxProgress): boolean {
  return progress.alpha > 0.008
}
