import type { CellView, GameStatus } from '../../core/types.ts';
import type { AiHintDisplay } from '../../core/ai/types.ts';

export interface ScrollPressureState {
  /** 剩余整秒（显示用） */
  seconds: number;
  /** 0→1，越满越接近上移 */
  progress: number;
  /** 最后 3 秒高亮 */
  urgent: boolean;
  /** 本次卷轴事件会离屏的行数 */
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
  /** 覆盖右侧 HUD（无尽模式卷轴倒计时） */
  hudRightDisplay?: string;
  /** 无尽卷轴：准备上移压迫感 UI */
  scrollPressure?: ScrollPressureState;
  /** 无尽：顶缘预览带高度（行） */
  previewRows?: number;
  /** AI 建议高亮（屏幕行坐标） */
  aiHint?: AiHintDisplay | null;
}
