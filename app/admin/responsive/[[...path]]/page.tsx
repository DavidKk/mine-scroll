import { parseResponsivePathFromSegments } from '@game-client/app/routes'

import { GameShell } from '@/app/components/game-shell'
import { checkAccess } from '@/services/auth/access'

export const dynamic = 'force-dynamic'

type AdminResponsivePageProps = {
  params: Promise<{ path?: string[] }>
}

export default async function AdminResponsivePage({ params }: AdminResponsivePageProps) {
  const { path } = await params
  const adminPath = path?.length ? `/admin/responsive/${path.join('/')}` : '/admin/responsive/matrix'

  await checkAccess({ redirectUrl: adminPath, isApiRouter: false })

  const responsiveRoute = parseResponsivePathFromSegments(path)

  return <GameShell route={{ type: 'responsive', panelId: responsiveRoute.panelId }} />
}
