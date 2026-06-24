import {
  clamp01,
  hash01,
  lerp,
  strokeRoundedLoop,
  type CosmicPalette,
  type Point2,
  type Vec3,
} from './shared.ts';
import type { BackdropGlyphsTuning } from './mood.ts';

const ASTEROID_LAYERS = [
  { count: 20, depthSpeed: 0.82, size: 16, alpha: 0.3, tumble: 0.38 },
  { count: 14, depthSpeed: 1.05, size: 22, alpha: 0.36, tumble: 0.52 },
  { count: 9, depthSpeed: 1.28, size: 28, alpha: 0.42, tumble: 0.66 },
  { count: 5, depthSpeed: 1.55, size: 34, alpha: 0.48, tumble: 0.82 },
] as const;

/** Screen-space cap so near shards never dominate the frame. */
const SHARD_SIZE_MAX = 38;

type ShardGlyphId = 'ps-triangle' | 'ps-cross' | 'ps-square' | 'ps-circle';

type FlatShardTemplate = 'ps-frame' | 'ps-cross' | 'strokes';

interface FlatShardShape {
  template: FlatShardTemplate;
  polylines: Vec3[][];
  closed: boolean[];
  /** Half-depth (local Z) for extruded stroke glyphs — letters & digits. */
  extrudeHalf?: number;
}

const SHARD_GLYPH_IDS: ShardGlyphId[] = ['ps-triangle', 'ps-cross', 'ps-square', 'ps-circle'];

function v3(x: number, y: number, z = 0): Vec3 {
  return { x, y, z };
}

function poly(scale: number, points: readonly (readonly [number, number])[]): Vec3[] {
  return points.map(([x, y]) => v3(x * scale, y * scale));
}

function ringPoly(scale: number, radius: number, segments: number): Vec3[] {
  const verts: Vec3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    verts.push(v3(Math.cos(a) * radius * scale, Math.sin(a) * radius * scale));
  }
  return verts;
}

function buildShardGlyph(id: ShardGlyphId, s: number, seed: number): FlatShardShape {
  const aspect = 0.82 + hash01(seed + 11) * 0.22;

  switch (id) {
    case 'ps-triangle':
      return {
        template: 'ps-frame',
        polylines: [
          poly(s, [
            [0, -0.92],
            [0.84 * aspect, 0.58],
            [-0.84 * aspect, 0.58],
          ]),
        ],
        closed: [true],
      };
    case 'ps-square': {
      const r = s * aspect * 0.82;
      return {
        template: 'ps-frame',
        polylines: [
          poly(1, [
            [-r, -r],
            [r, -r],
            [r, r],
            [-r, r],
          ]),
        ],
        closed: [true],
      };
    }
    case 'ps-circle':
      return {
        template: 'ps-frame',
        polylines: [ringPoly(s, 0.86 * aspect, 20)],
        closed: [true],
      };
    case 'ps-cross': {
      const r = s * aspect * 0.82;
      return {
        template: 'ps-cross',
        polylines: [poly(1, [[-r, -r], [r, -r], [r, r], [-r, r]])],
        closed: [false],
      };
    }
  }
}

function finalizeFlatShape(shape: FlatShardShape, seed: number, s: number): FlatShardShape {
  const scale = 0.68 + hash01(seed + 15) * 0.24;
  const sx = scale * (0.86 + hash01(seed + 16) * 0.22);
  const sy = scale * (0.86 + hash01(seed + 17) * 0.22);
  const sz = scale * (0.12 + hash01(seed + 21) * 0.28);
  const depthBase = s * scale * sz;
  const extrudeHalf =
    shape.template === 'ps-frame' || shape.template === 'ps-cross'
      ? Math.max(0.08, depthBase * 1.05)
      : shape.template === 'strokes'
        ? Math.max(0.06, depthBase * 0.88)
        : undefined;
  return {
    template: shape.template,
    closed: shape.closed,
    extrudeHalf,
    polylines: shape.polylines.map((line) =>
      scaleFlatVerts(warpFlatVerts(line, seed, s), sx, sy, sz),
    ),
  };
}

