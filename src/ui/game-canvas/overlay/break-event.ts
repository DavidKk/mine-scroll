import type { GameCanvasRuntime } from '../runtime/context.ts';
import type { GameCanvasHudStats } from '../types.ts';
import { GAME_ASSET_TUNING, drawFxSpriteFrame } from '../../game-assets.ts';
import { FONTS } from '../../theme.ts';
import { drawUiPanelImage } from '../hud/canvas-primitives.ts';

export function drawBreakEvent(rt: GameCanvasRuntime, 
  shellCtx: CanvasRenderingContext2D,
  event: GameCanvasHudStats['breakEvent'] | null,
  startedAt: number,
  shellW: number,
  shellH: number,
): void {
  if (!event || startedAt <= 0) return;
  const durationMs = GAME_ASSET_TUNING.fx.break.durationMs;
  const t = Math.min(1, (performance.now() - startedAt) / durationMs);
  if (t >= 1) {
    rt.state.activeBreakEvent = null;
    rt.state.breakFxStartedAt = 0;
    return;
  }
  const alpha = Math.max(0, 1 - t);
  const cx = shellW / 2;
  const stageScale = rt.state.stageLayout?.scale ?? 1;
  const isMobile = (rt.state.stageLayout?.viewportW ?? shellW) < 560;
  const cy = Math.max(96, rt.state.boardOffsetY - 4 * stageScale);
  const scale = 0.9 + Math.sin(Math.min(1, t * 2.3) * Math.PI) * 0.18;

  shellCtx.save();
  shellCtx.globalAlpha = Math.min(GAME_ASSET_TUNING.fx.break.flashAlpha, alpha * GAME_ASSET_TUNING.fx.break.flashAlpha);
  shellCtx.fillStyle = '#ef4444';
  shellCtx.fillRect(0, 0, shellW, shellH);
  shellCtx.restore();

  shellCtx.save();
  shellCtx.globalAlpha = alpha;
  shellCtx.translate(cx, cy);
  shellCtx.scale(scale, scale);
  drawFxSpriteFrame(shellCtx, 'wrong-flag-break', t, 0, 6, 190 * stageScale, 108 * stageScale, GAME_ASSET_TUNING.fx.break.spriteAlpha);
  drawUiPanelImage(rt, shellCtx, 'break-chip', -52 * stageScale, -42 * stageScale, 104 * stageScale, 32 * stageScale, 1);
  shellCtx.textAlign = 'center';
  shellCtx.textBaseline = 'middle';
  shellCtx.shadowColor = 'rgba(239, 68, 68, 0.9)';
  shellCtx.shadowBlur = 14 * stageScale;
  shellCtx.font = `900 ${28 * stageScale}px ${FONTS.display}`;
  shellCtx.fillStyle = '#fecaca';
  shellCtx.fillText(`BREAK x${event.comboCleared}`, 0, -6 * stageScale);
  shellCtx.font = `900 ${13 * stageScale}px ${FONTS.mono}`;
  shellCtx.fillStyle = '#ff4d3d';
  shellCtx.fillText(isMobile ? 'RESET' : `DEFUSE ${event.minesCleared}->0`, 0, 22 * stageScale);
  shellCtx.restore();

  if (t < 1) rt.scheduleAnimationFrame();
}
