import type { GameCanvasRuntime } from './context.ts';
import { renderBoardStaticFrame, renderBoardDynamicFrame, renderFrame } from '../../renderer/index.ts';
import { syncFullscreenCanvasSize } from '../layout/viewport-fit.ts';
import { syncBoardSizeFromLayout } from '../layout/board-layout.ts';
import { ensureBoardLayerCache } from './board-layer-cache.ts';
import { drawShellBackground } from '../shell/background.ts';
import { drawAmbientShellBackdrop } from '../shell/ambient-shell.ts';
import { pruneEffects, drawCellEffects } from './cell-effects-runtime.ts';
import { drawScrollMineGhostEffects } from './scroll-ghost-fx.ts';
import { drawFullscreenOverlay } from '../overlay/event-overlay.ts';
import { drawFullscreenHud } from '../hud/fullscreen-hud.ts';
import { syncPressureRepaint, scheduleContinuousRepaint } from './paint-scheduler.ts';

export function paint(rt: GameCanvasRuntime): void {
  syncFullscreenCanvasSize(rt);
  syncBoardSizeFromLayout(rt);
  const now = performance.now();
  pruneEffects(rt, now);
  const scrollPressure = rt.getScrollPressureFn?.();
  const renderState = {
    views: rt.state.currentViews,
    status: rt.state.currentStatus,
    mineTotal: rt.mineTotal,
    flagCount: rt.state.currentFlagCount,
    elapsedSeconds: rt.state.elapsed,
    scrollPressure,
    aiHint: rt.state.currentAiHint,
    previewRows: rt.state.currentPreviewRows > 0 ? rt.state.currentPreviewRows : undefined,
    nowMs: now,
    pointer: rt.state.boardPointer,
    ...(rt.fullscreen
      ? {}
      : {
          hudLeftDisplay: rt.state.currentHudLeftDisplay,
          hudRightDisplay: rt.state.currentHudRightDisplay,
        }),
  };

  if (rt.fullscreen) {
    rt.state.startRect = null;
    rt.state.retryRect = null;
    rt.state.devAutoRect = null;
    rt.state.devSpeedRect = null;
    rt.state.spaceHintRect = null;
    rt.ctx.clearRect(0, 0, rt.state.width, rt.state.height);
    drawShellBackground(rt, rt.ctx);
    drawAmbientShellBackdrop(rt, rt.ctx, now);
    rt.ctx.save();
    rt.ctx.translate(rt.state.boardOffsetX, rt.state.boardOffsetY);
  }

  const boardState = {
    ...renderState,
    rows: rt.state.currentRows,
    cols: rt.state.currentCols,
  };

  if (rt.fullscreen) {
    ensureBoardLayerCache(rt, boardState);
    if (rt.state.boardLayerCache) {
      const prevSmooth = rt.ctx.imageSmoothingEnabled;
      rt.ctx.imageSmoothingEnabled = false;
      rt.ctx.drawImage(rt.state.boardLayerCache, 0, 0, rt.state.squareLayout!.width, rt.state.squareLayout!.height);
      rt.ctx.imageSmoothingEnabled = prevSmooth;
    } else {
      renderBoardStaticFrame(rt.ctx, rt.state.squareLayout!, boardState);
    }
    renderBoardDynamicFrame(rt.ctx, rt.state.squareLayout!, boardState);
  } else {
    renderFrame(rt.ctx, rt.state.squareLayout!, boardState);
  }

  drawCellEffects(rt, rt.ctx, now);
  rt.fpsOverlay.recordGameFrame(now);
  rt.fpsOverlay.syncSize(rt.state.width, rt.state.height);

  if (rt.fullscreen) {
    rt.ctx.restore();
    drawFullscreenOverlay(rt, rt.ctx, rt.fullscreen, rt.state.width, rt.state.height);
    drawScrollMineGhostEffects(rt, rt.ctx, now);
    drawFullscreenHud(rt, rt.ctx, rt.fullscreen, rt.state.width, rt.state.height);
    if (rt.state.stageLayout) {
      const { scale, hudY } = rt.state.stageLayout;
      rt.fpsOverlay.setAnchor({ x: rt.state.width - 10 * scale, y: hudY + 2 * scale, scale });
    }
  } else {
    rt.fpsOverlay.setAnchor({ x: rt.state.width - 8, y: 8, scale: 1 });
  }

  rt.state.lastPaintAt = now;
  syncPressureRepaint(rt);
  scheduleContinuousRepaint(rt);
}
