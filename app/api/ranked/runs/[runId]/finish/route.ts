import { NextResponse } from 'next/server'

import { readRequestCountryCode } from '@/services/geoip/request'
import { isLeaderboardServiceError } from '@/services/leaderboard'
import { createLogger } from '@/services/logger'
import { finishRankedRun, type RunInputEvent } from '@/services/ranked'

export const dynamic = 'force-dynamic'

const logger = createLogger('api-ranked-finish')

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      logger.warn('finish invalid json', { runId: runId.slice(0, 8) })
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const payload = body as {
      playerId?: unknown
      name?: unknown
      claimedScore?: unknown
      claimedDepth?: unknown
      events?: RunInputEvent[]
    }
    const countryCode = readRequestCountryCode(request)
    const result = await finishRankedRun(runId, payload.playerId, String(payload.name ?? ''), payload.claimedScore, payload.claimedDepth, payload.events ?? [], countryCode)

    logger.ok('finish completed', {
      runId: runId.slice(0, 8),
      status: result.status,
      ranked: result.ranked,
      saved: result.saved,
      rank: result.rank,
      cheating: result.cheating,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to finish ranked run'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    logger.fail('finish failed', { message, status })
    return NextResponse.json({ error: message }, { status })
  }
}