/** PS-style flat glyphs (△ × □ ○) on a thin 3D card. */
function buildFlatShape(seed: number): FlatShardShape {
  const idx = Math.floor(hash01(seed + 8) * SHARD_GLYPH_IDS.length);
  const id = SHARD_GLYPH_IDS[idx] ?? 'ps-circle';
  const s = 0.52 + hash01(seed + 10) * 0.34;
  return finalizeFlatShape(buildShardGlyph(id, s, seed), seed, s);
}
function rotateX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

function rotateZ(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

function transformAsteroid(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  return rotateZ(rotateY(rotateX(v, rx), ry), rz);
}

function warpFlatVerts(verts: Vec3[], seed: number, s: number): Vec3[] {
  const bendX = (hash01(seed + 18) - 0.5) * s * 0.22;
  const bendY = (hash01(seed + 19) - 0.5) * s * 0.18;
  const curl = (hash01(seed + 20) - 0.5) * 0.14;
  return verts.map((v) => ({
    x: v.x * (1 + bendX * 0.08),
    y: v.y * (1 + bendY * 0.08),
    z: v.z + v.x * v.y * curl + (v.x * v.x - v.y * v.y) * curl * 0.35,
  }));
}

function scaleFlatVerts(verts: Vec3[], sx: number, sy: number, sz: number): Vec3[] {
  return verts.map((v) => ({ x: v.x * sx, y: v.y * sy, z: v.z * sz }));
}
function projectDepth(v: Vec3, focal: number, scale: number, zCenter: number): { x: number; y: number } {
  const z = Math.max(1.85, zCenter + v.z * 0.4);
  const s = (focal * scale) / z;
  return { x: v.x * s, y: v.y * s };
}
/** PS4-style × — two separate rounded capsule bars. */
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

interface SolidMesh {
  verts: Vec3[];
  faces: Array<[number, number, number]>;
}

const SOLID_LIGHT: Vec3 = { x: 0.32, y: -0.48, z: 0.82 };

function loopCentroid2(line: Vec3[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of line) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, line.length);
  return { x: x / n, y: y / n };
}

function appendSolidMesh(base: SolidMesh, extra: SolidMesh): void {
  const offset = base.verts.length;
  base.verts.push(...extra.verts);
  for (const face of extra.faces) {
    base.faces.push([face[0] + offset, face[1] + offset, face[2] + offset]);
  }
}

function closedFrameEdges(verts: Vec3[]): Array<[Vec3, Vec3]> {
  if (verts.length < 3) return [];
  const edges: Array<[Vec3, Vec3]> = [];
  for (let i = 0; i < verts.length; i += 1) {
    edges.push([verts[i]!, verts[(i + 1) % verts.length]!]);
  }
  return edges;
}

function frameBarHalfWidth(half: number, edgeCount: number): number {
  if (edgeCount <= 4) return half * 0.58;
  if (edgeCount <= 8) return half * 0.48;
  return half * 0.36;
}

function buildFrameSolidMesh(verts: Vec3[], half: number): SolidMesh {
  const barW = frameBarHalfWidth(half, verts.length);
  const mesh: SolidMesh = { verts: [], faces: [] };
  for (const [a, b] of closedFrameEdges(verts)) {
    appendSolidMesh(mesh, buildBarSolidMesh(a, b, half, barW));
  }
  return mesh;
}

