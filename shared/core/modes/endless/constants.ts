/** Endless mode constants and mine-density curve. */

export const ENDLESS_COLS = 9
export const ENDLESS_VISIBLE_ROWS = 18
/** Mobile visible rows are computed from viewport height (see game-stage-layout). */
export const ENDLESS_MOBILE_MIN_VISIBLE_ROWS = 12
export const ENDLESS_MOBILE_MAX_VISIBLE_ROWS = 24
export const ENDLESS_PREVIEW_ROWS = 0.5
export const ENDLESS_PREVIEW_SOURCE_ROWS = 1
export const ENDLESS_WINDOW_BUFFER = 12
export const ENDLESS_WINDOW_ROWS = ENDLESS_VISIBLE_ROWS + ENDLESS_WINDOW_BUFFER
export const ENDLESS_SCROLL_MS_START = 9000
export const ENDLESS_SCROLL_MS_MIN = 1500
export const ENDLESS_SCROLL_DECAY = 0.94
export const SCROLL_STEP_MS = 50_000
/** @deprecated Expert ranked curve — use {@link EXPERT_PRESET} from `./presets.ts`. */
export const SCROLL_INTERVAL_TIERS_MS = [9000, 7500, 6300, 5300, 4500, 3800, 3200, 2700, 2300, 2000, 1500] as const
/** @deprecated Expert ranked curve — use {@link EXPERT_PRESET} from `./presets.ts`. */
export const SCROLL_BATCH_TIERS = [1, 2, 3, 4, 5] as const
export const ENDLESS_SCROLL_BATCH_MAX = 5
export const ENDLESS_LIVES = 5
export const ENDLESS_MINE_RATIO_START = 12 / 81
export const ENDLESS_MINE_RATIO_MAX = 15 / 81
export const ENDLESS_MINE_RAMP_ROWS = 80
export const ENDLESS_MAX_MINES_PER_ROW = 3
export const ENDLESS_PENDING_REVEAL_LOOKAHEAD_ROWS = 12
export const ENDLESS_PENDING_REVEAL_MAX_PER_SYNC = 36
export const ENDLESS_MINE_RATIO = ENDLESS_MINE_RATIO_MAX

export function getEndlessMineRatio(scrollDepth: number): number {
  const t = Math.min(1, Math.max(0, scrollDepth) / ENDLESS_MINE_RAMP_ROWS)
  return ENDLESS_MINE_RATIO_START + (ENDLESS_MINE_RATIO_MAX - ENDLESS_MINE_RATIO_START) * t
}
