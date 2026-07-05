import type { AiHintDisplay } from '@shared/core/ai/types.ts'
import type { GameStatus } from '@shared/core/types.ts'

import type { ScrollPressureState } from '../renderer/index.ts'
import { resolveCanvasDpr } from './runtime/mobile-perf.ts'

export interface GameCanvasCallbacks {
  onReveal(row: number, col: number): void
  onToggleFlag(row: number, col: number): void
  onChord(row: number, col: number): void
  onReset(): void
}

export interface GameCanvasLogLine {
  time: string
  text: string
  kind: 'ai' | 'player' | 'scroll' | 'danger' | 'system'
}

export type DifficultyAlertKind = 'speed-up' | 'danger-rise' | 'ramp-up'

export interface GameCanvasHudStats {
  score: number
  combo: number
  scoreEvent?: {
    id: number
    scoreAdded: number
    scoreAfter: number
    comboAfter: number
  }
  breakEvent?: {
    id: number
    comboCleared: number
    minesCleared: number
  }
  lifeLossEvent?: {
    id: number
    damage: number
    cause: 'mine-reveal' | 'chord-mine' | 'scroll-bottom' | 'wrong-flag'
    comboCleared?: number
    minesCleared?: number
  }
  lives?: string
  /** Player can press Space to manual scroll while playing (unsafe bottom rows cost a life). */
  spaceEnabled?: boolean
  devAutoVisible?: boolean
  devAutoActive?: boolean
  /** DEV scroll tier +1 (↑). Hidden in modes without manual scroll (e.g. puzzle rush). */
  devSpeedVisible?: boolean
  /** Difficulty inputs for ambient backdrop (scroll tier / depth / lives). */
  backdrop?: {
    scrollElapsedMs: number
    scrollDepth: number
    livesCurrent: number
    livesMax: number
    presetId?: import('@shared/core/modes/endless/presets.ts').EndlessDifficultyPresetId
  }
  difficulty?: {
    speedTier: number
    batchTier: number
  }
  /** One-shot HUD alert (puzzle rush intro → warmup, etc.). */
  difficultyAlertEvent?: {
    id: number
    kind: DifficultyAlertKind
  }
}

export interface GameCanvasFullscreenOptions {
  getStats?: () => GameCanvasHudStats
  isLogOpen?: () => boolean
  onStart?: () => void
  /** Whether to show the start overlay while idle (false = started, waiting for first click). */
  showStartOverlay?: () => boolean
  onRestart?: () => void
  onDevAuto?: () => void
  /** DEV: advance scroll difficulty one tier (+50s elapsed). */
  onDevSpeedUp?: () => void
  /** Manual scroll (Space key or on-screen SPACE hint). */
  onManualScroll?: () => void
  /** Difficulty tier escalated (speed, batch, or puzzle ramp). */
  onDifficultyAlert?: (kind: DifficultyAlertKind) => void
  onUiHover?: (target: string) => void
  onUiClick?: () => void
  /** First pointer on canvas — unlock audio context (browser autoplay policy). */
  onPointerDown?: () => void
  getBgmMuted?: () => boolean
  onToggleBgmMute?: () => void
  isLeaderboardOpen?: () => boolean
  hasLeaderboardUnseenUpdate?: () => boolean
  onOpenLeaderboard?: () => void
  rankedInput?: {
    onMove(x: number, y: number): void
    onDown(btn: 0 | 2, x: number, y: number, buttons?: number): void
    onUp(btn: 0 | 2, x: number, y: number): void
    onDoubleClick(x: number, y: number): void
    onContextMenu(x: number, y: number): void
    onLayout(): void
  }
}

export interface ViewportFitOptions {
  cols: number
  rows: number
  minCellSize?: number
  maxCellSize?: number
}

export interface GameCanvasOptions {
  /** Looser max board pixels for larger cells on big grids. */
  maxGrid?: { width: number; height: number }
  /** Fixed cell width (endless scroll mode). */
  fixedCellSize?: number
  /** Fixed board row count (endless: canvas height ignores buffer rows). */
  fixedGridRows?: number
  /** Fit cell size to viewport in fullscreen (tall endless board). */
  fitViewport?: ViewportFitOptions
  /** Endless scroll pressure (pre-scroll countdown). */
  getScrollPressure?: () => ScrollPressureState | undefined
  /** Fullscreen canvas shell (HUD, input, log on one canvas). */
  fullscreen?: GameCanvasFullscreenOptions
  /** Endless: top preview band height (rows). */
  endlessPreviewRows?: number
  /** No panel underlay or side rails — cells composite over the starfield (puzzle rush). */
  transparentBoardUnderlay?: boolean
  /** Fixed shell size for embedded previews (landing page, asset lab). */
  viewportSize?: { width: number; height: number }
  /** Read-only demo shell — skip intro, no ranked/input side effects. */
  previewMode?: { skipIntro?: boolean; /** Landing attract: paint on demand, lower DPR / FPS. */ lowPower?: boolean; maxDpr?: number }
}

export interface GameCanvasRenderOptions {
  hudLeftDisplay?: string
  hudRightDisplay?: string
  rows?: number
  cols?: number
  aiHint?: AiHintDisplay | null
  previewRows?: number
  mineTotal?: number
}

export interface GameCanvasController {
  render(views: import('@shared/core/types.ts').CellView[], status: GameStatus, flagCount: number, options?: GameCanvasRenderOptions): void
  startTimer(): void
  stopTimer(): void
  resetTimer(): void
  /** Repaint only (scroll countdown animation). */
  repaint(): void
  /** Cleared board slides up; next board rises from below with intro ripple. */
  beginBoardAdvance(outgoingViews: import('@shared/core/types.ts').CellView[], incomingViews: import('@shared/core/types.ts').CellView[], onComplete: () => void): void
  isBoardAdvanceActive(): boolean
  /** Pinned scroll-off mine ghosts (shell coords; pure FX, no board mutation). */
  queueScrollMineGhosts(cells: { row: number; col: number }[]): void
  /** Pinned scroll-off wrong-flag break FX (not mine explosion). */
  queueScrollWrongFlagGhosts(cells: { row: number; col: number }[]): void
  /** Attract / tutorial — mobile swipe-up flag preview. */
  playFlagSwipePreview(row: number, col: number, options?: import('./runtime/flag-swipe-preview.ts').FlagSwipePreviewOptions): Promise<void>
  cancelFlagSwipePreview(): void
  getRankedLayoutSnapshot?(): import('../../ranked/types.ts').LayoutSnapshot | null
  /** Stop RAF loop (landing preview off-screen / tab hidden). */
  suspendRendering(): void
  resumeRendering(): void
  destroy(): void
}

export function applyCanvasSize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number, height: number, maxDpr?: number): void {
  const dpr = resolveCanvasDpr(width, maxDpr)
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
