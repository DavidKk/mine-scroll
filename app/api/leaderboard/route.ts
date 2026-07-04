import { NextResponse } from 'next/server'

import { getKvStorageMode } from '@/services/kv/client'
import {
  clearPlayerLeaderboard,
  isLeaderboardKvConfigured,
  isLeaderboardServiceError,
  parseRankedLeaderboardModeId,
  readLeaderboard,
  submitLeaderboardEntry,
} from '@/services/leaderboard'
import { createLogger } from '@/services/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('api-leaderboard')

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId') ?? undefined
    const modeId = parseRankedLeaderboardModeId(url.searchParams.get('mode'))
    const board = await readLeaderboard(playerId ?? undefined, modeId)
    return NextResponse.json({
      ok: true,
      modeId,
      configured: isLeaderboardKvConfigured(),
      storage: getKvStorageMode(),
      entries: board.entries,
      self: board.self,
      updatedAt: board.updatedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load leaderboard'
    logger.fail('get failed', { message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      logger.warn('post invalid json')
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
    logger.fail('post failed', { message, status })
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      logger.warn('delete invalid json')
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const payload = body as { playerId?: unknown; mode?: unknown }
    const modeId = parseRankedLeaderboardModeId(payload.mode)
    const result = await clearPlayerLeaderboard(String(payload.playerId ?? ''), modeId)
    return NextResponse.json({ ok: true, modeId, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear leaderboard entry'
    const status = isLeaderboardServiceError(error) ? error.statusCode : 500
    logger.fail('delete failed', { message, status })
    return NextResponse.json({ error: message }, { status })
  }
}
