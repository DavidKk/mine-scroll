import { LEADERBOARD_DISPLAY_ROWS, padLeaderboardDisplay } from '@/services/leaderboard/display'
import type { LeaderboardEntry } from '@/services/leaderboard/types'

function entry(overrides: Partial<LeaderboardEntry> & Pick<LeaderboardEntry, 'id' | 'name' | 'score'>): LeaderboardEntry {
  return {
    submittedAt: 1,
    ...overrides,
  }
}

describe('services/leaderboard/display', () => {
  it('pads an empty board to ten display rows', () => {
    const padded = padLeaderboardDisplay([])

    expect(padded).toHaveLength(LEADERBOARD_DISPLAY_ROWS)
    expect(padded[0]?.name).toBe('Kiro_404')
    expect(padded[9]?.name).toBe('StaticHum')
    expect(padded.every((row) => !row.id.startsWith('placeholder'))).toBe(true)
  })

  it('uses distinct filler players for puzzle rush', () => {
    const padded = padLeaderboardDisplay([], 'puzzle-rush')

    expect(padded).toHaveLength(LEADERBOARD_DISPLAY_ROWS)
    expect(padded[0]?.name).toBe('StreakAce')
    expect(padded[9]?.name).toBe('QuickChord')
    expect(padded.some((row) => row.name === 'Kiro_404')).toBe(false)
  })

  it('merges fillers with real players and sorts by score', () => {
    const top = entry({
      id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
      playerId: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
      name: 'DavidJones',
      score: 6310,
      depth: 40,
    })
    const low = entry({
      id: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
      playerId: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
      name: 'Pilot',
      score: 42,
      depth: 3,
    })

    const padded = padLeaderboardDisplay([top, low])

    expect(padded).toHaveLength(LEADERBOARD_DISPLAY_ROWS)
    expect(padded[0]?.name).toBe('DavidJones')
    expect(padded[1]?.name).toBe('Kiro_404')
    expect(padded[1]?.score).toBe(128)
    expect(padded.find((row) => row.name === 'Pilot')?.score).toBe(42)
    expect(padded[1]!.score).toBeGreaterThan(padded.find((row) => row.name === 'Pilot')!.score)
  })

  it('keeps public rows in descending score order', () => {
    const padded = padLeaderboardDisplay([
      entry({
        id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
        playerId: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
        name: 'DavidJones',
        score: 6310,
        depth: 40,
      }),
      entry({
        id: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
        playerId: 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff',
        name: 'Pilot',
        score: 42,
        depth: 3,
      }),
    ])

    for (let index = 1; index < padded.length; index += 1) {
      expect(padded[index - 1]!.score).toBeGreaterThanOrEqual(padded[index]!.score)
    }
  })

  it('caps at ten rows when the raw board is larger', () => {
    const many = Array.from({ length: 12 }, (_, index) => entry({ id: `player-${index}`, name: `P${index}`, score: 1000 - index }))

    expect(padLeaderboardDisplay(many)).toHaveLength(LEADERBOARD_DISPLAY_ROWS)
  })
})
