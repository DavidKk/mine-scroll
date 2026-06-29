import type { GameStatus } from '@shared/core/types.ts'

import type { ScrollPressureState } from '../renderer/index.ts'

export interface BackdropDifficultyInput {
  status: GameStatus
  scrollElapsedMs: number
  /** Auto scroll depth for mood ramp — exclude manual Space scrolls. */
  scrollDepth: number
  lives: number
  maxLives: number
  scrollPressure?: ScrollPressureState
}

export interface AmbientBackdropInput {
  shellW: number
  shellH: number
  nowMs: number
  status: GameStatus
  mood: BackdropMood
  combo?: number
  /** Mobile perf: scales particle counts (default 1). */
  particleScale?: number
  /** Mobile perf: skip expensive star halos. */
  liteStars?: boolean
  boardSafeRect?: { x: number; y: number; w: number; h: number }
}

export interface BackdropMood {
  heat: number
  energy: number
  intensity: number
}
