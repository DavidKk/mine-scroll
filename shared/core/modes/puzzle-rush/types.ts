import type { Board, GameStatus, LifeLossReport } from '../../types.ts'

export type PuzzleRushModeId = 'puzzle-rush'

export interface PuzzleRushGameState {
  status: GameStatus
  board: Board
  modeId: PuzzleRushModeId
}

export interface BoardClearReport {
  scoreAdded: number
  streakAfter: number
  timeBonus: number
  boardIndex: number
  tier?: number
  elapsedMs?: number
  livesGained?: number
  livesAfter?: number
}

export interface StreakBreakReport {
  streakCleared: number
}

export interface PuzzleRushSession {
  modeId: PuzzleRushModeId
  state: PuzzleRushGameState
  lives: number
  score: number
  /** Consecutive boards cleared without a life-ending mistake chain reset. */
  streak: number
  /** Boards cleared in a row with no life lost on any of them (for heal milestone). */
  cleanBoards: number
  /** Lives at the start of the current board — used to detect damage this board. */
  livesAtBoardStart: number
  boardIndex: number
  boardStartedAtMs: number
  /** Wall-clock start of the run (first begin / first reveal). */
  runStartedAtMs: number
  hitMineKeys: string[]
  /** Set after a board clear; committed after the slide-up transition. */
  pendingNextSeed?: number
  aiOscillationBlocked?: string[]
  aiContradictedFlags?: string[]
  lastLifeLoss?: LifeLossReport
  lastBoardClear?: BoardClearReport
  lastStreakBreak?: StreakBreakReport
}
