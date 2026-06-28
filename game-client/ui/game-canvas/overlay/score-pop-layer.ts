import { GAME_ASSET_TUNING } from '../../game-assets.ts'
import {
  createScorePopFallbackDrawer,
  drawScorePopV3,
  isScorePopFxVisible,
  resolveScorePopV3RuntimeLayout,
  type ScorePopFxProgress,
  scorePopRuntimeProgress,
  type ScorePopV3Layer,
} from '../../hud-feedback-fx.ts'
import { FONTS } from '../../theme.ts'
import { HUD_FEEDBACK_ASSETS } from '../assets/hud-feedback-assets.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { hudFxBudget } from '../runtime/paint-helpers.ts'
import { getBottomFeedbackSlots } from '../runtime/particle-system.ts'

export function resolveActiveScorePopProgress(rt: GameCanvasRuntime): ScorePopFxProgress | null {
  if (!rt.state.activeScoreEvent || rt.state.scoreFxStartedAt <= 0) return null
  const durationMs = GAME_ASSET_TUNING.fx.scorePop.durationMs
  const progress = scorePopRuntimeProgress(performance.now() - rt.state.scoreFxStartedAt, durationMs)
  if (progress.t >= 1) {
    rt.state.activeScoreEvent = null
    rt.state.scoreFxStartedAt = 0
    return null
  }
  return progress
}

export function drawScorePopV3Layer(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, shellW: number, shellH: number, layer: ScorePopV3Layer): void {
  const progress = resolveActiveScorePopProgress(rt)
  if (!progress || !rt.state.activeScoreEvent) return
  const stageScale = rt.state.stageLayout?.scale ?? 1
  const slots = getBottomFeedbackSlots(rt)
  drawScorePopV3(shellCtx, {
    canvasW: shellW,
    canvasH: shellH,
    progress,
    layout: resolveScorePopV3RuntimeLayout(slots.comboBurst, slots.scorePop, shellW, progress, stageScale),
    layer,
    comboTier: rt.state.activeScoreEvent.comboAfter,
    scoreText: `+${rt.state.activeScoreEvent.scoreAdded}`,
    scoreStrip: HUD_FEEDBACK_ASSETS.scoreStrip,
    scorePopBase: HUD_FEEDBACK_ASSETS.scorePopBase,
    fontFamily: FONTS.mono,
    hudFxBudget: hudFxBudget(rt),
    drawFallbackFx: createScorePopFallbackDrawer(stageScale),
  })
  if (layer !== 'strip' && isScorePopFxVisible(progress)) rt.scheduleAnimationFrame()
}
