import { paintStageBg } from '../../ui/cell-fx/gallery-preview-scenes.ts'
import { HUD_FEEDBACK_ASSETS } from '../../ui/game-canvas/assets/hud-feedback-assets.ts'
import { drawFeedbackAsset, drawSheetFrameContained } from '../../ui/game-canvas/hud/canvas-primitives.ts'
import { drawComboHud } from '../../ui/game-canvas/hud/combo-hud.ts'
import { drawScoreHud } from '../../ui/game-canvas/hud/score-hud.ts'
import { drawLifeLossSlash } from '../../ui/game-canvas/overlay/life-loss-event.ts'
import type { GameCanvasRuntime } from '../../ui/game-canvas/runtime/context.ts'
import {
  comboBurstPreviewProgress,
  drawComboBurstV3,
  drawScorePopV3,
  resolveComboBurstV3PreviewLayout,
  resolveScorePopV3PreviewLayout,
  scorePopPreviewProgress,
} from '../../ui/hud-feedback-fx.ts'
import { clamp01, easeOutCubic, roundedRectPath } from '../../ui/primitives/index.ts'
import { COMBO_BURST_V3_MS, HUD_ALERT_V3_MS, HUD_FEEDBACK_V3_MS, LIFE_LOSS_POPUP_V3_MS, SCORE_POP_V3_MS } from './cell-effect-panels.ts'

export type { CellMode, LivePreview, MineMode, PanelConceptKind } from '../../ui/cell-fx/gallery-preview-scenes.ts'
export {
  breathPhase,
  drawBoardV3InteractionScene,
  drawCellScene,
  drawDigitParticles,
  drawDigitScene,
  drawFlagPlaceScene,
  drawFlagScene,
  drawHeartRefillV3Scene,
  drawHeartStaticV3Scene,
  drawHiddenCellWithEffect,
  drawMineHitV3Scene,
  drawMineScene,
  drawOpenCell,
  drawPanelV3Scene,
  drawWrongFlagV3Scene,
  hoverStateOpts,
  initPreviewCanvas,
  layoutCell,
  measurePreviewCanvas,
  mixOpts,
  paintStageBg,
  startPreviewLoop,
} from '../../ui/cell-fx/gallery-preview-scenes.ts'

const PREVIEW_RT = { state: {} } as GameCanvasRuntime

function drawScoreHudV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number, score = '39160'): void {
  paintStageBg(ctx, w, h)
  const scale = w / 390
  PREVIEW_RT.state.scoreFxStartedAt = tMs - (tMs % HUD_FEEDBACK_V3_MS)
  PREVIEW_RT.state.lastDisplayedScore = Number(score)
  drawScoreHud(PREVIEW_RT, ctx, w / 2 - 118 * scale, h * 0.52 - 27 * scale, Number(score), scale)
}

function drawComboHudV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, _tMs: number, combo = 18): void {
  paintStageBg(ctx, w, h)
  const scale = w / 390
  drawComboHud(PREVIEW_RT, ctx, w / 2, h * 0.52 - 28 * scale, combo, scale)
}

function drawScorePopV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): void {
  paintStageBg(ctx, w, h)
  const progress = scorePopPreviewProgress(tMs, SCORE_POP_V3_MS)
  const layout = resolveScorePopV3PreviewLayout(w, h, progress)
  const chipX = (w - layout.chipW) / 2
  const chipY = layout.stripTopY

  drawScorePopV3(ctx, {
    canvasW: w,
    canvasH: h,
    progress,
    layout,
    comboTier: 10,
    scoreText: '+320',
    scoreStrip: HUD_FEEDBACK_ASSETS.scoreStrip,
    scorePopBase: HUD_FEEDBACK_ASSETS.scorePopBase,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    drawStripFallback: (stripCtx) => {
      if (HUD_FEEDBACK_ASSETS.scoreStrip.complete && HUD_FEEDBACK_ASSETS.scoreStrip.naturalWidth > 0) return
      stripCtx.save()
      stripCtx.fillStyle = 'rgba(15, 23, 42, 0.82)'
      stripCtx.fillRect(chipX, chipY, layout.chipW, layout.chipH)
      stripCtx.restore()
    },
  })
}

function drawComboBurstV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number, combo = 24): void {
  paintStageBg(ctx, w, h)
  const progress = comboBurstPreviewProgress(tMs, combo, COMBO_BURST_V3_MS, Math.min(w, h))
  const layout = resolveComboBurstV3PreviewLayout(w, h)

  drawComboBurstV3(ctx, {
    canvasW: w,
    canvasH: h,
    combo,
    progress,
    layout,
    fontFamilyMono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontFamilyDisplay: 'system-ui, sans-serif',
  })
}

