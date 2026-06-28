import { loadRuntimeImage } from '../../primitives/index.ts';

export const LIFE_LOSS_POPUP_V3_MS = 820;

export const HUD_FEEDBACK_ASSETS = {
  scoreStrip: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/score-energy-strip-v3.png'),
  scorePanelV6: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/score-energy-panel-v6.png'),
  comboRail: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/combo-energy-rail-v3.png'),
  scorePopBase: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/score-pop-energy-base-v3.png'),
  comboBurstBase: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/combo-burst-energy-base-v3.png'),
  speedUpAlert: loadRuntimeImage('/assets/candidates/hud-alerts-v3/runtime/speed-up-alert-v3.png'),
  dangerRiseAlert: loadRuntimeImage('/assets/candidates/hud-alerts-v3/runtime/danger-rise-alert-v3.png'),
  lifeLossPopupSheet: loadRuntimeImage('/assets/candidates/hud-damage-v3/runtime/life-loss-popup-v3-sheet.png'),
};

export const SCORE_DIGIT_ASSETS = Array.from({ length: 10 }, (_, digit) =>
  loadRuntimeImage(`/assets/candidates/hud-feedback-v3/runtime/score-digits-v1/digit-${digit}.png`),
);
