export const LEADERBOARD_MAX_ENTRIES = 100

export const LEADERBOARD_KV_KEY = 'leaderboard:endless'

export interface LeaderboardEntry {
  id: string
  playerId?: string
  name: string
  score: number
  depth?: number
  /** ISO 3166-1 alpha-2 region from Vercel geo headers at submit time. */
  countryCode?: string
  submittedAt: number
}

export interface LeaderboardBoard {
  entries: LeaderboardEntry[]
  updatedAt: number
}
