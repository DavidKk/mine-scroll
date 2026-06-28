import type { GameCanvasRuntime } from '../runtime/context.ts';
import { HUD_FEEDBACK_ASSETS, SCORE_DIGIT_ASSETS } from '../assets/hud-feedback-assets.ts';
import { RUNTIME_CONSTANTS } from '../runtime/state.ts';
import { FONTS, THEME } from '../../theme.ts';
import { drawFeedbackAsset, drawTopHudChip, setFittedMonoFont } from './canvas-primitives.ts';

export function isScoreCountUpAnimating(rt: GameCanvasRuntime, now: number): boolean {
  return (
    rt.state.scoreCountUpStartedAt > 0 &&
    now - rt.state.scoreCountUpStartedAt < RUNTIME_CONSTANTS.SCORE_COUNT_UP_MS &&
    rt.state.scoreCountUpTo > rt.state.scoreCountUpFrom
  );
}

export function peekScoreCountUpValue(rt: GameCanvasRuntime, now: number): number {
  if (!isScoreCountUpAnimating(rt, now)) {
    return rt.state.lastDisplayedScore ?? rt.state.scoreCountUpTo;
  }
  const t = Math.min(1, (now - rt.state.scoreCountUpStartedAt) / RUNTIME_CONSTANTS.SCORE_COUNT_UP_MS);
  if (t >= 1) return rt.state.scoreCountUpTo;
  const delta = rt.state.scoreCountUpTo - rt.state.scoreCountUpFrom;
  return rt.state.scoreCountUpFrom + Math.floor(t * delta);
}

/** Value currently shown in the score HUD (mid-animation or last painted frame). */
export function currentScoreHudValue(rt: GameCanvasRuntime, now: number, fallback: number): number {
  if (isScoreCountUpAnimating(rt, now)) return peekScoreCountUpValue(rt, now);
  return rt.state.lastDisplayedScore ?? fallback;
}

export function resolveScoreCountUpDisplay(rt: GameCanvasRuntime, 
  now: number,
  actualScore: number,
): { score: number; animating: boolean } {
  if (rt.state.scoreCountUpStartedAt <= 0) {
    return { score: actualScore, animating: false };
  }
  const t = Math.min(1, (now - rt.state.scoreCountUpStartedAt) / RUNTIME_CONSTANTS.SCORE_COUNT_UP_MS);
  const delta = rt.state.scoreCountUpTo - rt.state.scoreCountUpFrom;
  if (delta <= 0) {
    rt.state.scoreCountUpStartedAt = 0;
    return { score: actualScore, animating: false };
  }
  if (t >= 1) {
    rt.state.scoreCountUpStartedAt = 0;
    return { score: rt.state.scoreCountUpTo, animating: false };
  }
  const raw = t * delta;
  const step = Math.floor(raw);
  return {
    score: rt.state.scoreCountUpFrom + step,
    animating: true,
  };
}

export function beginScoreCountUp(rt: GameCanvasRuntime, scoreAfter: number, scoreAdded: number, now: number): void {
  if (scoreAdded <= 0) return;

  const replacing = isScoreCountUpAnimating(rt, now);
  const scoreBefore = scoreAfter - scoreAdded;
  const fromScore = Math.min(
    replacing ? currentScoreHudValue(rt, now, rt.state.scoreCountUpTo) : (rt.state.lastDisplayedScore ?? scoreBefore),
    scoreAfter,
  );

  if (fromScore >= scoreAfter) {
    rt.state.lastDisplayedScore = scoreAfter;
    rt.state.scoreCountUpStartedAt = 0;
    return;
  }

  // Replace any in-flight tween: restart from the visible value toward the new total.
  rt.state.scoreCountUpFrom = fromScore;
  rt.state.scoreCountUpTo = scoreAfter;
  rt.state.scoreCountUpStartedAt = now;
}

