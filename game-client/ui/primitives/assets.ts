import { getCachedImage, isBootComplete, setCachedImage } from '../boot/asset-cache.ts'
import { resolveRasterUrl } from '../boot/image-format.ts'

const PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

let placeholderImage: HTMLImageElement | null = null

function getPlaceholderImage(): HTMLImageElement {
  if (!placeholderImage) {
    placeholderImage = new Image()
    placeholderImage.src = PLACEHOLDER_SRC
  }
  return placeholderImage
}

export function loadRuntimeImage(src: string): HTMLImageElement {
  const cached = getCachedImage(src)
  if (cached) return cached

  if (isBootComplete()) {
    console.warn(`[boot] Image not preloaded: ${src}`)
    return getPlaceholderImage()
  }

  const image = new Image()
  const preferred = resolveRasterUrl(src)
  image.src = preferred
  image.onerror = () => {
    if (preferred !== src) image.src = src
  }
  image.onload = () => {
    setCachedImage(src, image)
  }
  return image
}
