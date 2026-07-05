/** First N boards: fixed tutorial — no difficulty scaling regardless of clock. */
export const PUZZLE_INTRO_BOARD_COUNT = 3

/** Baseline pace: ~1 board/min for effective session clock. */
export const PACE_MS_PER_BOARD = 60_000

/** Phase boundaries (minutes) — effective elapsed, left-closed right-open. */
export const PUZZLE_PHASE_BOUND_MIN = [6, 12, 18, 24, 30] as const

export const PUZZLE_PHASE_BOUND_MS = PUZZLE_PHASE_BOUND_MIN.map((m) => m * 60_000)

/** Min boards cleared (boardIndex) before a phase can apply — at least N per band. */
export const PUZZLE_PHASE_MIN_BOARDS = [0, 5, 10, 15, 20, 25] as const

/** Boards per density / phase band (design target). */
export const PUZZLE_BOARDS_PER_BAND = 5

/** Pressure score: effective duration saturates at 35 min. */
export const PUZZLE_PRESSURE_DURATION_MS = 35 * 60_000

/** Pressure score: board-index component saturates at 30 cleared boards. */
export const PUZZLE_PRESSURE_BOARDS_SCALE = 30

export const PUZZLE_DIFFICULTY_PHASES = ['warmup', 'climb', 'pressure', 'late', 'severe', 'apex'] as const

export type PuzzleDifficultyPhase = (typeof PUZZLE_DIFFICULTY_PHASES)[number]

export const PUZZLE_SESSION_PHASES = ['intro', ...PUZZLE_DIFFICULTY_PHASES] as const

export type PuzzleSessionPhase = (typeof PUZZLE_SESSION_PHASES)[number]

export type PuzzleMercyLevel = 'M0' | 'M1' | 'M2' | 'M3'

export function puzzlePhaseIndex(phase: PuzzleSessionPhase): number {
  return PUZZLE_SESSION_PHASES.indexOf(phase)
}

/** Cleared boards that count toward difficulty (intro boards excluded). */
export function puzzleProgressBoardIndex(boardIndex: number): number {
  return Math.max(0, boardIndex - PUZZLE_INTRO_BOARD_COUNT)
}

export function isPuzzleIntroBoard(boardIndex: number): boolean {
  return boardIndex < PUZZLE_INTRO_BOARD_COUNT
}

export function puzzleEffectiveElapsedMs(runElapsedMs: number, boardIndex: number): number {
  const progress = puzzleProgressBoardIndex(boardIndex)
  const paceCapMs = Math.max(0, progress) * PACE_MS_PER_BOARD
  return Math.min(Math.max(0, runElapsedMs), paceCapMs)
}

export function puzzleSessionPhaseByTime(effectiveElapsedMs: number): PuzzleDifficultyPhase {
  if (effectiveElapsedMs < PUZZLE_PHASE_BOUND_MS[0]!) return 'warmup'
  if (effectiveElapsedMs < PUZZLE_PHASE_BOUND_MS[1]!) return 'climb'
  if (effectiveElapsedMs < PUZZLE_PHASE_BOUND_MS[2]!) return 'pressure'
  if (effectiveElapsedMs < PUZZLE_PHASE_BOUND_MS[3]!) return 'late'
  if (effectiveElapsedMs < PUZZLE_PHASE_BOUND_MS[4]!) return 'severe'
  return 'apex'
}

/** Highest phase allowed from post-intro board progress alone. */
export function puzzleSessionPhaseByBoards(progressBoardIndex: number): PuzzleDifficultyPhase {
  let phase: PuzzleDifficultyPhase = 'warmup'
  for (let i = PUZZLE_PHASE_MIN_BOARDS.length - 1; i >= 0; i -= 1) {
    if (progressBoardIndex >= PUZZLE_PHASE_MIN_BOARDS[i]!) {
      phase = PUZZLE_DIFFICULTY_PHASES[i]!
      break
    }
  }
  return phase
}

/**
 * Resolved phase: intro (first PUZZLE_INTRO_BOARD_COUNT boards), else slower of time-axis and board-axis.
 * Evaluated at next-board first click.
 */
export function puzzleSessionPhase(effectiveElapsedMs: number, boardIndex: number): PuzzleSessionPhase {
  if (isPuzzleIntroBoard(boardIndex)) return 'intro'
  const progress = puzzleProgressBoardIndex(boardIndex)
  const byTime = puzzleSessionPhaseByTime(effectiveElapsedMs)
  const byBoards = puzzleSessionPhaseByBoards(progress)
  const index = Math.min(PUZZLE_DIFFICULTY_PHASES.indexOf(byTime), PUZZLE_DIFFICULTY_PHASES.indexOf(byBoards))
  return PUZZLE_DIFFICULTY_PHASES[index]!
}

/** @deprecated Use puzzleSessionPhase(effectiveMs, boardIndex). */
export function puzzleSessionPhaseFromEffectiveOnly(effectiveElapsedMs: number): PuzzleDifficultyPhase {
  return puzzleSessionPhaseByTime(effectiveElapsedMs)
}

export function puzzleMercyLevel(phase: PuzzleSessionPhase): PuzzleMercyLevel {
  if (phase === 'intro' || phase === 'warmup' || phase === 'climb') return 'M0'
  if (phase === 'pressure') return 'M1'
  if (phase === 'late' || phase === 'severe') return 'M2'
  return 'M3'
}

export function isQuotaDopedBoard(boardIndex: number, phase: PuzzleSessionPhase): boolean {
  if (phase === 'intro') return false
  const progress = puzzleProgressBoardIndex(boardIndex)
  switch (phase) {
    case 'warmup':
      return false
    case 'climb':
      return progress > 0 && progress % 4 === 0
    case 'pressure':
      return progress > 0 && progress % 3 === 0
    case 'late':
      return progress > 0 && progress % 2 === 0
    case 'severe':
      return progress > 0 && progress % 3 !== 0
    case 'apex':
      return progress > 0 && progress % 10 < 7
    default:
      return false
  }
}

/** Streak / pressure hard doped only after intro + warmup. */
export function canApplyHardDopedTriggers(phase: PuzzleSessionPhase): boolean {
  return phase !== 'intro' && phase !== 'warmup'
}
