import type { GameCanvasRuntime } from '../runtime/context.ts';
import { getCanvasPointerCoords, hitTestCellWithPreview } from '../../renderer/index.ts';
import { beginPanelTransition } from '../overlay/panel-transition.ts';
import { insideRect, hitInteractiveUi, hitReset } from './ui-hit-test.ts';

export function cellAtCoords(rt: GameCanvasRuntime, x: number, y: number): { row: number; col: number } | null {
  if (rt.fullscreen) {
    x -= rt.state.boardOffsetX;
    y -= rt.state.boardOffsetY;
  }
  const hit = hitTestCellWithPreview(
    rt.state.squareLayout!,
    rt.state.currentRows,
    rt.state.currentCols,
    rt.state.currentPreviewRows,
    x,
    y,
  );
  if (!hit) return null;
  return hit;
}

function canvasCoords(rt: GameCanvasRuntime, event: MouseEvent): { x: number; y: number } {
  return getCanvasPointerCoords(rt.canvas, event, { width: rt.state.width, height: rt.state.height });
}

function cellAt(rt: GameCanvasRuntime, event: MouseEvent): { row: number; col: number } | null {
  const { x, y } = canvasCoords(rt, event);
  if (hitReset(rt, x, y)) return null;
  return cellAtCoords(rt, x, y);
}

function isBothButtons(event: MouseEvent): boolean {
  return (event.buttons & 1) !== 0 && (event.buttons & 2) !== 0;
}

function updateBoardPointer(rt: GameCanvasRuntime, x: number, y: number, pressed: boolean): void {
  if (rt.state.currentStatus !== 'playing') {
    rt.state.boardPointer = null;
    return;
  }
  const cell = cellAtCoords(rt, x, y);
  if (cell) {
    rt.state.boardPointer = { row: cell.row, col: cell.col, pressed };
    rt.scheduleAnimationFrame();
    return;
  }
  if (!pressed) rt.state.boardPointer = null;
}

export function onMouseDown(rt: GameCanvasRuntime, event: MouseEvent): void {
  const { x, y } = canvasCoords(rt, event);
  if (event.button === 0) updateBoardPointer(rt, x, y, true);
  unlockAudioFromPointer(rt);

  if (rt.fullscreen?.isLogOpen?.()) return;
  if (rt.state.pendingPanelTransition) {
    event.preventDefault();
    return;
  }

  if (rt.fullscreen && rt.state.bgmMuteRect && insideRect(rt.state.bgmMuteRect, x, y)) {
    event.preventDefault();
    rt.fullscreen.onUiClick?.();
    rt.fullscreen.onToggleBgmMute?.();
    rt.scheduleAnimationFrame();
    return;
  }

  if (rt.fullscreen && rt.state.spaceHintRect && insideRect(rt.state.spaceHintRect, x, y)) {
    event.preventDefault();
    rt.fullscreen.onUiClick?.();
    rt.fullscreen.onManualScroll?.();
    return;
  }

  if (rt.fullscreen && rt.state.devSpeedRect && rt.state.currentStatus === 'playing' && insideRect(rt.state.devSpeedRect, x, y)) {
    event.preventDefault();
    rt.fullscreen.onUiClick?.();
    rt.fullscreen.onDevSpeedUp?.();
    return;
  }

  if (rt.fullscreen && rt.state.devAutoRect) {
    const insideAuto =
      x >= rt.state.devAutoRect.x &&
      x <= rt.state.devAutoRect.x + rt.state.devAutoRect.w &&
      y >= rt.state.devAutoRect.y &&
      y <= rt.state.devAutoRect.y + rt.state.devAutoRect.h;
    if (insideAuto) {
      event.preventDefault();
      rt.fullscreen.onUiClick?.();
      rt.fullscreen.onDevAuto?.();
      return;
    }
  }

  if (
    rt.fullscreen &&
    rt.state.currentStatus === 'idle' &&
    rt.state.startRect &&
    (rt.fullscreen.showStartOverlay?.() ?? true)
  ) {
    const insideStart =
      x >= rt.state.startRect.x &&
      x <= rt.state.startRect.x + rt.state.startRect.w &&
      y >= rt.state.startRect.y &&
      y <= rt.state.startRect.y + rt.state.startRect.h;
    if (insideStart) {
      event.preventDefault();
      rt.fullscreen.onUiClick?.();
      beginPanelTransition(rt, 'start', () => rt.fullscreen?.onStart?.());
      return;
    }
    return;
  }

  if (rt.fullscreen && rt.state.currentStatus === 'lost' && rt.state.retryRect) {
    const insideRetry =
      x >= rt.state.retryRect.x &&
      x <= rt.state.retryRect.x + rt.state.retryRect.w &&
      y >= rt.state.retryRect.y &&
      y <= rt.state.retryRect.y + rt.state.retryRect.h;
    if (insideRetry) {
      event.preventDefault();
      rt.fullscreen.onUiClick?.();
      beginPanelTransition(rt, 'retry', () => rt.fullscreen?.onRestart?.());
      return;
    }
    return;
  }

  if (hitReset(rt, x, y)) {
    if (event.button === 0) rt.callbacks.onReset();
    return;
  }

  const cell = cellAtCoords(rt, x, y);
  if (!cell) return;

  if (isBothButtons(event)) {
    event.preventDefault();
    rt.callbacks.onChord(cell.row, cell.col);
    return;
  }

  if (event.button === 0) {
    rt.callbacks.onReveal(cell.row, cell.col);
  }
}

export function onContextMenu(rt: GameCanvasRuntime, event: MouseEvent): void {
  event.preventDefault();
  if (isBothButtons(event)) {
    const cell = cellAt(rt, event);
    if (cell) rt.callbacks.onChord(cell.row, cell.col);
    return;
  }
  const cell = cellAt(rt, event);
  if (cell) {
    rt.callbacks.onToggleFlag(cell.row, cell.col);
  }
}

export function onDoubleClick(rt: GameCanvasRuntime, event: MouseEvent): void {
  event.preventDefault();
  const cell = cellAt(rt, event);
  if (cell) {
    rt.callbacks.onChord(cell.row, cell.col);
  }
}

function updateUiHover(rt: GameCanvasRuntime, x: number, y: number): void {
  if (!rt.fullscreen?.onUiHover) return;
  const target = hitInteractiveUi(rt, x, y);
  if (target && target !== rt.state.uiHoverTarget) {
    rt.fullscreen.onUiHover(target);
  }
  rt.state.uiHoverTarget = target;
}

export function onMouseMove(rt: GameCanvasRuntime, event: MouseEvent): void {
  const { x, y } = canvasCoords(rt, event);
  const pressed = (event.buttons & 1) !== 0;
  updateBoardPointer(rt, x, y, pressed);
  updateUiHover(rt, x, y);
}

export function onMouseUp(rt: GameCanvasRuntime, event: MouseEvent): void {
  if (event.button === 0) {
    const { x, y } = canvasCoords(rt, event);
    updateBoardPointer(rt, x, y, false);
  }
}

export function onMouseLeave(rt: GameCanvasRuntime): void {
  rt.state.boardPointer = null;
  rt.state.uiHoverTarget = null;
}

function unlockAudioFromPointer(rt: GameCanvasRuntime): void {
  rt.fullscreen?.onPointerDown?.();
}

export function onPointerDown(rt: GameCanvasRuntime, event: PointerEvent): void {
  if (event.pointerType === 'mouse') return;
  unlockAudioFromPointer(rt);
}
