import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Prefer built WebP siblings for server metadata when the file exists on disk. */
export function preferWebpAssetPath(assetPath: string): string {
  if (!assetPath.toLowerCase().endsWith('.png')) return assetPath
  const webpPath = assetPath.replace(/\.png$/i, '.webp')
  const absolute = join(process.cwd(), 'public', webpPath.replace(/^\//, ''))
  return existsSync(absolute) ? webpPath : assetPath
}
