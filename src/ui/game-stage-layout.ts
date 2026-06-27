import { CELL_GAP, computeViewportCellSize, DEFAULT_CELL_SIZE, GRID_PADDING } from './theme.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface GameStageLayout {
  viewportW: number;
  viewportH: number;
  stageX: number;
  stageY: number;
  stageW: number;
  stageH: number;
  scale: number;
  profile: EndlessLayoutProfile;
  safe: number;
  hudY: number;
  hudH: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  autoRect: Rect;
  devSpeedRect: Rect;
  bottomRailRect: Rect;
  scoreAnchor: Point;
  livesAnchor: Point;
  countdownAnchor: Point;
}

export interface EndlessShellReserves {
  scale: number;
  profile: EndlessLayoutProfile;
  safe: number;
  top: number;
  bottom: number;
  side: number;
  hudY: number;
  hudH: number;
  bottomRailH: number;
  bottomPad: number;
}

/** Desktop / mobile layout profile breakpoint (desktop-first today). */
export type EndlessLayoutProfile = 'desktop' | 'mobile';

const BASE_STAGE_W = 390;
const BASE_STAGE_H = 844;
const BASE_CELL_SIZE = 28;
const ENDLESS_BOTTOM_RAIL_H = 30;
const DESKTOP_BREAKPOINT_W = 768;
/** Extra row reserve when fitting cell size so the board does not hug top/bottom edges. */
const BOARD_HEIGHT_ROW_RESERVE = 1;
const BOARD_VERT_MARGIN_BASE = 6;

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getEndlessLayoutProfile(viewportW: number): EndlessLayoutProfile {
  return viewportW >= DESKTOP_BREAKPOINT_W ? 'desktop' : 'mobile';
}

/** Shell (HUD / bottom rail) scale: desktop follows viewport width; mobile uses contain. */
export function computeGameStageScale(viewportW: number, viewportH: number): number {
  const profile = getEndlessLayoutProfile(viewportW);
  if (profile === 'desktop') {
    return clamp(0.85, 1.35, viewportW / BASE_STAGE_W);
  }
  const fitScale = Math.min(viewportW / BASE_STAGE_W, viewportH / BASE_STAGE_H);
  return clamp(0.72, 1.18, fitScale);
}

function gridPixelSpan(rows: number, cellSize: number): number {
  return rows * (cellSize + CELL_GAP) - CELL_GAP + GRID_PADDING * 2;
}

/** Endless fullscreen shell reserves — shared with board cell-size fitting. */
export function getEndlessShellReserves(viewportW: number, viewportH: number): EndlessShellReserves {
  const profile = getEndlessLayoutProfile(viewportW);
  const scale = computeGameStageScale(viewportW, viewportH);
  const safe = 16 * scale;
  const hudH = 56 * scale;
  const hudGap = 8 * scale;
  const bottomRailH = ENDLESS_BOTTOM_RAIL_H * scale;
  const bottomPad = 6 * scale;
  const boardMargin = BOARD_VERT_MARGIN_BASE * scale;
  return {
    scale,
    profile,
    safe,
    top: hudH + hudGap + boardMargin,
    bottom: bottomRailH + bottomPad + boardMargin,
    side: 16,
    hudY: 0,
    hudH,
    bottomRailH,
    bottomPad,
  };
}

/**
 * Desktop: cell size from available width; tighten by height only when the board is too tall.
 * Mobile: contain (both axes); tune separately later.
 */
export function computeEndlessBoardCellSize(
  cols: number,
  rows: number,
  viewportW: number,
  viewportH: number,
  limits: { min?: number; max?: number } = {},
): number {
  const reserves = getEndlessShellReserves(viewportW, viewportH);
  const min = limits.min ?? 18;
  const max = limits.max ?? DEFAULT_CELL_SIZE;
  const pad = GRID_PADDING * 2;
  const availW = Math.max(120, viewportW - reserves.side * 2 - pad);
  const availH = Math.max(120, viewportH - reserves.top - reserves.bottom - pad);

  if (reserves.profile === 'mobile') {
    return computeViewportCellSize(
      cols,
      rows + BOARD_HEIGHT_ROW_RESERVE,
      viewportW,
      viewportH,
      { safe: reserves.side, top: reserves.top, bottom: reserves.bottom },
      { min, max, fillHeight: true },
    );
  }

  const fromW = Math.floor((availW + CELL_GAP) / cols - CELL_GAP);
  let cell = clamp(min, max, fromW);
  const fromHReserve = Math.floor(
    (availH + CELL_GAP) / (rows + BOARD_HEIGHT_ROW_RESERVE) - CELL_GAP,
  );
  cell = clamp(min, max, Math.min(cell, fromHReserve));
  if (gridPixelSpan(rows, cell) > availH) {
    const fromH = Math.floor((availH + CELL_GAP) / rows - CELL_GAP);
    cell = clamp(min, max, Math.min(cell, fromH));
  }
  return cell;
}

export function computeGameStageCellSize(
  viewportW: number,
  viewportH: number,
  limits: { min?: number; max?: number } = {},
): number {
  const min = limits.min ?? 18;
  const max = limits.max ?? 30;
  return Math.round(clamp(min, max, BASE_CELL_SIZE * computeGameStageScale(viewportW, viewportH)));
}

