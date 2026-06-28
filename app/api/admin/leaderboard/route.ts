import { NextResponse } from 'next/server'

import { checkAccess } from '@/services/auth/access'
import { getKvStorageMode } from '@/services/kv/client'
import { deleteLeaderboardEntry, isLeaderboardServiceError, readLeaderboardRaw, updateLeaderboardEntry } from '@/services/leaderboard'
import { createLogger } from '@/services/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('api-admin-leaderboard')

async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await checkAccess({ isApiRouter: true }))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function handleError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Leaderboard admin request failed'
  const status = isLeaderboardServiceError(error) ? error.statusCode : 500
  logger.fail('request failed', { message, status })
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const board = await readLeaderboardRaw()
    return NextResponse.json({
      ok: true,
      storage: getKvStorageMode(),
      entries: board.entries,
      updatedAt: board.updatedAt,
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const body = (await request.json().catch(() => null)) as {
      id?: unknown
      name?: unknown
      score?: unknown
      depth?: unknown
    } | null

    const id = String(body?.id ?? '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Missing entry id' }, { status: 400 })
    }

    const patch: { name?: string; score?: number; depth?: number } = {}
    if (body?.name !== undefined) patch.name = String(body.name)
    if (body?.score !== undefined) patch.score = typeof body.score === 'number' ? body.score : Number(body.score)
    if (body?.depth !== undefined) patch.depth = typeof body.depth === 'number' ? body.depth : Number(body.depth)

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const board = await updateLeaderboardEntry(id, patch)
    return NextResponse.json({ ok: true, entries: board.entries, updatedAt: board.updatedAt })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    let id = ''
    try {
      const body = (await request.json()) as { id?: unknown }
      id = String(body?.id ?? '').trim()
    } catch {
      const url = new URL(request.url)
      id = url.searchParams.get('id')?.trim() ?? ''
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing entry id' }, { status: 400 })
    }

    const board = await deleteLeaderboardEntry(id)
    return NextResponse.json({ ok: true, entries: board.entries, updatedAt: board.updatedAt })
  } catch (error) {
    return handleError(error)
  }
}
