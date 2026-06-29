import { ENDLESS_COLS, ENDLESS_MOBILE_MAX_VISIBLE_ROWS, ENDLESS_MOBILE_MIN_VISIBLE_ROWS, ENDLESS_VISIBLE_ROWS } from '@shared/core/modes/endless/constants.ts'

import { CELL_GAP, DEFAULT_CELL_SIZE, GRID_PADDING } from './theme.ts'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export interface GameStageLayout {
  viewportW: number
  viewportH: number
  stageX: number
  stageY: number
  stageW: number
  stageH: number
  scale: number
  profile: EndlessLayoutProfile
  safe: number
  hudY: number
  hudH: number
  boardX: number
  boardY: number
  boardW: number
  boardH: number
  autoRect: Rect
  devSpeedRect: Rect
  bottomRailRect: Rect
  /** Manual-scroll button, centered in the bottom action rail (desktop + mobile). */
  spaceButtonRect: Rect
  scoreAnchor: Point
  livesAnchor: Point
  /** Volume / leaderboard chips (top-right on mobile; stacks under lives on desktop). */
  sideControlsAnchor: Point
  countdownAnchor: Point
  /** Persistent combo HUD anchor (top on desktop, above bottom rail on mobile). */
  comboHudAnchor: Point
}

export interface EndlessShellReserves {
  scale: number
  profile: EndlessLayoutProfile
  safe: number
  top: number
  bottom: number
  side: number
  hudY: number
  hudH: number
  bottomRailH: number
  bottomPad: number
}

/** Desktop / mobile layout profile breakpoint (desktop-first today). */
export type EndlessLayoutProfile = 'desktop' | 'mobile'

const BASE_STAGE_W = 390
const BASE_STAGE_H = 844
const BASE_CELL_SIZE = 28
const ENDLESS_BOTTOM_RAIL_H = 30
const SCROLL_BUTTON_MIN_H = 44
const DESKTOP_SCROLL_BUTTON_MIN_H = 38
const DESKTOP_SCROLL_BUTTON_MIN_W = 128
const MOBILE_SCROLL_BUTTON_MIN_W = 104
const BOTTOM_RAIL_MIN_H = 54
const DESKTOP_BREAKPOINT_W = 768
/** Horizontal inset for board cell-size math (mobile uses minimal side gutter). */
const MOBILE_BOARD_SIDE_INSET = 6
/** Extra row reserve when fitting cell size so the board does not hug top/bottom edges. */
const BOARD_HEIGHT_ROW_RESERVE = 1
const BOARD_VERT_MARGIN_BASE = 6
/** Mobile: persistent COMBO rail above the grid. */
const MOBILE_COMBO_BAND_H = 12
/** Mobile: SPEED UP / life-loss alert band below HUD. */
const MOBILE_ALERT_BAND_H = 38
/** Mobile: header block height (score + lives stacked). */
const MOBILE_HUD_H = 124
/** Mobile score panel scale multiplier (applied in score-hud). */
export const MOBILE_SCORE_PANEL_SCALE = 1.5
/** Mobile: lives row inset from left HUD edge. */
const MOBILE_LIVES_LEFT_INSET = 8
/** Mobile: extra nudge right for lives row (within score band). */
export const MOBILE_LIVES_X_NUDGE = 14
/** Mobile: lift lives row by this many row-heights (1 = one full heart row up). */
export const MOBILE_LIVES_LIFT_ROWS = 1
/** Mobile: fine-tune lives row down (screen px). */
export const MOBILE_LIVES_Y_NUDGE = 16
/** Mobile: gap below score panel before lives row. */
export const MOBILE_SCORE_LIVES_GAP = 6
/** Mobile: heart icon scale vs base mobile HUD hearts. */
export const MOBILE_LIVES_SIZE_SCALE = 2
/** Mobile: volume / leaderboard stack top — fraction of viewport height. */
const MOBILE_SIDE_CONTROLS_Y_RATIO = 0.15
/** Mobile: bottom padding below SCROLL rail (tighter to screen edge). */
const MOBILE_BOTTOM_PAD = 2
/** Mobile: clearance between board bottom and bottom rail. */
const MOBILE_BOARD_BOTTOM_MARGIN = 2
/** Mobile: extra visible rows beyond height-fit (fills gap above bottom rail). */
const MOBILE_BOARD_EXTRA_ROWS = 3
/** Mobile: post-layout Y nudge (px). Positive = down; does not change rows or cell size. */
const MOBILE_BOARD_Y_NUDGE = 22
/** Desktop: min clearance between board-top alerts and grid. */
const DESKTOP_ALERT_BOARD_CLEARANCE = 10
/** Desktop: nudge SPEED UP / life-loss alerts downward. */
const DESKTOP_ALERT_Y_OFFSET = 6

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getEndlessLayoutProfile(viewportW: number): EndlessLayoutProfile {
  return viewportW >= DESKTOP_BREAKPOINT_W ? 'desktop' : 'mobile'
}

