import type { AiHintDisplay } from '../../core/ai/types.ts';
import type { GameStatus } from '../../core/types.ts';
import type { ScrollPressureState } from '../renderer/index.ts';

export interface GameCanvasCallbacks {
  onReveal(row: number, col: number): void;
  onToggleFlag(row: number, col: number): void;
  onChord(row: number, col: number): void;
  onReset(): void;
}

export interface GameCanvasLogLine {
  time: string;
  text: string;
  kind: 'ai' | 'player' | 'scroll' | 'danger' | 'system';
}

export interface GameCanvasHudStats {
  score: number;
  combo: number;
  scoreEvent?: {
    id: number;
    scoreAdded: number;
    comboAfter: number;
  };
  breakEvent?: {
    id: number;
    comboCleared: number;
    minesCleared: number;
  };
  lives?: string;
  /** Player can press Space to manual scroll while playing (unsafe bottom rows cost a life). */
  spaceEnabled?: boolean;
  devAutoVisible?: boolean;
  devAutoActive?: boolean;
  /** Difficulty inputs for ambient backdrop (scroll tier / depth / lives). */
  backdrop?: {
    scrollElapsedMs: number;
    scrollDepth: number;
    livesCurrent: number;
    livesMax: number;
  };
  difficulty?: {
    speedTier: number;
    batchTier: number;
  };
}

export interface GameCanvasFullscreenOptions {
  getStats?: () => GameCanvasHudStats;
  getRecentLogs?: () => GameCanvasLogLine[];
  isLogOpen?: () => boolean;
  onStart?: () => void;
  /** Whether to show the start overlay while idle (false = started, waiting for first click). */
  showStartOverlay?: () => boolean;
  onRestart?: () => void;
  onDevAuto?: () => void;
  /** DEV: advance scroll difficulty one tier (+50s elapsed). */
  onDevSpeedUp?: () => void;
  onUiHover?: () => void;
  onUiClick?: () => void;
  /** First pointer on canvas — unlock audio context (browser autoplay policy). */
  onPointerDown?: () => void;
  getBgmMuted?: () => boolean;
  onToggleBgmMute?: () => void;
}

export interface ViewportFitOptions {
  cols: number;
  rows: number;
  minCellSize?: number;
  maxCellSize?: number;
}

export interface GameCanvasOptions {
  /** Looser max board pixels for larger cells on big grids. */
  maxGrid?: { width: number; height: number };
  /** Fixed cell width (endless scroll mode). */
  fixedCellSize?: number;
  /** Fixed board row count (endless: canvas height ignores buffer rows). */
  fixedGridRows?: number;
  /** Fit cell size to viewport in fullscreen (tall endless board). */
  fitViewport?: ViewportFitOptions;
  /** Endless scroll pressure (pre-scroll countdown). */
  getScrollPressure?: () => ScrollPressureState | undefined;
  /** Fullscreen canvas shell (HUD, input, log on one canvas). */
  fullscreen?: GameCanvasFullscreenOptions;
  /** Endless: top preview band height (rows). */
  endlessPreviewRows?: number;
}

export interface GameCanvasRenderOptions {
  hudLeftDisplay?: string;
  hudRightDisplay?: string;
  rows?: number;
  cols?: number;
  aiHint?: AiHintDisplay | null;
  previewRows?: number;
}

export interface GameCanvasController {
  render(
    views: import('../../core/types.ts').CellView[],
    status: GameStatus,
    flagCount: number,
    options?: GameCanvasRenderOptions,
  ): void;
  startTimer(): void;
  stopTimer(): void;
  resetTimer(): void;
  /** Repaint only (scroll countdown animation). */
  repaint(): void;
  /** Pinned scroll-off mine ghosts (shell coords; pure FX, no board mutation). */
  queueScrollMineGhosts(cells: { row: number; col: number }[]): void;
  destroy(): void;
}

export function applyCanvasSize(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
