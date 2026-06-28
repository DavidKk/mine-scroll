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
  /** Manual-scroll button, centered in the bottom action rail (desktop + mobile). */
  spaceButtonRect: Rect;
  scoreAnchor: Point;
  livesAnchor: Point;
  countdownAnchor: Point;
  /** Persistent combo HUD anchor (top on desktop, above bottom rail on mobile). */
  comboHudAnchor: Point;
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
const SCROLL_BUTTON_MIN_H = 44;
const DESKTOP_SCROLL_BUTTON_MIN_W = 128;
const MOBILE_SCROLL_BUTTON_MIN_W = 104;
const BOTTOM_RAIL_MIN_H = 54;
const DESKTOP_BREAKPOINT_W = 768;
/** Extra row reserve when fitting cell size so the board does not hug top/bottom edges. */
const BOARD_HEIGHT_ROW_RESERVE = 1;
const BOARD_VERT_MARGIN_BASE = 6;
/** Mobile: persistent COMBO rail above the grid. */
const MOBILE_COMBO_BAND_H = 46;
/** Mobile: SPEED UP / life-loss alert band below COMBO. */
const MOBILE_ALERT_BAND_H = 38;
/** Matches drawDifficultyAlert maxH / 2. */
const MOBILE_ALERT_VISUAL_HALF_H = 30;
/** Mobile: clearance between alert visuals and first playable row. */
const MOBILE_BOARD_TOP_FEEDBACK_GAP = 4;
/** Desktop: min clearance between board-top alerts and grid. */
const DESKTOP_ALERT_BOARD_CLEARANCE = 10;
/** Desktop: nudge SPEED UP / life-loss alerts downward. */
const DESKTOP_ALERT_Y_OFFSET = 6;

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
  const hudH = (profile === 'mobile' ? 38 : 56) * scale;
  const hudGap = (profile === 'mobile' ? 4 : 8) * scale;
  const bottomRailH = Math.max(
    BOTTOM_RAIL_MIN_H,
    (profile === 'mobile' ? BOTTOM_RAIL_MIN_H : ENDLESS_BOTTOM_RAIL_H) * scale,
  );
  const bottomPad = profile === 'mobile' ? Math.max(8, 8 * scale) : 6 * scale;
  const boardMargin = BOARD_VERT_MARGIN_BASE * scale;
  const mobileGridOriginEstimate = GRID_PADDING + 14 * scale;
  const mobileTopFeedback =
    profile === 'mobile'
      ? MOBILE_COMBO_BAND_H * scale +
        MOBILE_ALERT_BAND_H * scale * 0.5 +
        MOBILE_ALERT_VISUAL_HALF_H * scale +
        MOBILE_BOARD_TOP_FEEDBACK_GAP * scale -
        mobileGridOriginEstimate
      : 0;
  return {
    scale,
    profile,
    safe,
    top: hudH + hudGap + boardMargin + mobileTopFeedback,
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
      : getMobileBoardCanvasY(
          { viewportW, hudY, hudH, boardY: 0, scale, profile },
          estimateMobileGridOriginY(boardH),
        );

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

  const spaceBtnW = Math.max(
    profile === 'mobile' ? MOBILE_SCROLL_BUTTON_MIN_W : DESKTOP_SCROLL_BUTTON_MIN_W,
    (profile === 'mobile' ? MOBILE_SCROLL_BUTTON_MIN_W : DESKTOP_SCROLL_BUTTON_MIN_W) * scale,
  );
  const spaceBtnH = Math.max(SCROLL_BUTTON_MIN_H, 44 * scale);
  const spaceButtonRect: Rect = {
    x: (viewportW - spaceBtnW) / 2,
    y: bottomRailRect.y + (bottomRailRect.h - spaceBtnH) / 2,
    w: spaceBtnW,
    h: spaceBtnH,
  };

  const hudBottom = hudY + hudH;
  const hudGap = (profile === 'mobile' ? 4 : 8) * scale;
  const boardMargin = BOARD_VERT_MARGIN_BASE * scale;
  const comboHudAnchor: Point =
    profile === 'mobile'
      ? { x: viewportW / 2, y: hudBottom + hudGap + boardMargin }
      : { x: viewportW / 2, y: hudY };

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
    scoreAnchor: { x: safe, y: hudY },
    livesAnchor: { x: viewportW - safe, y: hudY },
    countdownAnchor: { x: viewportW / 2, y: hudY },
    comboHudAnchor,
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

type BoardTopEventLayout = Pick<
  GameStageLayout,
  'viewportW' | 'hudY' | 'hudH' | 'boardY' | 'scale' | 'profile'
>;

function estimateMobileGridOriginY(boardH: number): number {
  const bandRows = 18.5;
  const innerH = Math.max(1, boardH - GRID_PADDING * 2);
  const cellStep = innerH / bandRows;
  return GRID_PADDING + 0.5 * cellStep;
}

/** Mobile board canvas Y: first playable row sits just below SPEED UP / life-loss alerts. */
export function getMobileBoardCanvasY(
  layout: BoardTopEventLayout,
  gridOriginY: number,
): number {
  const alertAnchor = getDifficultyAlertAnchor(layout);
  const alertBottom = alertAnchor.y + MOBILE_ALERT_VISUAL_HALF_H * layout.scale;
  const gap = MOBILE_BOARD_TOP_FEEDBACK_GAP * layout.scale;
  return alertBottom + gap - gridOriginY;
}

function mobileBoardTopFeedbackStack(layout: BoardTopEventLayout): {
  comboTopY: number;
  alertCenterY: number;
} {
  const scale = layout.scale;
  const hudGap = (layout.profile === 'mobile' ? 4 : 8) * scale;
  const boardMargin = BOARD_VERT_MARGIN_BASE * scale;
  const hudBottom = layout.hudY + layout.hudH;
  const comboTopY = hudBottom + hudGap + boardMargin;
  const alertCenterY =
    comboTopY + MOBILE_COMBO_BAND_H * scale + MOBILE_ALERT_BAND_H * scale * 0.5;
  return { comboTopY, alertCenterY };
}

/** SPEED UP / DANGER RISE — mobile: below COMBO; desktop: HUD–board gap with board clearance. */
export function getDifficultyAlertAnchor(layout: BoardTopEventLayout): Point {
  if (layout.profile === 'mobile') {
    return {
      x: layout.viewportW / 2,
      y: mobileBoardTopFeedbackStack(layout).alertCenterY,
    };
  }
  const hudBottom = layout.hudY + layout.hudH;
  const gap = Math.max(0, layout.boardY - hudBottom);
  const clearance = DESKTOP_ALERT_BOARD_CLEARANCE * layout.scale;
  const idealY = hudBottom + gap * 0.72;
  return {
    x: layout.viewportW / 2,
    y: Math.min(idealY, layout.boardY - clearance) + DESKTOP_ALERT_Y_OFFSET * layout.scale,
  };
}

/** Life-loss popup shares the board-top alert band (same Y as SPEED UP). */
export function getBoardTopEventAnchor(layout: BoardTopEventLayout | null): Point | null {
  if (!layout) return null;
  return getDifficultyAlertAnchor(layout);
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
