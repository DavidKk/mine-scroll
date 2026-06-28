import { GameShell } from '@/app/components/game-shell'
import { checkAccess } from '@/services/auth/access'

export const dynamic = 'force-dynamic'

/** `/admin` is redirected to `/admin/assets/sources` in next.config.ts; this page is a fallback. */
export default async function AdminIndexPage() {
  await checkAccess({ redirectUrl: '/admin/assets/sources', isApiRouter: false })
  return <GameShell route={{ type: 'assets', section: 'sources', panelId: null }} />
}
