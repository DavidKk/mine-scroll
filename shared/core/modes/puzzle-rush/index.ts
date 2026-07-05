export {
  createPuzzleRushSession,
  getPuzzleRushFlagCount,
  puzzleRushBeginRun,
  puzzleRushChordAt,
  puzzleRushCommitNextBoard,
  puzzleRushRevealAt,
  puzzleRushToggleMarkAt,
  toPuzzleBoardCellViews,
  toPuzzleRushCellViews,
} from './actions.ts'
export { createPuzzleBoard } from './board.ts'
export type { PuzzleBoardProfile, PuzzleDifficultySignals } from './board-profile.ts'
export {
  buildPuzzleDifficultySignals,
  placePuzzleBoardMines,
  puzzleRushDifficultyPressure,
  puzzleRushRunElapsedMs,
  puzzleRushSpeedPressure,
  resolvePuzzleBoardProfile,
  resolvePuzzleBoardProfileForSession,
  shouldForceLogicBoard,
} from './board-profile.ts'
export {
  BASE_BOARD_SCORE,
  CLEAN_BOARDS_HEAL_EVERY,
  PUZZLE_COLS,
  PUZZLE_INTRO_MINES,
  PUZZLE_LIVES,
  PUZZLE_LUCK_STREAK_THRESHOLD,
  PUZZLE_MERCY_LIVES,
  PUZZLE_MINES,
  PUZZLE_PROFILE_LUCK_PRESSURE,
  PUZZLE_ROWS,
  PUZZLE_SLOW_CLEAR_FACTOR,
  TIME_BONUS_CAP_SEC,
  TIME_BONUS_PER_SEC,
} from './constants.ts'
export {
  findSolvableSeed,
  hasSolvableSeedForFirstClick,
  isBoardLogicSolvable,
  isLogicSolvableFromFirstClick,
  mixSolvableAttemptSeed,
  placeSolvableMines,
  PUZZLE_SOLVABLE_SEED_ATTEMPTS,
} from './logic-solve.ts'
export type { PuzzleDifficultyPhase, PuzzleMercyLevel, PuzzleSessionPhase } from './session-phase.ts'
export {
  canApplyHardDopedTriggers,
  isPuzzleIntroBoard,
  isQuotaDopedBoard,
  PACE_MS_PER_BOARD,
  PUZZLE_BOARDS_PER_BAND,
  PUZZLE_DIFFICULTY_PHASES,
  PUZZLE_INTRO_BOARD_COUNT,
  PUZZLE_PHASE_BOUND_MIN,
  PUZZLE_PHASE_MIN_BOARDS,
  PUZZLE_PRESSURE_BOARDS_SCALE,
  PUZZLE_PRESSURE_DURATION_MS,
  PUZZLE_SESSION_PHASES,
  puzzleEffectiveElapsedMs,
  puzzleMercyLevel,
  puzzlePhaseIndex,
  puzzleProgressBoardIndex,
  puzzleSessionPhase,
  puzzleSessionPhaseByBoards,
  puzzleSessionPhaseByTime,
} from './session-phase.ts'
export { analyzePuzzleRushSession, applyPuzzleRushAiMove, buildPuzzleSolverBoard, getPuzzleRushAiStepMs, isPuzzleAiPersistBlocked, toPuzzleAiHintDisplay } from './solver.ts'
export type { PuzzleRushTierConfig } from './tier.ts'
export {
  getPuzzleIntroMineCount,
  getPuzzleRushTier,
  getPuzzleRushTierForBoardIndex,
  PUZZLE_MINES_BY_TIER,
  PUZZLE_TIER_BOARDS,
  PUZZLE_TIME_CAP_BY_TIER,
  puzzleRushBoardNumber,
} from './tier.ts'
export type { BoardClearReport, PuzzleRushGameState, PuzzleRushModeId, PuzzleRushSession, StreakBreakReport } from './types.ts'
