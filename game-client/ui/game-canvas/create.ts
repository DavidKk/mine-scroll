import { BRAND_NAME } from '../../../lib/brand.ts'
import { layoutSnapshotFromRuntime } from '../../ranked/layout-snapshot.ts'
import { createFpsOverlay } from './fps-overlay.ts'
import {
  destroyTouchGesture,
  initTouchGesture,
  onContextMenu,
  onDoubleClick,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} from './input/pointer-handlers.ts'
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

  const rt = {
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
    paint: () => {},
    scheduleAnimationFrame: () => {},
    scheduleContinuousRepaint: () => {},
  } satisfies GameCanvasRuntime

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

  const onResize = () => rt.paint()
  const handleMouseDown = (e: MouseEvent) => onMouseDown(rt, e)
  const handlePointerDown = (e: PointerEvent) => onPointerDown(rt, e)
  const handlePointerMove = (e: PointerEvent) => onPointerMove(rt, e)
  const handlePointerUp = (e: PointerEvent) => onPointerUp(rt, e)
  const handlePointerCancel = (e: PointerEvent) => onPointerCancel(rt, e)
  const handleMouseMove = (e: MouseEvent) => onMouseMove(rt, e)
  const handleMouseUp = (e: MouseEvent) => onMouseUp(rt, e)
  const handleMouseLeave = () => onMouseLeave(rt)
  const handleContextMenu = (e: MouseEvent) => onContextMenu(rt, e)
  const handleDoubleClick = (e: MouseEvent) => onDoubleClick(rt, e)

  rt.canvas.addEventListener('mousedown', handleMouseDown)
  rt.canvas.addEventListener('pointerdown', handlePointerDown)
  rt.canvas.addEventListener('pointermove', handlePointerMove)
  rt.canvas.addEventListener('pointerup', handlePointerUp)
  rt.canvas.addEventListener('pointercancel', handlePointerCancel)
  rt.canvas.addEventListener('mousemove', handleMouseMove)
  rt.canvas.addEventListener('mouseup', handleMouseUp)
  rt.canvas.addEventListener('mouseleave', handleMouseLeave)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerCancel)
  rt.canvas.addEventListener('contextmenu', handleContextMenu)
  rt.canvas.addEventListener('dblclick', handleDoubleClick)

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
      rt.canvas.removeEventListener('mousedown', handleMouseDown)
      rt.canvas.removeEventListener('pointerdown', handlePointerDown)
      rt.canvas.removeEventListener('pointermove', handlePointerMove)
      rt.canvas.removeEventListener('pointerup', handlePointerUp)
      rt.canvas.removeEventListener('pointercancel', handlePointerCancel)
      rt.canvas.removeEventListener('mousemove', handleMouseMove)
      rt.canvas.removeEventListener('mouseup', handleMouseUp)
      rt.canvas.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      rt.canvas.removeEventListener('contextmenu', handleContextMenu)
      rt.canvas.removeEventListener('dblclick', handleDoubleClick)
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