function drawLifeLossPopupV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): void {
  paintStageBg(ctx, w, h)
  const progress = (tMs % LIFE_LOSS_POPUP_V3_MS) / LIFE_LOSS_POPUP_V3_MS
  const popupProgress = clamp01((progress - 0.1) / 0.16)
  const enter = easeOutCubic(popupProgress)
  const exit = progress > 0.78 ? easeOutCubic(clamp01((progress - 0.78) / 0.22)) : 0
  const alpha = enter * (1 - exit)
  const impact = progress < 0.34 ? 1 - easeOutCubic(progress / 0.34) : 0
  const frameIndex = Math.min(3, Math.floor(progress * 4))
  const shake = Math.sin(progress * Math.PI * 30) * impact * Math.min(w, h) * 0.012
  const lift = Math.sin(clamp01(progress) * Math.PI) * h * 0.035
  const cx = w / 2 + shake
  const cy = h * 0.54 - lift

  const flash = progress < 0.2 ? 1 - progress / 0.2 : 0
  if (flash > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = flash * (0.2 + impact * 0.1)
    ctx.fillStyle = '#ff263f'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = flash * (0.28 + impact * 0.12)
    const flashGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.72)
    flashGlow.addColorStop(0, 'rgba(255, 240, 220, 0.58)')
    flashGlow.addColorStop(0.32, 'rgba(255, 54, 72, 0.38)')
    flashGlow.addColorStop(1, 'rgba(255, 54, 72, 0)')
    ctx.fillStyle = flashGlow
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  const slashProgress = clamp01(progress / 0.36)
  drawLifeLossSlash(PREVIEW_RT, ctx, cx, cy, Math.min(w * 0.82, h * 2.4), slashProgress, 0.9, Math.min(w, h) / 220)

  const asset = drawSheetFrameContained(
    PREVIEW_RT,
    ctx,
    HUD_FEEDBACK_ASSETS.lifeLossPopupSheet,
    frameIndex,
    4,
    cx,
    cy,
    w * 0.94,
    h * 0.52,
    0.94 + enter * 0.04 + impact * 0.12,
    alpha
  )

  const bounds = asset ?? {
    x: w * 0.18,
    y: h * 0.35,
    w: w * 0.64,
    h: h * 0.28,
  }

  if (!asset) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowColor = 'rgba(255, 58, 74, 0.74)'
    ctx.shadowBlur = 16 + impact * 8
    roundedRectPath(ctx, bounds.x, bounds.y, bounds.w, bounds.h, bounds.h * 0.28)
    const bg = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h)
    bg.addColorStop(0, 'rgba(56, 16, 24, 0.94)')
    bg.addColorStop(0.52, 'rgba(18, 10, 18, 0.96)')
    bg.addColorStop(1, 'rgba(80, 18, 28, 0.9)')
    ctx.fillStyle = bg
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 68, 86, 0.84)'
    ctx.lineWidth = Math.max(1.2, bounds.h * 0.035)
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 14; i += 1) {
    const seed = i * 1.913
    const t = (progress * 1.25 + i * 0.071) % 1
    const side = i % 2 === 0 ? -1 : 1
    const px = cx + side * (bounds.w * (0.2 + t * 0.42)) + Math.sin(seed) * bounds.w * 0.04
    const py = cy + Math.sin(seed * 2.1 + progress * 7) * bounds.h * 0.34
    const sparkAlpha = alpha * Math.sin(t * Math.PI) * 0.76
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 196, 86, ${sparkAlpha})` : `rgba(255, 64, 82, ${sparkAlpha})`
    ctx.beginPath()
    ctx.arc(px, py, Math.max(1.2, Math.min(w, h) * (0.006 + impact * 0.002)), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `1000 ${Math.min(bounds.h * 0.34, h * 0.18)}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.lineWidth = Math.max(2, bounds.h * 0.05)
  ctx.strokeStyle = 'rgba(3, 7, 18, 0.94)'
  ctx.shadowColor = 'rgba(255, 58, 74, 0.92)'
  ctx.shadowBlur = 10 + impact * 8
  ctx.strokeText('LIFE -1', bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.52)
  ctx.fillStyle = '#ffe6e0'
  ctx.fillText('LIFE -1', bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.52)
  ctx.restore()
}

type HudAlertKind = 'speed-up' | 'danger-rise'

function drawSpeedUpChevronStreaks(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  progress: number,
  alpha: number,
  canvasW: number,
  canvasH: number
): void {
  const main = '255, 190, 55'
  const soft = '45, 236, 255'

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha
  for (let i = 0; i < 12; i += 1) {
    const p = (progress + i * 0.071) % 1
    const px = bounds.x + bounds.w * (0.18 + p * 0.64)
    const py = bounds.y + bounds.h * (0.36 + Math.sin(i) * 0.12)
    ctx.fillStyle = i % 3 === 0 ? `rgba(${main}, ${alpha * (1 - p)})` : `rgba(${soft}, ${alpha * 0.72 * (1 - p)})`
    ctx.fillRect(px, py, Math.max(1.2, canvasW * 0.004), Math.max(1.2, canvasH * 0.004))
    ctx.fillRect(px - canvasW * 0.018, py, canvasW * 0.016, Math.max(1, canvasH * 0.003))
  }
  ctx.restore()
}

