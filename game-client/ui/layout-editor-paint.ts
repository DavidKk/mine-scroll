import { ENDLESS_COLS, ENDLESS_PREVIEW_ROWS } from '@shared/core/modes/endless/constants.ts'
import { createSessionWithSeed, getFlagCount, revealAt, toCellViews } from '@shared/core/modes/engine.ts'

import { drawBottomEnergyRail } from './game-canvas/hud/canvas-primitives.ts'
import { drawComboHud } from './game-canvas/hud/combo-hud.ts'
import { drawFullscreenHud } from './game-canvas/hud/fullscreen-hud.ts'
import { applySquareLayout, initialSquareLayout } from './game-canvas/layout/board-layout.ts'
import { fitCellSizeForViewport } from './game-canvas/layout/viewport-fit.ts'
import { drawSpaceHint, getSpaceHintRect, type ScrollButtonRevealState } from './game-canvas/overlay/space-hint.ts'
import type { GameCanvasRuntime } from './game-canvas/runtime/context.ts'
import { createInitialRuntimeState } from './game-canvas/runtime/state.ts'
import { drawShellBackground } from './game-canvas/shell/background.ts'
import type { GameCanvasCallbacks, GameCanvasFullscreenOptions } from './game-canvas/types.ts'
import { computeGameStageLayout, type GameStageLayout, resolveViewportEndlessVisibleRows } from './game-stage-layout.ts'
import { renderBoardDynamicFrame, renderBoardStaticFrame, type ScrollPressureState } from './renderer/index.ts'
import { applyUiLayoutOverrides, getUiWidgetBounds, hudContentY, UI_WIDGET_LABELS, UI_WIDGET_ORDER, type UiLayoutOverrides, type UiWidgetId } from './ui-layout-overrides.ts'

const EDITOR_SESSION_SEED = 4242
const FULL_SCROLL_REVEAL: ScrollButtonRevealState = {
  widthScale: 1,
  heightScale: 1,
  contentAlpha: 1,
  animating: false,
  interactable: true,
}

const EDITOR_STATS = {
  score: 1240,
  combo: 12,
  lives: '3/5',
  spaceEnabled: true,
  devAutoVisible: true,
  devAutoActive: false,
} as const

const EDITOR_SCROLL_PRESSURE: ScrollPressureState = {
  seconds: 4,
  progress: 0.35,
  urgent: false,
  batchRows: 1,
}

function noop(): void {}

function createEditorShell(): GameCanvasFullscreenOptions {
  return {
    getStats: () => EDITOR_STATS,
    getBgmMuted: () => false,
    onToggleBgmMute: noop,
    onOpenLeaderboard: noop,
    hasLeaderboardUnseenUpdate: () => false,
    showStartOverlay: () => false,
  }
}

function prepareEditorSession(visibleRows: number) {
  let session = createSessionWithSeed(EDITOR_SESSION_SEED)
  const midRow = Math.min(visibleRows - 3, Math.max(2, Math.floor(visibleRows * 0.45)))
  const midCol = Math.floor(ENDLESS_COLS / 2)
  session = revealAt(session, midRow, midCol)
  session = revealAt(session, midRow, midCol + 1)
  session = revealAt(session, midRow + 1, midCol)
  session = revealAt(session, midRow - 1, midCol)
  return session
}

function syncEditorLayout(rt: GameCanvasRuntime, viewportW: number, viewportH: number, overrides: UiLayoutOverrides): GameStageLayout {
  rt.state.width = viewportW
  rt.state.height = viewportH
  rt.state.currentRows = resolveViewportEndlessVisibleRows(viewportW, viewportH)
  rt.state.fittedCellSize = fitCellSizeForViewport(rt, viewportW, viewportH)
  applySquareLayout(rt, rt.state.currentRows, ENDLESS_COLS, rt.state.currentPreviewRows)
  rt.state.boardWidth = rt.state.squareLayout!.width
  rt.state.boardHeight = rt.state.squareLayout!.height

  const base = computeGameStageLayout(
    viewportW,
    viewportH,
    rt.state.boardWidth,
    rt.state.boardHeight,
    rt.state.squareLayout?.grid.cellSize ?? rt.state.fittedCellSize,
    rt.state.currentRows
  )
  rt.state.stageLayout = applyUiLayoutOverrides(base, overrides)
  rt.state.boardOffsetX = Math.round(rt.state.stageLayout.boardX)
  rt.state.boardOffsetY = Math.round(rt.state.stageLayout.boardY)
  return rt.state.stageLayout
}

