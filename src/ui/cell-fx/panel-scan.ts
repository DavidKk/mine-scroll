import type { PanelV3Bounds } from './types.ts';

export function getPanelV3InnerRect(bounds: PanelV3Bounds): PanelV3Bounds {
  const padX = bounds.w * 0.24;
  const padY = bounds.h * 0.18;
  return { x: bounds.x + padX, y: bounds.y + padY, w: bounds.w - padX * 2, h: bounds.h - padY * 2 };
}

export function drawPanelV3ScanBeams(
  ctx: CanvasRenderingContext2D,
  bounds: PanelV3Bounds,
  color: string,
  phase: number,
  pulse: number,
): void {
  const inner = getPanelV3InnerRect(bounds);
  const beamHalfLen = inner.w * 0.21;
  const scanTravel = 1 - Math.abs(phase * 2 - 1);
  const scanX = inner.x + beamHalfLen + scanTravel * Math.max(0, inner.w - beamHalfLen * 2);
  const yTop = inner.y + inner.h * 0.12;
  const yBottom = inner.y + inner.h * 0.88;
  const lineWidth = Math.max(1.2, bounds.h * 0.0055);
  const peakAlpha = 0.32 + pulse * 0.11;

  const drawBeam = (y: number): void => {
    const x1 = Math.max(inner.x, scanX - beamHalfLen);
    const x2 = Math.min(inner.x + inner.w, scanX + beamHalfLen);
    if (x2 - x1 < 2) return;

    const cx = (x1 + x2) / 2;
    const scan = ctx.createLinearGradient(x1, y, x2, y);
    scan.addColorStop(0, `rgba(${color}, 0)`);
    scan.addColorStop(0.1, `rgba(${color}, ${peakAlpha * 0.1})`);
    scan.addColorStop(0.24, `rgba(${color}, ${peakAlpha * 0.45})`);
    scan.addColorStop(0.5, `rgba(${color}, ${peakAlpha})`);
    scan.addColorStop(0.76, `rgba(${color}, ${peakAlpha * 0.45})`);
    scan.addColorStop(0.9, `rgba(${color}, ${peakAlpha * 0.1})`);
    scan.addColorStop(1, `rgba(${color}, 0)`);

    ctx.fillStyle = scan;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.quadraticCurveTo(cx, y - lineWidth, x2, y);
    ctx.quadraticCurveTo(cx, y + lineWidth, x1, y);
    ctx.closePath();
    ctx.fill();
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  drawBeam(yTop);
  drawBeam(yBottom);
  ctx.restore();
}
