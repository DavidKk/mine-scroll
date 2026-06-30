import type { AiHintDisplay } from '@shared/core/ai/types.ts'
import type { CellView, GameStatus } from '@shared/core/types.ts'

import type { BackdropMood } from '../../ambient-backdrop.ts'
import type { BoardPointerState } from '../../cell-fx.ts'
import type { GameStageLayout } from '../../game-stage-layout.ts'
import type { LayoutMetrics } from '../../renderer/index.ts'
import type { GameCanvasHudStats } from '../types.ts'

export type CellFxKind = 'reveal' | 'flag' | 'unflag' | 'explode' | 'scroll-mine-ghost' | 'scroll-wrong-flag-ghost'

export interface CellFx {
  kind: CellFxKind
  row: number
  col: number
  startedAt: number
  durationMs: number
  pinShellX?: number
  pinShellY?: number
  cellSize?: number
}

export interface ParticleFx {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  startedAt: number
  durationMs: number
}

export interface HitRect {
  x: number
  y: number
  w: number
  h: number
}

/** Touch flag swipe: locked cell preview (no finger-follow UI). */
export interface FlagSwipePreviewState {
  row: number
  col: number
  active: boolean
}

export interface PendingPanelTransition {
  kind: 'start' | 'retry'
  startedAt: number
  durationMs: number
  timerId: number
}

export interface CanvasRuntimeState {
  currentRows: number
  currentCols: number
  fittedCellSize: number | undefined
  currentPreviewRows: number
  squareLayout: LayoutMetrics | null
  boardWidth: number
  boardHeight: number
  width: number
  height: number
  boardOffsetX: number
  boardOffsetY: number
  stageLayout: GameStageLayout | null
  startRect: HitRect | null
  retryRect: HitRect | null
  devAutoRect: HitRect | null
  devSpeedRect: HitRect | null
  spaceHintRect: HitRect | null
  /** performance.now() when scroll button reveal started; 0 when hidden. */
  scrollButtonRevealStartedAt: number
  /** Game intro: 0 = pending, >0 = startedAt, -1 = done/skipped. */
  gameIntroStartedAt: number
  gameIntroComplete: boolean
  bgmMuteRect: HitRect | null
  leaderboardRect: HitRect | null
  uiHoverTarget: string | null
  pendingPanelTransition: PendingPanelTransition | null
  elapsed: number
  timerId: number | null
  pressureRepaintId: number | null
  currentViews: CellView[]
  currentStatus: GameStatus
  currentFlagCount: number
  currentHudLeftDisplay: string | undefined
  currentHudRightDisplay: string | undefined
  currentAiHint: AiHintDisplay | null | undefined
  lastCombo: number
  comboFxStartedAt: number
  lastScoreEventId: number
  scoreFxStartedAt: number
  scoreCountUpFrom: number
  scoreCountUpTo: number
  scoreCountUpStartedAt: number
  lastDisplayedScore: number | null
  activeScoreEvent: GameCanvasHudStats['scoreEvent'] | null
  lastBreakEventId: number
  breakFxStartedAt: number
  activeBreakEvent: GameCanvasHudStats['breakEvent'] | null
  lastLifeLossEventId: number
  lifeLossFxStartedAt: number
  activeLifeLossEvent: GameCanvasHudStats['lifeLossEvent'] | null
  lastDifficultySpeedTier: number | null
  lastDifficultyBatchTier: number | null
  activeDifficultyAlert: { kind: 'speed-up' | 'danger-rise'; startedAt: number } | null
  animationFrameId: number | null
  ambientDelayId: number | null
  lastPaintAt: number
  boardLayerCache: HTMLCanvasElement | null
  boardLayerCacheCtx: CanvasRenderingContext2D | null
  boardLayerCacheKey: string
  boardLayerCacheDpr: number
  shellBgCache: HTMLCanvasElement | null
  shellBgCacheKey: string
  boardPointer: BoardPointerState | null
  flagSwipePreview: FlagSwipePreviewState | null
  lastLivesCurrent: number
  heartRefillFxStartedAt: number
  heartRefillTargetIndex: number
  heartRefillMax: number
  levelUpFxStartedAt: number
  backdropMood: BackdropMood
  lastBackdropSampleAt: number
  ambientBackdropCache: HTMLCanvasElement | null
  ambientBackdropCacheKey: string
  cellEffects: CellFx[]
  particles: ParticleFx[]
}

