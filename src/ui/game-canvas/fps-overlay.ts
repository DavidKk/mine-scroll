import { FpsMeter, drawFpsHud } from '../fps-meter.ts';
import { applyCanvasSize } from './types.ts';

export interface FpsOverlayAnchor {
  x: number;
  y: number;
  scale: number;
}

export interface FpsOverlay {
  recordGameFrame(now?: number): void;
  setAnchor(anchor: FpsOverlayAnchor): void;
  syncSize(width: number, height: number): void;
  destroy(): void;
}

/** Independent overlay canvas — own rAF loop, not blocked by game paint cost. */
export function createFpsOverlay(mount: HTMLElement): FpsOverlay {
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas__fps-overlay';
  canvas.setAttribute('aria-hidden', 'true');
  mount.appendChild(canvas);

  const ctxOrNull = canvas.getContext('2d');
  if (!ctxOrNull) throw new Error('FPS overlay 2D context not available');
  const ctx = ctxOrNull;

  const meter = new FpsMeter();
  let anchor: FpsOverlayAnchor = { x: 8, y: 8, scale: 1 };
  let width = 0;
  let height = 0;
  let rafId: number | null = null;
  let destroyed = false;

  function draw(): void {
    if (destroyed) return;
    ctx.clearRect(0, 0, width, height);
    drawFpsHud(ctx, anchor.x, anchor.y, meter.getFps(), meter.getFrameMs(), anchor.scale);
  }

  function loop(): void {
    if (destroyed) return;
    rafId = window.requestAnimationFrame(() => {
      if (destroyed) return;
      draw();
      loop();
    });
  }

  loop();

  return {
    recordGameFrame(now = performance.now()) {
      meter.tick(now);
    },
    setAnchor(next) {
      anchor = next;
    },
    syncSize(w, h) {
      if (w === width && h === height) return;
      width = w;
      height = h;
      applyCanvasSize(canvas, ctx, w, h);
    },
    destroy() {
      destroyed = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      canvas.remove();
    },
  };
}
