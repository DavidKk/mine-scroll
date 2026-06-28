import type { BootAsset } from './types.ts'

export const BOOT_WEIGHTS_URL = '/assets/boot-weights.json'

export function applyBootWeightMap(assets: BootAsset[], weights: Record<string, number>, webpMap: Record<string, string> = {}): BootAsset[] {
  if (Object.keys(weights).length === 0) return assets
  return assets.map((asset) => {
    const preferredUrl = webpMap[asset.url] ?? asset.url
    const bytes = weights[preferredUrl] ?? weights[asset.url]
    if (typeof bytes !== 'number' || bytes <= 0) return asset
    return { ...asset, weight: bytes }
  })
}
