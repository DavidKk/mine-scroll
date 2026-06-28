import { hash01, type Vec3 } from '../shared.ts';

export const ASTEROID_LAYERS = [
  { count: 20, depthSpeed: 0.82, size: 16, alpha: 0.3, tumble: 0.38 },
  { count: 14, depthSpeed: 1.05, size: 22, alpha: 0.36, tumble: 0.52 },
  { count: 9, depthSpeed: 1.28, size: 28, alpha: 0.42, tumble: 0.66 },
  { count: 5, depthSpeed: 1.55, size: 34, alpha: 0.48, tumble: 0.82 },
] as const;

/** Screen-space cap so near shards never dominate the frame. */
export const SHARD_SIZE_MAX = 38;

type ShardGlyphId = 'ps-triangle' | 'ps-cross' | 'ps-square' | 'ps-circle';

type FlatShardTemplate = 'ps-frame' | 'ps-cross' | 'strokes';

export interface FlatShardShape {
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
export function buildFlatShape(seed: number): FlatShardShape {
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

export function transformAsteroid(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
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

export function projectDepth(v: Vec3, focal: number, scale: number, zCenter: number): { x: number; y: number } {
  const z = Math.max(1.85, zCenter + v.z * 0.4);
  const s = (focal * scale) / z;
  return { x: v.x * s, y: v.y * s };
}
