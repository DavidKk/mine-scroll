import type { MetadataRoute } from 'next'

import { getRequestMetadataBase } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { origin } = await getRequestMetadataBase()
  const lastModified = new Date()

  return [
    {
      url: `${origin}/play`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
