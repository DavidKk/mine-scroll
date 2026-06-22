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
  spaceEnabled: boolean;
  devAutoVisible?: boolean;
  devAutoActive?: boolean;
}

export interface GameCanvasFullscreenOptions {
  getStats?: () => GameCanvasHudStats;
  getRecentLogs?: () => GameCanvasLogLine[];
  isLogOpen?: () => boolean;
  onStart?: () => void;
  /** idle 时是否仍显示「开始」遮罩（false = 已点开始，等待玩家首击） */
  showStartOverlay?: () => boolean;
  onRestart?: () => void;
  onSpace?: () => void;
  onDevAuto?: () => void;
}

export interface ViewportFitOptions {
  cols: number;
  rows: number;
  minCellSize?: number;
  maxCellSize?: number;
}

export interface GameCanvasOptions {
  /** 放宽棋盘最大像素，大格盘时格子更大 */
  maxGrid?: { width: number; height: number };
  /** 固定格宽（无尽卷轴模式） */
  fixedCellSize?: number;
  /** 固定棋盘行数（无尽卷轴：Canvas 高度不随缓冲变化） */
  fixedGridRows?: number;
  /** 全屏时按视口拟合格子尺寸（竖长无尽盘） */
  fitViewport?: ViewportFitOptions;
  /** 无尽卷轴压迫感（准备上移倒数） */
  getScrollPressure?: () => ScrollPressureState | undefined;
  /** 游戏页全屏 Canvas Shell（HUD、操作、日志都画在同一张 Canvas） */
  fullscreen?: GameCanvasFullscreenOptions;
  /** 无尽：棋盘顶缘预览带高度（行） */
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
  /** 仅重绘（卷轴倒数动画） */
  repaint(): void;
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
