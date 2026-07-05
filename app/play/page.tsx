import type { Metadata } from 'next'

import { BreadcrumbJsonLd } from '@/app/components/breadcrumb-json-ld'
import { GameShell } from '@/app/components/game-shell'
import { BRAND_NAME, PLAY_PAGE_DESCRIPTION, PLAY_PAGE_TITLE } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { buildPublicPageMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase()
  return buildPublicPageMetadata(metadataBase, {
    title: PLAY_PAGE_TITLE,
    description: PLAY_PAGE_DESCRIPTION,
    path: '/play',
  })
}

export default function PlayPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: BRAND_NAME, path: '/' },
          { name: PLAY_PAGE_TITLE, path: '/play' },
        ]}
      />
      <GameShell route={{ type: 'game' }} />
    </>
  )
}
