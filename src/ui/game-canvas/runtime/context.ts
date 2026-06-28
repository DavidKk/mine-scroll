import type { FpsOverlay } from '../fps-overlay.ts';
import type { ScrollPressureState } from '../../renderer/index.ts';
import type {
  GameCanvasCallbacks,
  GameCanvasFullscreenOptions,
  GameCanvasOptions,
  ViewportFitOptions,
} from '../types.ts';
import type { CanvasRuntimeState } from './state.ts';
import type { TouchGestureController } from '../input/touch-gesture.ts';

export interface GameCanvasRuntime {
  state: CanvasRuntimeState;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  callbacks: GameCanvasCallbacks;
  canvasOptions: GameCanvasOptions;
  mineTotal: number;
  fpsOverlay: FpsOverlay;
  fixedCellSize: number | undefined;
  fixedGridRows: number | undefined;
  fitViewport: ViewportFitOptions | undefined;
  getScrollPressureFn: (() => ScrollPressureState | undefined) | undefined;
  fullscreen: GameCanvasFullscreenOptions | undefined;
  endlessPreviewRows: number;
  paint: () => void;
  scheduleAnimationFrame: () => void;
  scheduleContinuousRepaint: () => void;
  touchGesture?: TouchGestureController;
}
