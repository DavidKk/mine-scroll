import { BRAND_NAME } from '../../../lib/brand.ts'
import { layoutSnapshotFromRuntime } from '../../ranked/layout-snapshot.ts'
import { createFpsOverlay } from './fps-overlay.ts'
import { bindCanvasInputListeners } from './input/listener-bindings.ts'
import { destroyTouchGesture, initTouchGesture } from './input/pointer-handlers.ts'
import { initialSquareLayout, syncPreviewLayout, syncSquareLayout } from './layout/board-layout.ts'
import { resolveInitialCellSize } from './layout/viewport-fit.ts'
import { clearPendingPanelTransition } from './overlay/panel-transition.ts'
import { collectCellEffects } from './runtime/cell-effects-runtime.ts'
import type { GameCanvasRuntime } from './runtime/context.ts'
import { paint } from './runtime/paint.ts'
import { bindPaintScheduler, cancelScheduledPaint, requestRepaint, startAmbientLoop } from './runtime/paint-scheduler.ts'
import { queueScrollMineGhosts } from './runtime/scroll-ghost-fx.ts'
import { createInitialRuntimeState } from './runtime/state.ts'
import type { GameCanvasCallbacks, GameCanvasController, GameCanvasOptions } from './types.ts'
import { applyCanvasSize } from './types.ts'

export type {
  GameCanvasCallbacks,
  GameCanvasController,
  GameCanvasFullscreenOptions,
  GameCanvasHudStats,
  GameCanvasLogLine,
  GameCanvasOptions,
  GameCanvasRenderOptions,
  ViewportFitOptions,
} from './types.ts'