/** Closed loop → solid prism with bulged side strips (rounded extrusion profile). */
function buildLoopSolidMesh(line: Vec3[], halfDepth: number): SolidMesh {
  const n = line.length;
  if (n < 3 || halfDepth <= 0) return { verts: [], faces: [] };

  const verts: Vec3[] = [];
  const faces: Array<[number, number, number]> = [];
  const front: number[] = [];
  const back: number[] = [];

  for (const p of line) {
    front.push(verts.length);
    verts.push({ x: p.x, y: p.y, z: p.z + halfDepth });
  }
  for (const p of line) {
    back.push(verts.length);
    verts.push({ x: p.x, y: p.y, z: p.z - halfDepth });
  }

  const c2 = loopCentroid2(line);
  const zMid = line[0]?.z ?? 0;
  const fi = verts.length;
  verts.push({ x: c2.x, y: c2.y, z: zMid + halfDepth });
  const bi = verts.length;
  verts.push({ x: c2.x, y: c2.y, z: zMid - halfDepth });

  for (let i = 0; i < n; i += 1) {
    faces.push([fi, front[i]!, front[(i + 1) % n]!]);
  }
  for (let i = 0; i < n; i += 1) {
    faces.push([bi, back[(i + 1) % n]!, back[i]!]);
  }

  const bulge = halfDepth * 0.46;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const a = front[i]!;
    const b = front[j]!;
    const c = back[j]!;
    const d = back[i]!;
    const va = verts[a]!;
    const vb = verts[b]!;
    const vc = verts[c]!;
    const vd = verts[d]!;
    const mx = (va.x + vb.x + vc.x + vd.x) * 0.25;
    const my = (va.y + vb.y + vc.y + vd.y) * 0.25;
    let ox = mx - c2.x;
    let oy = my - c2.y;
    const olen = Math.hypot(ox, oy) || 1;
    ox /= olen;
    oy /= olen;
    const bulgeZ = (va.z + vb.z + vc.z + vd.z) * 0.25;
    const mi = verts.length;
    verts.push({
      x: mx + ox * bulge,
      y: my + oy * bulge,
      z: bulgeZ,
    });
    faces.push([a, b, mi], [b, c, mi], [c, d, mi], [d, a, mi]);
  }

  return { verts, faces };
}

/** Thick bar along segment — used for × diagonals. */
function buildBarSolidMesh(a: Vec3, b: Vec3, halfZ: number, halfWidth: number): SolidMesh {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * halfWidth;
  const py = (dx / len) * halfWidth;
  const az = a.z;
  const bz = b.z;

  const verts: Vec3[] = [
    { x: a.x + px, y: a.y + py, z: az + halfZ },
    { x: b.x + px, y: b.y + py, z: bz + halfZ },
    { x: b.x - px, y: b.y - py, z: bz + halfZ },
    { x: a.x - px, y: a.y - py, z: az + halfZ },
    { x: a.x + px, y: a.y + py, z: az - halfZ },
    { x: b.x + px, y: b.y + py, z: bz - halfZ },
    { x: b.x - px, y: b.y - py, z: bz - halfZ },
    { x: a.x - px, y: a.y - py, z: az - halfZ },
  ];
  const faces: Array<[number, number, number]> = [
    [0, 1, 2],
    [0, 2, 3],
    [4, 6, 5],
    [4, 7, 6],
    [0, 4, 5],
    [0, 5, 1],
    [1, 5, 6],
    [1, 6, 2],
    [2, 6, 7],
    [2, 7, 3],
    [3, 7, 4],
    [3, 4, 0],
  ];
  return { verts, faces };
}

/** Open / closed strokes → side walls (+ caps when closed). */
function buildStrokeSolidMesh(
  polylines: Vec3[][],
  closed: boolean[],
  halfDepth: number,
): SolidMesh {
  const mesh: SolidMesh = { verts: [], faces: [] };
  if (halfDepth <= 0) return mesh;

  for (let li = 0; li < polylines.length; li += 1) {
    const line = polylines[li]!;
    const isClosed = closed[li] ?? false;
    const n = line.length;
    if (n < 2) continue;

    if (isClosed && n >= 3) {
      appendSolidMesh(mesh, buildLoopSolidMesh(line, halfDepth));
      continue;
    }

    const front: number[] = [];
    const back: number[] = [];
    for (const p of line) {
      front.push(mesh.verts.length);
      mesh.verts.push({ x: p.x, y: p.y, z: p.z + halfDepth });
    }
    for (const p of line) {
      back.push(mesh.verts.length);
      mesh.verts.push({ x: p.x, y: p.y, z: p.z - halfDepth });
    }

    for (let i = 0; i < n - 1; i += 1) {
      const a = front[i]!;
      const b = front[i + 1]!;
      const c = back[i + 1]!;
      const d = back[i]!;
      mesh.faces.push([a, b, c], [a, c, d]);
    }

    if (n >= 2) {
      mesh.faces.push([front[0]!, back[0]!, front[1]!], [back[0]!, back[1]!, front[1]!]);
      const ln = n - 1;
      mesh.faces.push(
        [front[ln]!, front[ln + 1]!, back[ln + 1]!],
        [front[ln]!, back[ln + 1]!, back[ln]!],
      );
    }
  }

  return mesh;
}

