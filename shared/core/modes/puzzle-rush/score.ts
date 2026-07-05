import { BASE_BOARD_SCORE, TIME_BONUS_PER_SEC } from './constants.ts'
import { getPuzzleRushTierForBoardIndex } from './tier.ts'

export function boardClearScore(elapsedMs: number, boardIndex: number): { scoreAdded: number; timeBonus: number } {
  const elapsedSec = Math.floor(elapsedMs / 1000)
  const { timeBonusCapSec } = getPuzzleRushTierForBoardIndex(boardIndex)
  const timeBonus = Math.max(0, timeBonusCapSec - elapsedSec) * TIME_BONUS_PER_SEC
  const scoreAdded = BASE_BOARD_SCORE + timeBonus
  return { scoreAdded, timeBonus }
}

export function nextBoardSeed(currentSeed: number, boardIndex: number, streak: number): number {
  return (currentSeed + boardIndex * 7919 + streak * 2654435761) >>> 0
}
