import type { GameStatus } from '../../core/types.ts';
import { clamp01 } from '../primitives/index.ts';
import type { GameCutoutName } from '../game-assets.ts';

function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  radius: number,
  alpha: number,
): void {
  if (alpha <= 0.01) return;
  const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
  g.addColorStop(0, `rgba(203, 213, 225, ${alpha * 0.55})`);
  g.addColorStop(0.45, `rgba(100, 116, 139, ${alpha * 0.32})`);
  g.addColorStop(1, 'rgba(71, 85, 105, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Forward burst smoke during detonation (progress 0→1). */
export function drawMineBurstSmoke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  progress: number,
  intensity = 1,
): void {
  const t = clamp01(progress);
  if (t <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i += 1) {
    const seed = i * 2.17;
    const stagger = (i / 14) * 0.32;
    const puffT = clamp01((t - stagger) / 0.68);
    if (puffT <= 0) continue;
    const rise = puffT * cellSize * (0.18 + (i % 4) * 0.05);
    const spread = Math.sin(seed * 1.3) * cellSize * 0.16 * puffT;
    const px = cx + spread;
    const py = cy - rise + cellSize * 0.04;
    const radius = cellSize * (0.07 + (i % 3) * 0.028) * (0.45 + puffT * 0.95);
    const alpha = intensity * (1 - puffT * 0.55) * 0.5;
    drawSmokePuff(ctx, px, py, radius, alpha);
  }
  ctx.restore();
}

/** Gentle rising smoke after the blast has settled. */
export function drawMineSettledSmoke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  nowMs: number,
  intensity = 1,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i += 1) {
    const seed = i * 1.91;
    const cycle = 2600 + (i % 4) * 420;
    const phase = ((nowMs + seed * 140) % cycle) / cycle;
    const life = Math.sin(phase * Math.PI);
    if (life <= 0.05) continue;
    const rise = phase * cellSize * 0.52;
    const spread = Math.sin(seed) * cellSize * 0.11;
    const px = cx + spread;
    const py = cy - rise + cellSize * 0.06;
    const radius = cellSize * (0.05 + (i % 3) * 0.022) * (0.7 + life * 0.5);
    const alpha = intensity * life * 0.34;
    drawSmokePuff(ctx, px, py, radius, alpha);
  }
  ctx.restore();
}

export function drawMineScorchMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.ellipse(cx, cy + cellSize * 0.12, cellSize * 0.33, cellSize * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function resolveMineCutout(status: GameStatus, isHitMine = false): GameCutoutName {
  if (isHitMine) return 'mine-cracked';
  if (status === 'lost') return 'mine-exploded';
  return 'mine-standard';
}