export function createGameCanvas(
  container: HTMLElement,
  rows: number,
  cols: number,
  mineTotal: number,
  callbacks: GameCanvasCallbacks,
  canvasOptions: GameCanvasOptions = {}
): GameCanvasController {
  const fixedCellSize = canvasOptions.fixedCellSize
  const fixedGridRows = canvasOptions.fixedGridRows
  const fitViewport = canvasOptions.fitViewport
  const getScrollPressureFn = canvasOptions.getScrollPressure
  const fullscreen = canvasOptions.fullscreen
  const endlessPreviewRows = canvasOptions.endlessPreviewRows ?? 0

  let currentRows = fixedGridRows ?? rows
  const currentCols = cols

  const wrap = document.createElement('div')
  wrap.className = fullscreen ? 'game-canvas-wrap game-canvas-wrap--fullscreen' : 'game-canvas-wrap'

  const rt: GameCanvasRuntime = {
    state: createInitialRuntimeState(currentRows, cols, fixedCellSize, null, 0, 0),
    canvas: document.createElement('canvas'),
    ctx: null as unknown as CanvasRenderingContext2D,
    callbacks,
    canvasOptions,
    mineTotal,
    fpsOverlay: null as unknown as ReturnType<typeof createFpsOverlay>,
    fixedCellSize,
    fixedGridRows,
    fitViewport,
    getScrollPressureFn,
    fullscreen,
    endlessPreviewRows,
    inputBindings: undefined,
    paint: () => {},
    scheduleAnimationFrame: () => {},
    scheduleContinuousRepaint: () => {},
  }

  rt.state.fittedCellSize = resolveInitialCellSize(rt)
  rt.state.squareLayout = initialSquareLayout(rt, currentRows, cols)
  rt.state.boardWidth = rt.state.squareLayout.width
  rt.state.boardHeight = rt.state.squareLayout.height
  rt.state.width = fullscreen ? window.innerWidth : rt.state.boardWidth
  rt.state.height = fullscreen ? window.innerHeight : rt.state.boardHeight

  rt.canvas.className = fullscreen ? 'game-canvas game-canvas--fullscreen' : 'game-canvas'
  rt.canvas.setAttribute('role', 'application')
  rt.canvas.setAttribute('aria-label', `${BRAND_NAME} board`)
  wrap.appendChild(rt.canvas)
  container.appendChild(wrap)
  rt.fpsOverlay = createFpsOverlay(wrap)

  const context = rt.canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context not available')
  rt.ctx = context
  applyCanvasSize(rt.canvas, rt.ctx, rt.state.width, rt.state.height)
  rt.fpsOverlay.syncSize(rt.state.width, rt.state.height)

  rt.paint = () => paint(rt)
  bindPaintScheduler(rt)
  initTouchGesture(rt)
  rt.inputBindings = bindCanvasInputListeners(rt) ?? undefined

  const onResize = () => rt.paint()
  if (fullscreen) {
    window.addEventListener('resize', onResize)
    startAmbientLoop(rt)
  }

  const controller: GameCanvasController = {
    render(views, status, flagCount, options) {
      const nextRows = fixedGridRows ?? options?.rows ?? currentRows
      const nextCols = options?.cols ?? currentCols

      if (!fixedGridRows && (nextRows !== currentRows || nextCols !== currentCols)) {
        syncSquareLayout(rt, nextRows, nextCols)
        currentRows = nextRows
        rt.state.currentRows = nextRows
        rt.state.currentCols = nextCols
      }

      syncPreviewLayout(rt, options?.previewRows ?? 0)

      collectCellEffects(rt, rt.state.currentViews, views)
      if (status === 'idle' && rt.state.currentStatus !== 'idle') {
        rt.state.cellEffects.length = 0
        rt.state.particles.length = 0
        rt.state.lastCombo = 0
        rt.state.comboFxStartedAt = 0
        rt.state.scoreCountUpStartedAt = 0
        rt.state.scoreCountUpFrom = 0
        rt.state.scoreCountUpTo = 0
        rt.state.lastDisplayedScore = null
        rt.state.activeDifficultyAlert = null
        rt.state.lastDifficultySpeedTier = null
        rt.state.lastDifficultyBatchTier = null
        rt.state.boardLayerCacheKey = ''
      }
      if (
        rt.state.pendingPanelTransition &&
        ((rt.state.pendingPanelTransition.kind === 'start' && status !== 'idle') || (rt.state.pendingPanelTransition.kind === 'retry' && status !== 'lost'))
      ) {
        clearPendingPanelTransition(rt)
      }

      rt.state.currentViews = views
      rt.state.currentStatus = status
      rt.state.currentFlagCount = flagCount
      rt.state.currentHudLeftDisplay = options?.hudLeftDisplay
      rt.state.currentHudRightDisplay = options?.hudRightDisplay
      rt.state.currentAiHint = options?.aiHint
      requestRepaint(rt)
    },
    startTimer() {
      if (rt.state.timerId !== null) return
      rt.state.timerId = window.setInterval(() => {
        rt.state.elapsed += 1
        requestRepaint(rt)
      }, 1000)
    },
    stopTimer() {
      if (rt.state.timerId !== null) {
        window.clearInterval(rt.state.timerId)
        rt.state.timerId = null
      }
    },
    resetTimer() {
      controller.stopTimer()
      rt.state.elapsed = 0
      requestRepaint(rt)
    },
    repaint() {
      rt.paint()
    },
    queueScrollMineGhosts: (cells) => queueScrollMineGhosts(rt, cells),
    getRankedLayoutSnapshot: () => layoutSnapshotFromRuntime(rt),
    destroy() {
      controller.stopTimer()
      clearPendingPanelTransition(rt)
      cancelScheduledPaint(rt)
      destroyTouchGesture(rt)
      rt.inputBindings?.unbind()
      rt.inputBindings = undefined
      if (fullscreen) window.removeEventListener('resize', onResize)
      rt.fpsOverlay.destroy()
      if (typeof wrap.remove === 'function') {
        wrap.remove()
      } else {
        wrap.parentElement?.removeChild(wrap)
      }
    },
  }

  return controller
}
