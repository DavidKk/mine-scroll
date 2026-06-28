import { NextResponse } from 'next/server'

import { isLeaderboardServiceError } from '@/services/leaderboard'
import { createRankedRun } from '@/services/ranked'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const modeId = (body as { modeId?: string }).modeId === 'endless' ? 'endless' : 'endless'
    const run = await createRankedRun(modeId)
    return NextResponse.json({ ok: true, ...run })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create ranked run'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    return NextResponse.json({ error: message }, { status })
  }
}
