import type { PuzzleRushSession } from '@shared/core/modes/puzzle-rush/index.ts'
import { analyzePuzzleRushSession ,
  createPuzzleRushSession,
  puzzleRushBeginRun,
  puzzleRushChordAt,
  puzzleRushCommitNextBoard,
  puzzleRushRevealAt,
  puzzleRushToggleMarkAt,
} from '@shared/core/modes/puzzle-rush/index.ts'

import { derivePlayerActions, validateEventTimeline } from './derive.ts'
import type { DerivedPlayerAction, ReplayResult, RunInputEvent, ShadowAiMetrics } from './types.ts'

function applyPlayerAction(session: PuzzleRushSession, action: DerivedPlayerAction, nowMs: number): { session: PuzzleRushSession; ok: boolean; skipped?: boolean; error?: string } {
  if (session.state.status === 'lost') {
    return { session, ok: true, skipped: true }
  }

  if (action.kind === 'scroll') {
    return { session, ok: true, skipped: true }
  }

  if (session.state.status !== 'playing' && session.state.status !== 'idle') {
    return { session, ok: true, skipped: true }
  }

  const row = action.screenRow
  const col = action.col
  const before = session

  let next: PuzzleRushSession
  if (action.kind === 'reveal') {
    next = puzzleRushRevealAt(session, row, col, nowMs)
  } else if (action.kind === 'flag') {
    next = puzzleRushToggleMarkAt(session, row, col)
  } else {
    next = puzzleRushChordAt(session, row, col, nowMs)
  }

  if (next === before) {
    return { session, ok: true, skipped: true }
  }

  if (next.pendingNextSeed !== undefined) {
    next = puzzleRushCommitNextBoard(next, nowMs)
  }

  return { session: next, ok: true }
}

function compareShadowAi(session: PuzzleRushSession, action: DerivedPlayerAction, metrics: ShadowAiMetrics): void {
  if (action.kind === 'scroll') return
  const analysis = analyzePuzzleRushSession(session)
  const move = analysis.move
  if (!move || move.kind === 'heal') return
  if (move.kind !== action.kind) return

  metrics.comparedMoves += 1
  if (move.row === action.screenRow && move.col === action.col) {
    metrics.aiMoveMatches += 1
  }
}

export function replayPuzzleRushRun(seed: number, events: RunInputEvent[]): ReplayResult {
  const timelineError = validateEventTimeline(events)
  if (timelineError) {
    return {
      replayOk: false,
      replayError: timelineError,
      sessionScore: 0,
      sessionDepth: 0,
      inputMetrics: [],
      shadowAi: { comparedMoves: 0, aiMoveMatches: 0, aiMoveMatchRate: 0 },
    }
  }

  const { actions, metrics, beginT } = derivePlayerActions(events)
  if (actions.length === 0) {
    return {
      replayOk: false,
      replayError: 'No player actions derived from input',
      sessionScore: 0,
      sessionDepth: 0,
      inputMetrics: metrics,
      shadowAi: { comparedMoves: 0, aiMoveMatches: 0, aiMoveMatchRate: 0 },
    }
  }

  let session = puzzleRushBeginRun(createPuzzleRushSession(seed))
  session = { ...session, boardStartedAtMs: beginT }
  const shadowAi: ShadowAiMetrics = { comparedMoves: 0, aiMoveMatches: 0, aiMoveMatchRate: 0 }
  let skippedActions = 0

  for (const action of actions) {
    if (session.state.status === 'lost') break

    compareShadowAi(session, action, shadowAi)

    const result = applyPlayerAction(session, action, action.t)
    if (!result.ok) {
      return {
        replayOk: false,
        replayError: result.error,
        sessionScore: session.score,
        sessionDepth: session.boardIndex,
        inputMetrics: metrics,
        shadowAi: finalizeShadow(shadowAi),
        skippedActions,
      }
    }
    if (result.skipped) skippedActions += 1
    session = result.session

    if (session.state.status === 'lost') break
  }

  return {
    replayOk: true,
    sessionScore: session.score,
    sessionDepth: session.boardIndex,
    inputMetrics: metrics,
    shadowAi: finalizeShadow(shadowAi),
    skippedActions,
  }
}

function finalizeShadow(metrics: ShadowAiMetrics): ShadowAiMetrics {
  return {
    ...metrics,
    aiMoveMatchRate: metrics.comparedMoves > 0 ? metrics.aiMoveMatches / metrics.comparedMoves : 0,
  }
}
