import { sanitizeCountryCode } from '../geoip/request.ts'
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

export function normalizeLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry | null {
  if (
    !entry ||
    typeof entry.id !== 'string' ||
    typeof entry.name !== 'string' ||
    entry.name.trim().length === 0 ||
    typeof entry.score !== 'number' ||
    !Number.isFinite(entry.score) ||
    entry.score <= 0 ||
    (entry.depth !== undefined && (typeof entry.depth !== 'number' || !Number.isFinite(entry.depth) || entry.depth < 0)) ||
    typeof entry.submittedAt !== 'number' ||
    !Number.isFinite(entry.submittedAt)
  ) {
    return null
  }

  const { countryCode: rawCountryCode, ...rest } = entry
  const countryCode = sanitizeCountryCode(rawCountryCode)
  return {
    ...rest,
    ...(countryCode ? { countryCode } : {}),
  }
}

export function normalizeLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return sortLeaderboardEntries(entries.map((entry) => normalizeLeaderboardEntry(entry)).filter((entry): entry is LeaderboardEntry => entry !== null)).slice(
    0,
    LEADERBOARD_MAX_ENTRIES
  )
}

export function entryPlayerId(entry: LeaderboardEntry): string {
  return entry.playerId?.trim() || entry.id
}

export function isBetterLeaderboardEntry(candidate: LeaderboardEntry, incumbent: LeaderboardEntry): boolean {
  if (candidate.score !== incumbent.score) return candidate.score > incumbent.score
  const depthC = candidate.depth ?? 0
  const depthI = incumbent.depth ?? 0
  if (depthC !== depthI) return depthC > depthI
  return false
}

export function upsertPlayerBestEntry(entries: LeaderboardEntry[], entry: LeaderboardEntry): { entries: LeaderboardEntry[]; saved: boolean; rank: number | null } {
  const playerId = entryPlayerId(entry)
  const candidate: LeaderboardEntry = { ...entry, id: playerId, playerId }
  const incumbent = entries.find((item) => entryPlayerId(item) === playerId)
  const withoutPlayer = entries.filter((item) => entryPlayerId(item) !== playerId)

  if (incumbent && !isBetterLeaderboardEntry(candidate, incumbent)) {
    const normalized = normalizeLeaderboardEntries([...withoutPlayer, incumbent])
    const rankIndex = normalized.findIndex((item) => entryPlayerId(item) === playerId)
    return { entries: normalized, saved: false, rank: rankIndex >= 0 ? rankIndex + 1 : computeLeaderboardRank(entries, incumbent) }
  }

  const normalized = normalizeLeaderboardEntries([...withoutPlayer, candidate])
  const rankIndex = normalized.findIndex((item) => entryPlayerId(item) === playerId)
  const onBoard = rankIndex >= 0
  const rank = onBoard ? rankIndex + 1 : computeLeaderboardRank(entries, candidate)
  return { entries: normalized, saved: onBoard, rank }
}

/** Global rank for a candidate among all known entries (not capped at top 100). */
export function computeLeaderboardRank(entries: LeaderboardEntry[], candidate: LeaderboardEntry): number | null {
  const playerId = entryPlayerId(candidate)
  const normalizedCandidate = normalizeLeaderboardEntry({ ...candidate, id: playerId, playerId })
  if (!normalizedCandidate) return null

  const withoutPlayer = entries
    .filter((item) => entryPlayerId(item) !== playerId)
    .map((item) => normalizeLeaderboardEntry(item))
    .filter((item): item is LeaderboardEntry => item !== null)

  const sorted = sortLeaderboardEntries([...withoutPlayer, normalizedCandidate])
  const rankIndex = sorted.findIndex((item) => entryPlayerId(item) === playerId)
  return rankIndex >= 0 ? rankIndex + 1 : null
}

export function mergeLeaderboardEntry(entries: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  return normalizeLeaderboardEntries([...entries, entry])
}

export function sanitizePlayerId(value: unknown): string {
  const id = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) return ''
  return id
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