export interface LayoutEditorPaintContext {
  rt: GameCanvasRuntime
}

export function createLayoutEditorPaintContext(canvas: HTMLCanvasElement, paintCtx: CanvasRenderingContext2D, viewportW: number, viewportH: number): LayoutEditorPaintContext {
  const visibleRows = resolveViewportEndlessVisibleRows(viewportW, viewportH)
  const session = prepareEditorSession(visibleRows)
  const shell = createEditorShell()
  const scrollPressure = EDITOR_SCROLL_PRESSURE

  const rt: GameCanvasRuntime = {
    state: createInitialRuntimeState(visibleRows, ENDLESS_COLS, undefined, null, viewportW, viewportH),
    canvas,
    ctx: paintCtx,
    callbacks: {
      onReveal: noop,
      onToggleFlag: noop,
      onChord: noop,
      onReset: noop,
    } satisfies GameCanvasCallbacks,
    canvasOptions: {},
    mineTotal: session.state.board.mineCount,
    fpsOverlay: {
      recordGameFrame: noop,
      setAnchor: noop,
      syncSize: noop,
      destroy: noop,
    },
    fixedCellSize: undefined,
    fixedGridRows: undefined,
    fitViewport: { rows: visibleRows, cols: ENDLESS_COLS, minCellSize: 18, maxCellSize: 36 },
    getScrollPressureFn: () => scrollPressure,
    fullscreen: shell,
    endlessPreviewRows: ENDLESS_PREVIEW_ROWS,
    paint: noop,
    scheduleAnimationFrame: noop,
    scheduleContinuousRepaint: noop,
  }

  rt.state.squareLayout = initialSquareLayout(rt, visibleRows, ENDLESS_COLS)
  rt.state.currentPreviewRows = ENDLESS_PREVIEW_ROWS
  applySquareLayout(rt, visibleRows, ENDLESS_COLS, ENDLESS_PREVIEW_ROWS)
  rt.state.currentViews = toCellViews(session)
  rt.state.currentStatus = 'idle'
  rt.state.currentFlagCount = getFlagCount(session.state)
  rt.state.lastLivesCurrent = 3
  rt.state.lastCombo = EDITOR_STATS.combo
  rt.state.gameIntroComplete = true

  syncEditorLayout(rt, viewportW, viewportH, {})
  return { rt }
}

export function resyncLayoutEditorViewport(ctx: LayoutEditorPaintContext, viewportW: number, viewportH: number): void {
  const visibleRows = resolveViewportEndlessVisibleRows(viewportW, viewportH)
  const session = prepareEditorSession(visibleRows)
  ctx.rt.state.currentRows = visibleRows
  ctx.rt.fitViewport = { rows: visibleRows, cols: ENDLESS_COLS, minCellSize: 18, maxCellSize: 36 }
  ctx.rt.state.currentViews = toCellViews(session)
  ctx.rt.state.currentFlagCount = getFlagCount(session.state)
  ctx.rt.mineTotal = session.state.board.mineCount
  ctx.rt.state.lastLivesCurrent = 3
}

export function getUiWidgetBoundsAfterDraw(rt: GameCanvasRuntime, layout: GameStageLayout, id: UiWidgetId): ReturnType<typeof getUiWidgetBounds> {
  if (id === 'side-controls' && rt.state.bgmMuteRect && rt.state.leaderboardRect) {
    const a = rt.state.bgmMuteRect
    const b = rt.state.leaderboardRect
    return {
      x: Math.min(a.x, b.x),
      y: a.y,
      w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
      h: b.y + b.h - a.y,
    }
  }
  if (id === 'auto' && rt.state.devAutoRect) return { ...rt.state.devAutoRect }
  if (id === 'dev-speed' && rt.state.devSpeedRect) return { ...rt.state.devSpeedRect }
  if (id === 'scroll-button' && layout.spaceButtonRect) return { ...layout.spaceButtonRect }
  return getUiWidgetBounds(layout, id)
}

