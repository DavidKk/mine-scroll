import { BGM_IDLE_SRC, GAME_AUDIO_ASSETS } from '../game-audio.ts'
import { warmAudioClip } from './audio-cache.ts'
import type { BootAsset } from './types.ts'

const AUDIO_WEIGHT = 1024 * 1024

export function buildAudioBootAssets(): BootAsset[] {
  const sfx = (Object.entries(GAME_AUDIO_ASSETS) as [string, string][]).map(([id, url]) => ({
    id: `audio.${id}`,
    url,
    tier: 3 as const,
    group: 'audio' as const,
    weight: AUDIO_WEIGHT,
    optional: true,
  }))

  return [
    ...sfx,
    {
      id: 'audio.bgm-idle',
      url: BGM_IDLE_SRC,
      tier: 3,
      group: 'audio',
      weight: AUDIO_WEIGHT * 2,
      optional: true,
    },
  ]
}

/** Tier 3 — warm browser cache; does not block mountApp. */
export function preloadGameAudio(): void {
  for (const asset of buildAudioBootAssets()) {
    warmAudioClip(asset.url)
  }
}
