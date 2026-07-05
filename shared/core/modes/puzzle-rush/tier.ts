import { PUZZLE_INTRO_MINES, TIME_BONUS_CAP_SEC } from './constants.ts'
import { isPuzzleIntroBoard, PUZZLE_INTRO_BOARD_COUNT, puzzleProgressBoardIndex } from './session-phase.ts'

export interface PuzzleRushTierConfig {
  tier: number
  mines: number
  timeBonusCapSec: number
}

/** Tier steps: each band spans PUZZLE_BOARDS_PER_BAND (5) boards. */
const PUZZLE_TIER_STEPS: ReadonlyArray<{ fromBoard: number; tier: number; mines: number; timeBonusCapSec: number }> = [
  { fromBoard: 1, tier: 1, mines: 8, timeBonusCapSec: 60 },
  { fromBoard: 6, tier: 2, mines: 8, timeBonusCapSec: 55 },
  { fromBoard: 11, tier: 3, mines: 9, timeBonusCapSec: 50 },
  { fromBoard: 16, tier: 4, mines: 9, timeBonusCapSec: 45 },
  { fromBoard: 21, tier: 5, mines: 10, timeBonusCapSec: 40 },
  { fromBoard: 26, tier: 6, mines: 10, timeBonusCapSec: 38 },
  { fromBoard: 31, tier: 7, mines: 11, timeBonusCapSec: 35 },
  { fromBoard: 36, tier: 8, mines: 11, timeBonusCapSec: 33 },
]

/** @deprecated Use tier steps table; kept for tests referencing length. */
export const PUZZLE_TIER_BOARDS = 5

/** @deprecated Legacy 5-step mine table. */
export const PUZZLE_MINES_BY_TIER = [8, 8, 9, 9, 10] as const

/** @deprecated Legacy 5-step time table. */
export const PUZZLE_TIME_CAP_BY_TIER = [60, 50, 45, 40, 35] as const

/** 1-based board number from session boardIndex (cleared count at board start). */
export function puzzleRushBoardNumber(boardIndex: number): number {
  return Math.max(1, boardIndex + 1)
}

export function getPuzzleRushTier(boardNumber: number): PuzzleRushTierConfig {
  const normalized = Math.max(1, Math.floor(boardNumber))
  let config = PUZZLE_TIER_STEPS[0]!
  for (const step of PUZZLE_TIER_STEPS) {
    if (normalized >= step.fromBoard) config = step
  }
  return {
    tier: config.tier,
    mines: config.mines,
    timeBonusCapSec: config.timeBonusCapSec,
  }
}

export function getPuzzleIntroMineCount(boardIndex: number): number {
  const slot = Math.max(0, Math.min(boardIndex, PUZZLE_INTRO_BOARD_COUNT - 1))
  return PUZZLE_INTRO_MINES[slot] ?? PUZZLE_INTRO_MINES[PUZZLE_INTRO_MINES.length - 1]!
}

export function getPuzzleRushTierForBoardIndex(boardIndex: number): PuzzleRushTierConfig {
  if (isPuzzleIntroBoard(boardIndex)) {
    return { tier: 0, mines: getPuzzleIntroMineCount(boardIndex), timeBonusCapSec: TIME_BONUS_CAP_SEC }
  }
  return getPuzzleRushTier(puzzleRushBoardNumber(puzzleProgressBoardIndex(boardIndex)))
}
