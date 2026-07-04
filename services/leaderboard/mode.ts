export const RANKED_LEADERBOARD_MODES = ['endless', 'puzzle-rush'] as const

export type RankedLeaderboardModeId = (typeof RANKED_LEADERBOARD_MODES)[number]

export function parseRankedLeaderboardModeId(value: unknown): RankedLeaderboardModeId {
  return value === 'puzzle-rush' ? 'puzzle-rush' : 'endless'
}

export function leaderboardBoardKey(modeId: RankedLeaderboardModeId): string {
  return `leaderboard:${modeId}`
}

/** Endless keeps legacy key shape for existing KV data. */
export function leaderboardPlayerBestKey(modeId: RankedLeaderboardModeId, playerId: string): string {
  if (modeId === 'endless') return `leaderboard:player:${playerId}`
  return `leaderboard:player:${modeId}:${playerId}`
}

export function leaderboardModeLabel(modeId: RankedLeaderboardModeId): string {
  return modeId === 'puzzle-rush' ? 'Puzzle Rush' : 'Endless'
}
