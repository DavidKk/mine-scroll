import { LEADERBOARD_MAX_ENTRIES, type LeaderboardEntry } from './types.ts'

export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const depthA = a.depth ?? 0
    const depthB = b.depth ?? 0
    if (depthB !== depthA) return depthB - depthA
    return a.submittedAt - b.submittedAt
  })
}

export function normalizeLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return sortLeaderboardEntries(
    entries.filter(
      (entry) =>
        entry &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        entry.name.trim().length > 0 &&
        typeof entry.score === 'number' &&
        Number.isFinite(entry.score) &&
        entry.score > 0 &&
        (entry.depth === undefined || (typeof entry.depth === 'number' && Number.isFinite(entry.depth) && entry.depth >= 0)) &&
        typeof entry.submittedAt === 'number' &&
        Number.isFinite(entry.submittedAt)
    )
  ).slice(0, LEADERBOARD_MAX_ENTRIES)
}

export function mergeLeaderboardEntry(entries: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  return normalizeLeaderboardEntries([...entries, entry])
}

export function sanitizeLeaderboardName(name: string): string {
  return name
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 24)
}

export function sanitizeLeaderboardScore(score: unknown): number {
  const value = typeof score === 'number' ? score : Number(score)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(99_999_999, Math.floor(value)))
}
