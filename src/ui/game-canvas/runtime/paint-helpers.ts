import type { GameCanvasRuntime } from './context.ts';
import { GAME_ASSET_TUNING } from '../../game-assets.ts';
import type { HudFxBudget } from '../../hud-feedback-fx.ts';

export function isScorePopFxEnabled(_rt: GameCanvasRuntime): boolean {
  return GAME_ASSET_TUNING.fx.scorePop.enabled;
}

export function isHudFxHeavy(rt: GameCanvasRuntime, now = performance.now()): boolean {
  if (!isScorePopFxEnabled(rt)) return false;
  if (!rt.state.activeScoreEvent || rt.state.scoreFxStartedAt <= 0) return false;
  if (now - rt.state.scoreFxStartedAt >= GAME_ASSET_TUNING.fx.scorePop.durationMs) return false;
  if (rt.state.lastCombo <= 1 || rt.state.comboFxStartedAt <= 0) return false;
  if (now - rt.state.comboFxStartedAt >= GAME_ASSET_TUNING.fx.comboBurst.durationMs) return false;
  return true;
}

export function hudFxBudget(rt: GameCanvasRuntime, now = performance.now()): HudFxBudget {
  return isHudFxHeavy(rt, now) ? 'lite' : 'normal';
}
