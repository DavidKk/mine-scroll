import { kv } from '@vercel/kv'

import { LeaderboardServiceError } from './errors.ts'
import { normalizeLeaderboardEntries } from './merge.ts'
import { LEADERBOARD_KV_KEY, type LeaderboardBoard } from './types.ts'

export function isLeaderboardKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

export async function readLeaderboard(): Promise<LeaderboardBoard> {
  if (!isLeaderboardKvConfigured()) {
    return { entries: [], updatedAt: 0 }
  }

  const board = await kv.get<LeaderboardBoard>(LEADERBOARD_KV_KEY)
  if (!board || !Array.isArray(board.entries)) {
    return { entries: [], updatedAt: 0 }
  }

  return {
    entries: normalizeLeaderboardEntries(board.entries),
    updatedAt: typeof board.updatedAt === 'number' ? board.updatedAt : 0,
  }
}

export async function submitLeaderboardEntry(_name: string, _score: unknown): Promise<LeaderboardBoard> {
  throw new LeaderboardServiceError('Direct score submission is disabled. Finish a ranked run to submit.', 400)
}