export function resolveViewportEndlessVisibleRows(viewportW: number, viewportH?: number, previewRows = 0): number {
  if (getEndlessLayoutProfile(viewportW) !== 'mobile') return ENDLESS_VISIBLE_ROWS
  const vh = viewportH ?? (typeof window !== 'undefined' ? window.innerHeight : BASE_STAGE_H)
  return computeEndlessMobileBoardFit(ENDLESS_COLS, viewportW, vh, { previewRows }).visibleRows
}

export interface EndlessMobileBoardFit {
  cellSize: number
  visibleRows: number
  /** Rows before height clamp (after extra-row boost). */
  targetRows: number
  /** Vertical centering when rows are trimmed: (targetRows - visibleRows) / 2 × row step. */
  rowCenterNudge: number
}

function mobileRowStep(cellSize: number): number {
  return cellSize + CELL_GAP
}

/** Shift board toward vertical center when height fit drops visible rows below target. */
export function mobileBoardRowCenterNudge(cellSize: number, targetRows: number, visibleRows: number): number {
  const rowsTrimmed = Math.max(0, targetRows - visibleRows)
  return (rowsTrimmed / 2) * mobileRowStep(cellSize)
}

function mobileWidthCellSize(availW: number, cols: number, min: number, max: number): number {
  return clamp(min, max, Math.floor((availW + CELL_GAP) / cols - CELL_GAP))
}

function mobileEndlessCellSize(viewportW: number, viewportH: number, limits: { min?: number; max?: number } = {}): number {
  const reserves = getEndlessShellReserves(viewportW, viewportH)
  const min = limits.min ?? 18
  const max = limits.max ?? 48
  const pad = GRID_PADDING * 2
  const availW = Math.max(120, viewportW - reserves.side * 2 - pad)
  return mobileWidthCellSize(availW, ENDLESS_COLS, min, max)
}

/** Mobile board canvas top Y — HUD clearance baseline for fit + render. */
export function mobileBoardCanvasY(reserves: EndlessShellReserves, _cellSize?: number): number {
  return reserves.top
}

function mobileBoardBottomLimit(reserves: EndlessShellReserves, viewportH: number): number {
  return viewportH - reserves.bottomRailH - reserves.bottomPad - MOBILE_BOARD_BOTTOM_MARGIN * reserves.scale
}

/** Cap offset from `mobileBoardCanvasY` so the board stays above the bottom rail. */
function clampMobileBoardYOffset(reserves: EndlessShellReserves, boardH: number, viewportH: number, desiredOffset: number): number {
  const top = mobileBoardCanvasY(reserves)
  const maxOffset = mobileBoardBottomLimit(reserves, viewportH) - top - boardH
  return Math.min(desiredOffset, Math.max(0, Math.floor(maxOffset)))
}

function mobileBoardPixelSpan(visibleRows: number, previewRows: number, cellSize: number): number {
  return gridPixelSpan(visibleRows + previewRows, cellSize)
}

function tryGrowMobileVisibleRows(
  visibleRows: number,
  fitCell: number,
  previewRows: number,
  availH: number,
  min: number,
  maxRows: number
): { visibleRows: number; fitCell: number } {
  if (visibleRows >= maxRows) return { visibleRows, fitCell }
  if (mobileBoardPixelSpan(visibleRows + 1, previewRows, fitCell) <= availH) {
    return { visibleRows: visibleRows + 1, fitCell }
  }
  for (let cell = fitCell - 1; cell >= min; cell -= 1) {
    if (mobileBoardPixelSpan(visibleRows + 1, previewRows, cell) <= availH) {
      return { visibleRows: visibleRows + 1, fitCell: cell }
    }
  }
  return { visibleRows, fitCell }
}

