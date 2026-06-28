import assert from 'node:assert/strict'

import { collectBootAssets, dedupeBootAssets } from '../game-client/ui/boot/asset-registry.ts'
import { computeBootProgress } from '../game-client/ui/boot/boot-sequence.ts'
import { applyBootWeightMap } from '../game-client/ui/boot/boot-weights.ts'
import { configureBootImageFormatForTests, resetBootImageFormatForTests, resolveRasterUrl } from '../game-client/ui/boot/image-format.ts'
import { sortBootAssetsForLoad } from '../game-client/ui/boot/load-priority.ts'
import type { BootAsset } from '../game-client/ui/boot/types.ts'

function asset(id: string, overrides: Partial<BootAsset> = {}): BootAsset {
  return {
    id,
    url: `/assets/${id}.png`,
    tier: 2,
    group: 'fx',
    weight: 100,
    ...overrides,
  }
}

export function testComputeBootProgressClampsRatio(): void {
  const low = computeBootProgress(-0.2, 'tiles', 0, 10)
  const high = computeBootProgress(1.5, 'ready', 10, 10)
  assert.equal(low.ratio, 0)
  assert.equal(low.displayPercent, 0)
  assert.equal(high.ratio, 1)
  assert.equal(high.displayPercent, 100)
}

export function testApplyBootWeightMapUsesBytes(): void {
  const assets = [asset('a', { url: '/assets/a.png', weight: 10 })]
  const weighted = applyBootWeightMap(assets, { '/assets/a.png': 2048 })
  assert.equal(weighted[0]?.weight, 2048)
}

export function testApplyBootWeightMapPrefersWebpBytes(): void {
  const assets = [asset('a', { url: '/assets/a.png', weight: 10 })]
  const weighted = applyBootWeightMap(assets, { '/assets/a.png': 2048, '/assets/a.webp': 512 }, { '/assets/a.png': '/assets/a.webp' })
  assert.equal(weighted[0]?.weight, 512)
}

export function testApplyBootWeightMapKeepsFallbackWhenMissing(): void {
  const assets = [asset('a', { weight: 42 })]
  const weighted = applyBootWeightMap(assets, {})
  assert.equal(weighted[0]?.weight, 42)
}

export function testDedupeBootAssetsMergesByUrl(): void {
  const merged = dedupeBootAssets([
    asset('one', { url: '/assets/shared.png', tier: 2, weight: 10, optional: true }),
    asset('two', { url: '/assets/shared.png', tier: 1, weight: 50, optional: false }),
  ])
  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.tier, 1)
  assert.equal(merged[0]?.weight, 50)
  assert.equal(merged[0]?.optional, false)
}

export function testSortBootAssetsForLoadPrioritizesHeavyWithinTier(): void {
  const sorted = sortBootAssetsForLoad([asset('light', { tier: 2, weight: 10 }), asset('heavy', { tier: 2, weight: 900 }), asset('tile', { tier: 1, weight: 1 })])
  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ['tile', 'heavy', 'light']
  )
}

export function testCollectBootAssetsHasNoDuplicateUrls(): void {
  const assets = collectBootAssets(null)
  const urls = assets.map((entry) => entry.url)
  assert.equal(urls.length, new Set(urls).size)
  assert.ok(assets.some((entry) => entry.tier === 1 && entry.group === 'tiles'))
}

export function testResolveRasterUrlUsesWebpWhenSupported(): void {
  resetBootImageFormatForTests()
  configureBootImageFormatForTests(true, { '/assets/a.png': '/assets/a.webp' })
  assert.equal(resolveRasterUrl('/assets/a.png'), '/assets/a.webp')
  assert.equal(resolveRasterUrl('/assets/b.png'), '/assets/b.png')
  resetBootImageFormatForTests()
}

export function testResolveRasterUrlKeepsPngWhenUnsupported(): void {
  resetBootImageFormatForTests()
  configureBootImageFormatForTests(false, { '/assets/a.png': '/assets/a.webp' })
  assert.equal(resolveRasterUrl('/assets/a.png'), '/assets/a.png')
  resetBootImageFormatForTests()
}
