import { GAME_ASSET_TUNING } from '../../game-assets.ts'
import { COMBO_HUD_TIER_THRESHOLDS, comboBurstRuntimeProgress, drawComboBurstV3, isComboBurstFxVisible, resolveComboBurstV3RuntimeLayout } from '../../hud-feedback-fx.ts'
import { drawHudIcon, drawIconTextButton } from '../../hud-sprites.ts'
import { fillRounded } from '../../primitives/index.ts'
import { createBoardSideRailGradient, getBoardSideRailLayout } from '../../renderer/index.ts'
import { FONTS, THEME } from '../../theme.ts'
import { comboColor, drawArcadePanel, drawBottomEnergyRail, drawRuntimePanelV3Fx, drawUiPanelImageBounds } from '../hud/canvas-primitives.ts'
import { beginScoreCountUp } from '../hud/score-hud.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { hudFxBudget, isScorePopFxEnabled } from '../runtime/paint-helpers.ts'
import { drawParticles, getBottomFeedbackSlots, spawnComboParticles, spawnScoreHudParticles } from '../runtime/particle-system.ts'
import type { GameCanvasFullscreenOptions } from '../types.ts'
import { drawBreakEvent } from './break-event.ts'
import { drawDifficultyAlert, drawDifficultyAlertFullscreenFlash, drawFullscreenScrollWarning } from './difficulty-alert.ts'
import type { GameIntroProgress } from './game-intro.ts'
import { drawHeartRefillFx } from './heart-refill-fx.ts'
import { drawLevelUpFx } from './level-up-fx.ts'
import { drawLifeLossEvent } from './life-loss-event.ts'
import { panelTransitionProgress } from './panel-transition.ts'
import { drawScorePopV3Layer } from './score-pop-layer.ts'
import { drawSpaceHint, getSpaceHintRect, updateScrollButtonReveal } from './space-hint.ts'

