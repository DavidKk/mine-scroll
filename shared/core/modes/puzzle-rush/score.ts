import { BASE_BOARD_SCORE, TIME_BONUS_CAP_SEC, TIME_BONUS_PER_SEC } from './constants.ts'

export function boardClearScore(streakAfter: number, elapsedMs: number): { scoreAdded: number; timeBonus: number } {
  const elapsedSec = Math.floor(elapsedMs / 1000)
  const timeBonus = Math.max(0, TIME_BONUS_CAP_SEC - elapsedSec) * TIME_BONUS_PER_SEC
  const scoreAdded = BASE_BOARD_SCORE * Math.max(1, streakAfter) + timeBonus
  return { scoreAdded, timeBonus }
}

export function nextBoardSeed(currentSeed: number, boardIndex: number, streak: number): number {
  return (currentSeed + boardIndex * 7919 + streak * 2654435761) >>> 0
}
