import type { Metadata } from 'next'

import { LandingPage } from '@/app/components/landing/landing-page'
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { buildPublicPageMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase()
  return buildPublicPageMetadata(metadataBase, {
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    path: '/',
  })
}

export default function HomePage() {
  return <LandingPage />
}
