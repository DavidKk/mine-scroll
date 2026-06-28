import { getCachedImage, setCachedImage } from '../boot/asset-cache.ts';

export function loadRuntimeImage(src: string): HTMLImageElement {
  const cached = getCachedImage(src);
  if (cached) return cached;

  const image = new Image();
  image.src = src;
  image.onload = () => {
    setCachedImage(src, image);
  };
  return image;
}
