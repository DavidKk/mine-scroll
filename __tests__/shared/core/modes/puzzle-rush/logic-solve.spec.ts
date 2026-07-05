import { createPuzzleRushSession, puzzleRushBeginRun, puzzleRushRevealAt } from '@shared/core/modes/puzzle-rush/index.ts'
import {
  findSolvableSeed,
  isBoardLogicSolvable,
  isLogicSolvableFromFirstClick,
  mixSolvableAttemptSeed,
  PUZZLE_SOLVABLE_SEED_ATTEMPTS,
} from '@shared/core/modes/puzzle-rush/logic-solve.ts'

describe('puzzle-rush logic-solve', () => {
  it('finds a solvable seed within attempt budget for tier-1 density', () => {
    const seed = findSolvableSeed(424242, 8, 3, 3)
    expect(isLogicSolvableFromFirstClick(seed, 8, 3, 3)).toBe(true)
  })

  it('is deterministic for the same base seed and first click', () => {
    const a = findSolvableSeed(9001, 9, 2, 4)
    const b = findSolvableSeed(9001, 9, 2, 4)
    expect(a).toBe(b)
  })

  it('mixSolvableAttemptSeed covers distinct attempts', () => {
    const seeds = new Set(Array.from({ length: 16 }, (_, i) => mixSolvableAttemptSeed(1, i)))
    expect(seeds.size).toBeGreaterThan(1)
  })

  it('first reveal produces a logic-solvable board in play', () => {
    const session = puzzleRushBeginRun(createPuzzleRushSession(12345))
    const next = puzzleRushRevealAt(session, 3, 3)
    expect(next.state.board.minesPlaced).toBe(true)
    expect(isBoardLogicSolvable(next.state.board)).toBe(true)
  })

  it('resolves most tier-5 boards within seed attempts (center start)', () => {
    let resolved = 0
    for (let seed = 0; seed < 30; seed += 1) {
      const solvable = findSolvableSeed(seed, 10, 3, 3)
      if (isLogicSolvableFromFirstClick(solvable, 10, 3, 3)) resolved += 1
    }
    expect(resolved).toBe(30)
  })

  it('documents attempt ceiling', () => {
    expect(PUZZLE_SOLVABLE_SEED_ATTEMPTS).toBeGreaterThanOrEqual(64)
  })
})