/** Mobile: full-width cells, row count chosen to fill HUD → bottom rail. */
export function computeEndlessMobileBoardFit(
  cols: number,
  viewportW: number,
  viewportH: number,
  limits: { min?: number; max?: number; previewRows?: number } = {}
): EndlessMobileBoardFit {
  const previewRows = limits.previewRows ?? 0
  const reserves = getEndlessShellReserves(viewportW, viewportH)
  const min = limits.min ?? 18
  const max = limits.max ?? 48
  const pad = GRID_PADDING * 2
  const availW = Math.max(120, viewportW - reserves.side * 2 - pad)

  const cellSize = mobileWidthCellSize(availW, cols, min, max)
  const boardTop = mobileBoardCanvasY(reserves, cellSize)
  const boardBottom = mobileBoardBottomLimit(reserves, viewportH)
  const availH = Math.max(120, boardBottom - boardTop)

  let visibleRows = ENDLESS_MOBILE_MIN_VISIBLE_ROWS
  while (visibleRows < ENDLESS_MOBILE_MAX_VISIBLE_ROWS) {
    if (mobileBoardPixelSpan(visibleRows + 1, previewRows, cellSize) > availH) break
    visibleRows += 1
  }

  const heightFitRows = visibleRows
  const targetRows = Math.min(ENDLESS_MOBILE_MAX_VISIBLE_ROWS, Math.max(ENDLESS_MOBILE_MIN_VISIBLE_ROWS, heightFitRows + MOBILE_BOARD_EXTRA_ROWS))
  visibleRows = mobileBoardPixelSpan(targetRows, previewRows, cellSize) <= availH ? targetRows : heightFitRows

  let fitCell = cellSize

  while (visibleRows > ENDLESS_MOBILE_MIN_VISIBLE_ROWS && mobileBoardPixelSpan(visibleRows, previewRows, fitCell) > availH) {
    visibleRows -= 1
  }

  while (mobileBoardPixelSpan(visibleRows, previewRows, fitCell) > availH && fitCell > min) {
    fitCell -= 1
  }

  const grown = tryGrowMobileVisibleRows(visibleRows, fitCell, previewRows, availH, min, ENDLESS_MOBILE_MAX_VISIBLE_ROWS)
  visibleRows = grown.visibleRows
  fitCell = grown.fitCell

  const rowCenterNudge = mobileBoardRowCenterNudge(fitCell, targetRows, visibleRows)

  return { cellSize: fitCell, visibleRows, targetRows, rowCenterNudge }
}

/** Shell (HUD / bottom rail) scale: desktop follows viewport width; mobile uses contain. */
export function computeGameStageScale(viewportW: number, viewportH: number): number {
  const profile = getEndlessLayoutProfile(viewportW)
  if (profile === 'desktop') {
    return clamp(0.85, 1.35, viewportW / BASE_STAGE_W)
  }
  const fitScale = Math.min(viewportW / BASE_STAGE_W, viewportH / BASE_STAGE_H)
  return clamp(0.72, 1.18, fitScale)
}

function gridPixelSpan(rows: number, cellSize: number): number {
  return rows * (cellSize + CELL_GAP) - CELL_GAP + GRID_PADDING * 2
}

