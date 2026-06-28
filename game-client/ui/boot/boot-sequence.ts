import { markBootComplete, setBootManifest } from './asset-cache.ts'
import { loadBootAssets } from './asset-loader.ts'
import { buildBootAssetList } from './asset-registry.ts'
import { initBootImageFormat } from './image-format.ts'
import { sortBootAssetsForLoad } from './load-priority.ts'
import type { BootAsset, BootAssetGroup, BootProgress, BootProgressLabel, BootResult, BootSequenceOptions } from './types.ts'

const MIN_BOOT_DISPLAY_MS = 400

let bootPromise: Promise<BootResult> | null = null

function groupLabel(group: BootAssetGroup): BootProgressLabel {
  if (group === 'tiles') return 'tiles'
  if (group === 'hud-icons' || group === 'panels' || group === 'hud-feedback') return 'ui'
  return 'fx'
}

export function computeBootProgress(ratio: number, label: BootProgressLabel, loaded: number, total: number, currentGroup?: BootAssetGroup): BootProgress {
  const clamped = Math.min(1, Math.max(0, ratio))
  return {
    ratio: clamped,
    displayPercent: Math.round(clamped * 100),
    label,
    loaded,
    total,
    currentGroup,
  }
}

function isBlockingTier(tier: number): boolean {
  return tier === 1 || tier === 2
}

function partitionByTier(assets: BootAsset[]): { blocking: BootAsset[]; background: BootAsset[] } {
  const blocking = assets.filter((asset) => isBlockingTier(asset.tier))
  const background = assets.filter((asset) => asset.tier === 3)
  return { blocking, background }
}

const MANIFEST_PROGRESS = 0.03
const ASSET_PROGRESS = 1 - MANIFEST_PROGRESS

async function runOnce(options: BootSequenceOptions = {}): Promise<BootResult> {
  const startedAt = performance.now()
  const { onProgress, signal, maxConcurrent = 8 } = options

  let currentLabel: BootProgressLabel = 'starting'
  let currentGroup: BootAssetGroup | undefined
  let loadedCount = 0

  const emit = (ratio: number) => {
    onProgress?.(computeBootProgress(ratio, currentLabel, loadedCount, 0, currentGroup))
  }

  emit(0)

  const [{ assets, manifest }] = await Promise.all([buildBootAssetList(), initBootImageFormat()])
  if (manifest) setBootManifest(manifest)

  const { blocking, background } = partitionByTier(assets)
  const totalWeight = blocking.reduce((sum, asset) => sum + asset.weight, 0)
  let completedWeight = 0
  loadedCount = 0
  currentLabel = 'starting'

  emit(MANIFEST_PROGRESS)

  const assetRatio = () => (totalWeight > 0 ? MANIFEST_PROGRESS + ASSET_PROGRESS * (completedWeight / totalWeight) : MANIFEST_PROGRESS)

  const emitAssets = () => {
    onProgress?.(computeBootProgress(assetRatio(), currentLabel, loadedCount, blocking.length, currentGroup))
  }

  emitAssets()

  const failedRequired: BootAsset[] = []
  const failedOptional: BootAsset[] = []

  const blockingTiers = [1, 2] as const
  for (const tier of blockingTiers) {
    const tierAssets = sortBootAssetsForLoad(blocking.filter((asset) => asset.tier === tier))
    if (tierAssets.length === 0) continue

    await loadBootAssets({
      assets: tierAssets,
      maxConcurrent,
      signal,
      onAssetComplete: (asset, result) => {
        loadedCount += 1
        if (result.ok) {
          completedWeight += asset.weight
        } else if (asset.optional) {
          failedOptional.push(asset)
        } else {
          failedRequired.push(asset)
        }
        currentGroup = asset.group
        currentLabel = groupLabel(asset.group)
        emitAssets()
      },
    })

    if (failedRequired.length > 0) break
  }

  if (failedRequired.length > 0) {
    return {
      ok: false,
      loaded: loadedCount - failedRequired.length,
      failed: [...failedRequired, ...failedOptional],
      durationMs: performance.now() - startedAt,
    }
  }

  currentLabel = 'ready'
  emit(1)

  if (background.length > 0) {
    void loadBootAssets({ assets: background, maxConcurrent, signal })
  }

  markBootComplete()

  const elapsed = performance.now() - startedAt
  if (elapsed < MIN_BOOT_DISPLAY_MS) {
    await new Promise((resolve) => window.setTimeout(resolve, MIN_BOOT_DISPLAY_MS - elapsed))
  }

  return {
    ok: true,
    loaded: loadedCount - failedRequired.length,
    failed: failedOptional,
    durationMs: performance.now() - startedAt,
  }
}

export function runBootSequence(options: BootSequenceOptions = {}): Promise<BootResult> {
  if (bootPromise) return bootPromise
  bootPromise = runOnce(options).finally(() => {
    // Keep bootPromise resolved for idempotent callers; do not reset on failure so retry uses fresh call
  })
  return bootPromise
}

export function resetBootSequence(): void {
  bootPromise = null
}

export async function retryBootSequence(options: BootSequenceOptions = {}): Promise<BootResult> {
  resetBootSequence()
  return runOnce(options)
}
