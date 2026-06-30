import { getJsonKv, isKvConfigured, setJsonKvEx } from '../kv/client.ts'
import { entryPlayerId,isBetterLeaderboardEntry, normalizeLeaderboardEntry } from './merge.ts'
import { LEADERBOARD_PLAYER_KEY_PREFIX, LEADERBOARD_PLAYER_TTL_SECONDS, type LeaderboardEntry } from './types.ts'

function playerBestKey(playerId: string): string {
  return `${LEADERBOARD_PLAYER_KEY_PREFIX}${playerId}`
}

export async function getPlayerBestEntry(playerId: string): Promise<LeaderboardEntry | null> {
  if (!isKvConfigured() || !playerId) return null
  const stored = await getJsonKv<LeaderboardEntry>(playerBestKey(playerId))
  if (!stored) return null
  return normalizeLeaderboardEntry(stored)
}

export async function savePlayerBestIfBetter(entry: LeaderboardEntry): Promise<LeaderboardEntry | null> {
  if (!isKvConfigured()) return null
  const normalized = normalizeLeaderboardEntry(entry)
  if (!normalized) return null

  const playerId = entryPlayerId(normalized)
  const existing = await getPlayerBestEntry(playerId)
  if (existing && !isBetterLeaderboardEntry(normalized, existing)) {
    return existing
  }

  await setJsonKvEx(playerBestKey(playerId), normalized, LEADERBOARD_PLAYER_TTL_SECONDS)
  return normalized
}