/** Endless fullscreen shell reserves — shared with board cell-size fitting. */
export function getEndlessShellReserves(viewportW: number, viewportH: number): EndlessShellReserves {
  const profile = getEndlessLayoutProfile(viewportW)
  const scale = computeGameStageScale(viewportW, viewportH)
  const safe = 16 * scale
  const hudH = (profile === 'mobile' ? MOBILE_HUD_H : 56) * scale
  const hudGap = (profile === 'mobile' ? 6 : 8) * scale
  const bottomRailH = Math.max(BOTTOM_RAIL_MIN_H, (profile === 'mobile' ? BOTTOM_RAIL_MIN_H : ENDLESS_BOTTOM_RAIL_H) * scale)
  const bottomPad = profile === 'mobile' ? Math.max(MOBILE_BOTTOM_PAD, MOBILE_BOTTOM_PAD * scale) : 6 * scale
  const boardMargin = BOARD_VERT_MARGIN_BASE * scale
  const mobileBoardBottomMargin = MOBILE_BOARD_BOTTOM_MARGIN * scale
  return {
    scale,
    profile,
    safe,
    top: hudH + hudGap + boardMargin,
    bottom: bottomRailH + bottomPad + (profile === 'mobile' ? mobileBoardBottomMargin : boardMargin),
    side: profile === 'mobile' ? MOBILE_BOARD_SIDE_INSET : 16,
    hudY: 0,
    hudH,
    bottomRailH,
    bottomPad,
  }
}

/**
 * Desktop: cell size from available width; tighten by height only when the board is too tall.
 * Mobile: width-first (board spans viewport), then clamp by available height.
 */
export function computeEndlessBoardCellSize(cols: number, rows: number, viewportW: number, viewportH: number, limits: { min?: number; max?: number } = {}): number {
  const reserves = getEndlessShellReserves(viewportW, viewportH)
  const min = limits.min ?? 18
  const max = limits.max ?? DEFAULT_CELL_SIZE
  const pad = GRID_PADDING * 2
  const availW = Math.max(120, viewportW - reserves.side * 2 - pad)
  const availH = Math.max(120, viewportH - reserves.top - reserves.bottom - pad)

  const fromW = Math.floor((availW + CELL_GAP) / cols - CELL_GAP)
  let cell = clamp(min, max, fromW)

  if (reserves.profile === 'mobile') {
    return computeEndlessMobileBoardFit(cols, viewportW, viewportH, limits).cellSize
  }

  const fromHReserve = Math.floor((availH + CELL_GAP) / (rows + BOARD_HEIGHT_ROW_RESERVE) - CELL_GAP)
  cell = clamp(min, max, Math.min(cell, fromHReserve))
  if (gridPixelSpan(rows, cell) > availH) {
    const fromH = Math.floor((availH + CELL_GAP) / rows - CELL_GAP)
    cell = clamp(min, max, Math.min(cell, fromH))
  }
  return cell
}

export function computeGameStageCellSize(viewportW: number, viewportH: number, limits: { min?: number; max?: number } = {}): number {
  const min = limits.min ?? 18
  const max = limits.max ?? 30
  return Math.round(clamp(min, max, BASE_CELL_SIZE * computeGameStageScale(viewportW, viewportH)))
}

