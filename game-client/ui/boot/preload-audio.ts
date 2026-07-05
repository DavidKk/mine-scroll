import { BGM_IDLE_SRC, GAME_AUDIO_ASSETS } from '../game-audio.ts'
import { warmAudioClip, warmAudioClipAsync } from './audio-cache.ts'
import { isMobileBootClient } from './boot-client.ts'
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

  const bgm: BootAsset = {
    id: 'audio.bgm-idle',
    url: BGM_IDLE_SRC,
    tier: 3,
    group: 'audio',
    weight: AUDIO_WEIGHT * 2,
    optional: true,
  }

  return [bgm, ...sfx]
}

/** Tier 3 — warm browser cache; desktop only (mobile blocks in boot sequence). */
export function preloadGameAudio(): void {
  if (typeof window !== 'undefined' && isMobileBootClient()) return
  for (const asset of buildAudioBootAssets()) {
    warmAudioClip(asset.url)
  }
}

/** Landing attract — always warm clips (including mobile) so BGM/SFX start quickly after unlock. */
export function preloadLandingAudio(): void {
  if (typeof window === 'undefined') return
  for (const asset of buildAudioBootAssets()) {
    warmAudioClip(asset.url)
  }
}

/** Await every audio clip — mobile boot already does this; exposed for tests. */
export async function preloadGameAudioBlocking(): Promise<void> {
  await Promise.all(buildAudioBootAssets().map((asset) => warmAudioClipAsync(asset.url)))
}
