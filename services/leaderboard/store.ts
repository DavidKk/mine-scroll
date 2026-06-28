import { getJsonKv, isKvConfigured } from '../kv/client.ts'
import { padLeaderboardDisplay } from './display.ts'
import { LeaderboardServiceError } from './errors.ts'
import { logger } from './logger.ts'
import { normalizeLeaderboardEntries } from './merge.ts'
import { LEADERBOARD_KV_KEY, type LeaderboardBoard } from './types.ts'

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
export async function readLeaderboard(): Promise<LeaderboardBoard> {
  const board = await readLeaderboardRaw()
  const entries = padLeaderboardDisplay(board.entries)
  logger.info('board read public', { entries: entries.length, updatedAt: board.updatedAt })
  return { entries, updatedAt: board.updatedAt }
}

export async function submitLeaderboardEntry(_name: string, _score: unknown): Promise<LeaderboardBoard> {
  logger.warn('direct submit rejected')
  throw new LeaderboardServiceError('Direct score submission is disabled. Finish a ranked run to submit.', 400)
}
