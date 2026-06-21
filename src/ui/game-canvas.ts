import type { CellView, GameStatus } from '../core/types.ts';
import type { AiHintDisplay } from '../core/ai/types.ts';
import { DEFAULT_CELL_SIZE } from './theme.ts';
import {
  getHexLayoutMetrics,
  hitTestHexCell,
  hitTestHexReset,
  renderHexFrame,
} from './hex-grid.ts';
import {
  getCanvasPointerCoords,
  getLayoutMetrics,
  hitTestCell,
  hitTestReset,
  renderFrame,
  type LayoutMetrics,
  type ScrollPressureState,
} from './renderer.ts';

export interface GameCanvasCallbacks {
  onReveal(row: number, col: number): void;
  onToggleFlag(row: number, col: number): void;
  onChord(row: number, col: number): void;
  onReset(): void;
}

export interface GameCanvasOptions {
  hexRadius?: number;
  /** 放宽棋盘最大像素，大格盘时格子更大 */
  maxGrid?: { width: number; height: number };
  /** 固定格宽（无尽卷轴模式） */
  fixedCellSize?: number;
  /** 固定棋盘行数（无尽卷轴：Canvas 高度不随缓冲变化） */
  fixedGridRows?: number;
  /** 每次绘制时读取右侧 HUD（卷轴倒计时等） */
  getHudRightDisplay?: () => string | undefined;
  /** 无尽卷轴压迫感（准备上移倒数） */
  getScrollPressure?: () => ScrollPressureState | undefined;
}

export interface GameCanvasRenderOptions {
  hudLeftDisplay?: string;
  hudDefusedDisplay?: string;
  hudRightDisplay?: string;
  rows?: number;
  cols?: number;
  aiHint?: AiHintDisplay | null;
}

