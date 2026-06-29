import type { BootAsset } from './types.ts'

/** Mobile boot: every tier-1/2 asset is required; tier-3 audio joins the blocking queue. */
export function buildMobileBlockingBootAssets(blocking: BootAsset[], audioAssets: BootAsset[]): BootAsset[] {
  const promoted = blocking.map((asset) => (asset.optional ? { ...asset, optional: false } : asset))
  const mobileAudio = audioAssets.map((asset) => ({
    ...asset,
    tier: 2 as const,
    optional: false,
  }))
  return [...promoted, ...mobileAudio]
}

export function isAudioBootUrl(url: string): boolean {
  return /\.(wav|mp3|ogg|m4a)(\?|$)/i.test(url)
}