export function computeGameStageLayout(
  viewportW: number,
  viewportH: number,
  boardW: number,
  boardH: number,
  cellSize?: number,
  visibleRows?: number,
  mobileRowCenterNudge = 0
): GameStageLayout {
  const reserves = getEndlessShellReserves(viewportW, viewportH)
  const scale = reserves.scale
  const profile = reserves.profile
  const stageW = BASE_STAGE_W * scale
  const stageH = BASE_STAGE_H * scale
  const stageX = (viewportW - stageW) / 2
  const stageY = Math.max(0, (viewportH - stageH) / 2)
  const safe = reserves.safe
  const hudY = reserves.hudY
  const hudH = reserves.hudH

  const boardAreaTop = reserves.top
  const boardAreaBottom = viewportH - reserves.bottom
  const boardX = (viewportW - boardW) / 2
  const slack = Math.max(0, boardAreaBottom - boardAreaTop - boardH)
  const mobileCell = cellSize ?? mobileEndlessCellSize(viewportW, viewportH)
  const mobileYOffset =
    profile === 'mobile' && visibleRows != null
      ? clampMobileBoardYOffset(reserves, boardH, viewportH, MOBILE_BOARD_Y_NUDGE + mobileRowCenterNudge)
      : MOBILE_BOARD_Y_NUDGE + mobileRowCenterNudge
  const boardY = profile === 'desktop' ? boardAreaTop + slack * 0.5 : mobileBoardCanvasY(reserves, mobileCell) + mobileYOffset

  const devBtnH = (profile === 'desktop' ? 26 : 23) * scale
  const devAutoW = (profile === 'desktop' ? 50 : 46) * scale
  const devSpeedW = (profile === 'desktop' ? 30 : 27) * scale
  const devInset = safe + 8 * scale
  const cornerInset = profile === 'mobile' ? MOBILE_BOARD_SIDE_INSET + 4 * scale : devInset
  const bottomRailRect: Rect = {
    x: 0,
    y: viewportH - reserves.bottomRailH - reserves.bottomPad,
    w: viewportW,
    h: reserves.bottomRailH,
  }

  const autoRect: Rect = {
    x: viewportW - devAutoW - cornerInset,
    y: bottomRailRect.y + (bottomRailRect.h - devBtnH) / 2,
    w: devAutoW,
    h: devBtnH,
  }
  const devButtonGap = 6 * scale
  const devSpeedRect: Rect = {
    x: Math.max(cornerInset, autoRect.x - devSpeedW - devButtonGap),
    y: autoRect.y,
    w: devSpeedW,
    h: devBtnH,
  }

  const spaceBtnW = Math.max(
    profile === 'mobile' ? MOBILE_SCROLL_BUTTON_MIN_W : DESKTOP_SCROLL_BUTTON_MIN_W,
    (profile === 'mobile' ? MOBILE_SCROLL_BUTTON_MIN_W : DESKTOP_SCROLL_BUTTON_MIN_W) * scale
  )
  const spaceBtnH = Math.max(
    profile === 'mobile' ? SCROLL_BUTTON_MIN_H : DESKTOP_SCROLL_BUTTON_MIN_H,
    (profile === 'mobile' ? SCROLL_BUTTON_MIN_H : DESKTOP_SCROLL_BUTTON_MIN_H) * scale
  )
  const spaceButtonRect: Rect = {
    x: (viewportW - spaceBtnW) / 2,
    y: bottomRailRect.y + (bottomRailRect.h - spaceBtnH) / 2,
    w: spaceBtnW,
    h: spaceBtnH,
  }

  const hudBottom = hudY + hudH
  const hudGap = (profile === 'mobile' ? 4 : 8) * scale
  const boardMargin = BOARD_VERT_MARGIN_BASE * scale
  const comboHudAnchor: Point = profile === 'mobile' ? { x: viewportW / 2, y: hudBottom + hudGap + boardMargin } : { x: viewportW / 2, y: hudY }
  const mobileHudLeft = MOBILE_BOARD_SIDE_INSET * scale

  return {
    viewportW,
    viewportH,
    stageX,
    stageY,
    stageW,
    stageH,
    scale,
    profile,
    safe,
    hudY,
    hudH,
    boardX,
    boardY,
    boardW,
    boardH,
    autoRect,
    devSpeedRect,
    bottomRailRect,
    spaceButtonRect,
    scoreAnchor: { x: profile === 'mobile' ? mobileHudLeft : safe, y: hudY },
    livesAnchor: profile === 'mobile' ? { x: mobileHudLeft + MOBILE_LIVES_LEFT_INSET * scale, y: hudY } : { x: viewportW - safe, y: hudY },
    sideControlsAnchor: {
      x: viewportW - safe,
      y: profile === 'mobile' ? viewportH * MOBILE_SIDE_CONTROLS_Y_RATIO : hudY,
    },
    countdownAnchor: { x: viewportW / 2, y: hudY },
    comboHudAnchor,
  }
}

/** Combo / score pop anchor input (aligned with board bottom row and bottom rail). */
export interface ComboFeedbackAnchorInput {
  scale: number
  boardOffsetY: number
  gridOriginY: number
  cellStep: number
  cellSize: number
  visibleRows: number
  bottomRailY: number
}

/**
 * Defuse combo feedback anchor: center of bottom scroll-off band, between last row and bottom rail.
 * Falls back above viewport bottom when layout is missing.
 */
