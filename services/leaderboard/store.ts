import { getJsonKv, isKvConfigured } from '../kv/client.ts'
import { padLeaderboardDisplay } from './display.ts'
import { LeaderboardServiceError } from './errors.ts'
import { logger } from './logger.ts'
import { computeLeaderboardRank,entryPlayerId, normalizeLeaderboardEntries } from './merge.ts'
import { getPlayerBestEntry } from './player-best.ts'
import { LEADERBOARD_KV_KEY, type LeaderboardBoard, type LeaderboardSelfView } from './types.ts'

export function isLeaderboardKvConfigured(): boolean {
  return isKvConfigured()
}

/** Raw entries stored in KV — no display padding. */
export async function readLeaderboardRaw(): Promise<LeaderboardBoard> {
  if (!isLeaderboardKvConfigured()) {
    logger.info('board read raw', { entries: 0, configured: false })
    return { entries: [], updatedAt: 0 }
  }

  const board = await getJsonKv<LeaderboardBoard>(LEADERBOARD_KV_KEY)
  if (!board || !Array.isArray(board.entries)) {
    logger.info('board read raw', { entries: 0, configured: true })
    return { entries: [], updatedAt: 0 }
  }

  const result = {
    entries: normalizeLeaderboardEntries(board.entries),
    updatedAt: typeof board.updatedAt === 'number' ? board.updatedAt : 0,
  }
  logger.info('board read raw', { entries: result.entries.length, updatedAt: result.updatedAt })
  return result
}

/** Public leaderboard view — pads sparse boards on the server. */
export async function readLeaderboard(playerId?: string): Promise<LeaderboardBoard> {
  const board = await readLeaderboardRaw()
  let pool = board.entries
  let self: LeaderboardSelfView | undefined

  const trimmedPlayerId = playerId?.trim().toLowerCase()
  if (trimmedPlayerId) {
    const personalBest = await getPlayerBestEntry(trimmedPlayerId)
    if (personalBest) {
      self = {
        ...personalBest,
        rank: computeLeaderboardRank(board.entries, personalBest),
      }
      if (!pool.some((entry) => entryPlayerId(entry) === trimmedPlayerId)) {
        pool = normalizeLeaderboardEntries([...pool, personalBest])
      }
    }
  }

  const entries = padLeaderboardDisplay(pool)
  logger.info('board read public', {
    entries: entries.length,
    updatedAt: board.updatedAt,
    playerId: trimmedPlayerId ? trimmedPlayerId.slice(0, 8) : undefined,
    hasSelf: Boolean(self),
  })
  return { entries, updatedAt: board.updatedAt, self }
}

export async function submitLeaderboardEntry(_name: string, _score: unknown): Promise<LeaderboardBoard> {
  logger.warn('direct submit rejected')
  throw new LeaderboardServiceError('Direct score submission is disabled. Finish a ranked run to submit.', 400)
}
