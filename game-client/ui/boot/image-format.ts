export const BOOT_WEBP_MAP_URL = '/assets/boot-webp-map.json'

let webpSupported: boolean | null = null
let webpMap: Record<string, string> = {}

export function isWebpSupported(): boolean {
  return webpSupported === true
}

export function getWebpMap(): Readonly<Record<string, string>> {
  return webpMap
}

export function detectWebpSupport(): Promise<boolean> {
  if (webpSupported !== null) return Promise.resolve(webpSupported)
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      webpSupported = image.width === 1
      resolve(webpSupported)
    }
    image.onerror = () => {
      webpSupported = false
      resolve(false)
    }
    image.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='
  })
}

export async function initBootImageFormat(): Promise<void> {
  const supported = await detectWebpSupport()
  if (!supported) return
  try {
    const response = await fetch(BOOT_WEBP_MAP_URL)
    if (!response.ok) return
    webpMap = (await response.json()) as Record<string, string>
  } catch {
    // PNG fallback when map is unavailable (e.g. dev without build step).
  }
}

/** Resolve a canonical PNG URL to WebP when supported and mapped. */
export function resolveRasterUrl(canonicalUrl: string): string {
  if (!webpSupported) return canonicalUrl
  return webpMap[canonicalUrl] ?? canonicalUrl
}

/** Reset for tests. */
export function resetBootImageFormatForTests(): void {
  webpSupported = null
  webpMap = {}
}

/** Test-only configuration for resolveRasterUrl. */
export function configureBootImageFormatForTests(supported: boolean, map: Record<string, string> = {}): void {
  webpSupported = supported
  webpMap = map
}