export function getComboFeedbackAnchor(viewportW: number, viewportH: number, layout: ComboFeedbackAnchorInput | null): Point {
  const scale = layout?.scale ?? 1
  const cx = viewportW / 2
  if (!layout) {
    return { x: cx, y: viewportH - 72 * scale }
  }

  const bottomRowCenterY = layout.boardOffsetY + layout.gridOriginY + (layout.visibleRows - 1) * layout.cellStep + layout.cellSize * 0.42
  const minY = layout.boardOffsetY + layout.gridOriginY + layout.cellSize * 0.5
  const y = Math.max(minY, Math.min(bottomRowCenterY, layout.bottomRailY - 28 * scale))
  return { x: cx, y }
}

type BoardTopEventLayout = Pick<GameStageLayout, 'viewportW' | 'hudY' | 'hudH' | 'boardY' | 'scale' | 'profile'>

/** Mobile board canvas Y — grid starts just below HUD; combo/alerts overlay top rows. */
export function getMobileBoardCanvasY(layout: BoardTopEventLayout, _gridOriginY?: number): number {
  const hudBottom = layout.hudY + layout.hudH
  const gap = (layout.profile === 'mobile' ? 2 : 8) * layout.scale
  return hudBottom + gap
}

function mobileBoardTopFeedbackStack(layout: BoardTopEventLayout): {
  comboTopY: number
  alertCenterY: number
} {
  const scale = layout.scale
  const hudGap = (layout.profile === 'mobile' ? 4 : 8) * scale
  const boardMargin = BOARD_VERT_MARGIN_BASE * scale
  const hudBottom = layout.hudY + layout.hudH
  const comboTopY = hudBottom + hudGap + boardMargin
  const alertCenterY = comboTopY + MOBILE_COMBO_BAND_H * scale + MOBILE_ALERT_BAND_H * scale * 0.5
  return { comboTopY, alertCenterY }
}

/** SPEED UP / DANGER RISE — mobile: below COMBO; desktop: HUD–board gap with board clearance. */
export function getDifficultyAlertAnchor(layout: BoardTopEventLayout): Point {
  if (layout.profile === 'mobile') {
    return {
      x: layout.viewportW / 2,
      y: mobileBoardTopFeedbackStack(layout).alertCenterY,
    }
  }
  const hudBottom = layout.hudY + layout.hudH
  const gap = Math.max(0, layout.boardY - hudBottom)
  const clearance = DESKTOP_ALERT_BOARD_CLEARANCE * layout.scale
  const idealY = hudBottom + gap * 0.72
  return {
    x: layout.viewportW / 2,
    y: Math.min(idealY, layout.boardY - clearance) + DESKTOP_ALERT_Y_OFFSET * layout.scale,
  }
}

/** Life-loss popup shares the board-top alert band (same Y as SPEED UP). */
export function getBoardTopEventAnchor(layout: BoardTopEventLayout | null): Point | null {
  if (!layout) return null
  return getDifficultyAlertAnchor(layout)
}

/** Bottom feedback stack: score pop above, combo burst below, separate anchors. */
export interface BottomFeedbackSlots {
  comboBurst: Point
  scorePop: Point
}

const BOTTOM_FEEDBACK_STACK_GAP = 118

export function getBottomFeedbackSlots(viewportW: number, viewportH: number, layout: ComboFeedbackAnchorInput | null): BottomFeedbackSlots {
  const comboBurst = getComboFeedbackAnchor(viewportW, viewportH, layout)
  const scale = layout?.scale ?? 1
  const stackGap = BOTTOM_FEEDBACK_STACK_GAP * scale
  const idealScoreY = comboBurst.y - stackGap

  if (!layout) {
    return {
      comboBurst,
      scorePop: { x: comboBurst.x, y: idealScoreY },
    }
  }

  const minY = layout.boardOffsetY + layout.gridOriginY + layout.cellSize * 0.35
  const scoreY = Math.max(minY, idealScoreY)
  const verticalSeparation = comboBurst.y - scoreY

  if (verticalSeparation >= stackGap * 0.65) {
    return {
      comboBurst,
      scorePop: { x: comboBurst.x, y: scoreY },
    }
  }

  // When vertical space is tight: score shifts left but stays clearly above combo
  return {
    comboBurst,
    scorePop: {
      x: comboBurst.x - 92 * scale,
      y: comboBurst.y - stackGap * 0.92,
    },
  }
}
