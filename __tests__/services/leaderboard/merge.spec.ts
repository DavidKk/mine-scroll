import { mergeLeaderboardEntry, normalizeLeaderboardEntries, sanitizeLeaderboardName, sanitizeLeaderboardScore, sortLeaderboardEntries } from '@/services/leaderboard/merge'
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
