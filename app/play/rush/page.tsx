import type { Metadata } from 'next'

import { BreadcrumbJsonLd } from '@/app/components/breadcrumb-json-ld'
import { GameShell } from '@/app/components/game-shell'
import { BRAND_NAME, RUSH_PAGE_DESCRIPTION } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { buildPublicPageMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase()
  return buildPublicPageMetadata(metadataBase, {
    title: 'Puzzle Rush',
    description: RUSH_PAGE_DESCRIPTION,
    path: '/play/rush',
  })
}

export default function PuzzleRushPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: BRAND_NAME, path: '/' },
          { name: 'Puzzle Rush', path: '/play/rush' },
        ]}
      />
      <GameShell route={{ type: 'puzzle-rush' }} />
    </>
  )
}
