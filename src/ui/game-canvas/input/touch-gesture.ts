import type { GameCanvasRuntime } from '../runtime/context.ts';
import type { FlagSwipePreviewState } from '../runtime/state.ts';
import { useTouchPointerInput } from './input-profile.ts';

export const DOUBLE_TAP_MS = 300;

export interface GestureThresholds {
  swipeThresholdY: number;
  tapSlop: number;
}

export interface TouchGestureSession {
  pointerId: number;
  cell: { row: number; col: number };
  x0: number;
  y0: number;
  t0: number;
  mode: 'idle' | 'swipe-flag';
}

export interface PendingTap {
  row: number;
  col: number;
  timerId: number;
}

export interface DoubleTapState {
  lastCellKey: string | null;
  lastTapAt: number;
}

export type PointerEndClassification = 'swipe-flag' | 'tap' | 'cancel';

export function computeGestureThresholds(cellSize: number): GestureThresholds {
  return {
    swipeThresholdY: Math.max(20, cellSize * 0.35),
    tapSlop: Math.max(10, cellSize * 0.18),
  };
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function sameCell(
  a: { row: number; col: number },
  b: { row: number; col: number },
): boolean {
  return a.row === b.row && a.col === b.col;
}

export function classifyPointerEnd(
  dx: number,
  dy: number,
  mode: 'idle' | 'swipe-flag',
  thresholds: GestureThresholds,
): PointerEndClassification {
  if (mode === 'swipe-flag') return 'swipe-flag';
  if (Math.hypot(dx, dy) <= thresholds.tapSlop) return 'tap';
  if (Math.abs(dy) > thresholds.swipeThresholdY) return 'swipe-flag';
  return 'cancel';
}

export function detectSwipeDuringMove(
  dy: number,
  mode: 'idle' | 'swipe-flag',
  thresholds: GestureThresholds,
): 'idle' | 'swipe-flag' {
  if (mode === 'swipe-flag') return 'swipe-flag';
  if (Math.abs(dy) > thresholds.swipeThresholdY) return 'swipe-flag';
  return 'idle';
}

export function isDoubleTap(
  cell: { row: number; col: number },
  now: number,
  state: DoubleTapState,
): boolean {
  if (!state.lastCellKey) return false;
  return state.lastCellKey === cellKey(cell.row, cell.col) && now - state.lastTapAt <= DOUBLE_TAP_MS;
}

export function useTouchGestureInput(viewportW: number): boolean {
  return useTouchPointerInput(viewportW);
}

export interface TouchGestureController {
  handlePointerDown(event: PointerEvent): void;
  handlePointerMove(event: PointerEvent): void;
  handlePointerUp(event: PointerEvent): void;
  handlePointerCancel(event: PointerEvent): void;
  destroy(): void;
}

export function createTouchGestureController(
  rt: GameCanvasRuntime,
  deps: {
    cellAtCoords(x: number, y: number): { row: number; col: number } | null;
    canvasCoords(event: PointerEvent): { x: number; y: number };
    setBoardPointerLocked(cell: { row: number; col: number }, pressed: boolean): void;
    setFlagSwipePreview(preview: FlagSwipePreviewState | null): void;
    clearTouchPointerState(): void;
    handleUiPointerDown(x: number, y: number): boolean;
    blocksBoardInput(): boolean;
  },
): TouchGestureController {
  let session: TouchGestureSession | null = null;
  let pendingTap: PendingTap | null = null;
  let doubleTap: DoubleTapState = { lastCellKey: null, lastTapAt: 0 };

  function thresholds(): GestureThresholds {
    const cellSize = rt.state.squareLayout?.grid.cellSize ?? 28;
    return computeGestureThresholds(cellSize);
  }

  function clearPendingTap(): void {
    if (pendingTap) {
      window.clearTimeout(pendingTap.timerId);
      pendingTap = null;
    }
  }

  function releaseSession(event: PointerEvent): void {
    if (session && session.pointerId === event.pointerId) {
      try {
        rt.canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      session = null;
    }
    deps.clearTouchPointerState();
  }

  function scheduleReveal(cell: { row: number; col: number }): void {
    clearPendingTap();
    const key = cellKey(cell.row, cell.col);
    doubleTap = { lastCellKey: key, lastTapAt: performance.now() };
    const timerId = window.setTimeout(() => {
      pendingTap = null;
      doubleTap = { lastCellKey: null, lastTapAt: 0 };
      rt.callbacks.onReveal(cell.row, cell.col);
    }, DOUBLE_TAP_MS);
    pendingTap = { row: cell.row, col: cell.col, timerId };
  }

  function handleTap(cell: { row: number; col: number }): void {
    const now = performance.now();
    if (pendingTap && sameCell(pendingTap, cell) && now - doubleTap.lastTapAt <= DOUBLE_TAP_MS) {
      clearPendingTap();
      doubleTap = { lastCellKey: null, lastTapAt: 0 };
      rt.callbacks.onChord(cell.row, cell.col);
      return;
    }
    if (isDoubleTap(cell, now, doubleTap)) {
      clearPendingTap();
      doubleTap = { lastCellKey: null, lastTapAt: 0 };
      rt.callbacks.onChord(cell.row, cell.col);
      return;
    }
    scheduleReveal(cell);
  }

  return {
    handlePointerDown(event: PointerEvent): void {
      if (!useTouchGestureInput(rt.state.width)) return;
      if (event.pointerType === 'mouse') return;

      event.preventDefault();

      const { x, y } = deps.canvasCoords(event);

      if (deps.handleUiPointerDown(x, y)) return;

      if (deps.blocksBoardInput()) return;

      const cell = deps.cellAtCoords(x, y);
      if (!cell) return;

      deps.setBoardPointerLocked(cell, true);

      session = {
        pointerId: event.pointerId,
        cell,
        x0: x,
        y0: y,
        t0: performance.now(),
        mode: 'idle',
      };
      rt.canvas.setPointerCapture(event.pointerId);
    },

    handlePointerMove(event: PointerEvent): void {
      if (!useTouchGestureInput(rt.state.width)) return;
      if (!session || session.pointerId !== event.pointerId) return;

      const y = deps.canvasCoords(event).y;
      deps.setBoardPointerLocked(session.cell, true);

      const dy = y - session.y0;
      session.mode = detectSwipeDuringMove(dy, session.mode, thresholds());

      if (session.mode === 'swipe-flag') {
        deps.setFlagSwipePreview({
          row: session.cell.row,
          col: session.cell.col,
          active: true,
        });
      } else {
        deps.setFlagSwipePreview(null);
      }
    },

    handlePointerUp(event: PointerEvent): void {
      if (!useTouchGestureInput(rt.state.width)) return;
      if (!session || session.pointerId !== event.pointerId) {
        releaseSession(event);
        return;
      }

      const { x, y } = deps.canvasCoords(event);
      const dx = x - session.x0;
      const dy = y - session.y0;
      const cell = session.cell;
      const end = classifyPointerEnd(dx, dy, session.mode, thresholds());

      releaseSession(event);

      if (end === 'swipe-flag') {
        clearPendingTap();
        doubleTap = { lastCellKey: null, lastTapAt: 0 };
        rt.callbacks.onToggleFlag(cell.row, cell.col);
        return;
      }
      if (end === 'tap') {
        handleTap(cell);
      }
    },

    handlePointerCancel(event: PointerEvent): void {
      if (!useTouchGestureInput(rt.state.width)) return;
      clearPendingTap();
      releaseSession(event);
    },

    destroy(): void {
      clearPendingTap();
      session = null;
      deps.clearTouchPointerState();
    },
  };
}