export const RUNTIME_CONSTANTS = {
  LIFE_LOSS_POPUP_V3_MS: 820,
  AMBIENT_FRAME_MS: 1000 / 40,
  PANEL_V3_MS: 1480,
  DIFFICULTY_ALERT_MS: 1260,
  SCORE_HUD_PULSE_MS: 420,
  SCORE_COUNT_UP_MS: 480,
  SCROLL_BUTTON_REVEAL_WIDTH_MS: 320,
  SCROLL_BUTTON_REVEAL_HEIGHT_MS: 220,
  SCROLL_BUTTON_REVEAL_HEIGHT_DELAY_MS: 260,
  SCROLL_BUTTON_REVEAL_CONTENT_DELAY_MS: 420,
  SCROLL_BUTTON_REVEAL_CONTENT_MS: 180,
  GAME_INTRO_LINE_MS: 800,
  GAME_INTRO_HUD_DELAY_MS: 260,
  GAME_INTRO_HUD_MS: 1000,
  GAME_INTRO_BOARD_DELAY_MS: 520,
  GAME_INTRO_BOARD_MS: 1600,
  GAME_INTRO_START_DELAY_MS: 2000,
  GAME_INTRO_START_MS: 650,
  GAME_INTRO_TOTAL_MS: 2800,
} as const

export function createInitialRuntimeState(
  rows: number,
  cols: number,
  fittedCellSize: number | undefined,
  squareLayout: LayoutMetrics | null,
  width: number,
  height: number
): CanvasRuntimeState {
  return {
    currentRows: rows,
    currentCols: cols,
    fittedCellSize,
    currentPreviewRows: 0,
    squareLayout,
    boardWidth: squareLayout?.width ?? 0,
    boardHeight: squareLayout?.height ?? 0,
    width,
    height,
    boardOffsetX: 0,
    boardOffsetY: 0,
    stageLayout: null,
    startRect: null,
    retryRect: null,
    devAutoRect: null,
    devSpeedRect: null,
    spaceHintRect: null,
    scrollButtonRevealStartedAt: 0,
    gameIntroStartedAt: 0,
    gameIntroComplete: false,
    bgmMuteRect: null,
    leaderboardRect: null,
    uiHoverTarget: null,
    pendingPanelTransition: null,
    elapsed: 0,
    timerId: null,
    pressureRepaintId: null,
    currentViews: [],
    currentStatus: 'idle',
    currentFlagCount: 0,
    currentHudLeftDisplay: undefined,
    currentHudRightDisplay: undefined,
    currentAiHint: undefined,
    lastCombo: 0,
    comboFxStartedAt: 0,
    lastScoreEventId: 0,
    scoreFxStartedAt: 0,
    scoreCountUpFrom: 0,
    scoreCountUpTo: 0,
    scoreCountUpStartedAt: 0,
    lastDisplayedScore: null,
    activeScoreEvent: null,
    lastBreakEventId: 0,
    breakFxStartedAt: 0,
    activeBreakEvent: null,
    lastLifeLossEventId: 0,
    lifeLossFxStartedAt: 0,
    activeLifeLossEvent: null,
    lastDifficultySpeedTier: null,
    lastDifficultyBatchTier: null,
    activeDifficultyAlert: null,
    animationFrameId: null,
    ambientDelayId: null,
    lastPaintAt: 0,
    boardLayerCache: null,
    boardLayerCacheCtx: null,
    boardLayerCacheKey: '',
    boardLayerCacheDpr: 0,
    shellBgCache: null,
    shellBgCacheKey: '',
    boardPointer: null,
    flagSwipePreview: null,
    lastLivesCurrent: -1,
    heartRefillFxStartedAt: 0,
    heartRefillTargetIndex: 0,
    heartRefillMax: 5,
    levelUpFxStartedAt: 0,
    backdropMood: { heat: 0.15, energy: 0.88, intensity: 0 },
    lastBackdropSampleAt: 0,
    ambientBackdropCache: null,
    ambientBackdropCacheKey: '',
    cellEffects: [],
    particles: [],
  }
}
