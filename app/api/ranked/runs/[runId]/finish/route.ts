import { NextResponse } from 'next/server'

import { isLeaderboardServiceError, readLeaderboard } from '@/services/leaderboard'
import { finishRankedRun } from '@/services/ranked'

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

    const payload = body as { name?: unknown; claimedScore?: unknown; claimedDepth?: unknown }
    const result = await finishRankedRun(runId, String(payload.name ?? ''), payload.claimedScore, payload.claimedDepth)

    let entries = undefined
    if (result.status === 'accepted') {
      const board = await readLeaderboard()
      entries = board.entries
    }

    return NextResponse.json({ ok: true, ...result, entries })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to finish ranked run'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    return NextResponse.json({ error: message }, { status })
  }
}
