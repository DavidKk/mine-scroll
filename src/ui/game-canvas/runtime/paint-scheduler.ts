import type { GameCanvasRuntime } from './context.ts';
import { RUNTIME_CONSTANTS } from './state.ts';
import { GAME_ASSET_TUNING } from '../../game-assets.ts';
import { LIFE_LOSS_POPUP_V3_MS } from '../assets/hud-feedback-assets.ts';

export function stopPressureRepaint(rt: GameCanvasRuntime): void {
  if (rt.state.pressureRepaintId !== null) {
    window.clearInterval(rt.state.pressureRepaintId);
    rt.state.pressureRepaintId = null;
  }
  if (rt.state.ambientDelayId !== null) {
    window.clearTimeout(rt.state.ambientDelayId);
    rt.state.ambientDelayId = null;
  }
}

export function needsContinuousRepaint(rt: GameCanvasRuntime, now: number): 'full' | 'ambient' | false {
  if (rt.state.cellEffects.length > 0 || rt.state.particles.length > 0) return 'full';
  if (
    rt.state.heartRefillFxStartedAt > 0 &&
    now - rt.state.heartRefillFxStartedAt < GAME_ASSET_TUNING.fx.heartRefillHud.durationMs
  ) {
    return 'full';
  }
  if (rt.state.levelUpFxStartedAt > 0 && now - rt.state.levelUpFxStartedAt < GAME_ASSET_TUNING.fx.levelUp.durationMs) {
    return 'full';
  }
  if (rt.state.pendingPanelTransition) return 'full';
  if (rt.state.activeDifficultyAlert && now - rt.state.activeDifficultyAlert.startedAt < RUNTIME_CONSTANTS.DIFFICULTY_ALERT_MS) {
    return 'full';
  }
  if (rt.state.scoreFxStartedAt > 0 && now - rt.state.scoreFxStartedAt < RUNTIME_CONSTANTS.SCORE_HUD_PULSE_MS) {
    return 'full';
  }
  if (
    rt.state.scoreCountUpStartedAt > 0 &&
    now - rt.state.scoreCountUpStartedAt < RUNTIME_CONSTANTS.SCORE_COUNT_UP_MS &&
    rt.state.scoreCountUpTo > rt.state.scoreCountUpFrom
  ) {
    return 'full';
  }
  if (rt.state.activeBreakEvent && rt.state.breakFxStartedAt > 0) return 'full';
  if (
    rt.state.activeLifeLossEvent &&
    rt.state.lifeLossFxStartedAt > 0 &&
    now - rt.state.lifeLossFxStartedAt < LIFE_LOSS_POPUP_V3_MS
  ) {
    return 'full';
  }
  if (rt.state.lastCombo > 1 && rt.state.comboFxStartedAt > 0) {
    const comboAge = now - rt.state.comboFxStartedAt;
    if (comboAge < GAME_ASSET_TUNING.fx.comboBurst.durationMs) return 'full';
  }
  if (rt.state.lastCombo > 1 && rt.state.currentStatus === 'playing') return 'ambient';
  if (rt.fullscreen) return 'ambient';
  if (rt.state.currentStatus === 'idle') return 'ambient';
  if (rt.state.currentStatus !== 'playing') return false;
  if (rt.state.boardPointer !== null) return 'ambient';
  if (rt.getScrollPressureFn?.()) return 'ambient';
  return false;
}

export function startAmbientLoop(rt: GameCanvasRuntime): void {
  if (!rt.fullscreen) return;
  rt.state.lastBackdropSampleAt = 0;
  rt.scheduleContinuousRepaint();
}

export function scheduleContinuousRepaint(rt: GameCanvasRuntime): void {
  const mode = needsContinuousRepaint(rt, performance.now());
  if (!mode) return;
  if (rt.state.animationFrameId !== null) return;
  if (mode === 'ambient' && rt.state.ambientDelayId !== null) return;

  const delay =
    mode === 'full' ? 0 : Math.max(0, RUNTIME_CONSTANTS.AMBIENT_FRAME_MS - (performance.now() - rt.state.lastPaintAt));
  if (delay <= 1) {
    rt.scheduleAnimationFrame();
    return;
  }
  rt.state.ambientDelayId = window.setTimeout(() => {
    rt.state.ambientDelayId = null;
    rt.scheduleAnimationFrame();
  }, delay);
}

export function syncPressureRepaint(rt: GameCanvasRuntime): void {
  if (!rt.getScrollPressureFn?.()) {
    stopPressureRepaint(rt);
    return;
  }
  rt.scheduleContinuousRepaint();
}

export function scheduleAnimationFrameImpl(rt: GameCanvasRuntime): void {
  if (rt.state.animationFrameId !== null) return;
  rt.state.animationFrameId = window.requestAnimationFrame(() => {
    rt.state.animationFrameId = null;
    rt.paint();
  });
}

export function bindPaintScheduler(rt: GameCanvasRuntime): void {
  rt.scheduleAnimationFrame = () => scheduleAnimationFrameImpl(rt);
  rt.scheduleContinuousRepaint = () => scheduleContinuousRepaint(rt);
}
