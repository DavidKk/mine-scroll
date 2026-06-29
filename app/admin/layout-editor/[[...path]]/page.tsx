import { parseLayoutEditorPathFromSegments } from '@game-client/app/routes'

import { GameShell } from '@/app/components/game-shell'
import { checkAccess } from '@/services/auth/access'

export const dynamic = 'force-dynamic'

type AdminLayoutEditorPageProps = {
  params: Promise<{ path?: string[] }>
}

export default async function AdminLayoutEditorPage({ params }: AdminLayoutEditorPageProps) {
  const { path } = await params
  const adminPath = path?.length ? `/admin/layout-editor/${path.join('/')}` : '/admin/layout-editor/editor'

  await checkAccess({ redirectUrl: adminPath, isApiRouter: false })

  const layoutEditorRoute = parseLayoutEditorPathFromSegments(path)

  return <GameShell route={{ type: 'layout-editor', panelId: layoutEditorRoute.panelId }} />
}
