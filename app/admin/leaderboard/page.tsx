import type { Metadata } from 'next'

import { checkAccess } from '@/services/auth/access'

import { LeaderboardAdminClient } from './leaderboard-admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Leaderboard',
}

export default async function LeaderboardAdminPage() {
  await checkAccess({ redirectUrl: '/admin/leaderboard', isApiRouter: false })
  return <LeaderboardAdminClient />
}
