import type { GameCanvasRuntime } from '../runtime/context.ts';
import { getCanvasPointerCoords, hitTestCellWithPreview } from '../../renderer/index.ts';
import { beginPanelTransition } from '../overlay/panel-transition.ts';
import { isGameIntroBlockingInput } from '../overlay/game-intro.ts';
import { insideRect, hitInteractiveUi, hitReset } from './ui-hit-test.ts';
import { createTouchGestureController, type TouchGestureController } from './touch-gesture.ts';
import type { FlagSwipePreviewState } from '../runtime/state.ts';
import { useDesktopMouseInput, useTouchPointerInput } from './input-profile.ts';

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

function canvasCoords(
  rt: GameCanvasRuntime,
  event: MouseEvent | PointerEvent,
): { x: number; y: number } {
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

function setBoardPointerLocked(
  rt: GameCanvasRuntime,
  cell: { row: number; col: number },
  pressed: boolean,
): void {
  if (rt.state.currentStatus !== 'playing') {
    rt.state.boardPointer = null;
    return;
  }
  rt.state.boardPointer = { row: cell.row, col: cell.col, pressed };
  rt.scheduleAnimationFrame();
}

function setFlagSwipePreview(rt: GameCanvasRuntime, preview: FlagSwipePreviewState | null): void {
  rt.state.flagSwipePreview = preview;
  if (preview?.active) {
    rt.scheduleContinuousRepaint();
  } else {
    rt.scheduleAnimationFrame();
  }
}

function clearTouchPointerState(rt: GameCanvasRuntime): void {
  rt.state.boardPointer = null;
  rt.state.flagSwipePreview = null;
  rt.scheduleAnimationFrame();
}

function unlockAudioFromPointer(rt: GameCanvasRuntime): void {
  rt.fullscreen?.onPointerDown?.();
}

/** Shared UI hit-test for mouse down and touch pointer down. */
function handleUiPointerDown(rt: GameCanvasRuntime, x: number, y: number): boolean {
  if (rt.fullscreen?.isLogOpen?.()) return true;
  if (rt.state.pendingPanelTransition) return true;
  if (isGameIntroBlockingInput(rt, performance.now())) return true;

  if (rt.fullscreen && rt.state.bgmMuteRect && insideRect(rt.state.bgmMuteRect, x, y)) {
    rt.fullscreen.onUiClick?.();
    rt.fullscreen.onToggleBgmMute?.();
    rt.scheduleAnimationFrame();
    return true;
  }

  if (rt.fullscreen && rt.state.spaceHintRect && insideRect(rt.state.spaceHintRect, x, y)) {
    rt.fullscreen.onUiClick?.();
    rt.fullscreen.onManualScroll?.();
    return true;
  }

  if (
    rt.fullscreen &&
    rt.state.devSpeedRect &&
    rt.state.currentStatus === 'playing' &&
    insideRect(rt.state.devSpeedRect, x, y)
  ) {
    rt.fullscreen.onUiClick?.();
    rt.fullscreen.onDevSpeedUp?.();
    return true;
  }

  if (rt.fullscreen && rt.state.devAutoRect && insideRect(rt.state.devAutoRect, x, y)) {
    rt.fullscreen.onUiClick?.();
    rt.fullscreen.onDevAuto?.();
    return true;
  }

  if (
    rt.fullscreen &&
    rt.state.currentStatus === 'idle' &&
    rt.state.startRect &&
    (rt.fullscreen.showStartOverlay?.() ?? true) &&
    insideRect(rt.state.startRect, x, y)
  ) {
    rt.fullscreen.onUiClick?.();
    beginPanelTransition(rt, 'start', () => rt.fullscreen?.onStart?.());
    return true;
  }

  if (
    rt.fullscreen &&
    rt.state.currentStatus === 'lost' &&
    rt.state.retryRect &&
    insideRect(rt.state.retryRect, x, y)
  ) {
    rt.fullscreen.onUiClick?.();
    beginPanelTransition(rt, 'retry', () => rt.fullscreen?.onRestart?.());
    return true;
  }

  return false;
}

function blocksBoardPointerInput(rt: GameCanvasRuntime): boolean {
  if (isGameIntroBlockingInput(rt, performance.now())) return true;
  if (
    rt.fullscreen &&
    rt.state.currentStatus === 'idle' &&
    rt.state.startRect &&
    (rt.fullscreen.showStartOverlay?.() ?? true)
  ) {
    return true;
  }
  if (rt.fullscreen && rt.state.currentStatus === 'lost' && rt.state.retryRect) {
    return true;
  }
  return false;
}

export function initTouchGesture(rt: GameCanvasRuntime): TouchGestureController | null {
  if (!useTouchPointerInput(rt.state.width)) {
    rt.touchGesture = undefined;
    return null;
  }
  const controller = createTouchGestureController(rt, {
    cellAtCoords: (x, y) => cellAtCoords(rt, x, y),
    canvasCoords: (event) => canvasCoords(rt, event),
    setBoardPointerLocked: (cell, pressed) => setBoardPointerLocked(rt, cell, pressed),
    setFlagSwipePreview: (preview) => setFlagSwipePreview(rt, preview),
    clearTouchPointerState: () => clearTouchPointerState(rt),
    handleUiPointerDown: (x, y) => handleUiPointerDown(rt, x, y),
    blocksBoardInput: () => blocksBoardPointerInput(rt),
  });
  rt.touchGesture = controller;
  return controller;
}

export function onMouseDown(rt: GameCanvasRuntime, event: MouseEvent): void {
  if (!useDesktopMouseInput(rt.state.width)) return;

  const { x, y } = canvasCoords(rt, event);
  if (event.button === 0) updateBoardPointer(rt, x, y, true);
  unlockAudioFromPointer(rt);

  if (rt.fullscreen?.isLogOpen?.()) return;
  if (rt.state.pendingPanelTransition) {
    event.preventDefault();
    return;
  }

  if (handleUiPointerDown(rt, x, y)) {
    event.preventDefault();
    return;
  }

  if (blocksBoardPointerInput(rt)) return;

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
  if (!useDesktopMouseInput(rt.state.width)) return;
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
  if (!useDesktopMouseInput(rt.state.width)) return;
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
  if (!useDesktopMouseInput(rt.state.width)) return;
  const { x, y } = canvasCoords(rt, event);
  const pressed = (event.buttons & 1) !== 0;
  updateBoardPointer(rt, x, y, pressed);
  updateUiHover(rt, x, y);
}

export function onMouseUp(rt: GameCanvasRuntime, event: MouseEvent): void {
  if (!useDesktopMouseInput(rt.state.width)) return;
  if (event.button === 0) {
    const { x, y } = canvasCoords(rt, event);
    updateBoardPointer(rt, x, y, false);
  }
}

export function onMouseLeave(rt: GameCanvasRuntime): void {
  if (!useDesktopMouseInput(rt.state.width)) return;
  rt.state.boardPointer = null;
  rt.state.flagSwipePreview = null;
  rt.state.uiHoverTarget = null;
}

export function onPointerDown(rt: GameCanvasRuntime, event: PointerEvent): void {
  if (!useTouchPointerInput(rt.state.width)) return;
  unlockAudioFromPointer(rt);
  rt.touchGesture?.handlePointerDown(event);
}

export function onPointerMove(rt: GameCanvasRuntime, event: PointerEvent): void {
  if (!useTouchPointerInput(rt.state.width)) return;
  rt.touchGesture?.handlePointerMove(event);
}

export function onPointerUp(rt: GameCanvasRuntime, event: PointerEvent): void {
  if (!useTouchPointerInput(rt.state.width)) return;
  rt.touchGesture?.handlePointerUp(event);
}

export function onPointerCancel(rt: GameCanvasRuntime, event: PointerEvent): void {
  if (!useTouchPointerInput(rt.state.width)) return;
  rt.touchGesture?.handlePointerCancel(event);
}

export function destroyTouchGesture(rt: GameCanvasRuntime): void {
  rt.touchGesture?.destroy();
  rt.touchGesture = undefined;
}

/** Re-bind touch controller when viewport crosses mobile/desktop breakpoint. */
export function syncInputProfile(rt: GameCanvasRuntime): void {
  if (useTouchPointerInput(rt.state.width)) {
    if (!rt.touchGesture) initTouchGesture(rt);
    return;
  }
  if (rt.touchGesture) {
    destroyTouchGesture(rt);
    clearTouchPointerState(rt);
  }
}
