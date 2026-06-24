import { FONTS } from './theme.ts';

/** 滑动窗口 FPS 采样（约每 500ms 更新一次读数） */
export class FpsMeter {
  private frames = 0;
  private lastSampleAt = 0;
  private fps = 0;
  private frameMs = 0;

  tick(now = performance.now()): void {
    this.frames += 1;
    if (this.lastSampleAt === 0) {
      this.lastSampleAt = now;
      return;
    }
    const elapsed = now - this.lastSampleAt;
    if (elapsed < 500) return;
    this.fps = Math.round((this.frames * 1000) / elapsed);
    this.frameMs = elapsed / this.frames;
    this.frames = 0;
    this.lastSampleAt = now;
  }

  getFps(): number {
    return this.fps;
  }

  getFrameMs(): number {
    return this.frameMs;
  }
}

export function drawFpsHud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fps: number,
  frameMs: number,
  scale = 1,
): void {
  const color = fps >= 55 ? '#4ade80' : fps >= 20 ? '#facc15' : '#f87171';
  const text = frameMs > 0 ? `${fps} FPS · ${frameMs.toFixed(1)}ms` : `${fps} FPS`;
  const fontSize = Math.max(10, 11 * scale);
  const lineH = 18 * scale;
  const padding = 6 * scale;

  ctx.save();
  ctx.font = `600 ${fontSize}px ${FONTS.mono}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const w = ctx.measureText(text).width + padding * 2;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(x - w, y, w, lineH);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w + 0.5, y + 0.5, w - 1, lineH - 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x - padding, y + 3 * scale);
  ctx.restore();
}
