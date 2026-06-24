import type { CellView, GameStatus } from '../../core/types.ts';
import type { AiHintDisplay } from '../../core/ai/types.ts';
import type { BoardPointerState } from '../cell-fx.ts';

export interface ScrollPressureState {
  /** Whole seconds remaining (display) */
  seconds: number;
  /** 0→1, fuller means closer to scroll */
  progress: number;
  /** Highlight in the last 3 seconds */
  urgent: boolean;
  /** Rows that will leave the screen in this scroll event */
  batchRows?: number;
}

export interface RenderState {
  views: CellView[];
  rows: number;
  cols: number;
  status: GameStatus;
  mineTotal: number;
  flagCount: number;
  elapsedSeconds: number;
  hudLeftDisplay?: string;
  /** Override right HUD (endless scroll countdown) */
  hudRightDisplay?: string;
  /** Endless scroll: pre-scroll pressure UI */
  scrollPressure?: ScrollPressureState;
  /** Endless: top preview band height (rows) */
  previewRows?: number;
  /** AI hint highlight (screen row coords) */
  aiHint?: AiHintDisplay | null;
  /** Pointer hover cell (hover / breath FX) */
  pointer?: BoardPointerState | null;
  /** Animation timestamp (performance.now) */
  nowMs?: number;
}
