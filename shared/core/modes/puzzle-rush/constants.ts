export const PUZZLE_ROWS = 7
export const PUZZLE_COLS = 7
export const PUZZLE_MINES = 8
export const PUZZLE_LIVES = 3
/** Consecutive boards cleared with zero life lost to restore 1 life (capped at PUZZLE_LIVES). */
export const CLEAN_BOARDS_HEAL_EVERY = 4
/** Base score per cleared board before streak multiplier. */
export const BASE_BOARD_SCORE = 100
/** Seconds under which time bonus applies (max bonus = TIME_BONUS_PER_SEC × this). */
export const TIME_BONUS_CAP_SEC = 60
export const TIME_BONUS_PER_SEC = 5
