import type { PuzzleDifficultySignals } from '@shared/core/modes/puzzle-rush/index.ts'
import {
  buildPuzzleDifficultySignals,
  createPuzzleRushSession,
  PUZZLE_LUCK_STREAK_THRESHOLD,
  PUZZLE_MERCY_LIVES,
  PUZZLE_PROFILE_LUCK_PRESSURE,
  puzzleRushBeginRun,
  puzzleRushDifficultyPressure,
  puzzleRushSpeedPressure,
  resolvePuzzleBoardProfile,
  shouldForceLogicBoard,
} from '@shared/core/modes/puzzle-rush/index.ts'

function signals(overrides: Partial<PuzzleDifficultySignals>): PuzzleDifficultySignals {
  return {
    streak: 0,
    lives: 3,
    boardIndex: 0,
    runElapsedMs: 0,
    effectiveElapsedMs: 0,
    phase: 'warmup',
    mercyLevel: 'M0',
    tierTimeCapSec: 60,
    ...overrides,
  }
}

describe('puzzle-rush board-profile', () => {
  it('starts on logic boards', () => {
    expect(resolvePuzzleBoardProfile(signals({}))).toBe('logic')
  })

  it('M0 mercy forces logic when lives are low', () => {
    expect(resolvePuzzleBoardProfile(signals({ streak: PUZZLE_LUCK_STREAK_THRESHOLD, lives: PUZZLE_MERCY_LIVES - 1, mercyLevel: 'M0' }))).toBe('logic')
  })

  it('M1 does not mercy low lives alone', () => {
    expect(
      resolvePuzzleBoardProfile(
        signals({
          streak: PUZZLE_LUCK_STREAK_THRESHOLD,
          lives: 1,
          mercyLevel: 'M1',
          phase: 'pressure',
          effectiveElapsedMs: 14 * 60_000,
          boardIndex: 2,
        })
      )
    ).toBe('luck')
  })

  it('M0 forces logic after a mistake', () => {
    expect(resolvePuzzleBoardProfile(signals({ streak: 0, mercyLevel: 'M0' }))).toBe('logic')
  })

  it('M3 never mercies', () => {
    expect(shouldForceLogicBoard(signals({ streak: 0, lives: 1, mercyLevel: 'M3', phase: 'apex' }))).toBe(false)
  })

  it('switches to luck at streak threshold after intro and warmup', () => {
    expect(resolvePuzzleBoardProfile(signals({ streak: PUZZLE_LUCK_STREAK_THRESHOLD, phase: 'intro' }))).toBe('logic')
    expect(resolvePuzzleBoardProfile(signals({ streak: PUZZLE_LUCK_STREAK_THRESHOLD, phase: 'warmup' }))).toBe('logic')
    expect(resolvePuzzleBoardProfile(signals({ streak: PUZZLE_LUCK_STREAK_THRESHOLD, mercyLevel: 'M1', phase: 'pressure' }))).toBe('luck')
  })

  it('quota doped in climb phase', () => {
    expect(
      resolvePuzzleBoardProfile(
        signals({
          streak: 2,
          boardIndex: 7,
          phase: 'climb',
          effectiveElapsedMs: 8 * 60_000,
          mercyLevel: 'M0',
        })
      )
    ).toBe('luck')
  })

  it('slow effective clock delays quota pressure', () => {
    expect(
      resolvePuzzleBoardProfile(
        signals({
          boardIndex: 1,
          runElapsedMs: 30 * 60_000,
          effectiveElapsedMs: 60_000,
          phase: 'warmup',
          mercyLevel: 'M0',
        })
      )
    ).toBe('logic')
  })

  it('ramps luck via combined pressure', () => {
    const s = signals({
      streak: 10,
      boardIndex: 20,
      effectiveElapsedMs: 14 * 60_000,
      phase: 'pressure',
      mercyLevel: 'M1',
      lastClearElapsedMs: 12_000,
      tierTimeCapSec: 50,
    })
    expect(puzzleRushDifficultyPressure(s)).toBeGreaterThanOrEqual(PUZZLE_PROFILE_LUCK_PRESSURE)
    expect(resolvePuzzleBoardProfile(s)).toBe('luck')
  })

  it('awards higher speed pressure for faster clears', () => {
    expect(puzzleRushSpeedPressure(10_000, 60)).toBeGreaterThan(puzzleRushSpeedPressure(25_000, 60))
    expect(puzzleRushSpeedPressure(80_000, 60)).toBe(0)
  })

  it('builds signals from session state', () => {
    const session = puzzleRushBeginRun(createPuzzleRushSession(42), 1000)
    const withClear = {
      ...session,
      boardIndex: 10,
      streak: 4,
      score: 900,
      lastBoardClear: { scoreAdded: 400, streakAfter: 4, timeBonus: 50, boardIndex: 10, elapsedMs: 22_000 },
    }
    const built = buildPuzzleDifficultySignals(withClear, 1000 + 10 * 60_000)
    expect(built.boardIndex).toBe(10)
    expect(built.effectiveElapsedMs).toBe(7 * 60_000)
    expect(built.phase).toBe('climb')
    expect(built.lastClearElapsedMs).toBe(22_000)
  })

  it('keeps intro boards on pure logic even under pressure signals', () => {
    expect(
      resolvePuzzleBoardProfile(
        signals({
          boardIndex: 1,
          phase: 'intro',
          streak: PUZZLE_LUCK_STREAK_THRESHOLD,
          effectiveElapsedMs: 30 * 60_000,
          mercyLevel: 'M0',
        })
      )
    ).toBe('logic')
  })
})
