import type { Metadata } from 'next'

import { LandingPage } from '@/app/components/landing/landing-page'
import { LandingFaqJsonLd } from '@/app/components/landing-faq-json-ld'
import { BRAND_DESCRIPTION, BRAND_HOME_TITLE } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { buildPublicPageMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase()
  return buildPublicPageMetadata(metadataBase, {
    title: BRAND_HOME_TITLE,
    description: BRAND_DESCRIPTION,
    path: '/',
  })
}

export default function HomePage() {
  return (
    <>
      <LandingFaqJsonLd />
      <LandingPage />
    </>
  )
}
