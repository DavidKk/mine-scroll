import type { Metadata } from 'next'

import { GameShell } from '@/app/components/game-shell'
import { BRAND_DESCRIPTION } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { buildPublicPageMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase()
  return buildPublicPageMetadata(metadataBase, {
    title: '开始游戏',
    description: BRAND_DESCRIPTION,
    path: '/play',
  })
}

export default function PlayPage() {
  return <GameShell route={{ type: 'game' }} />
}
