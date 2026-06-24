export { clamp01, hash01, lerp } from './math.ts';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CosmicPalette {
  voidTop: string;
  voidBottom: string;
  horizon: string;
  nebulaA: string;
  nebulaB: string;
  starCool: string;
  starWarm: string;
  rockEdge: string;
}
export interface Point2 {
  x: number;
  y: number;
}

export function dist2(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerpPt2(a: Point2, b: Point2, t: number): Point2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Closed loop with rounded corners (triangle / quad). */
export function strokeRoundedLoop(
  ctx: CanvasRenderingContext2D,
  points: Point2[],
  lineW: number,
  cornerR: number,
  stroke: string,
): void {
  const n = points.length;
  if (n < 3) return;

  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i - 1 + n) % n]!;
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;
    const edgeIn = dist2(prev, curr);
    const edgeOut = dist2(curr, next);
    if (edgeIn < 0.001 || edgeOut < 0.001) continue;
    const r = Math.min(cornerR, edgeIn * 0.42, edgeOut * 0.42);
    const before = lerpPt2(curr, prev, r / edgeIn);
    const after = lerpPt2(curr, next, r / edgeOut);
    if (i === 0) ctx.moveTo(before.x, before.y);
    else ctx.lineTo(before.x, before.y);
    ctx.quadraticCurveTo(curr.x, curr.y, after.x, after.y);
  }
  ctx.closePath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}
export function cosmicPalette(heat: number): CosmicPalette {
  if (heat > 0.68) {
    return {
      voidTop: '#241018',
      voidBottom: '#0c0608',
      horizon: '255, 110, 70',
      nebulaA: '220, 60, 60',
      nebulaB: '180, 80, 40',
      starCool: '255, 210, 180',
      starWarm: '255, 160, 100',
      rockEdge: '168, 118, 102',
    };
  }
  if (heat > 0.42) {
    return {
      voidTop: '#1a1228',
      voidBottom: '#0a0814',
      horizon: '180, 100, 255',
      nebulaA: '140, 70, 200',
      nebulaB: '200, 80, 140',
      starCool: '220, 190, 255',
      starWarm: '255, 200, 140',
      rockEdge: '148, 138, 172',
    };
  }
  return {
    voidTop: '#141c38',
    voidBottom: '#080812',
    horizon: '110, 150, 240',
    nebulaA: '70, 110, 210',
    nebulaB: '90, 130, 230',
    starCool: '200, 220, 255',
    starWarm: '170, 200, 255',
    rockEdge: '132, 148, 182',
  };
}
export function drawDeepVoid(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  colors: CosmicPalette,
): void {
  const bg = ctx.createLinearGradient(0, 0, 0, shellH);
  bg.addColorStop(0, colors.voidTop);
  bg.addColorStop(0.45, '#182038');
  bg.addColorStop(1, colors.voidBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, shellW, shellH);
}

/** Full-width top sky wash — no center vanishing point. */
export function drawSkyWash(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  colors: CosmicPalette,
  glow: number,
): void {
  ctx.save();
  const washH = shellH * 0.62;
  const g = ctx.createLinearGradient(0, 0, 0, washH);
  g.addColorStop(0, `rgba(${colors.horizon}, ${0.32 * glow})`);
  g.addColorStop(0.28, `rgba(${colors.nebulaB}, ${0.14 * glow})`);
  g.addColorStop(0.55, `rgba(${colors.nebulaA}, ${0.05 * glow})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, shellW, washH);
  ctx.restore();
}
export function drawEdgeFade(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  intensity: number,
): void {
  const alpha = 0.1 + intensity * 0.08;
  ctx.save();

  const top = ctx.createLinearGradient(0, 0, 0, shellH * 0.12);
  top.addColorStop(0, `rgba(0,0,0,${alpha * 0.35})`);
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, shellW, shellH * 0.12);

  const bottom = ctx.createLinearGradient(0, shellH, 0, shellH * 0.88);
  bottom.addColorStop(0, `rgba(0,0,0,${alpha})`);
  bottom.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, shellH * 0.88, shellW, shellH * 0.12);

  ctx.restore();
}
