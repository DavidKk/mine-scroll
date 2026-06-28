import { GameShell } from '@/app/components/game-shell'
import { checkAccess } from '@/services/auth/access'

export const dynamic = 'force-dynamic'

export default async function AdminLabPage() {
  await checkAccess({ redirectUrl: '/admin/lab', isApiRouter: false })
  return <GameShell route={{ type: 'lab' }} />
}
