import type { CellView, GameStatus } from '../core/types.ts';
import {
  getCanvasPointerCoords,
  getLayoutMetrics,
  hitTestCell,
  hitTestReset,
  renderFrame,
} from './renderer.ts';
import { getCanvasSize } from './theme.ts';

export interface GameCanvasCallbacks {
  onReveal(row: number, col: number): void;
  onToggleFlag(row: number, col: number): void;
  onChord(row: number, col: number): void;
  onReset(): void;
}

export interface GameCanvasController {
  render(views: CellView[], status: GameStatus, flagCount: number): void;
  startTimer(): void;
  stopTimer(): void;
  resetTimer(): void;
  destroy(): void;
}

export function createGameCanvas(
  container: HTMLElement,
  rows: number,
  cols: number,
  mineTotal: number,
  callbacks: GameCanvasCallbacks,
): GameCanvasController {
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', '扫雷棋盘');
  container.appendChild(canvas);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context not available');
  }
  const ctx = context;

  const layout = getLayoutMetrics(rows, cols);
  const { width, height } = getCanvasSize(rows, cols);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  let elapsed = 0;
  let timerId: number | null = null;
  let currentViews: CellView[] = [];
  let currentStatus: GameStatus = 'idle';
  let currentFlagCount = 0;

  function paint(): void {
    renderFrame(ctx, layout, {
      views: currentViews,
      rows,
      cols,
      status: currentStatus,
      mineTotal,
      flagCount: currentFlagCount,
      elapsedSeconds: elapsed,
    });
  }

  function cellAt(event: MouseEvent): { row: number; col: number } | null {
    const { x, y } = getCanvasPointerCoords(canvas, event);
    if (hitTestReset(layout, x, y)) return null;
    return hitTestCell(layout, rows, cols, x, y);
  }

  function isBothButtons(event: MouseEvent): boolean {
    return (event.buttons & 1) !== 0 && (event.buttons & 2) !== 0;
  }

  function onMouseDown(event: MouseEvent): void {
    const { x, y } = getCanvasPointerCoords(canvas, event);

    if (hitTestReset(layout, x, y)) {
      if (event.button === 0) callbacks.onReset();
      return;
    }

    const cell = hitTestCell(layout, rows, cols, x, y);
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
    render(views, status, flagCount) {
      currentViews = views;
      currentStatus = status;
      currentFlagCount = flagCount;
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
    destroy() {
      this.stopTimer();
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.remove();
    },
  };
}
