import { NextResponse } from 'next/server'

import { isLeaderboardServiceError } from '@/services/leaderboard'
import type { RunInputEvent } from '@/services/ranked'
import { appendRankedEvents } from '@/services/ranked'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const payload = body as { seq?: unknown; events?: RunInputEvent[] }
    const seq = typeof payload.seq === 'number' ? payload.seq : Number(payload.seq)
    if (!Number.isInteger(seq) || seq <= 0) {
      return NextResponse.json({ error: 'Invalid event sequence' }, { status: 400 })
    }

    await appendRankedEvents(runId, seq, payload.events ?? [])
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload events'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    return NextResponse.json({ error: message }, { status })
  }
}
