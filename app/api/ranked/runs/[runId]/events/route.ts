import { NextResponse } from 'next/server'

import { isLeaderboardServiceError } from '@/services/leaderboard'
import { createLogger } from '@/services/logger'
import type { RunInputEvent } from '@/services/ranked'
import { appendRankedEvents } from '@/services/ranked'

export const dynamic = 'force-dynamic'

const logger = createLogger('api-ranked-events')

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      logger.warn('events invalid json', { runId: runId.slice(0, 8) })
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const payload = body as { seq?: unknown; events?: RunInputEvent[] }
    const seq = typeof payload.seq === 'number' ? payload.seq : Number(payload.seq)
    if (!Number.isInteger(seq) || seq <= 0) {
      logger.warn('events invalid seq', { runId: runId.slice(0, 8), seq: payload.seq })
      return NextResponse.json({ error: 'Invalid event sequence' }, { status: 400 })
    }

    await appendRankedEvents(runId, seq, payload.events ?? [])
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload events'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    logger.fail('events upload failed', { message, status })
    return NextResponse.json({ error: message }, { status })
  }
}
