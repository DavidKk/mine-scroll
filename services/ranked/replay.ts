import { aiMoveFromScreenRow, analyzeSession } from '@shared/core/ai/solver.ts'
import { visibleViewStart } from '@shared/core/modes/endless/grid.ts'
import {
  endlessBeginRun,
  endlessScreenRowToLocal,
  endlessScrollTick,
  getEndlessScrollProfileForSession,
  isEndlessInteractiveScreenRowForSession,
} from '@shared/core/modes/endless/index.ts'
import { chordAt, createSessionWithSeed, revealAt, toggleMarkAt } from '@shared/core/modes/engine.ts'
import type { ModeSession } from '@shared/core/types.ts'

import { derivePlayerActions, validateEventTimeline } from './derive.ts'
import type { DerivedPlayerAction, ReplayResult, RunInputEvent, ShadowAiMetrics } from './types.ts'

function applyAutoScrolls(session: ModeSession, fromT: number, toT: number): ModeSession {
  let next = session
  let elapsed = Math.max(0, fromT)

  while (next.state.status === 'playing' && elapsed < toT) {
    const profile = getEndlessScrollProfileForSession(next, elapsed)
    const nextAt = elapsed + profile.intervalMs
    if (nextAt > toT) break
    elapsed = nextAt
    next = endlessScrollTick(next, getEndlessScrollProfileForSession(next, elapsed).batchRows)
  }

  return next
}

function applyPlayerAction(session: ModeSession, action: DerivedPlayerAction): { session: ModeSession; ok: boolean; error?: string } {
  if (session.state.status !== 'playing' && action.kind !== 'reveal') {
    return { session, ok: false, error: `Action ${action.kind} while not playing` }
  }

  if (action.kind === 'scroll') {
    const profile = getEndlessScrollProfileForSession(session, action.t)
    const next = endlessScrollTick(session, profile.batchRows)
    return { session: next, ok: true }
  }

  if (!isEndlessInteractiveScreenRowForSession(session, action.screenRow)) {
    return { session, ok: false, error: `Screen row ${action.screenRow} not interactive` }
  }

  const localRow = endlessScreenRowToLocal(session, action.screenRow)
  const before = session

  let next: ModeSession
  if (action.kind === 'reveal') {
    next = revealAt(session, localRow, action.col)
  } else if (action.kind === 'flag') {
    next = toggleMarkAt(session, localRow, action.col)
  } else {
    next = chordAt(session, localRow, action.col)
  }

  if (next === before) {
    return { session, ok: false, error: `No-op ${action.kind} at (${action.screenRow},${action.col})` }
  }

  return { session: next, ok: true }
}

function compareShadowAi(session: ModeSession, action: DerivedPlayerAction, elapsedMs: number, metrics: ShadowAiMetrics): void {
  if (action.kind === 'scroll') return
  const analysis = analyzeSession(session, elapsedMs)
  const move = analysis.move
  if (!move || move.kind === 'heal' || move.kind === 'scroll') return
  if (move.kind !== action.kind) return

  const screenRow = aiMoveFromScreenRow(session, move.row)
  metrics.comparedMoves += 1
  if (screenRow === action.screenRow && move.col === action.col) {
    metrics.aiMoveMatches += 1
  }
}

export function replayRankedRun(seed: number, events: RunInputEvent[]): ReplayResult {
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

  let session = createSessionWithSeed(seed, 'expert')
  const layoutEvent = events.find((event): event is Extract<RunInputEvent, { e: 'layout' }> => event.e === 'layout')
  if (layoutEvent?.layout.rows) {
    session.endlessVisibleRows = layoutEvent.layout.rows
    session.endlessViewStart = visibleViewStart(session.state.board, layoutEvent.layout.rows)
  }
  session = endlessBeginRun(session)

  const shadowAi: ShadowAiMetrics = { comparedMoves: 0, aiMoveMatches: 0, aiMoveMatchRate: 0 }
  let lastT = beginT

  for (const action of actions) {
    session = applyAutoScrolls(session, lastT, action.t)
    if (session.state.status !== 'playing') break

    compareShadowAi(session, action, Math.max(0, action.t - beginT), shadowAi)

    const result = applyPlayerAction(session, action)
    if (!result.ok) {
      return {
        replayOk: false,
        replayError: result.error,
        sessionScore: session.score ?? 0,
        sessionDepth: session.scrollRowCount ?? 0,
        inputMetrics: metrics,
        shadowAi: finalizeShadow(shadowAi),
      }
    }
    session = result.session
    lastT = action.t

    if (session.state.status !== 'playing') break
  }

  shadowAi.aiMoveMatchRate = shadowAi.comparedMoves > 0 ? shadowAi.aiMoveMatches / shadowAi.comparedMoves : 0

  return {
    replayOk: true,
    sessionScore: session.score ?? 0,
    sessionDepth: session.scrollRowCount ?? 0,
    inputMetrics: metrics,
    shadowAi: finalizeShadow(shadowAi),
  }
}

function finalizeShadow(metrics: ShadowAiMetrics): ShadowAiMetrics {
  return {
    ...metrics,
    aiMoveMatchRate: metrics.comparedMoves > 0 ? metrics.aiMoveMatches / metrics.comparedMoves : 0,
  }
}
