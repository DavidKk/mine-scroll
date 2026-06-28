import { GameShell } from '@/app/components/game-shell'
import { checkAccess } from '@/services/auth/access'

export const dynamic = 'force-dynamic'

export default async function AdminResponsivePage() {
  await checkAccess({ redirectUrl: '/admin/responsive', isApiRouter: false })
  return <GameShell route={{ type: 'responsive' }} />
}
