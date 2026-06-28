import { parseAssetPathFromSegments } from '@game-client/app/routes'

import { GameShell } from '@/app/components/game-shell'
import { checkAccess } from '@/services/auth/access'

export const dynamic = 'force-dynamic'

type AdminAssetsPageProps = {
  params: Promise<{ path?: string[] }>
}

export default async function AdminAssetsPage({ params }: AdminAssetsPageProps) {
  const { path } = await params
  const adminPath = path?.length ? `/admin/assets/${path.join('/')}` : '/admin/assets/sources'

  await checkAccess({ redirectUrl: adminPath, isApiRouter: false })

  const assetRoute = parseAssetPathFromSegments(path)

  return <GameShell route={{ type: 'assets', section: assetRoute.section, panelId: assetRoute.panelId }} />
}
