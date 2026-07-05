import type { MetadataRoute } from 'next'

import { getRequestMetadataBase } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { origin } = await getRequestMetadataBase()

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/play'],
        disallow: ['/admin', '/login', '/api', '/auth', '/lab', '/responsive'],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
