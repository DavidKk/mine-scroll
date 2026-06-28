import { isKvConfigured, setJsonKv } from '../kv/client.ts'
import { LeaderboardServiceError } from './errors.ts'
import { logger } from './logger.ts'
import { entryPlayerId, normalizeLeaderboardEntries, sanitizeLeaderboardName, sanitizeLeaderboardScore } from './merge.ts'
import { readLeaderboardRaw } from './store.ts'
import { LEADERBOARD_KV_KEY, type LeaderboardBoard, type LeaderboardEntry } from './types.ts'

function assertKvConfigured(): void {
  if (!isKvConfigured()) {
    throw new LeaderboardServiceError('Leaderboard storage is not configured', 503)
  }
}

function findEntryIndex(entries: LeaderboardEntry[], targetId: string): number {
  const id = targetId.trim()
  return entries.findIndex((entry) => entry.id === id || entryPlayerId(entry) === id)
}

async function persistLeaderboard(entries: LeaderboardEntry[]): Promise<LeaderboardBoard> {
  assertKvConfigured()
  const board: LeaderboardBoard = {
    entries: normalizeLeaderboardEntries(entries),
    updatedAt: Date.now(),
  }
  await setJsonKv(LEADERBOARD_KV_KEY, board)
  logger.info('board admin write', { entries: board.entries.length })
  return board
}

export async function replaceLeaderboardEntries(entries: LeaderboardEntry[]): Promise<LeaderboardBoard> {
  if (!Array.isArray(entries)) {
    throw new LeaderboardServiceError('entries must be an array', 400)
  }
  return persistLeaderboard(entries)
}

export async function updateLeaderboardEntry(targetId: string, patch: { name?: string; score?: number; depth?: number }): Promise<LeaderboardBoard> {
  const board = await readLeaderboardRaw()
  const index = findEntryIndex(board.entries, targetId)
  if (index < 0) throw new LeaderboardServiceError('Entry not found', 404)

  const current = board.entries[index]!
  const updated: LeaderboardEntry = { ...current }

  if (patch.name !== undefined) {
    updated.name = sanitizeLeaderboardName(patch.name)
    if (!updated.name) throw new LeaderboardServiceError('Invalid name', 400)
  }
  if (patch.score !== undefined) {
    updated.score = sanitizeLeaderboardScore(patch.score)
    if (updated.score <= 0) throw new LeaderboardServiceError('Invalid score', 400)
  }
  if (patch.depth !== undefined) {
    const depth = Math.floor(Number(patch.depth))
    if (!Number.isFinite(depth) || depth < 0) throw new LeaderboardServiceError('Invalid depth', 400)
    updated.depth = depth
  }

  const next = [...board.entries]
  next[index] = updated
  return persistLeaderboard(next)
}

export async function deleteLeaderboardEntry(targetId: string): Promise<LeaderboardBoard> {
  const board = await readLeaderboardRaw()
  const next = board.entries.filter((entry) => {
    const id = targetId.trim()
    return entry.id !== id && entryPlayerId(entry) !== id
  })
  if (next.length === board.entries.length) {
    throw new LeaderboardServiceError('Entry not found', 404)
  }
  return persistLeaderboard(next)
}
