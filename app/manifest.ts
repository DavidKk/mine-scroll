import type { MetadataRoute } from 'next'

import { BRAND_DESCRIPTION, BRAND_LOGO_PATH, BRAND_MARK_PATH, BRAND_NAME } from '@/lib/brand'
import { preferWebpAssetPath } from '@/lib/server-raster-url'

export default function manifest(): MetadataRoute.Manifest {
  const brandMark = preferWebpAssetPath(BRAND_MARK_PATH)
  const brandLogo = preferWebpAssetPath(BRAND_LOGO_PATH)
  const rasterType = (path: string) => (path.endsWith('.webp') ? 'image/webp' : 'image/png')

  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    start_url: '/play',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#030408',
    theme_color: '#2decff',
    lang: 'en',
    categories: ['games', 'entertainment'],
    icons: [
      {
        src: brandMark,
        sizes: '512x512',
        type: rasterType(brandMark),
      },
      {
        src: brandLogo,
        sizes: '512x512',
        type: rasterType(brandLogo),
        purpose: 'maskable',
      },
    ],
  }
}
