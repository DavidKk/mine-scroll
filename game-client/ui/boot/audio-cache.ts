const warmedClips = new Map<string, HTMLAudioElement>()

export function warmAudioClip(url: string): HTMLAudioElement {
  let clip = warmedClips.get(url)
  if (!clip) {
    clip = new Audio(url)
    clip.preload = 'auto'
    clip.load()
    warmedClips.set(url, clip)
  }
  return clip
}

export function getWarmedAudioClip(url: string): HTMLAudioElement | undefined {
  return warmedClips.get(url)
}

/** Clone a warmed clip when available so controllers can own playback state. */
export function cloneAudioTemplate(url: string): HTMLAudioElement {
  const warmed = warmedClips.get(url)
  if (warmed) {
    const clone = warmed.cloneNode() as HTMLAudioElement
    clone.preload = 'auto'
    return clone
  }
  const audio = new Audio(url)
  audio.preload = 'auto'
  return audio
}

export function resetAudioCache(): void {
  for (const clip of warmedClips.values()) {
    clip.pause()
    clip.src = ''
  }
  warmedClips.clear()
}
