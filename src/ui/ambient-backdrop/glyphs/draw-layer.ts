import {
  clamp01,
  hash01,
  lerp,
  type CosmicPalette,
  type Point2,
  type Vec3,
} from '../shared.ts';
import type { BackdropGlyphsTuning } from '../mood.ts';
import {
  ASTEROID_LAYERS,
  SHARD_SIZE_MAX,
  fillExtrudedSolid,
  getCachedShardAssets,
  glyphFloatShift,
  projectDepth,
  shardDrift3D,
  strokeExtrudedWire,
  strokeFlatShard,
  transformAsteroid,
  type ShardDrawItem,
} from './geometry.ts';

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
