import { NextResponse } from 'next/server'

import { isLeaderboardServiceError } from '@/services/leaderboard'
import { getRankedRun, toPublicRunStatus } from '@/services/ranked'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params
    const record = await getRankedRun(runId)
    if (!record) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...toPublicRunStatus(record) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load run status'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    return NextResponse.json({ error: message }, { status })
  }
}
