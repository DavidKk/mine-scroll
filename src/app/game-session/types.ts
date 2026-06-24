import type { AiHintDisplay } from '../../core/ai/types.ts';
import type { LifeLossReport, ModeSession } from '../../core/types.ts';
import type {
  GameCanvasController,
  GameCanvasHudStats,
  GameCanvasLogLine,
} from '../../ui/game-canvas/index.ts';

export interface GameSessionCallbacks {
  onBack(): void;
}

export interface CanvasLogController {
  append(text: string, kind?: GameCanvasLogLine['kind']): void;
  clear(): void;
}

export interface SessionApplyContext {
  trigger?: string;
}

export interface PresentationState {
  eventId: number;
  scoreEvent: GameCanvasHudStats['scoreEvent'];
  breakEvent: GameCanvasHudStats['breakEvent'];
}

export interface GameSessionRuntime {
  session: ModeSession;
  timerStarted: boolean;
  scrollGameStartedAt: number;
  /** Backdrop mood depth — auto scroll ticks only; manual Space does not advance this. */
  backdropScrollDepth: number;
  scrollTimeoutId: number | null;
  scrollDeadlineAt: number;
  scrollIntervalMs: number;
  aiHint: AiHintDisplay | null;
  aiAutoId: number | null;
  aiAutoActive: boolean;
  aiWaitLogged: boolean;
  aiOscillationCell: string | null;
  aiOscillationCount: number;
  presentation: PresentationState;
  recentLogLines: GameCanvasLogLine[];
  logOpen: boolean;
  startOverlayOpen: boolean;
  view: GameCanvasController | null;
}

export interface SessionApplyDeps {
  runtime: GameSessionRuntime;
  gameLog: CanvasLogController;
  getScrollElapsedMs(): number;
}

export type LifeLossLogger = (
  before: number,
  after: number,
  report?: LifeLossReport,
  context?: SessionApplyContext,
) => void;
