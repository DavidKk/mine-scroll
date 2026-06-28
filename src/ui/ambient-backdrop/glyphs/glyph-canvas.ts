import {
  clamp01,
  strokeRoundedLoop,
  type Point2,
  type Vec3,
} from '../shared.ts';
import type { FlatShardShape } from './shard-shapes.ts';

const SOLID_LIGHT: Vec3 = { x: 0.32, y: -0.48, z: 0.82 };

function strokePsCross(
  ctx: CanvasRenderingContext2D,
  world: Point2[],
  lineW: number,
  stroke: string,
): void {
  if (world.length < 4) return;
  const barW = lineW * 1.42;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = barW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(world[0]!.x, world[0]!.y);
  ctx.lineTo(world[2]!.x, world[2]!.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(world[1]!.x, world[1]!.y);
  ctx.lineTo(world[3]!.x, world[3]!.y);
  ctx.stroke();
}

function strokeOpenPolyline(
  ctx: CanvasRenderingContext2D,
  points: Point2[],
  lineW: number,
  stroke: string,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function faceNormal3(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  return { x: nx, y: ny, z: nz };
}

function faceShade(normal: Vec3): number {
  const dot =
    normal.x * SOLID_LIGHT.x + normal.y * SOLID_LIGHT.y + normal.z * SOLID_LIGHT.z;
  return clamp01(0.22 + dot * 0.68);
}

export function fillExtrudedSolid(
  ctx: CanvasRenderingContext2D,
  transformed: Vec3[],
  screen: Point2[],
  faces: ReadonlyArray<readonly [number, number, number]>,
  depthKeys: number[],
  rockRgb: string,
  fillAlpha: number,
): void {
  if (faces.length === 0) return;

  const order = faces.map((_, i) => i).sort((a, b) => depthKeys[a]! - depthKeys[b]!);

  ctx.save();
  for (const fi of order) {
    const face = faces[fi]!;
    const ia = face[0]!;
    const ib = face[1]!;
    const ic = face[2]!;
    const ta = transformed[ia];
    const tb = transformed[ib];
    const tc = transformed[ic];
    const sa = screen[ia];
    const sb = screen[ib];
    const sc = screen[ic];
    if (!ta || !tb || !tc || !sa || !sb || !sc) continue;

    const shade = faceShade(faceNormal3(ta, tb, tc));
    const alpha = fillAlpha * (0.42 + shade * 0.58);
    if (alpha < 0.03) continue;

    ctx.fillStyle = `rgba(${rockRgb}, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.lineTo(sc.x, sc.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function strokeExtrudedWire(
  ctx: CanvasRenderingContext2D,
  world: Point2[],
  segments: ReadonlyArray<readonly [number, number]>,
  lineW: number,
  stroke: string,
): void {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [a, b] of segments) {
    const p0 = world[a];
    const p1 = world[b];
    if (!p0 || !p1) continue;
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
  }
  ctx.stroke();
}

export function strokeFlatShard(
  ctx: CanvasRenderingContext2D,
  shape: FlatShardShape,
  worldPolylines: Point2[][],
  lineW: number,
  stroke: string,
  sizeBase: number,
): void {
  const cornerR = Math.max(2.8, sizeBase * 0.17);

  if (shape.template === 'ps-cross') {
    strokePsCross(ctx, worldPolylines[0] ?? [], lineW, stroke);
    return;
  }

  if (shape.template === 'ps-frame') {
    const pts = worldPolylines[0];
    if (!pts || pts.length < 3) return;
    for (let i = 0; i < pts.length; i += 1) {
      strokeOpenPolyline(ctx, [pts[i]!, pts[(i + 1) % pts.length]!], lineW, stroke);
    }
    return;
  }

  for (let i = 0; i < worldPolylines.length; i += 1) {
    const pts = worldPolylines[i]!;
    if (pts.length < 2) continue;
    if (shape.closed[i] && pts.length >= 3) {
      strokeRoundedLoop(ctx, pts, lineW, cornerR, stroke);
    } else {
      strokeOpenPolyline(ctx, pts, lineW, stroke);
    }
  }
}
