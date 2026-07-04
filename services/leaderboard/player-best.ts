import { deleteJsonKv, getJsonKv, isKvConfigured, setJsonKvEx } from '../kv/client.ts'
import { entryPlayerId, isBetterLeaderboardEntry, normalizeLeaderboardEntry } from './merge.ts'
import { leaderboardPlayerBestKey, type RankedLeaderboardModeId } from './mode.ts'
import { LEADERBOARD_PLAYER_TTL_SECONDS, type LeaderboardEntry } from './types.ts'

export async function getPlayerBestEntry(playerId: string, modeId: RankedLeaderboardModeId = 'endless'): Promise<LeaderboardEntry | null> {
  if (!isKvConfigured() || !playerId) return null
  const stored = await getJsonKv<LeaderboardEntry>(leaderboardPlayerBestKey(modeId, playerId))
  if (!stored) return null
  return normalizeLeaderboardEntry(stored)
}

export async function savePlayerBestIfBetter(entry: LeaderboardEntry, modeId: RankedLeaderboardModeId = 'endless'): Promise<LeaderboardEntry | null> {
  if (!isKvConfigured()) return null
  const normalized = normalizeLeaderboardEntry(entry)
  if (!normalized) return null

  const playerId = entryPlayerId(normalized)
  const existing = await getPlayerBestEntry(playerId, modeId)
  if (existing && !isBetterLeaderboardEntry(normalized, existing)) {
    return existing
  }

  await setJsonKvEx(leaderboardPlayerBestKey(modeId, playerId), normalized, LEADERBOARD_PLAYER_TTL_SECONDS)
  return normalized
}

export async function deletePlayerBestEntry(playerId: string, modeId: RankedLeaderboardModeId = 'endless'): Promise<boolean> {
  if (!isKvConfigured() || !playerId) return false
  return deleteJsonKv(leaderboardPlayerBestKey(modeId, playerId))
}
