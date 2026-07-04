import type { Metadata } from 'next'

import { GameShell } from '@/app/components/game-shell'
import { BRAND_DESCRIPTION } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { buildPublicPageMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase()
  return buildPublicPageMetadata(metadataBase, {
    title: 'Puzzle Rush',
    description: `${BRAND_DESCRIPTION} Clear small boards in a row and stack combo multipliers.`,
    path: '/play/rush',
  })
}

export default function PuzzleRushPage() {
  return <GameShell route={{ type: 'puzzle-rush' }} />
}
