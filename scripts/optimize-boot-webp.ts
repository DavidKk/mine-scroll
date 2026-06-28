import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { collectBootAssets } from '../game-client/ui/boot/asset-registry.ts'
import type { GameAssetManifestSnapshot } from '../game-client/ui/boot/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const assetsDir = join(publicDir, 'assets')
const manifestPath = join(publicDir, 'assets/game/manifest.json')
const mapPath = join(publicDir, 'assets/boot-webp-map.json')

const WEBP_QUALITY = 85

function collectPublicPngUrls(dir: string, rel = ''): string[] {
  const urls: string[] = []
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    const relPath = rel ? `${rel}/${entry}` : entry
    if (statSync(abs).isDirectory()) {
      urls.push(...collectPublicPngUrls(abs, relPath))
      continue
    }
    if (entry.toLowerCase().endsWith('.png')) {
      urls.push(`/assets/${relPath}`)
    }
  }
  return urls
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as GameAssetManifestSnapshot
const bootUrls = collectBootAssets(manifest)
  .map((asset) => asset.url)
  .filter((url) => url.endsWith('.png'))
const scannedUrls = collectPublicPngUrls(assetsDir)
const pngUrls = [...new Set([...bootUrls, ...scannedUrls])].sort()

const webpMap: Record<string, string> = {}
let converted = 0
let skipped = 0
let missingSource = 0
let bytesBefore = 0
let bytesAfter = 0

for (const assetUrl of pngUrls) {
  const pngPath = join(publicDir, assetUrl.replace(/^\//, ''))
  if (!existsSync(pngPath)) {
    missingSource += 1
    console.warn(`boot-webp: missing source ${assetUrl}`)
    continue
  }

  const webpUrl = `${assetUrl.replace(/\.png$/i, '')}.webp`
  const webpPath = join(publicDir, webpUrl.replace(/^\//, ''))

  const pngStat = statSync(pngPath)
  bytesBefore += pngStat.size

  if (existsSync(webpPath)) {
    const webpStat = statSync(webpPath)
    if (webpStat.mtimeMs >= pngStat.mtimeMs) {
      webpMap[assetUrl] = webpUrl
      bytesAfter += webpStat.size
      skipped += 1
      continue
    }
  }

  await sharp(pngPath).webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(webpPath)
  webpMap[assetUrl] = webpUrl
  bytesAfter += statSync(webpPath).size
  converted += 1
}

writeFileSync(mapPath, `${JSON.stringify(webpMap, null, 2)}\n`)

const bootOnly = bootUrls.filter((url) => !scannedUrls.includes(url))
const scanOnly = scannedUrls.filter((url) => !bootUrls.includes(url))
const unmappedAfter = scannedUrls.filter((url) => !webpMap[url])

const savedPct = bytesBefore > 0 ? Math.round((1 - bytesAfter / bytesBefore) * 100) : 0
console.log(`boot-webp: ${Object.keys(webpMap).length} mapped (${converted} converted, ${skipped} cached)`)
console.log(`boot-webp: ${scannedUrls.length} PNG under public/assets, ${missingSource} missing on disk`)
console.log(`boot-webp: ~${savedPct}% smaller vs PNG (${bootUrls.length} boot URLs, ${scanOnly.length} non-boot extras)`)
if (bootOnly.length > 0) {
  console.log(`boot-webp: boot-only URLs: ${bootOnly.join(', ')}`)
}
if (scanOnly.length > 0) {
  console.log('boot-webp: non-boot PNGs now mapped:')
  for (const url of scanOnly) console.log(`  - ${url}`)
}
if (unmappedAfter.length > 0) {
  console.warn('boot-webp: still unmapped after conversion:')
  for (const url of unmappedAfter) console.warn(`  - ${url}`)
}
