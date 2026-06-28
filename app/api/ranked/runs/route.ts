import { NextResponse } from 'next/server'

import { isLeaderboardServiceError } from '@/services/leaderboard'
import { createLogger } from '@/services/logger'
import { createRankedRun } from '@/services/ranked'

export const dynamic = 'force-dynamic'

const logger = createLogger('api-ranked-runs')

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      logger.warn('create run invalid json')
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const modeId = (body as { modeId?: string }).modeId === 'endless' ? 'endless' : 'endless'
    const run = await createRankedRun(modeId)
    logger.ok('create run', { runId: run.runId.slice(0, 8), modeId })
    return NextResponse.json({ ok: true, ...run })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create ranked run'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    logger.fail('create run failed', { message, status })
    return NextResponse.json({ error: message }, { status })
  }
}
