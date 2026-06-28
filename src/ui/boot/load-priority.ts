import type { BootAsset } from './types.ts';

/** Tier ascending; within a tier, heavier assets first for better progress accuracy. */
export function sortBootAssetsForLoad(assets: BootAsset[]): BootAsset[] {
  return [...assets].sort((left, right) => {
    if (left.tier !== right.tier) return left.tier - right.tier;
    if (right.weight !== left.weight) return right.weight - left.weight;
    return left.id.localeCompare(right.id);
  });
}
