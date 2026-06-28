import type { GameAssetManifestSnapshot } from './types.ts';

const imageCache = new Map<string, HTMLImageElement>();
let manifestSnapshot: GameAssetManifestSnapshot | null = null;
let bootComplete = false;

export function getCachedImage(url: string): HTMLImageElement | undefined {
  return imageCache.get(url);
}

export function setCachedImage(url: string, image: HTMLImageElement): void {
  imageCache.set(url, image);
}

export function hasCachedImage(url: string): boolean {
  return imageCache.has(url);
}

export function setBootManifest(manifest: GameAssetManifestSnapshot): void {
  manifestSnapshot = manifest;
}

export function getBootManifest(): GameAssetManifestSnapshot | null {
  return manifestSnapshot;
}

export function markBootComplete(): void {
  bootComplete = true;
}

export function isBootComplete(): boolean {
  return bootComplete;
}

export function resetBootCache(): void {
  imageCache.clear();
  manifestSnapshot = null;
  bootComplete = false;
}
