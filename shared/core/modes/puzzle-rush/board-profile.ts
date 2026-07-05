import type { Board } from '../../types.ts'
import { buildFirstClickSafeZone, placeMinesFromSeed } from './board.ts'
import { PUZZLE_LUCK_STREAK_THRESHOLD, PUZZLE_MERCY_LIVES, PUZZLE_PROFILE_LUCK_PRESSURE, PUZZLE_SLOW_CLEAR_FACTOR } from './constants.ts'
import { hasSolvableSeedForFirstClick, placeSolvableMines } from './logic-solve.ts'
import {
  canApplyHardDopedTriggers,
  isQuotaDopedBoard,
  PUZZLE_PRESSURE_BOARDS_SCALE,
  PUZZLE_PRESSURE_DURATION_MS,
  puzzleEffectiveElapsedMs,
  type PuzzleMercyLevel,
  puzzleMercyLevel,
  puzzleProgressBoardIndex,
  type PuzzleSessionPhase,
  puzzleSessionPhase,
} from './session-phase.ts'
import { getPuzzleRushTierForBoardIndex } from './tier.ts'
import type { PuzzleRushSession } from './types.ts'

export type PuzzleBoardProfile = 'logic' | 'luck'

export interface PuzzleDifficultySignals {
  streak: number
  lives: number
  boardIndex: number
  runElapsedMs: number
  effectiveElapsedMs: number
  phase: PuzzleSessionPhase
  mercyLevel: PuzzleMercyLevel
  lastClearElapsedMs?: number
  tierTimeCapSec: number
}

export function puzzleRushRunElapsedMs(session: PuzzleRushSession, nowMs: number): number {
  if (session.runStartedAtMs <= 0) return 0
  return Math.max(0, nowMs - session.runStartedAtMs)
}

function r1LowLives(signals: PuzzleDifficultySignals): boolean {
  return signals.lives < PUZZLE_MERCY_LIVES
}

function r2StreakBroken(signals: PuzzleDifficultySignals): boolean {
  return signals.streak === 0
}

function r3SlowClear(signals: PuzzleDifficultySignals): boolean {
  if (signals.lastClearElapsedMs === undefined) return false
  const capMs = signals.tierTimeCapSec * 1000
  return signals.lastClearElapsedMs >= capMs * PUZZLE_SLOW_CLEAR_FACTOR
}

function r4LowMomentum(signals: PuzzleDifficultySignals): boolean {
  return signals.streak <= 2 && signals.lives <= 2
}

export function puzzleRushSpeedPressure(lastClearElapsedMs: number | undefined, tierCapSec: number): number {
  if (lastClearElapsedMs === undefined) return 0
  const capMs = tierCapSec * 1000
  if (lastClearElapsedMs >= capMs * PUZZLE_SLOW_CLEAR_FACTOR) return 0
  const fastRatio = 1 - lastClearElapsedMs / (capMs * 0.5)
  return Math.max(0, Math.min(25, fastRatio * 25))
}

export function puzzleRushDifficultyPressure(signals: PuzzleDifficultySignals): number {
  const streakPart = Math.min(25, signals.streak * 2.5)
  const durationPart = Math.min(25, (signals.effectiveElapsedMs / PUZZLE_PRESSURE_DURATION_MS) * 25)
  const boardPart = Math.min(25, (puzzleProgressBoardIndex(signals.boardIndex) / PUZZLE_PRESSURE_BOARDS_SCALE) * 25)
  const speedPart = puzzleRushSpeedPressure(signals.lastClearElapsedMs, signals.tierTimeCapSec)
  return Math.round(streakPart + durationPart + boardPart + speedPart)
}

export function shouldForceLogicBoard(signals: PuzzleDifficultySignals): boolean {
  switch (signals.mercyLevel) {
    case 'M0':
      return r1LowLives(signals) || r2StreakBroken(signals) || r3SlowClear(signals) || r4LowMomentum(signals)
    case 'M1':
      return (r2StreakBroken(signals) && signals.lives === 3) || (r3SlowClear(signals) && signals.streak >= 3)
    case 'M2':
      return r3SlowClear(signals) && signals.lives === 3 && signals.streak >= 5
    case 'M3':
      return false
    default:
      return false
  }
}

export function buildPuzzleDifficultySignals(session: PuzzleRushSession, nowMs: number): PuzzleDifficultySignals {
  const boardIndex = session.boardIndex
  const tier = getPuzzleRushTierForBoardIndex(boardIndex)
  const runElapsedMs = puzzleRushRunElapsedMs(session, nowMs)
  const effectiveElapsedMs = puzzleEffectiveElapsedMs(runElapsedMs, boardIndex)
  const phase = puzzleSessionPhase(effectiveElapsedMs, boardIndex)
  return {
    streak: session.streak,
    lives: session.lives,
    boardIndex,
    runElapsedMs,
    effectiveElapsedMs,
    phase,
    mercyLevel: puzzleMercyLevel(phase),
    lastClearElapsedMs: session.lastBoardClear?.elapsedMs,
    tierTimeCapSec: tier.timeBonusCapSec,
  }
}

export function resolvePuzzleBoardProfile(signals: PuzzleDifficultySignals): PuzzleBoardProfile {
  if (shouldForceLogicBoard(signals)) return 'logic'
  if (isQuotaDopedBoard(signals.boardIndex, signals.phase)) return 'luck'
  if (canApplyHardDopedTriggers(signals.phase)) {
    if (signals.streak >= PUZZLE_LUCK_STREAK_THRESHOLD) return 'luck'
    if (puzzleRushDifficultyPressure(signals) >= PUZZLE_PROFILE_LUCK_PRESSURE) return 'luck'
  }
  return 'logic'
}

export function resolvePuzzleBoardProfileForSession(session: PuzzleRushSession, nowMs: number): PuzzleBoardProfile {
  return resolvePuzzleBoardProfile(buildPuzzleDifficultySignals(session, nowMs))
}

export function placePuzzleBoardMines(board: Board, startRow: number, startCol: number, session: PuzzleRushSession, nowMs: number): PuzzleBoardProfile {
  const profile = resolvePuzzleBoardProfileForSession(session, nowMs)
  const forbidden = buildFirstClickSafeZone(startRow, startCol, board)
  const baseSeed = board.worldSeed ?? 1

  if (profile === 'logic' && hasSolvableSeedForFirstClick(baseSeed, board.mineCount, startRow, startCol)) {
    placeSolvableMines(board, startRow, startCol)
    return 'logic'
  }

  placeMinesFromSeed(board, forbidden)
  return 'luck'
}
