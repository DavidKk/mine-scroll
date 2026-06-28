import type { AiHintDisplay } from '@shared/core/ai/types.ts'
import type { LifeLossReport, ModeSession } from '@shared/core/types.ts'

import type { GameCanvasController, GameCanvasHudStats, GameCanvasLogLine } from '../../ui/game-canvas/index.ts'

export interface GameSessionCallbacks {
  onBack(): void
}

export interface CanvasLogController {
  append(text: string, kind?: GameCanvasLogLine['kind']): void
  clear(): void
}

export interface SessionApplyContext {
  trigger?: string
}

export interface PresentationState {
  eventId: number
  scoreEvent: GameCanvasHudStats['scoreEvent']
  breakEvent: GameCanvasHudStats['breakEvent']
  lifeLossEvent: GameCanvasHudStats['lifeLossEvent']
}

export interface GameSessionRuntime {
  session: ModeSession
  timerStarted: boolean
  scrollGameStartedAt: number
  /** Backdrop mood depth — auto scroll ticks only; manual Space does not advance this. */
  backdropScrollDepth: number
  scrollTimeoutId: number | null
  scrollDeadlineAt: number
  scrollIntervalMs: number
  scrollDetonateTimeoutId: number | null
  scrollPendingTick: { manual: boolean; aiReason?: string; batchRows: number } | null
  aiHint: AiHintDisplay | null
  aiAutoId: number | null
  aiAutoActive: boolean
  aiWaitLogged: boolean
  aiOscillationCell: string | null
  aiOscillationCount: number
  presentation: PresentationState
  recentLogLines: GameCanvasLogLine[]
  logOpen: boolean
  leaderboardOpen: boolean
  rankedRunId: string | null
  rankedFinishStatus: 'idle' | 'active' | 'pending' | 'accepted' | 'rejected' | null
  startOverlayOpen: boolean
  view: GameCanvasController | null
}

export interface SessionApplyDeps {
  runtime: GameSessionRuntime
  gameLog: CanvasLogController
  getScrollElapsedMs(): number
}

export type LifeLossLogger = (before: number, after: number, report?: LifeLossReport, context?: SessionApplyContext) => void
