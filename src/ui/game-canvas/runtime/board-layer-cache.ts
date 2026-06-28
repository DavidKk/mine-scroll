import type { CellView, GameStatus } from '../../../core/types.ts';
import type { AiHintDisplay } from '../../../core/ai/types.ts';
import type { GameCanvasRuntime } from './context.ts';
import { renderBoardStaticFrame, type RenderState } from '../../renderer/index.ts';

export function computeBoardLayerCacheKey(rt: GameCanvasRuntime, state: {
  views: CellView[];
  status: GameStatus;
  flagCount: number;
  rows: number;
  previewRows?: number;
  aiHint?: AiHintDisplay | null;
}): string {
  const layout = rt.state.squareLayout;
  const parts: string[] = [
    state.status,
    String(state.flagCount),
    String(state.rows),
    String(state.previewRows ?? 0),
    String(layout?.width ?? 0),
    String(layout?.height ?? 0),
    String(layout?.grid.cellSize ?? 0),
  ];
  for (const view of state.views) {
    parts.push(
      `${view.row},${view.col}:${view.preview ? 'p' : ''}${view.revealed ? 1 : 0}${view.flagged ? 1 : 0}${view.adjacentMines ?? '-'}${view.isMine ?? '-'}${view.mineHit ? 'h' : ''}`,
    );
  }
  if (state.aiHint) {
    parts.push(`hint:${state.aiHint.row},${state.aiHint.col},${state.aiHint.kind}`);
  }
  return parts.join('|');
}

export function ensureBoardLayerCache(rt: GameCanvasRuntime, 
  state: RenderState & { rows: number; cols: number },
): void {
  const layout = rt.state.squareLayout!;
  const key = computeBoardLayerCacheKey(rt, state);
  const dpr = window.devicePixelRatio || 1;
  const cacheW = Math.round(layout.width * dpr);
  const cacheH = Math.round(layout.height * dpr);

  if (
    key !== rt.state.boardLayerCacheKey ||
    !rt.state.boardLayerCache ||
    rt.state.boardLayerCache.width !== cacheW ||
    rt.state.boardLayerCache.height !== cacheH ||
    rt.state.boardLayerCacheDpr !== dpr
  ) {
    rt.state.boardLayerCache = document.createElement('canvas');
    rt.state.boardLayerCache.width = cacheW;
    rt.state.boardLayerCache.height = cacheH;
    rt.state.boardLayerCacheCtx = rt.state.boardLayerCache.getContext('2d');
    rt.state.boardLayerCacheDpr = dpr;
    rt.state.boardLayerCacheKey = '';
  }
  if (key === rt.state.boardLayerCacheKey && rt.state.boardLayerCache) return;

  if (!rt.state.boardLayerCacheCtx) return;

  rt.state.boardLayerCacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rt.state.boardLayerCacheCtx.imageSmoothingEnabled = false;
  renderBoardStaticFrame(rt.state.boardLayerCacheCtx, layout, {
    ...state,
    nowMs: 0,
    pointer: null,
    scrollPressure: undefined,
  });
  rt.state.boardLayerCacheKey = key;
}
