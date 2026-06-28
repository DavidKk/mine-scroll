export const LEADERBOARD_MAX_ENTRIES = 100

export const LEADERBOARD_KV_KEY = 'leaderboard:endless'

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  depth?: number
  submittedAt: number
}

export interface LeaderboardBoard {
  entries: LeaderboardEntry[]
  updatedAt: number
}