export function drawFullscreenOverlay(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  shell: GameCanvasFullscreenOptions,
  shellW: number,
  shellH: number,
  intro: GameIntroProgress | null = null
): void {
  const stats = shell.getStats?.()
  const combo = stats?.combo ?? 0
  const scrollPressure = rt.getScrollPressureFn?.()
  const difficulty = stats?.difficulty

  if (difficulty) {
    if (rt.state.lastDifficultySpeedTier === null || rt.state.lastDifficultyBatchTier === null) {
      rt.state.lastDifficultySpeedTier = difficulty.speedTier
      rt.state.lastDifficultyBatchTier = difficulty.batchTier
    } else {
      if (difficulty.batchTier > rt.state.lastDifficultyBatchTier) {
        rt.state.activeDifficultyAlert = { kind: 'danger-rise', startedAt: performance.now() }
        shell.onDifficultyAlert?.('danger-rise')
        rt.scheduleAnimationFrame()
      } else if (difficulty.speedTier > rt.state.lastDifficultySpeedTier) {
        rt.state.activeDifficultyAlert = { kind: 'speed-up', startedAt: performance.now() }
        shell.onDifficultyAlert?.('speed-up')
        rt.scheduleAnimationFrame()
      }
      rt.state.lastDifficultySpeedTier = difficulty.speedTier
      rt.state.lastDifficultyBatchTier = difficulty.batchTier
    }
  }

  if (stats?.scoreEvent && stats.scoreEvent.id !== rt.state.lastScoreEventId) {
    rt.state.lastScoreEventId = stats.scoreEvent.id
    const scoreNow = performance.now()
    rt.state.scoreFxStartedAt = scoreNow
    beginScoreCountUp(rt, stats.scoreEvent.scoreAfter ?? stats.score ?? 0, stats.scoreEvent.scoreAdded, scoreNow)
    const comboAlsoIncreased = combo > rt.state.lastCombo && combo > 1
    if (!comboAlsoIncreased) spawnScoreHudParticles(rt)
    rt.scheduleAnimationFrame()
    if (isScorePopFxEnabled(rt)) {
      rt.state.activeScoreEvent = stats.scoreEvent
    }
  }
  if (stats?.breakEvent && stats.breakEvent.id !== rt.state.lastBreakEventId) {
    rt.state.lastBreakEventId = stats.breakEvent.id
    rt.state.activeBreakEvent = stats.breakEvent
    rt.state.breakFxStartedAt = performance.now()
    rt.scheduleAnimationFrame()
  }
  if (stats?.lifeLossEvent && stats.lifeLossEvent.id !== rt.state.lastLifeLossEventId) {
    rt.state.lastLifeLossEventId = stats.lifeLossEvent.id
    rt.state.activeLifeLossEvent = stats.lifeLossEvent
    rt.state.lifeLossFxStartedAt = performance.now()
    rt.state.activeBreakEvent = null
    rt.state.breakFxStartedAt = 0
    rt.scheduleAnimationFrame()
  }

  if (combo !== rt.state.lastCombo) {
    if (combo > rt.state.lastCombo && combo > 1) spawnComboParticles(rt, combo)
    const levelThresholds = [...COMBO_HUD_TIER_THRESHOLDS]
    for (const threshold of levelThresholds) {
      if (rt.state.lastCombo < threshold && combo >= threshold) {
        rt.state.levelUpFxStartedAt = performance.now()
        rt.scheduleAnimationFrame()
        break
      }
    }
    rt.state.lastCombo = combo
    if (combo > 1) rt.state.comboFxStartedAt = performance.now()
  }

  drawHeartRefillFx(rt, shellCtx, shellW, shellH)
  drawLevelUpFx(rt, shellCtx, shellW, shellH)

  drawDifficultyAlertFullscreenFlash(rt, shellCtx, shellW, shellH)
  if ((!intro || intro.complete) && (stats?.spaceEnabled || scrollPressure)) {
    drawBottomEnergyRail(rt, shellCtx, scrollPressure, shellW, shellH)
  }
  if (scrollPressure) {
    drawFullscreenScrollWarning(rt, shellCtx, scrollPressure, shellW, shellH)
  }

  const scrollIntroReady = !intro || intro.complete
  if (stats?.spaceEnabled) {
    const spaceRect = getSpaceHintRect(rt, scrollPressure)
    if (spaceRect) {
      const reveal = updateScrollButtonReveal(rt, scrollIntroReady)
      rt.state.spaceHintRect = reveal.interactable ? spaceRect : null
      drawSpaceHint(rt, shellCtx, spaceRect, scrollPressure, rt.state.stageLayout?.scale ?? 1, reveal)
    } else {
      updateScrollButtonReveal(rt, false)
      rt.state.spaceHintRect = null
    }
  } else {
    updateScrollButtonReveal(rt, false)
    rt.state.spaceHintRect = null
  }

  drawParticles(rt, shellCtx, performance.now())
  drawDifficultyAlert(rt, shellCtx, shellW)
  drawBreakEvent(rt, shellCtx, rt.state.activeLifeLossEvent ? null : rt.state.activeBreakEvent, rt.state.breakFxStartedAt, shellW, shellH)
  drawLifeLossEvent(rt, shellCtx, rt.state.activeLifeLossEvent, rt.state.lifeLossFxStartedAt, shellW, shellH)

  if (isScorePopFxEnabled(rt)) drawScorePopV3Layer(rt, shellCtx, shellW, shellH, 'strip')

  if (combo > 1 && rt.state.comboFxStartedAt > 0) {
    const elapsedMs = performance.now() - rt.state.comboFxStartedAt
    const durationMs = GAME_ASSET_TUNING.fx.comboBurst.durationMs
    const progress = comboBurstRuntimeProgress(elapsedMs, combo, durationMs)
    const stageScale = rt.state.stageLayout?.scale ?? 1
    const slots = getBottomFeedbackSlots(rt)
    const railTop = rt.state.stageLayout?.bottomRailRect.y ?? shellH
    const layout = resolveComboBurstV3RuntimeLayout(slots.comboBurst, progress, stageScale, shellW, railTop)

    drawComboBurstV3(shellCtx, {
      canvasW: shellW,
      canvasH: shellH,
      combo,
      progress,
      layout,
      fontFamilyMono: FONTS.mono,
      fontFamilyDisplay: FONTS.display,
      hudFxBudget: hudFxBudget(rt),
    })

    if (isComboBurstFxVisible(progress)) rt.scheduleAnimationFrame()
  }

  if (isScorePopFxEnabled(rt)) drawScorePopV3Layer(rt, shellCtx, shellW, shellH, 'pop')

  if (combo > 1) {
    const pulse = 0.5 + Math.sin(Date.now() / 120) * 0.5
    const palette = comboColor(rt, combo)

    const railAlpha = Math.min(0.62, 0.22 + combo * 0.035 + pulse * 0.2)
    shellCtx.save()
    const previewRows = rt.state.currentPreviewRows > 0 ? rt.state.currentPreviewRows : 0
    const railLayout = rt.state.squareLayout
      ? getBoardSideRailLayout(rt.state.squareLayout, previewRows)
      : { top: 6, bottom: rt.state.boardHeight - 6, fadeInStart: null, fadeInEnd: null }
    const railTop = rt.state.boardOffsetY + railLayout.top
    const railBottom = rt.state.boardOffsetY + railLayout.bottom
    const peakStroke = palette.stroke.replace(/[\d.]+\)$/u, `${railAlpha})`)
    const railGradient = createBoardSideRailGradient(
      shellCtx,
      railTop,
      railBottom,
      peakStroke,
      railLayout.fadeInStart !== null ? rt.state.boardOffsetY + railLayout.fadeInStart : null,
      railLayout.fadeInEnd !== null ? rt.state.boardOffsetY + railLayout.fadeInEnd : null
    )
    shellCtx.strokeStyle = railGradient
    shellCtx.lineWidth = 2
    shellCtx.lineCap = 'round'
    for (const side of [-1, 1]) {
      const x = side < 0 ? rt.state.boardOffsetX - 16 : rt.state.boardOffsetX + rt.state.boardWidth + 16
      shellCtx.beginPath()
      shellCtx.moveTo(x, railTop)
      shellCtx.lineTo(x, railBottom)
      shellCtx.stroke()
    }
    shellCtx.restore()
  }

  if (rt.state.currentStatus === 'idle' && (shell.showStartOverlay?.() ?? true) && (!intro || intro.startPanelAlpha > 0.01)) {
    const isMobile = rt.state.stageLayout?.profile === 'mobile'
    const scale = rt.state.stageLayout?.scale ?? 1
    const w = Math.min(isMobile ? 300 : 420, shellW - (isMobile ? 24 : 40), Math.max(isMobile ? 240 : 280, rt.state.boardWidth * (isMobile ? 0.88 : 1.08)))
    const h = Math.min(Math.round(w * (246 / 364)), Math.max(120, shellH - (isMobile ? 48 : 64) * scale))
    const x = (shellW - w) / 2
    const y = (shellH - h) / 2
    const now = performance.now()
    const action = panelTransitionProgress(rt, 'start', now)
    const introScale = intro?.startPanelScale ?? 1
    const pop = (action > 0 ? 1 - Math.sin(action * Math.PI) * 0.025 : 1) * introScale
    const panelAlpha = intro?.startPanelAlpha ?? 1
    rt.state.startRect = intro && !intro.interactable ? null : { x, y, w, h }
    shellCtx.save()
    shellCtx.globalAlpha = panelAlpha
    if (introScale < 0.999) {
      const cx = x + w / 2
      const cy = y + h / 2
      shellCtx.translate(cx, cy)
      shellCtx.scale(introScale, introScale)
      shellCtx.translate(-cx, -cy)
    }
    const panelBounds = drawUiPanelImageBounds(rt, shellCtx, 'start-panel', x, y, w, h, 1.03 * pop)
    if (!panelBounds) {
      drawArcadePanel(rt, shellCtx, x, y, w, h, 'rgba(59, 130, 246, 0.78)', 'rgba(3, 8, 20, 0.95)')
      drawHudIcon(shellCtx, 'play', shellW / 2 - 12, y + 32, { size: 24 })
      shellCtx.fillStyle = '#fde047'
      shellCtx.font = `900 46px ${FONTS.display}`
      shellCtx.textAlign = 'center'
      shellCtx.textBaseline = 'middle'
      shellCtx.fillText('START', shellW / 2, y + h / 2 + 8)
    }
    drawRuntimePanelV3Fx(rt, shellCtx, panelBounds?.x ?? x, panelBounds?.y ?? y, panelBounds?.w ?? w, panelBounds?.h ?? h, 'start', now, action)
    shellCtx.restore()
  }

  if (rt.state.currentStatus === 'lost') {
    const panelW = Math.min(480, shellW - 40, Math.max(300, rt.state.boardWidth * 1.18))
    const panelH = Math.round(panelW * (269 / 430))
    const panelX = (shellW - panelW) / 2
    const panelY = (shellH - panelH) / 2
    const now = performance.now()
    const action = panelTransitionProgress(rt, 'retry', now)
    const shake = action > 0 && action < 0.55 ? Math.sin(action * Math.PI * 18) * (1 - action) * Math.min(panelW, panelH) * 0.012 : 0
    const pop = action > 0 ? 1 - Math.sin(action * Math.PI) * 0.025 : 1
    const retryW = panelW * 0.52
    const retryH = panelH * 0.2
    const retryX = panelX + (panelW - retryW) / 2
    const retryY = panelY + panelH * 0.68

    shellCtx.save()
    shellCtx.fillStyle = THEME.overlayScrim
    shellCtx.fillRect(0, 0, shellW, shellH)
    const panelBounds = drawUiPanelImageBounds(rt, shellCtx, 'game-over-panel', panelX + shake, panelY, panelW, panelH, 1.03 * pop)
    if (!panelBounds) {
      drawArcadePanel(rt, shellCtx, panelX, panelY, panelW, panelH, 'rgba(239, 68, 68, 0.8)', 'rgba(24, 3, 5, 0.95)')
      drawHudIcon(shellCtx, 'skull', shellW / 2 - 16, panelY + 26, { size: 32 })
      shellCtx.fillStyle = '#ff453a'
      shellCtx.font = `900 42px ${FONTS.display}`
      shellCtx.textAlign = 'center'
      shellCtx.textBaseline = 'middle'
      shellCtx.fillText('GAME OVER', shellW / 2, panelY + panelH * 0.46)
      fillRounded(rt.ctx, retryX, retryY, retryW, retryH, 10, THEME.danger)
      shellCtx.fillStyle = '#ffffff'
      shellCtx.font = `700 18px ${FONTS.display}`
      if (
        !drawIconTextButton(shellCtx, shellW / 2, retryY + retryH / 2 + 1, 'refresh', 'RETRY', {
          iconSize: 16,
          font: `700 18px ${FONTS.display}`,
        })
      ) {
        shellCtx.fillText('RETRY', shellW / 2, retryY + retryH / 2 + 1)
      }
      rt.state.retryRect = { x: panelX, y: panelY, w: panelW, h: panelH }
    } else {
      rt.state.retryRect = { x: panelBounds.x, y: panelBounds.y, w: panelBounds.w, h: panelBounds.h }
    }
    drawRuntimePanelV3Fx(rt, shellCtx, panelBounds?.x ?? panelX, panelBounds?.y ?? panelY, panelBounds?.w ?? panelW, panelBounds?.h ?? panelH, 'game-over', now, action)
    shellCtx.fillStyle = '#fee2e2'
    shellCtx.font = `700 15px ${FONTS.mono}`
    shellCtx.textAlign = 'center'
    shellCtx.textBaseline = 'top'
    shellCtx.fillText(`SCORE ${String(stats?.score ?? 0).padStart(5, '0')}`, shellW / 2, panelY + panelH + 12)
    shellCtx.restore()
  }
}
