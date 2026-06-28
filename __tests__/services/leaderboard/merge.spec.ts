import {
  entryPlayerId,
  mergeLeaderboardEntry,
  normalizeLeaderboardEntries,
  sanitizeLeaderboardName,
  sanitizeLeaderboardScore,
  sortLeaderboardEntries,
  upsertPlayerBestEntry,
} from '@/services/leaderboard/merge'
import { LEADERBOARD_MAX_ENTRIES, type LeaderboardEntry } from '@/services/leaderboard/types'

function entry(score: number, submittedAt: number, name = 'player'): LeaderboardEntry {
  return { id: `${score}-${submittedAt}`, name, score, submittedAt }
}

describe('services/leaderboard/merge', () => {
  it('sorts by score desc then submittedAt asc', () => {
    const sorted = sortLeaderboardEntries([entry(100, 3), entry(200, 2), entry(200, 1), entry(50, 0)])

    expect(sorted.map((item) => item.score)).toEqual([200, 200, 100, 50])
    expect(sorted[0]?.submittedAt).toBe(1)
    expect(sorted[1]?.submittedAt).toBe(2)
  })

  it('keeps only top 100 entries after merge', () => {
    const existing = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, index) => entry(LEADERBOARD_MAX_ENTRIES - index, index))
    const next = mergeLeaderboardEntry(existing, entry(999_999, Date.now(), 'champion'))

    expect(next).toHaveLength(LEADERBOARD_MAX_ENTRIES)
    expect(next[0]?.score).toBe(999_999)
    expect(next[0]?.name).toBe('champion')
  })

  it('upserts one best score per player id', () => {
    const playerId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee'
    const first = upsertPlayerBestEntry([], {
      id: playerId,
      playerId,
      name: 'Pilot',
      score: 120,
      depth: 4,
      submittedAt: 1,
    })
    expect(first.saved).toBe(true)
    expect(first.rank).toBe(1)
    expect(first.entries[0]?.score).toBe(120)

    const worse = upsertPlayerBestEntry(first.entries, {
      id: playerId,
      playerId,
      name: 'Pilot',
      score: 80,
      depth: 2,
      submittedAt: 2,
    })
    expect(worse.saved).toBe(false)
    expect(worse.entries[0]?.score).toBe(120)

    const better = upsertPlayerBestEntry(worse.entries, {
      id: playerId,
      playerId,
      name: 'Pilot',
      score: 200,
      depth: 6,
      submittedAt: 3,
    })
    expect(better.saved).toBe(true)
    expect(better.entries[0]?.score).toBe(200)
  })

  it('does not save a new player who misses the top 100', () => {
    const fullBoard = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, index) => entry(LEADERBOARD_MAX_ENTRIES + 1 - index, index))
    const playerId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff'
    const result = upsertPlayerBestEntry(fullBoard, {
      id: playerId,
      playerId,
      name: 'Rookie',
      score: 1,
      depth: 1,
      submittedAt: 999,
    })

    expect(result.saved).toBe(false)
    expect(result.rank).toBeNull()
    expect(result.entries).toHaveLength(LEADERBOARD_MAX_ENTRIES)
    expect(result.entries.some((item) => entryPlayerId(item) === playerId)).toBe(false)
  })

  it('sanitizes name and score', () => {
    expect(sanitizeLeaderboardName('  hello   world  ')).toBe('hello world')
    expect(sanitizeLeaderboardName('x'.repeat(40))).toHaveLength(24)
    expect(sanitizeLeaderboardName('bad\u0007name')).toBe('badname')
    expect(sanitizeLeaderboardScore('42.9')).toBe(42)
    expect(sanitizeLeaderboardScore(-5)).toBe(0)
    expect(sanitizeLeaderboardScore(100_000_000)).toBe(99_999_999)
  })

  it('normalizes invalid and excess entries', () => {
    const normalized = normalizeLeaderboardEntries([
      entry(10, 1),
      { id: 'bad', name: '', score: 5, submittedAt: 2 } as LeaderboardEntry,
      { id: 'nan', name: 'x', score: Number.NaN, submittedAt: 3 } as LeaderboardEntry,
      ...Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, index) => entry(index + 1, index + 10)),
    ])

    expect(normalized).toHaveLength(LEADERBOARD_MAX_ENTRIES)
    expect(normalized[0]?.score).toBe(LEADERBOARD_MAX_ENTRIES)
    expect(normalized.some((item) => item.score === 1)).toBe(false)
  })
})
