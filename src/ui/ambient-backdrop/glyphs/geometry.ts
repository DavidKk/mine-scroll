export {
  ASTEROID_LAYERS,
  SHARD_SIZE_MAX,
  buildFlatShape,
  projectDepth,
  transformAsteroid,
  type FlatShardShape,
} from './shard-shapes.ts';
export { buildShapeExtrudedWire, buildShapeSolidMesh, type SolidMesh } from './solid-mesh.ts';
export { fillExtrudedSolid, strokeExtrudedWire, strokeFlatShard } from './glyph-canvas.ts';
export {
  getCachedShardAssets,
  glyphFloatShift,
  shardDrift3D,
  type ShardDrawItem,
} from './shard-motion.ts';