function drawSpeedUpChevronFxScene(ctx: CanvasRenderingContext2D, w: number, h: number, tMs: number): void {
  ctx.fillStyle = '#07080f'
  ctx.fillRect(0, 0, w, h)

  const progress = (tMs % HUD_ALERT_V3_MS) / HUD_ALERT_V3_MS
  const lane = { x: w * 0.06, y: h * 0.34, w: w * 0.88, h: h * 0.32 }

  ctx.save()
  ctx.strokeStyle = 'rgba(45, 236, 255, 0.14)'
  ctx.lineWidth = 1
  ctx.setLineDash([6, 8])
  ctx.strokeRect(lane.x, lane.y, lane.w, lane.h)
  ctx.restore()

  drawSpeedUpChevronStreaks(ctx, lane, progress, 1, w, h)

  ctx.save()
  ctx.globalAlpha = 0.42
  ctx.strokeStyle = 'rgba(255, 190, 55, 0.55)'
  ctx.lineWidth = Math.max(1, h * 0.006)
  ctx.beginPath()
  ctx.moveTo(lane.x + lane.w * 0.12, lane.y + lane.h * 0.72)
  ctx.lineTo(lane.x + lane.w * 0.88, lane.y + lane.h * 0.72)
  ctx.stroke()
  ctx.restore()
}

function drawHudAlertV3Scene(ctx: CanvasRenderingContext2D, w: number, h: number, kind: HudAlertKind, tMs: number): void {
  paintStageBg(ctx, w, h)
  const progress = (tMs % HUD_ALERT_V3_MS) / HUD_ALERT_V3_MS
  const inT = clamp01(progress / 0.18)
  const outT = progress > 0.82 ? clamp01((progress - 0.82) / 0.18) : 0
  const visible = easeOutCubic(inT) * (1 - easeOutCubic(outT))
  const impact = progress < 0.28 ? 1 - easeOutCubic(progress / 0.28) : 0
  const image = kind === 'speed-up' ? HUD_FEEDBACK_ASSETS.speedUpAlert : HUD_FEEDBACK_ASSETS.dangerRiseAlert
  const label = kind === 'speed-up' ? 'SPEED UP' : 'DANGER RISE'
  const main = kind === 'speed-up' ? '255, 190, 55' : '255, 76, 86'
  const soft = kind === 'speed-up' ? '45, 236, 255' : '251, 113, 36'
  const text = kind === 'speed-up' ? '#fef3c7' : '#ffe4e6'
  const shake = kind === 'danger-rise' ? Math.sin(progress * Math.PI * 18) * impact * w * 0.004 : 0
  const asset = drawFeedbackAsset(PREVIEW_RT, ctx, image, w / 2 + shake, h * 0.52, w * 0.9, h * 0.34, 0.94 + impact * 0.035, visible)
  if (!asset) return

  ctx.save()
  ctx.globalAlpha = visible
  ctx.globalCompositeOperation = 'lighter'
  const scanX = asset.x + ((progress * 1.35) % 1) * asset.w
  const scan = ctx.createLinearGradient(scanX - asset.w * 0.12, 0, scanX + asset.w * 0.12, 0)
  scan.addColorStop(0, 'rgba(255,255,255,0)')
  scan.addColorStop(0.5, `rgba(${soft}, ${0.24 + impact * 0.18})`)
  scan.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = scan
  ctx.fillRect(asset.x + asset.w * 0.08, asset.y + asset.h * 0.22, asset.w * 0.84, asset.h * 0.56)

  if (kind === 'speed-up') {
    drawSpeedUpChevronStreaks(ctx, asset, progress, visible, w, h)
  } else {
    for (let i = 0; i < 12; i += 1) {
      const p = (progress + i * 0.071) % 1
      const px = asset.x + asset.w * (0.18 + p * 0.64)
      const py = asset.y + asset.h * (0.75 - p * 0.48)
      ctx.fillStyle = i % 3 === 0 ? `rgba(${main}, ${visible * (1 - p)})` : `rgba(${soft}, ${visible * 0.72 * (1 - p)})`
      ctx.fillRect(px, py, Math.max(1.2, w * 0.004), Math.max(1.2, h * 0.004 + p * h * 0.02))
    }
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `1000 ${Math.min(32, asset.h * 0.31)}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.lineWidth = Math.max(2, asset.h * 0.045)
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)'
  ctx.shadowColor = `rgba(${main}, ${0.72 + impact * 0.18})`
  ctx.shadowBlur = asset.h * (0.12 + impact * 0.08)
  ctx.strokeText(label, asset.x + asset.w / 2, asset.y + asset.h * 0.52)
  ctx.fillStyle = text
  ctx.fillText(label, asset.x + asset.w / 2, asset.y + asset.h * 0.52)
  ctx.restore()
}

export type { HudAlertKind }
export { drawComboBurstV3Scene, drawComboHudV3Scene, drawHudAlertV3Scene, drawLifeLossPopupV3Scene, drawScoreHudV3Scene, drawScorePopV3Scene, drawSpeedUpChevronFxScene }
