import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { collectBootAssets } from '../src/ui/boot/asset-registry.ts';
import type { GameAssetManifestSnapshot } from '../src/ui/boot/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const manifestPath = join(publicDir, 'assets/game/manifest.json');
const mapPath = join(publicDir, 'assets/boot-webp-map.json');

const WEBP_QUALITY = 85;

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as GameAssetManifestSnapshot;
const assets = collectBootAssets(manifest);

const webpMap: Record<string, string> = {};
let converted = 0;
let skipped = 0;
let bytesBefore = 0;
let bytesAfter = 0;

for (const asset of assets) {
  if (!asset.url.endsWith('.png')) continue;

  const pngPath = join(publicDir, asset.url.replace(/^\//, ''));
  if (!existsSync(pngPath)) continue;

  const webpUrl = `${asset.url.replace(/\.png$/i, '')}.webp`;
  const webpPath = join(publicDir, webpUrl.replace(/^\//, ''));

  const pngStat = statSync(pngPath);
  bytesBefore += pngStat.size;

  if (existsSync(webpPath)) {
    const webpStat = statSync(webpPath);
    if (webpStat.mtimeMs >= pngStat.mtimeMs) {
      webpMap[asset.url] = webpUrl;
      bytesAfter += webpStat.size;
      skipped += 1;
      continue;
    }
  }

  await sharp(pngPath).webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(webpPath);
  webpMap[asset.url] = webpUrl;
  bytesAfter += statSync(webpPath).size;
  converted += 1;
}

writeFileSync(mapPath, `${JSON.stringify(webpMap, null, 2)}\n`);

const savedPct = bytesBefore > 0 ? Math.round((1 - bytesAfter / bytesBefore) * 100) : 0;
console.log(
  `boot-webp: ${Object.keys(webpMap).length} mapped (${converted} converted, ${skipped} cached) — ~${savedPct}% smaller vs PNG`,
);