function drawScoreDigits(_rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D,
  text: string,
  x: number,
  cy: number,
  maxW: number,
  maxH: number,
): boolean {
  const digits: HTMLImageElement[] = [];
  for (const ch of text) {
    const image = SCORE_DIGIT_ASSETS[Number(ch)];
    if (!image || !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return false;
    digits.push(image);
  }

  const baseW = digits.reduce((sum, image) => sum + image.naturalWidth, 0);
  const baseH = Math.max(...digits.map((image) => image.naturalHeight));
  const gap = baseH * 0.015;
  const totalBaseW = baseW + gap * Math.max(0, digits.length - 1);
  const fit = Math.min(maxW / totalBaseW, maxH / baseH);
  let cursorX = x;

  shellCtx.save();
  for (const image of digits) {
    const w = image.naturalWidth * fit;
    const h = image.naturalHeight * fit;
    shellCtx.drawImage(image, cursorX, cy - h / 2, w, h);
    cursorX += w + gap * fit;
  }
  shellCtx.restore();
  return true;
}

export function drawScoreHud(rt: GameCanvasRuntime, 
  shellCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  score: number,
  scale: number,
): void {
  const now = performance.now();
  const countUp = resolveScoreCountUpDisplay(rt, now, score);
  const displayScore = countUp.score;
  rt.state.lastDisplayedScore = displayScore;
  const pulseElapsed = rt.state.scoreFxStartedAt > 0 ? now - rt.state.scoreFxStartedAt : RUNTIME_CONSTANTS.SCORE_HUD_PULSE_MS;
  const pulseT = Math.max(0, Math.min(1, pulseElapsed / RUNTIME_CONSTANTS.SCORE_HUD_PULSE_MS));
  const pulse = pulseElapsed < RUNTIME_CONSTANTS.SCORE_HUD_PULSE_MS ? Math.sin(pulseT * Math.PI) * (1 - pulseT * 0.35) : 0;
  const panelPulseScale = 1 + pulse * 0.018;
  const asset = drawFeedbackAsset(rt, shellCtx,
    HUD_FEEDBACK_ASSETS.scorePanelV6,
    x + 118 * scale,
    y + 27 * scale,
    248 * scale,
    80 * scale,
    panelPulseScale,
    0.92,
  );
  if (!asset) {
    drawTopHudChip(rt, shellCtx, x - 10 * scale, y - 4 * scale, 116 * scale, 46 * scale, 'rgba(96, 165, 250, 0.68)', 'left');
    shellCtx.save();
    shellCtx.textAlign = 'left';
    shellCtx.textBaseline = 'top';
    shellCtx.fillStyle = '#7dd3fc';
    shellCtx.font = `800 ${7.5 * scale}px ${FONTS.display}`;
    shellCtx.fillText('SCORE', x - 2 * scale, y);
    shellCtx.shadowColor = 'rgba(45, 236, 255, 0.42)';
    shellCtx.shadowBlur = 7 * scale;
    shellCtx.fillStyle = THEME.hudText;
    const fallbackText = String(displayScore);
    setFittedMonoFont(rt, shellCtx, fallbackText, 86 * scale, 15 * scale, 10 * scale, 850);
    shellCtx.fillText(fallbackText, x - 2 * scale, y + 15 * scale);
    shellCtx.restore();
    return;
  }

  const text = String(displayScore);
  const basePanelH = asset.h / panelPulseScale;
  const digitMaxH = Math.min(basePanelH * 0.155, 15 * scale);
  const digitX = asset.x + asset.w * 0.34;
  const digitCy = asset.y + asset.h * 0.475;
  const digitMaxW = asset.w * 0.52;
  const clipPadX = asset.w * 0.02;
  const clipPadY = basePanelH * 0.06;
  shellCtx.save();
  shellCtx.beginPath();
  shellCtx.rect(
    digitX - clipPadX,
    digitCy - digitMaxH / 2 - clipPadY,
    digitMaxW + clipPadX * 2,
    digitMaxH + clipPadY * 2,
  );
  shellCtx.clip();
  const drewDigits = drawScoreDigits(rt, shellCtx, text, digitX, digitCy, digitMaxW, digitMaxH);
  shellCtx.restore();
  if (drewDigits) return;

  shellCtx.save();
  shellCtx.textAlign = 'left';
  shellCtx.textBaseline = 'middle';
  shellCtx.shadowColor = 'rgba(45, 236, 255, 0.42)';
  shellCtx.shadowBlur = 7 * scale;
  shellCtx.fillStyle = '#d8fbff';
  setFittedMonoFont(rt, shellCtx, text, digitMaxW, 15 * scale, 10 * scale, 850);
  shellCtx.fillText(text, digitX, digitCy);
  shellCtx.restore();
}
