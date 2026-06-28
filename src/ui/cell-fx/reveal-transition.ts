import { clamp01 } from '../primitives/index.ts';
import { roundedRectPath } from '../primitives/path.ts';
import type { GridMetrics } from '../theme.ts';
import { drawHiddenCellUnderlay, drawSpriteInCell, getTileSprites } from '../tile-sprites.ts';

export function drawCellRevealTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  g: GridMetrics,
  progress: number,
): void {
  const t = clamp01(progress);
  const sprites = getTileSprites();
  const cx = x + g.cellSize / 2;
  const cy = y + g.cellSize / 2;
  const flash = Math.sin(Math.min(1, t * 1.25) * Math.PI);
  const reveal = clamp01(t / 0.5);

  if (sprites && t < 0.58) {
    ctx.save();
    ctx.globalAlpha = (1 - reveal) * 0.9;
    drawHiddenCellUnderlay(ctx, x, y, g.cellSize);
    drawSpriteInCell(ctx, sprites.pressed, x, y, g.cellSize);
    ctx.restore();
  }

  if (sprites && t > 0.14 && t < 0.82) {
    const safeT = clamp01((t - 0.14) / 0.5);
    const scale = 0.94 + safeT * 0.1;
    const size = g.cellSize * scale;
    ctx.save();
    ctx.globalAlpha = Math.sin(safeT * Math.PI) * 0.72;
    ctx.globalCompositeOperation = 'lighter';
    drawSpriteInCell(ctx, sprites.safe, cx - size / 2, cy - size / 2, size);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bloomRadius = g.cellSize * (0.32 + t * 0.74);
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius);
  bloom.addColorStop(0, `rgba(235, 255, 255, ${0.52 * flash})`);
  bloom.addColorStop(0.32, `rgba(45, 236, 255, ${0.34 * flash})`);
  bloom.addColorStop(1, 'rgba(45, 236, 255, 0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(cx, cy, bloomRadius, 0, Math.PI * 2);
  ctx.fill();

  const ringAlpha = (1 - t) * 0.78;
  ctx.strokeStyle = `rgba(45, 236, 255, ${ringAlpha})`;
  ctx.lineWidth = Math.max(1, g.cellSize * (0.06 - t * 0.035));
  roundedRectPath(
    ctx,
    x - g.cellSize * 0.08 * t,
    y - g.cellSize * 0.08 * t,
    g.cellSize * (1 + 0.16 * t),
    g.cellSize * (1 + 0.16 * t),
    g.cellRadius + 4,
  );
  ctx.stroke();

  for (let i = 0; i < 8; i += 1) {
    const angle = i * (Math.PI * 2 / 8) + t * 0.7;
    const dist = g.cellSize * (0.18 + t * 0.46) * (i % 2 === 0 ? 1 : 0.75);
    const alpha = (1 - t) * 0.58;
    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 211, 90, ${alpha})` : `rgba(45, 236, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.72, Math.max(1, g.cellSize * (0.035 - t * 0.018)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
