import type { GameCanvasRuntime } from '../runtime/context.ts';
import { GAME_ASSET_TUNING, drawFxSpriteFrame } from '../../game-assets.ts';

export function drawLevelUpFx(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, shellW: number, shellH: number): void {
  if (rt.state.levelUpFxStartedAt <= 0) return;
  const durationMs = GAME_ASSET_TUNING.fx.levelUp.durationMs;
  const t = Math.min(1, (performance.now() - rt.state.levelUpFxStartedAt) / durationMs);
  if (t >= 1) {
    rt.state.levelUpFxStartedAt = 0;
    return;
  }
  const alpha = Math.max(0, 1 - t * 0.85);
  const stageScale = rt.state.stageLayout?.scale ?? 1;
  const cx = shellW / 2;
  const cy = shellH * 0.38;

  shellCtx.save();
  shellCtx.globalAlpha = alpha;
  drawFxSpriteFrame(
    shellCtx,
    'level-up',
    t,
    cx,
    cy,
    180 * stageScale * GAME_ASSET_TUNING.fx.levelUp.spriteW,
    120 * stageScale * GAME_ASSET_TUNING.fx.levelUp.spriteH,
    GAME_ASSET_TUNING.fx.levelUp.spriteAlpha,
  );
  shellCtx.restore();

  if (t < 1) rt.scheduleAnimationFrame();
}
