import { NextResponse } from 'next/server'

import { isLeaderboardServiceError } from '@/services/leaderboard'
import { createLogger } from '@/services/logger'
import { getRankedRun, toPublicRunStatus } from '@/services/ranked'

export const dynamic = 'force-dynamic'

const logger = createLogger('api-ranked-run-status')

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params
    const record = await getRankedRun(runId)
    if (!record) {
      logger.warn('run status not found', { runId: runId.slice(0, 8) })
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...toPublicRunStatus(record) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load run status'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    logger.fail('run status failed', { message, status })
    return NextResponse.json({ error: message }, { status })
  }
}
