import {
  MOBILE_LIVES_LIFT_ROWS,
  MOBILE_LIVES_SIZE_SCALE,
  MOBILE_LIVES_X_NUDGE,
  MOBILE_LIVES_Y_NUDGE,
  MOBILE_SCORE_LIVES_GAP,
  MOBILE_SCORE_PANEL_SCALE,
} from '../../game-stage-layout.ts'
import { drawLivesRow, type LivesDisplay, parseLivesDisplay } from '../../hud-sprites.ts'
import { FONTS } from '../../theme.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'

export function drawLivesHud(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, x: number, y: number, raw: string | undefined, scale: number): void {
  const lives = parseLivesDisplay(raw)
  if (!lives) return
  const metrics = hudHeartRowMetrics(rt, x, y, lives, scale)
  shellCtx.save()
  shellCtx.shadowColor = 'rgba(248, 113, 113, 0.44)'
  shellCtx.shadowBlur = 12 * scale
  if (!drawLivesRow(shellCtx, metrics.x, metrics.cy, lives, metrics.iconSize, metrics.gap)) {
    shellCtx.fillStyle = '#ef4444'
    shellCtx.font = `700 ${(rt.state.stageLayout?.profile === 'mobile' ? 32 : 16) * scale}px ${FONTS.mono}`
    shellCtx.textAlign = 'right'
    shellCtx.textBaseline = 'middle'
    shellCtx.fillText(raw ?? '', metrics.x, metrics.cy)
  }
  shellCtx.restore()
}

export function hudHeartIconSize(rt: GameCanvasRuntime, scale: number): number {
  const isMobile = rt.state.stageLayout?.profile === 'mobile'
  if (isMobile) {
    return Math.max(40, Math.min(56, 22 * scale * MOBILE_LIVES_SIZE_SCALE))
  }
  return Math.max(28, Math.min(38, 34 * scale))
}

/** Extra tightening vs nominal heart row gap (screen px). */
const HUD_HEART_GAP_TIGHTEN = 11

export function hudHeartGap(scale: number, isMobile = false): number {
  const base = Math.max(isMobile ? 1 : 5, (isMobile ? 2.5 : 7) * scale)
  if (!isMobile) return base
  // Slight negative gap — heart cutouts have transparent padding.
  return Math.max(-6, base - HUD_HEART_GAP_TIGHTEN)
}

export function hudHeartRowMetrics(
  rt: GameCanvasRuntime,
  anchorX: number,
  hudY: number,
  lives: LivesDisplay,
  scale: number
): { x: number; cy: number; iconSize: number; gap: number; rowW: number } {
  const isMobile = rt.state.stageLayout?.profile === 'mobile'
  const iconSize = hudHeartIconSize(rt, scale)
  const gap = hudHeartGap(scale, isMobile)
  const rowW = lives.max * iconSize + (lives.max - 1) * gap
  const scorePanelH = 66 * MOBILE_SCORE_PANEL_SCALE * scale
  const scorePanelBottom = hudY + 24 * MOBILE_SCORE_PANEL_SCALE * scale + scorePanelH / 2
  const baseCy = scorePanelBottom + MOBILE_SCORE_LIVES_GAP * scale + iconSize / 2
  return {
    x: isMobile ? anchorX + MOBILE_LIVES_X_NUDGE * scale : anchorX - rowW,
    cy: isMobile ? baseCy - iconSize * MOBILE_LIVES_LIFT_ROWS + MOBILE_LIVES_Y_NUDGE : hudY + 34 * scale,
    iconSize,
    gap,
    rowW,
  }
}
