const warmedClips = new Map<string, HTMLAudioElement>()

const AUDIO_LOAD_TIMEOUT_MS = 45_000

function isAudioReady(clip: HTMLAudioElement): boolean {
  return clip.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA
}

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

/** Block until the clip can play through — used by mobile boot. */
export function warmAudioClipAsync(url: string, signal?: AbortSignal, timeoutMs = AUDIO_LOAD_TIMEOUT_MS): Promise<HTMLAudioElement> {
  const clip = warmAudioClip(url)
  if (isAudioReady(clip)) return Promise.resolve(clip)

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const cleanup = () => {
      clip.removeEventListener('canplaythrough', onReady)
      clip.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
      window.clearTimeout(timer)
    }

    const onReady = () => {
      cleanup()
      resolve(clip)
    }
    const onError = () => {
      cleanup()
      reject(new Error(`Failed to load audio: ${url}`))
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error(`Audio load timeout: ${url}`))
    }, timeoutMs)

    signal?.addEventListener('abort', onAbort, { once: true })
    clip.addEventListener('canplaythrough', onReady, { once: true })
    clip.addEventListener('error', onError, { once: true })
    clip.load()
  })
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
