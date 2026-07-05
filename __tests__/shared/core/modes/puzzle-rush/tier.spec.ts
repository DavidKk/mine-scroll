import {
  getPuzzleRushTier,
  getPuzzleRushTierForBoardIndex,
  PACE_MS_PER_BOARD,
  PUZZLE_INTRO_BOARD_COUNT,
  puzzleEffectiveElapsedMs,
  puzzleProgressBoardIndex,
  puzzleRushBoardNumber,
  puzzleSessionPhase,
  puzzleSessionPhaseByBoards,
  puzzleSessionPhaseByTime,
} from '@shared/core/modes/puzzle-rush/index.ts'

describe('puzzle-rush tier', () => {
  it('maps board numbers to tier configs (5 boards per band)', () => {
    expect(getPuzzleRushTier(1)).toEqual({ tier: 1, mines: 8, timeBonusCapSec: 60 })
    expect(getPuzzleRushTier(5)).toEqual({ tier: 1, mines: 8, timeBonusCapSec: 60 })
    expect(getPuzzleRushTier(6)).toEqual({ tier: 2, mines: 8, timeBonusCapSec: 55 })
    expect(getPuzzleRushTier(11)).toEqual({ tier: 3, mines: 9, timeBonusCapSec: 50 })
    expect(getPuzzleRushTier(16)).toEqual({ tier: 4, mines: 9, timeBonusCapSec: 45 })
    expect(getPuzzleRushTier(21)).toEqual({ tier: 5, mines: 10, timeBonusCapSec: 40 })
    expect(getPuzzleRushTier(26)).toEqual({ tier: 6, mines: 10, timeBonusCapSec: 38 })
    expect(getPuzzleRushTier(31)).toEqual({ tier: 7, mines: 11, timeBonusCapSec: 35 })
    expect(getPuzzleRushTier(36)).toEqual({ tier: 8, mines: 11, timeBonusCapSec: 33 })
  })

  it('ramps intro boards 5 → 6 → 7 mines, then warmup at 8', () => {
    expect(getPuzzleRushTierForBoardIndex(0)).toEqual({ tier: 0, mines: 5, timeBonusCapSec: 60 })
    expect(getPuzzleRushTierForBoardIndex(1)).toEqual({ tier: 0, mines: 6, timeBonusCapSec: 60 })
    expect(getPuzzleRushTierForBoardIndex(2)).toEqual({ tier: 0, mines: 7, timeBonusCapSec: 60 })
    expect(getPuzzleRushTierForBoardIndex(PUZZLE_INTRO_BOARD_COUNT)).toEqual({
      tier: 1,
      mines: 8,
      timeBonusCapSec: 60,
    })
  })

  it('derives board number from boardIndex', () => {
    expect(puzzleRushBoardNumber(0)).toBe(1)
    expect(puzzleRushBoardNumber(5)).toBe(6)
  })

  it('excludes intro boards from progress index', () => {
    expect(puzzleProgressBoardIndex(0)).toBe(0)
    expect(puzzleProgressBoardIndex(2)).toBe(0)
    expect(puzzleProgressBoardIndex(3)).toBe(0)
    expect(puzzleProgressBoardIndex(8)).toBe(5)
  })
})

describe('puzzle-rush session-phase', () => {
  it('caps effective elapsed by post-intro board pace', () => {
    expect(puzzleEffectiveElapsedMs(10 * 60_000, 1)).toBe(0)
    expect(puzzleEffectiveElapsedMs(10 * 60_000, 4)).toBe(PACE_MS_PER_BOARD)
    expect(puzzleEffectiveElapsedMs(10 * 60_000, 13)).toBe(10 * 60_000)
  })

  it('locks first intro boards regardless of clock', () => {
    expect(puzzleSessionPhase(30 * 60_000, 0)).toBe('intro')
    expect(puzzleSessionPhase(30 * 60_000, 2)).toBe('intro')
    expect(puzzleSessionPhase(0, 2)).toBe('intro')
  })

  it('starts difficulty at board index 3 with zero effective clock', () => {
    expect(puzzleSessionPhase(0, PUZZLE_INTRO_BOARD_COUNT)).toBe('warmup')
  })

  it('holds fast players until board bands are satisfied', () => {
    expect(puzzleSessionPhaseByTime(20 * 60_000)).toBe('late')
    expect(puzzleSessionPhaseByBoards(8)).toBe('climb')
    expect(puzzleSessionPhase(20 * 60_000, 11)).toBe('climb')
  })

  it('requires both axes for apex', () => {
    expect(puzzleSessionPhase(35 * 60_000, 33)).toBe('apex')
    expect(puzzleSessionPhase(35 * 60_000, 23)).toBe('severe')
    expect(puzzleSessionPhase(20 * 60_000, 33)).toBe('late')
  })

  it('maps effective duration to time-only phases', () => {
    expect(puzzleSessionPhaseByTime(5 * 60_000)).toBe('warmup')
    expect(puzzleSessionPhaseByTime(8 * 60_000)).toBe('climb')
    expect(puzzleSessionPhaseByTime(14 * 60_000)).toBe('pressure')
    expect(puzzleSessionPhaseByTime(31 * 60_000)).toBe('apex')
  })
})
