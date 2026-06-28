import { getCachedImage, hasCachedImage, setCachedImage } from './asset-cache.ts';
import type { BootAsset, BootAssetResult } from './types.ts';

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [300, 900];

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function loadImageOnce(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  const cached = getCachedImage(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const img = new Image();
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      img.onload = null;
      img.onerror = null;
      reject(new DOMException('Aborted', 'AbortError'));
    };

    img.onload = () => {
      cleanup();
      setCachedImage(url, img);
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${url}`));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    img.src = url;
  });
}

async function loadImageWithRetry(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (hasCachedImage(url)) return getCachedImage(url)!;
    try {
      return await loadImageOnce(url, signal);
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 900, signal);
      }
    }
  }
  throw lastError;
}

export async function loadBootAsset(asset: BootAsset, signal?: AbortSignal): Promise<BootAssetResult> {
  try {
    await loadImageWithRetry(asset.url, signal);
    return { id: asset.id, url: asset.url, ok: true };
  } catch {
    return { id: asset.id, url: asset.url, ok: false };
  }
}

export interface LoadBootAssetsOptions {
  assets: BootAsset[];
  maxConcurrent?: number;
  onAssetComplete?: (asset: BootAsset, result: BootAssetResult, progressWeight: number) => void;
  signal?: AbortSignal;
}

export async function loadBootAssets(options: LoadBootAssetsOptions): Promise<BootAssetResult[]> {
  const { assets, maxConcurrent = 8, onAssetComplete, signal } = options;
  const results: BootAssetResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < assets.length) {
      if (signal?.aborted) return;
      const index = cursor;
      cursor += 1;
      const asset = assets[index];
      if (!asset) continue;

      const result = await loadBootAsset(asset, signal);
      results.push(result);
      onAssetComplete?.(asset, result, asset.weight);
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, assets.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
