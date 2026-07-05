import { getEndlessAiStepMs } from '@shared/core/ai/solver.ts'
import { visibleViewStart } from '@shared/core/modes/endless/grid.ts'
import { getEndlessPreviewRows } from '@shared/core/modes/endless/index.ts'
import type { ModeSession } from '@shared/core/types.ts'

import { resolveViewportEndlessVisibleRows } from '../../ui/game-stage-layout.ts'
import type { GameSessionRuntime } from '../game-session/types.ts'
import { LANDING_PREVIEW_VIEWPORT } from './viewport.ts'

const DEMO_AI_DELAY = {
  normalMultiplier: 2.0,
  normalMinMs: 340,
  urgentMultiplier: 1.25,
  urgentMinMs: 200,
} as const

export function applyViewportForPreview(session: ModeSession): ModeSession {
  const previewRows = getEndlessPreviewRows(session)
  const visibleRows = resolveViewportEndlessVisibleRows(LANDING_PREVIEW_VIEWPORT.width, LANDING_PREVIEW_VIEWPORT.height, previewRows)
  let next: ModeSession = {
    ...session,
    endlessVisibleRows: visibleRows,
    endlessViewStart: visibleViewStart(session.state.board, visibleRows),
  }
  const refinedPreview = getEndlessPreviewRows(next)
  if (refinedPreview !== previewRows) {
    const refinedRows = resolveViewportEndlessVisibleRows(LANDING_PREVIEW_VIEWPORT.width, LANDING_PREVIEW_VIEWPORT.height, refinedPreview)
    if (refinedRows !== visibleRows) {
      next = {
        ...next,
        endlessVisibleRows: refinedRows,
        endlessViewStart: visibleViewStart(next.state.board, refinedRows),
      }
    }
  }
  return next
}

export function createPreviewRuntime(session: ModeSession): GameSessionRuntime {
  return {
    session,
    timerStarted: false,
    scrollGameStartedAt: Date.now(),
    backdropScrollDepth: session.scrollRowCount ?? 0,
    scrollTimeoutId: null,
    scrollDeadlineAt: 0,
    scrollIntervalMs: 0,
    scrollDetonateTimeoutId: null,
    scrollPendingTick: null,
    aiHint: null,
    aiAutoId: null,
    aiAutoActive: false,
    aiWaitLogged: false,
    aiOscillationCell: null,
    aiOscillationCount: 0,
    presentation: {
      eventId: 0,
      scoreEvent: undefined,
      breakEvent: undefined,
      lifeLossEvent: undefined,
    },
    recentLogLines: [],
    logOpen: false,
    leaderboardOpen: false,
    rankedRunId: null,
    rankedFinishStatus: null,
    startOverlayOpen: false,
    view: null,
  }
}

export function resolveDemoAiStepDelay(session: ModeSession, elapsedMs: number, urgent: boolean, endgameFast: boolean): number {
  const base = getEndlessAiStepMs(session, elapsedMs)
  if (endgameFast) {
    return Math.max(140, Math.round(base * 0.48))
  }
  if (urgent) {
    return Math.max(DEMO_AI_DELAY.urgentMinMs, Math.round(base * DEMO_AI_DELAY.urgentMultiplier))
  }
  return Math.max(DEMO_AI_DELAY.normalMinMs, Math.round(base * DEMO_AI_DELAY.normalMultiplier))
}
