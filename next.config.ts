import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Legacy asset-lab UI paths only — must not catch `public/assets/*` game files (hud, tiles, game, …). */
const ASSET_LAB_SECTIONS = ['sources', 'sprites', 'animations', 'game-ui', 'background', 'audio'] as const

function legacyAssetLabRedirects(): { source: string; destination: string; permanent: boolean }[] {
  const redirects: { source: string; destination: string; permanent: boolean }[] = [{ source: '/assets', destination: '/admin/assets/sources', permanent: false }]
  for (const section of ASSET_LAB_SECTIONS) {
    redirects.push(
      { source: `/assets/${section}`, destination: `/admin/assets/${section}`, permanent: false },
      { source: `/assets/${section}/:path*`, destination: `/admin/assets/${section}/:path*`, permanent: false }
    )
  }
  return redirects
}

const nextConfig: NextConfig = {
  transpilePackages: ['@shared/core'],
  async redirects() {
    return [
      { source: '/admin', destination: '/admin/assets/sources', permanent: false },
      { source: '/admin/assets', destination: '/admin/assets/sources', permanent: false },
      { source: '/admin/lab', destination: '/admin/lab/asset-sheets', permanent: false },
      { source: '/admin/responsive', destination: '/admin/responsive/matrix', permanent: false },
      ...legacyAssetLabRedirects(),
      { source: '/lab', destination: '/admin/lab/asset-sheets', permanent: false },
      { source: '/responsive', destination: '/admin/responsive/matrix', permanent: false },
    ]
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@game-client': path.join(rootDir, 'game-client'),
      '@shared/core': path.join(rootDir, 'shared/core'),
    }
    return config
  },
}

export default nextConfig
