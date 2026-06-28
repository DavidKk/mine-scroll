import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { collectBootAssets } from '../game-client/ui/boot/asset-registry.ts'
import type { GameAssetManifestSnapshot } from '../game-client/ui/boot/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const manifestPath = join(publicDir, 'assets/game/manifest.json')
const outputPath = join(publicDir, 'assets/boot-weights.json')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as GameAssetManifestSnapshot
const assets = collectBootAssets(manifest)

let webpMap: Record<string, string> = {}
const webpMapPath = join(publicDir, 'assets/boot-webp-map.json')
if (existsSync(webpMapPath)) {
  webpMap = JSON.parse(readFileSync(webpMapPath, 'utf8')) as Record<string, string>
}

const weights: Record<string, number> = {}
let missing = 0

for (const asset of assets) {
  const urls = [asset.url, webpMap[asset.url]].filter(Boolean) as string[]
  for (const url of urls) {
    if (weights[url]) continue
    const filePath = join(publicDir, url.replace(/^\//, ''))
    try {
      weights[url] = statSync(filePath).size
    } catch {
      if (url === asset.url) {
        weights[url] = asset.weight
        missing += 1
      }
    }
  }
}

writeFileSync(outputPath, `${JSON.stringify(weights, null, 2)}\n`)
console.log(`boot-weights: ${assets.length} urls (${missing} missing on disk, used fallback weight)`)
