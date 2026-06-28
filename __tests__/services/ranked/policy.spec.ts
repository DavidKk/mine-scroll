import { evaluateRankedRun } from '@/services/ranked/policy'
import type { ReplayResult } from '@/services/ranked/types'

function baseReplay(overrides: Partial<ReplayResult> = {}): ReplayResult {
  return {
    replayOk: true,
    sessionScore: 100,
    sessionDepth: 3,
    inputMetrics: [{ moveSamplesBeforeDown: 3, pathLengthPx: 24, straightLineRatio: 0.6 }],
    shadowAi: { comparedMoves: 1, aiMoveMatches: 0, aiMoveMatchRate: 0 },
    ...overrides,
  }
}

describe('services/ranked/policy', () => {
  it('rejects failed replay', () => {
    const decision = evaluateRankedRun(baseReplay({ replayOk: false }))
    expect(decision.decision).toBe('rejected')
  })

  it('rejects bot-like input chains', () => {
    const decision = evaluateRankedRun(
      baseReplay({
        inputMetrics: Array.from({ length: 10 }, () => ({
          moveSamplesBeforeDown: 0,
          pathLengthPx: 0,
          straightLineRatio: 1,
        })),
        shadowAi: { comparedMoves: 10, aiMoveMatches: 10, aiMoveMatchRate: 1 },
      })
    )
    expect(decision.decision).toBe('rejected')
  })

  it('accepts human-like replay', () => {
    const decision = evaluateRankedRun(
      baseReplay({
        inputMetrics: Array.from({ length: 8 }, () => ({
          moveSamplesBeforeDown: 4,
          pathLengthPx: 30,
          straightLineRatio: 0.5,
        })),
        shadowAi: { comparedMoves: 4, aiMoveMatches: 1, aiMoveMatchRate: 0.25 },
      })
    )
    expect(decision.decision).toBe('accepted')
  })
})
