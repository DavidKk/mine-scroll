import { NextResponse } from 'next/server'

import { isLeaderboardKvConfigured, isLeaderboardServiceError, readLeaderboard, submitLeaderboardEntry } from '@/services/leaderboard'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const board = await readLeaderboard()
    return NextResponse.json({
      ok: true,
      configured: isLeaderboardKvConfigured(),
      entries: board.entries,
      updatedAt: board.updatedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load leaderboard'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const payload = body as { name?: unknown; score?: unknown }
    const board = await submitLeaderboardEntry(String(payload.name ?? ''), payload.score)
    return NextResponse.json({
      ok: true,
      entries: board.entries,
      updatedAt: board.updatedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit score'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    return NextResponse.json({ error: message }, { status })
  }
}