export interface GameCanvasController {
  render(
    views: CellView[],
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

function applyCanvasSize(
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

export function createGameCanvas(
  container: HTMLElement,
  rows: number,
  cols: number,
  mineTotal: number,
  callbacks: GameCanvasCallbacks,
  canvasOptions: GameCanvasOptions = {},
): GameCanvasController {
  const isHex = canvasOptions.hexRadius !== undefined;
  const fixedCellSize = canvasOptions.fixedCellSize;
  const fixedGridRows = canvasOptions.fixedGridRows;
  const getHudRightDisplayFn = canvasOptions.getHudRightDisplay;
  const getScrollPressureFn = canvasOptions.getScrollPressure;
  const hexLayout = isHex ? getHexLayoutMetrics(canvasOptions.hexRadius!) : null;
  let currentRows = fixedGridRows ?? rows;
  let currentCols = cols;
  let squareLayout: LayoutMetrics | null = isHex
    ? null
    : getLayoutMetrics(currentRows, cols, canvasOptions.maxGrid, fixedCellSize);

  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', isHex ? '六边形扫雷棋盘' : '扫雷棋盘');
  container.appendChild(canvas);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context not available');
  }
  const ctx = context;

  let width = isHex ? hexLayout!.width : squareLayout!.width;
  let height = isHex ? hexLayout!.height : squareLayout!.height;
  applyCanvasSize(canvas, ctx, width, height);

  let elapsed = 0;
  let timerId: number | null = null;
  let pressureRepaintId: number | null = null;
  let currentViews: CellView[] = [];
  let currentStatus: GameStatus = 'idle';
  let currentFlagCount = 0;
  let currentHudLeftDisplay: string | undefined;
  let currentHudDefusedDisplay: string | undefined;
  let currentHudRightDisplay: string | undefined;
  let currentAiHint: AiHintDisplay | null | undefined;

  function syncSquareLayout(nextRows: number, nextCols: number): void {
    if (isHex || !squareLayout || fixedGridRows !== undefined) return;
    squareLayout = getLayoutMetrics(nextRows, nextCols, canvasOptions.maxGrid, fixedCellSize);
    width = squareLayout.width;
    height = squareLayout.height;
    applyCanvasSize(canvas, ctx, width, height);
  }

  function stopPressureRepaint(): void {
    if (pressureRepaintId !== null) {
      window.clearInterval(pressureRepaintId);
      pressureRepaintId = null;
    }
  }

  function syncPressureRepaint(): void {
    if (!getScrollPressureFn || currentStatus !== 'playing' || !getScrollPressureFn()) {
      stopPressureRepaint();
      return;
    }
    if (pressureRepaintId !== null) return;
    pressureRepaintId = window.setInterval(() => {
      if (!getScrollPressureFn?.() || currentStatus !== 'playing') {
        stopPressureRepaint();
        return;
      }
      paint();
    }, 100);
  }

  function paint(): void {
    const hudRight = getHudRightDisplayFn?.() ?? currentHudRightDisplay;
    const scrollPressure = getScrollPressureFn?.();
    const renderState = {
      views: currentViews,
      status: currentStatus,
      mineTotal,
      flagCount: currentFlagCount,
      elapsedSeconds: elapsed,
      hudLeftDisplay: currentHudLeftDisplay,
      hudDefusedDisplay: currentHudDefusedDisplay,
      hudRightDisplay: hudRight,
      scrollPressure,
      aiHint: currentAiHint,
    };

    if (isHex && hexLayout) {
      renderHexFrame(ctx, hexLayout, {
        ...renderState,
        aiHint: currentAiHint,
      });
      return;
    }

    renderFrame(ctx, squareLayout!, {
      ...renderState,
      rows: currentRows,
      cols: currentCols,
    });
    syncPressureRepaint();
  }

  function hitReset(x: number, y: number): boolean {
    if (isHex && hexLayout) return hitTestHexReset(hexLayout, x, y);
    return hitTestReset(squareLayout!, x, y);
  }

  function cellAtCoords(x: number, y: number): { row: number; col: number } | null {
    if (isHex && hexLayout) return hitTestHexCell(hexLayout, currentViews, x, y);
    return hitTestCell(squareLayout!, currentRows, currentCols, x, y);
  }

  function cellAt(event: MouseEvent): { row: number; col: number } | null {
    const { x, y } = getCanvasPointerCoords(canvas, event);
    if (hitReset(x, y)) return null;
    return cellAtCoords(x, y);
  }

  function isBothButtons(event: MouseEvent): boolean {
    return (event.buttons & 1) !== 0 && (event.buttons & 2) !== 0;
  }

  function onMouseDown(event: MouseEvent): void {
    const { x, y } = getCanvasPointerCoords(canvas, event);

    if (hitReset(x, y)) {
      if (event.button === 0) callbacks.onReset();
      return;
    }

    const cell = cellAtCoords(x, y);
    if (!cell) return;

    if (isBothButtons(event)) {
      event.preventDefault();
      callbacks.onChord(cell.row, cell.col);
      return;
    }

    if (event.button === 0) {
      callbacks.onReveal(cell.row, cell.col);
    }
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (isBothButtons(event)) {
      const cell = cellAt(event);
      if (cell) callbacks.onChord(cell.row, cell.col);
      return;
    }
    const cell = cellAt(event);
    if (cell) {
      callbacks.onToggleFlag(cell.row, cell.col);
    }
  }

  function onDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    const cell = cellAt(event);
    if (cell) {
      callbacks.onChord(cell.row, cell.col);
    }
  }

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('dblclick', onDoubleClick);

  return {
    render(views, status, flagCount, options) {
      const nextRows = fixedGridRows ?? options?.rows ?? currentRows;
      const nextCols = options?.cols ?? currentCols;

      if (!isHex && !fixedGridRows && (nextRows !== currentRows || nextCols !== currentCols)) {
        syncSquareLayout(nextRows, nextCols);
        currentRows = nextRows;
        currentCols = nextCols;
      }

      currentViews = views;
      currentStatus = status;
      currentFlagCount = flagCount;
      currentHudLeftDisplay = options?.hudLeftDisplay;
      currentHudDefusedDisplay = options?.hudDefusedDisplay;
      currentHudRightDisplay = options?.hudRightDisplay;
      currentAiHint = options?.aiHint;
      paint();
    },
    startTimer() {
      if (timerId !== null) return;
      timerId = window.setInterval(() => {
        elapsed += 1;
        paint();
      }, 1000);
    },
    stopTimer() {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    },
    resetTimer() {
      this.stopTimer();
      elapsed = 0;
      paint();
    },
    repaint() {
      paint();
    },
    destroy() {
      this.stopTimer();
      stopPressureRepaint();
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.remove();
    },
  };
}

export { DEFAULT_CELL_SIZE };
