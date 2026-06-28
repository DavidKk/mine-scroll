import { parseLabPathFromSegments } from '@game-client/app/routes'

import { GameShell } from '@/app/components/game-shell'
import { checkAccess } from '@/services/auth/access'

export const dynamic = 'force-dynamic'

type AdminLabPageProps = {
  params: Promise<{ path?: string[] }>
}

export default async function AdminLabPage({ params }: AdminLabPageProps) {
  const { path } = await params
  const adminPath = path?.length ? `/admin/lab/${path.join('/')}` : '/admin/lab/asset-sheets'

  await checkAccess({ redirectUrl: adminPath, isApiRouter: false })

  const labRoute = parseLabPathFromSegments(path)

  return <GameShell route={{ type: 'lab', panelId: labRoute.panelId }} />
}
