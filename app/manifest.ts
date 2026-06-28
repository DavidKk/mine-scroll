import type { MetadataRoute } from 'next'

import { BRAND_DESCRIPTION, BRAND_LOGO_PATH, BRAND_MARK_PATH, BRAND_NAME } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
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
    lang: 'zh-CN',
    categories: ['games', 'entertainment'],
    icons: [
      {
        src: BRAND_MARK_PATH,
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: BRAND_LOGO_PATH,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
