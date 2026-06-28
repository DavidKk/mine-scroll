import { renderBoardDynamicFrame, renderBoardIntroFrame, renderBoardStaticFrame, renderFrame } from '../../renderer/index.ts'
import { drawFullscreenHud } from '../hud/fullscreen-hud.ts'
import { syncInputProfile } from '../input/pointer-handlers.ts'
import { syncBoardSizeFromLayout } from '../layout/board-layout.ts'
import { syncFullscreenCanvasSize } from '../layout/viewport-fit.ts'
import { drawFullscreenOverlay } from '../overlay/event-overlay.ts'
import { drawGameIntroChrome, updateGameIntro } from '../overlay/game-intro.ts'
import { drawAmbientShellBackdrop } from '../shell/ambient-shell.ts'
import { drawShellBackground } from '../shell/background.ts'
import { ensureBoardLayerCache } from './board-layer-cache.ts'
import { drawCellEffects, pruneEffects } from './cell-effects-runtime.ts'
import type { GameCanvasRuntime } from './context.ts'
import { scheduleContinuousRepaint, syncPressureRepaint } from './paint-scheduler.ts'
import { drawScrollMineGhostEffects } from './scroll-ghost-fx.ts'

export function paint(rt: GameCanvasRuntime): void {
  syncFullscreenCanvasSize(rt)
  syncInputProfile(rt)
  syncBoardSizeFromLayout(rt)
  const now = performance.now()
  pruneEffects(rt, now)
  const intro = rt.fullscreen ? updateGameIntro(rt, now) : null
  const scrollPressure = rt.getScrollPressureFn?.()
  const renderState = {
    views: rt.state.currentViews,
    status: rt.state.currentStatus,
    mineTotal: rt.mineTotal,
    flagCount: rt.state.currentFlagCount,
    elapsedSeconds: rt.state.elapsed,
    scrollPressure,
    aiHint: rt.state.currentAiHint,
    previewRows: rt.state.currentPreviewRows > 0 ? rt.state.currentPreviewRows : undefined,
    nowMs: now,
    pointer: rt.state.boardPointer,
    flagSwipeActive: Boolean(rt.state.flagSwipePreview?.active),
    ...(rt.fullscreen
      ? {}
      : {
          hudLeftDisplay: rt.state.currentHudLeftDisplay,
          hudRightDisplay: rt.state.currentHudRightDisplay,
        }),
  }

  if (rt.fullscreen) {
    rt.state.startRect = null
    rt.state.retryRect = null
    rt.state.devAutoRect = null
    rt.state.devSpeedRect = null
    rt.state.spaceHintRect = null
    rt.ctx.clearRect(0, 0, rt.state.width, rt.state.height)
    drawShellBackground(rt, rt.ctx)
    drawAmbientShellBackdrop(rt, rt.ctx, now)
    rt.ctx.save()
    rt.ctx.translate(rt.state.boardOffsetX, rt.state.boardOffsetY)
  }

  const boardState = {
    ...renderState,
    rows: rt.state.currentRows,
    cols: rt.state.currentCols,
  }

  if (rt.fullscreen) {
    if (!intro || intro.complete) {
      ensureBoardLayerCache(rt, boardState)
    }
    const introBoardActive = intro && !intro.complete
    const skipBoard = introBoardActive && intro.boardReveal <= 0
    const useIntroBoard = introBoardActive && intro.boardReveal > 0
    if (!skipBoard) {
      if (useIntroBoard) {
        renderBoardIntroFrame(rt.ctx, rt.state.squareLayout!, boardState, intro.boardReveal, rt.state.currentRows, rt.state.currentCols)
      } else if (rt.state.boardLayerCache) {
        const prevSmooth = rt.ctx.imageSmoothingEnabled
        rt.ctx.imageSmoothingEnabled = false
        rt.ctx.drawImage(rt.state.boardLayerCache, 0, 0, rt.state.squareLayout!.width, rt.state.squareLayout!.height)
        rt.ctx.imageSmoothingEnabled = prevSmooth
      } else {
        renderBoardStaticFrame(rt.ctx, rt.state.squareLayout!, boardState)
      }
      if (!useIntroBoard) {
        renderBoardDynamicFrame(rt.ctx, rt.state.squareLayout!, boardState)
      }
    }
  } else {
    renderFrame(rt.ctx, rt.state.squareLayout!, boardState)
  }

  drawCellEffects(rt, rt.ctx, now)
  rt.fpsOverlay.recordGameFrame(now)
  rt.fpsOverlay.syncSize(rt.state.width, rt.state.height)

  if (rt.fullscreen) {
    rt.ctx.restore()
    drawFullscreenOverlay(rt, rt.ctx, rt.fullscreen, rt.state.width, rt.state.height, intro)
    drawScrollMineGhostEffects(rt, rt.ctx, now)
    if (intro && !intro.complete) drawGameIntroChrome(rt, rt.ctx, rt.state.width, intro)
    drawFullscreenHud(rt, rt.ctx, rt.fullscreen, rt.state.width, rt.state.height, intro)
    if (rt.state.stageLayout) {
      const { scale, hudY } = rt.state.stageLayout
      rt.fpsOverlay.setAnchor({ x: rt.state.width - 10 * scale, y: hudY + 2 * scale, scale })
    }
  } else {
    rt.fpsOverlay.setAnchor({ x: rt.state.width - 8, y: 8, scale: 1 })
  }

  rt.state.lastPaintAt = now
  syncPressureRepaint(rt)
  scheduleContinuousRepaint(rt)
}