function buildShapeSolidMesh(shape: FlatShardShape): SolidMesh | null {
  const half = shape.extrudeHalf ?? 0;
  if (half <= 0) return null;

  if (shape.template === 'ps-cross') {
    const corners = shape.polylines[0];
    if (!corners || corners.length < 4) return null;
    const barW = half * 0.62;
    const mesh: SolidMesh = { verts: [], faces: [] };
    appendSolidMesh(mesh, buildBarSolidMesh(corners[0]!, corners[2]!, half, barW));
    appendSolidMesh(mesh, buildBarSolidMesh(corners[1]!, corners[3]!, half, barW));
    return mesh;
  }

  if (shape.template === 'ps-frame') {
    const verts = shape.polylines[0];
    if (!verts || verts.length < 3) return null;
    return buildFrameSolidMesh(verts, half);
  }

  return buildStrokeSolidMesh(shape.polylines, shape.closed, half);
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

function fillExtrudedSolid(
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

function buildExtrudedWire(
  polylines: Vec3[][],
  closed: boolean[],
  halfDepth: number,
): { verts: Vec3[]; segments: Array<[number, number]> } {
  const verts: Vec3[] = [];
  const segments: Array<[number, number]> = [];

  for (let li = 0; li < polylines.length; li += 1) {
    const line = polylines[li]!;
    const isClosed = closed[li] ?? false;
    const n = line.length;
    if (n < 2) continue;

    const f0 = verts.length;
    for (const p of line) verts.push({ x: p.x, y: p.y, z: p.z + halfDepth });
    const b0 = verts.length;
    for (const p of line) verts.push({ x: p.x, y: p.y, z: p.z - halfDepth });

    for (let i = 0; i < n - 1; i += 1) {
      segments.push([f0 + i, f0 + i + 1], [b0 + i, b0 + i + 1], [f0 + i, b0 + i]);
    }
    if (isClosed) {
      segments.push([f0 + n - 1, f0], [b0 + n - 1, b0], [f0 + n - 1, b0 + n - 1]);
    } else {
      segments.push([f0 + n - 1, b0 + n - 1]);
    }
  }

  return { verts, segments };
}

/** Build extruded wire for any glyph — × uses two diagonal bars, loops stay closed. */
function buildShapeExtrudedWire(shape: FlatShardShape): { verts: Vec3[]; segments: Array<[number, number]> } | null {
  const half = shape.extrudeHalf ?? 0;
  if (half <= 0) return null;

  if (shape.template === 'ps-cross') {
    const corners = shape.polylines[0];
    if (!corners || corners.length < 4) return null;
    return buildExtrudedWire(
      [
        [corners[0]!, corners[2]!],
        [corners[1]!, corners[3]!],
      ],
      [false, false],
      half,
    );
  }

  if (shape.template === 'ps-frame') {
    const verts = shape.polylines[0];
    if (!verts || verts.length < 3) return null;
    const edges = closedFrameEdges(verts);
    return buildExtrudedWire(
      edges.map(([a, b]) => [a, b]),
      edges.map(() => false),
      half,
    );
  }

  return buildExtrudedWire(shape.polylines, shape.closed, half);
}

function strokeExtrudedWire(
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

function strokeFlatShard(
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

const SHARD_Z_MIN = 2.1;
const SHARD_Z_MAX = 6.6;
const SHARD_Z_SPAN = SHARD_Z_MAX - SHARD_Z_MIN;

function wrapRange(value: number, min: number, span: number): number {
  return min + ((((value - min) % span) + span) % span);
}

interface ShardDrift {
  cx: number;
  cy: number;
  zCenter: number;
  depthNorm: number;
  lifeFade: number;
}

/**
 * One continuous pass: far → near along fixed heading, fade at respawn (no mid-screen pop).
 */
function shardDrift3D(
  seed: number,
  nowMs: number,
  motion: number,
  layerSpeed: number,
  shellW: number,
  shellH: number,
): ShardDrift {
  const t = nowMs * motion * layerSpeed * 0.1;
  const spawnX = hash01(seed) * shellW;
  const spawnY = hash01(seed + 19) * shellH;

  const heading = hash01(seed + 40) * Math.PI * 2;
  const xyWeight = 0.08 + hash01(seed + 41) * 0.22;
  const dx = Math.cos(heading) * xyWeight;
  const dy = Math.sin(heading) * xyWeight;

  const zSpeed = (0.00005 + hash01(seed + 44) * 0.00008) * motion;
  const zOffset = hash01(seed + 1) * SHARD_Z_SPAN;
  const zTravel = (t * zSpeed + zOffset) % SHARD_Z_SPAN;
  const zCenter = SHARD_Z_MAX - zTravel;
  const depthNorm = zTravel / SHARD_Z_SPAN;

  const cx = wrapRange(spawnX + dx * t * shellW * 0.0045, 0, shellW);
  const cy = wrapRange(spawnY + dy * t * shellH * 0.004, 0, shellH);

  let lifeFade = 1;
  if (depthNorm < 0.1) lifeFade = depthNorm / 0.1;
  else if (depthNorm > 0.88) lifeFade = (1 - depthNorm) / 0.12;

  return { cx, cy, zCenter, depthNorm, lifeFade };
}

/** Independent glyph drift — not driven by shmup or scroll energy. */
function glyphFloatShift(seed: number, nowMs: number, shellH: number): Point2 {
  const scroll = (nowMs * (0.016 + hash01(seed + 55) * 0.012)) % Math.max(1, shellH);
  return {
    x: Math.sin(nowMs * 0.00042 + seed * 0.13) * 10,
    y: scroll * 0.22,
  };
}

interface ShardDrawItem {
  zCenter: number;
  draw: () => void;
}

interface CachedShardAssets {
  shape: FlatShardShape;
  solidMesh: SolidMesh | null;
  extrudedWire: { verts: Vec3[]; segments: Array<[number, number]> } | null;
}

const shardAssetsCache = new Map<number, CachedShardAssets>();

function getCachedShardAssets(shapeSeed: number): CachedShardAssets {
  const hit = shardAssetsCache.get(shapeSeed);
  if (hit) return hit;

  const shape = buildFlatShape(shapeSeed);
  const extrudeHalf = shape.extrudeHalf ?? 0;
  const assets: CachedShardAssets = {
    shape,
    solidMesh: extrudeHalf > 0 ? buildShapeSolidMesh(shape) : null,
    extrudedWire: extrudeHalf > 0 ? buildShapeExtrudedWire(shape) : null,
  };
  shardAssetsCache.set(shapeSeed, assets);
  if (shardAssetsCache.size > 200) {
    const oldest = shardAssetsCache.keys().next().value;
    if (oldest !== undefined) shardAssetsCache.delete(oldest);
  }
  return assets;
}

/** PS-style flat glyphs (△ × □ ○) — 3D tumble, independent motion. */
export function drawFloatingGlyphsLayer(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  nowMs: number,
  colors: CosmicPalette,
  tuning: BackdropGlyphsTuning,
): void {
  ctx.save();
  const motion = tuning.motion;
  const density = tuning.density;
  const intensity = tuning.intensity;
  const focal = 5.8;
  const items: ShardDrawItem[] = [];

  for (const layer of ASTEROID_LAYERS) {
    const count = Math.floor(layer.count * density);
    for (let i = 0; i < count; i += 1) {
      const seed = i * 37.83 + layer.depthSpeed * 5000 + 900;
      const { cx, cy, zCenter, depthNorm, lifeFade } = shardDrift3D(
        seed,
        nowMs,
        motion,
        layer.depthSpeed,
        shellW,
        shellH,
      );

      const sizeBase = Math.min(
        SHARD_SIZE_MAX,
        layer.size * lerp(0.55, 1.05, depthNorm) * (0.55 + hash01(seed + 2) * 0.32),
      );
      const alpha = clamp01(
        layer.alpha * lerp(0.52, 0.95, depthNorm) * lifeFade * (0.88 + intensity * 0.12),
      );
      if (alpha < 0.04) continue;

      const shift = glyphFloatShift(seed, nowMs, shellH);
      const gx = cx + shift.x;
      const gy = cy + shift.y;

      const tumble = layer.tumble * motion * (0.5 + hash01(seed + 23) * 0.45);
      const rxRate = 0.00028 + hash01(seed + 24) * 0.0004;
      const ryRate = 0.00034 + hash01(seed + 25) * 0.0005;
      const rzRate = 0.0002 + hash01(seed + 26) * 0.00034;
      const rx = nowMs * rxRate * tumble + hash01(seed + 4) * Math.PI * 2;
      const ry = nowMs * ryRate * tumble + hash01(seed + 5) * Math.PI * 2;
      const rz = nowMs * rzRate * tumble + hash01(seed + 6) * Math.PI * 2;

      const shapeSeed = seed + Math.floor(hash01(seed + 27) * 999);
      const { shape, solidMesh, extrudedWire } = getCachedShardAssets(shapeSeed);
      const projectVert = (v: Vec3): Point2 => {
        const tv = transformAsteroid(v, rx, ry, rz);
        const p = projectDepth(tv, focal, sizeBase, zCenter);
        return { x: gx + p.x, y: gy + p.y };
      };

      const worldPolylines = shape.polylines.map((line) => line.map(projectVert));
      const worldExtruded = extrudedWire?.verts.map(projectVert);

      const stroke = `rgba(${colors.rockEdge}, ${alpha * 0.88})`;
      const edgeStroke = `rgba(${colors.rockEdge}, ${alpha * 0.96})`;
      const fillAlpha = alpha * 0.38;
      const lineW = Math.max(1.45, sizeBase * (0.055 + hash01(seed + 28) * 0.028));

      items.push({
        zCenter,
        draw: () => {
          if (solidMesh && solidMesh.faces.length > 0 && extrudedWire) {
            const transformed = solidMesh.verts.map((v) => transformAsteroid(v, rx, ry, rz));
            const screen = transformed.map((tv) => {
              const p = projectDepth(tv, focal, sizeBase, zCenter);
              return { x: gx + p.x, y: gy + p.y };
            });
            const depthKeys = solidMesh.faces.map((face) => {
              const z0 = zCenter + (transformed[face[0]!]?.z ?? 0) * 0.4;
              const z1 = zCenter + (transformed[face[1]!]?.z ?? 0) * 0.4;
              const z2 = zCenter + (transformed[face[2]!]?.z ?? 0) * 0.4;
              return (z0 + z1 + z2) / 3;
            });
            fillExtrudedSolid(
              ctx,
              transformed,
              screen,
              solidMesh.faces,
              depthKeys,
              colors.rockEdge,
              fillAlpha,
            );
            strokeExtrudedWire(ctx, screen, extrudedWire.segments, lineW * 0.88, edgeStroke);
            return;
          }
          if (worldExtruded && extrudedWire) {
            strokeExtrudedWire(ctx, worldExtruded, extrudedWire.segments, lineW, stroke);
            return;
          }
          strokeFlatShard(ctx, shape, worldPolylines, lineW, stroke, sizeBase);
        },
      });
    }
  }

  items.sort((a, b) => b.zCenter - a.zCenter);
  for (const item of items) item.draw();

  ctx.restore();
}
