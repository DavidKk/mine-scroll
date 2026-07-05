export const PUZZLE_ROWS = 7
export const PUZZLE_COLS = 7
export const PUZZLE_MINES = 8
/** Intro boards 1–3: escalating mine count before warmup baseline (PUZZLE_MINES). */
export const PUZZLE_INTRO_MINES = [5, 6, 7] as const
export const PUZZLE_LIVES = 3
/** Consecutive boards cleared with zero life lost to restore 1 life (capped at PUZZLE_LIVES). */
export const CLEAN_BOARDS_HEAL_EVERY = 4
/** Base score per cleared board. */
export const BASE_BOARD_SCORE = 100
/** Consecutive clears — switch to doped boards when not in mercy. */
export const PUZZLE_LUCK_STREAK_THRESHOLD = 10
/** Lives below this trigger R1 mercy (M0 only). */
export const PUZZLE_MERCY_LIVES = 2
/** Combined pressure score (0–100) at or above this selects doped boards. */
export const PUZZLE_PROFILE_LUCK_PRESSURE = 60
/** Previous clear slower than tier cap × this factor → R3 mercy (when level allows). */
export const PUZZLE_SLOW_CLEAR_FACTOR = 1.2
/** Seconds under which time bonus applies (tier 1 default; see tier.ts). */
export const TIME_BONUS_CAP_SEC = 60
export const TIME_BONUS_PER_SEC = 5
