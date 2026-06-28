import { initPreviewCanvas, measurePreviewCanvas, startPreviewLoop, type LivePreview } from './cell-effect-scenes.ts';

export function scaledTime(now: number, fps: number, baseFps: number): number {
  return now * (fps / baseFps);
}

export function createLoopCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => void,
  getFps: () => number,
  baseFps: number,
): LivePreview | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__preview-canvas';
  const ctx = initPreviewCanvas(canvas);
  if (!ctx) return null;

  const stopLoop = startPreviewLoop(canvas, () => {
    const { w, h } = measurePreviewCanvas(canvas, ctx);
    const now = scaledTime(performance.now(), getFps(), baseFps);
    draw(ctx, w, h, now);
  });

  return {
    canvas,
    dispose: () => stopLoop(),
  };
}
