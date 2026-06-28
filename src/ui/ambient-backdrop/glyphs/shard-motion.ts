import { hash01, type Point2, type Vec3 } from '../shared.ts';
import { buildFlatShape } from './shard-shapes.ts';
import { buildShapeExtrudedWire, buildShapeSolidMesh, type SolidMesh } from './solid-mesh.ts';

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
export function shardDrift3D(
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
export function glyphFloatShift(seed: number, nowMs: number, shellH: number): Point2 {
  const scroll = (nowMs * (0.016 + hash01(seed + 55) * 0.012)) % Math.max(1, shellH);
  return {
    x: Math.sin(nowMs * 0.00042 + seed * 0.13) * 10,
    y: scroll * 0.22,
  };
}

export interface ShardDrawItem {
  zCenter: number;
  draw: () => void;
}

interface CachedShardAssets {
  shape: ReturnType<typeof buildFlatShape>;
  solidMesh: SolidMesh | null;
  extrudedWire: { verts: Vec3[]; segments: Array<[number, number]> } | null;
}

const shardAssetsCache = new Map<number, CachedShardAssets>();

export function getCachedShardAssets(shapeSeed: number): CachedShardAssets {
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