function drawSelectionChrome(shellCtx: CanvasRenderingContext2D, rt: GameCanvasRuntime, layout: GameStageLayout, selectedId: UiWidgetId | null): void {
  const scale = layout.scale
  for (const id of UI_WIDGET_ORDER) {
    const b = getUiWidgetBoundsAfterDraw(rt, layout, id)
    const active = id === selectedId
    shellCtx.strokeStyle = active ? 'rgba(250, 204, 21, 0.95)' : 'rgba(74, 222, 128, 0.42)'
    shellCtx.lineWidth = active ? 2 : 1
    shellCtx.setLineDash(active ? [] : [5, 4])
    shellCtx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1)
    shellCtx.setLineDash([])
    if (active) {
      shellCtx.fillStyle = 'rgba(250, 204, 21, 0.92)'
      shellCtx.font = `700 ${11 * scale}px IBM Plex Mono, ui-monospace, monospace`
      shellCtx.textAlign = 'left'
      shellCtx.textBaseline = 'bottom'
      shellCtx.fillText(UI_WIDGET_LABELS[id], b.x, b.y - 4 * scale)
    }
  }
}

export function paintLayoutEditorScene(
  ctx: LayoutEditorPaintContext,
  shellCtx: CanvasRenderingContext2D,
  viewportW: number,
  viewportH: number,
  overrides: UiLayoutOverrides,
  selectedId: UiWidgetId | null
): GameStageLayout {
  const { rt } = ctx
  const layout = syncEditorLayout(rt, viewportW, viewportH, overrides)
  const now = performance.now()

  shellCtx.clearRect(0, 0, viewportW, viewportH)
  drawShellBackground(rt, shellCtx)

  shellCtx.save()
  shellCtx.translate(rt.state.boardOffsetX, rt.state.boardOffsetY)
  const boardState = {
    views: rt.state.currentViews,
    rows: rt.state.currentRows,
    cols: rt.state.currentCols,
    status: rt.state.currentStatus,
    mineTotal: rt.mineTotal,
    flagCount: rt.state.currentFlagCount,
    elapsedSeconds: 0,
    scrollPressure: EDITOR_SCROLL_PRESSURE,
    previewRows: rt.state.currentPreviewRows > 0 ? rt.state.currentPreviewRows : undefined,
    nowMs: now,
    pointer: null,
    flagSwipeActive: false,
  }
  renderBoardStaticFrame(shellCtx, rt.state.squareLayout!, boardState)
  renderBoardDynamicFrame(shellCtx, rt.state.squareLayout!, boardState)
  shellCtx.restore()

  drawBottomEnergyRail(rt, shellCtx, EDITOR_SCROLL_PRESSURE, viewportW, viewportH)

  const spaceRect = getSpaceHintRect(rt, EDITOR_SCROLL_PRESSURE)
  if (spaceRect) {
    drawSpaceHint(rt, shellCtx, spaceRect, EDITOR_SCROLL_PRESSURE, layout.scale, FULL_SCROLL_REVEAL)
  }

  drawFullscreenHud(rt, shellCtx, rt.fullscreen!, viewportW, viewportH, null)

  if (layout.profile === 'mobile' && EDITOR_STATS.combo > 1) {
    drawComboHud(rt, shellCtx, layout.comboHudAnchor.x, layout.comboHudAnchor.y, EDITOR_STATS.combo, layout.scale)
  }

  drawSelectionChrome(shellCtx, rt, layout, selectedId)
  return layout
}

export function hitTestLayoutEditorWidget(ctx: LayoutEditorPaintContext, layout: GameStageLayout, x: number, y: number): UiWidgetId | null {
  for (let i = UI_WIDGET_ORDER.length - 1; i >= 0; i -= 1) {
    const id = UI_WIDGET_ORDER[i]
    const b = getUiWidgetBoundsAfterDraw(ctx.rt, layout, id)
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return id
  }
  return null
}

export { hudContentY }