export function computeGameStageLayout(
  viewportW: number,
  viewportH: number,
  boardW: number,
  boardH: number,
): GameStageLayout {
  const reserves = getEndlessShellReserves(viewportW, viewportH);
  const scale = reserves.scale;
  const profile = reserves.profile;
  const stageW = BASE_STAGE_W * scale;
  const stageH = BASE_STAGE_H * scale;
  const stageX = (viewportW - stageW) / 2;
  const stageY = Math.max(0, (viewportH - stageH) / 2);
  const safe = reserves.safe;
  const hudY = reserves.hudY;
  const hudH = reserves.hudH;

  const boardAreaTop = reserves.top;
  const boardAreaBottom = viewportH - reserves.bottom;
  const boardX = (viewportW - boardW) / 2;
  const slack = Math.max(0, boardAreaBottom - boardAreaTop - boardH);
  const boardY =
    profile === 'desktop'
      ? boardAreaTop + slack * 0.5
      : boardAreaTop + slack * 0.15;

  const devBtnH = (profile === 'desktop' ? 22 : 20) * scale;
  const devAutoW = (profile === 'desktop' ? 44 : 40) * scale;
  const devSpeedW = (profile === 'desktop' ? 26 : 24) * scale;
  const devInset = safe + 8 * scale;
  const bottomRailRect: Rect = {
    x: 0,
    y: viewportH - reserves.bottomRailH - reserves.bottomPad,
    w: viewportW,
    h: reserves.bottomRailH,
  };

  const autoRect: Rect = {
    x: Math.max(safe, viewportW - devAutoW - devInset),
    y: bottomRailRect.y - devBtnH - 6 * scale,
    w: devAutoW,
    h: devBtnH,
  };
  const devButtonGap = 5 * scale;
  const devSpeedRect: Rect = {
    x: Math.max(safe, autoRect.x - devSpeedW - devButtonGap),
    y: autoRect.y,
    w: devSpeedW,
    h: devBtnH,
  };

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
    scoreAnchor: { x: safe, y: hudY },
    livesAnchor: { x: viewportW - safe, y: hudY },
    countdownAnchor: { x: viewportW / 2, y: hudY },
  };
}

/** Combo / score pop anchor input (aligned with board bottom row and bottom rail). */
export interface ComboFeedbackAnchorInput {
  scale: number;
  boardOffsetY: number;
  gridOriginY: number;
  cellStep: number;
  cellSize: number;
  visibleRows: number;
  bottomRailY: number;
}

/**
 * Defuse combo feedback anchor: center of bottom scroll-off band, between last row and bottom rail.
 * Falls back above viewport bottom when layout is missing.
 */
export function getComboFeedbackAnchor(
  viewportW: number,
  viewportH: number,
  layout: ComboFeedbackAnchorInput | null,
): Point {
  const scale = layout?.scale ?? 1;
  const cx = viewportW / 2;
  if (!layout) {
    return { x: cx, y: viewportH - 72 * scale };
  }

  const bottomRowCenterY =
    layout.boardOffsetY +
    layout.gridOriginY +
    (layout.visibleRows - 1) * layout.cellStep +
    layout.cellSize * 0.42;
  const minY = layout.boardOffsetY + layout.gridOriginY + layout.cellSize * 0.5;
  const y = Math.max(minY, Math.min(bottomRowCenterY, layout.bottomRailY - 28 * scale));
  return { x: cx, y };
}

/** Speed / danger alerts: centered in the HUD–board gap, just above the grid. */
export function getDifficultyAlertAnchor(
  layout: Pick<GameStageLayout, 'viewportW' | 'hudY' | 'hudH' | 'boardY'>,
): Point {
  const hudBottom = layout.hudY + layout.hudH;
  const gap = Math.max(0, layout.boardY - hudBottom);
  return {
    x: layout.viewportW / 2,
    y: hudBottom + gap * 0.82,
  };
}

/** Bottom feedback stack: score pop above, combo burst below, separate anchors. */
export interface BottomFeedbackSlots {
  comboBurst: Point;
  scorePop: Point;
}

const BOTTOM_FEEDBACK_STACK_GAP = 118;

export function getBottomFeedbackSlots(
  viewportW: number,
  viewportH: number,
  layout: ComboFeedbackAnchorInput | null,
): BottomFeedbackSlots {
  const comboBurst = getComboFeedbackAnchor(viewportW, viewportH, layout);
  const scale = layout?.scale ?? 1;
  const stackGap = BOTTOM_FEEDBACK_STACK_GAP * scale;
  const idealScoreY = comboBurst.y - stackGap;

  if (!layout) {
    return {
      comboBurst,
      scorePop: { x: comboBurst.x, y: idealScoreY },
    };
  }

  const minY = layout.boardOffsetY + layout.gridOriginY + layout.cellSize * 0.35;
  const scoreY = Math.max(minY, idealScoreY);
  const verticalSeparation = comboBurst.y - scoreY;

  if (verticalSeparation >= stackGap * 0.65) {
    return {
      comboBurst,
      scorePop: { x: comboBurst.x, y: scoreY },
    };
  }

  // When vertical space is tight: score shifts left but stays clearly above combo
  return {
    comboBurst,
    scorePop: {
      x: comboBurst.x - 92 * scale,
      y: comboBurst.y - stackGap * 0.92,
    },
  };
}
