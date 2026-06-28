import type { GameCanvasRuntime } from '../runtime/context.ts';
import { HUD_FEEDBACK_ASSETS } from '../assets/hud-feedback-assets.ts';
import { FONTS } from '../../theme.ts';
import {
  COMBO_HUD_TIER_THRESHOLDS,
  comboHudGlowRgba,
  drawComboRailInteriorArcs,
  getComboFeedbackPalette,
  getComboHudTier,
  getComboRailFilter,
} from '../../hud-feedback-fx.ts';
import { drawElectricBolt } from '../../hud-feedback/electric-field.ts';
import { clamp01, seededUnit } from '../../primitives/index.ts';
import { drawFilteredFeedbackAsset, setFittedMonoFont } from './canvas-primitives.ts';
import type { ComboFeedbackPalette } from '../../hud-feedback-fx.ts';

function getComboTier3Progress(combo: number): number {
  if (combo < COMBO_HUD_TIER_THRESHOLDS[2]) return 0;
  return clamp01((combo - COMBO_HUD_TIER_THRESHOLDS[2]) / 48);
}

function drawComboHudDigitArcs(
  shellCtx: CanvasRenderingContext2D,
  textW: number,
  textH: number,
  palette: ComboFeedbackPalette,
  scale: number,
  nowMs: number,
  progress: number,
): void {
  const boltCount = 5 + Math.floor(progress * 3);
  const halfW = textW * 0.52;
  const halfH = textH * 0.48;
  const fade = 0.58 + progress * 0.34;
  const t = (nowMs % 1200) / 1200;

  shellCtx.save();
  shellCtx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < boltCount; i += 1) {
    const seed = i * 13.7 + Math.floor(nowMs / 120) * 0.31;
    const angle = (i / boltCount) * Math.PI * 2 + t * Math.PI * 2 + seededUnit(seed) * 0.8;
    const edgeX = Math.cos(angle) * halfW;
    const edgeY = Math.sin(angle) * halfH;
    const len = scale * (8 + seededUnit(seed + 1) * 14 + progress * 8);
    const tipX = edgeX + Math.cos(angle) * len;
    const tipY = edgeY + Math.sin(angle) * len * 0.62;
    drawElectricBolt(
      shellCtx,
      edgeX,
      edgeY,
      tipX,
      tipY,
      palette,
      fade * (0.55 + seededUnit(seed + 2) * 0.45),
      scale,
      seed,
      3,
      i % 2 === 0,
    );
  }
  shellCtx.restore();
}

function drawComboHudDigits(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  cx: number,
  comboTextY: number,
  text: string,
  palette: ComboFeedbackPalette,
  scale: number,
  displayCombo: number,
  maxTextW: number,
): void {
  const tier = getComboHudTier(displayCombo);
  const isOverload = tier >= 3;
  const now = Date.now();
  const overloadProgress = getComboTier3Progress(displayCombo);
  const startPx = isOverload ? (26 + overloadProgress * 6) * scale : 21 * scale;
  const fontSize = setFittedMonoFont(rt, shellCtx, text, maxTextW, startPx, 12 * scale, 900);

  shellCtx.textAlign = 'center';
  shellCtx.textBaseline = 'middle';

  if (!isOverload) {
    shellCtx.lineWidth = Math.max(1.5, fontSize * 0.09);
    shellCtx.strokeStyle = 'rgba(2, 6, 23, 0.88)';
    shellCtx.strokeText(text, cx, comboTextY);
    shellCtx.fillStyle = palette.digitColor;
    shellCtx.fillText(text, cx, comboTextY);
    return;
  }

  const pulse = 0.5 + Math.sin(now / 95) * 0.5;
  const jitterX = Math.sin(now / 41) * scale * 0.35;
  const jitterY = Math.cos(now / 37) * scale * 0.28;
  const textScale = 1 + pulse * 0.05 + overloadProgress * 0.04;

  shellCtx.save();
  shellCtx.translate(cx + jitterX, comboTextY + jitterY);
  shellCtx.scale(textScale, textScale);
  shellCtx.font = `900 ${fontSize}px ${FONTS.mono}`;

  const textW = shellCtx.measureText(text).width;
  const textH = fontSize * 0.72;
  drawComboHudDigitArcs(shellCtx, textW, textH, palette, scale, now, overloadProgress);

  shellCtx.shadowColor = palette.digitColor;
  shellCtx.shadowBlur = fontSize * (0.42 + pulse * 0.22);
  shellCtx.lineWidth = Math.max(2, fontSize * 0.14);
  shellCtx.strokeStyle = `rgba(127, 29, 29, ${0.72 + pulse * 0.18})`;
  shellCtx.strokeText(text, 0, 0);

  shellCtx.shadowBlur = fontSize * 0.2;
  shellCtx.lineWidth = Math.max(1.5, fontSize * 0.09);
  shellCtx.strokeStyle = 'rgba(2, 6, 23, 0.88)';
  shellCtx.strokeText(text, 0, 0);

  shellCtx.shadowColor = palette.digitColor;
  shellCtx.shadowBlur = fontSize * 0.38;
  shellCtx.fillStyle = palette.digitColor;
  shellCtx.fillText(text, 0, 0);

  shellCtx.globalCompositeOperation = 'lighter';
  shellCtx.shadowColor = palette.hot;
  shellCtx.shadowBlur = fontSize * 0.3;
  shellCtx.fillStyle = palette.hot;
  shellCtx.globalAlpha = 0.48 + pulse * 0.24;
  shellCtx.fillText(text, 0, 0);

  shellCtx.globalAlpha = 0.34 + pulse * 0.22;
  shellCtx.fillStyle = '#ffffff';
  shellCtx.shadowBlur = fontSize * 0.14;
  shellCtx.fillText(text, 0, 0);
  shellCtx.restore();
}

function drawComboHudLabel(
  shellCtx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  label: string,
  palette: ComboFeedbackPalette,
  scale: number,
  displayCombo: number,
): void {
  const tier = getComboHudTier(displayCombo);
  const isOverload = tier >= 3;
  const now = Date.now();
  const pulse = 0.5 + Math.sin(now / 110) * 0.5;
  const labelSize = (isOverload ? 11.5 : 10) * scale;

  shellCtx.font = `900 ${labelSize}px ${FONTS.display}`;
  shellCtx.textAlign = 'center';
  shellCtx.textBaseline = 'top';

  if (!isOverload) {
    shellCtx.fillStyle = `rgba(${palette.main}, 0.72)`;
    shellCtx.globalAlpha = 0.9;
    shellCtx.fillText(label, cx, y);
    return;
  }

  shellCtx.save();
  shellCtx.shadowColor = palette.digitColor;
  shellCtx.shadowBlur = 10 * scale + pulse * 4 * scale;
  shellCtx.fillStyle = `rgba(${palette.main}, ${0.78 + pulse * 0.14})`;
  shellCtx.globalAlpha = 0.92;
  shellCtx.fillText(label, cx, y);

  shellCtx.globalCompositeOperation = 'lighter';
  shellCtx.globalAlpha = 0.38 + pulse * 0.18;
  shellCtx.fillStyle = palette.hot;
  shellCtx.shadowBlur = 6 * scale;
  shellCtx.fillText(label, cx, y);
  shellCtx.restore();
}

export function drawComboRailGlow(_rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  asset: { x: number; y: number; w: number; h: number },
  palette: ReturnType<typeof getComboFeedbackPalette>,
  alpha: number,
): void {
  const cx = asset.x + asset.w / 2;
  const cy = asset.y + asset.h * 0.54;
  shellCtx.save();
  shellCtx.globalCompositeOperation = 'lighter';
  const glow = shellCtx.createRadialGradient(cx, cy, 0, cx, cy, asset.w * 0.58);
  glow.addColorStop(0, `rgba(${palette.main}, ${alpha * 0.34})`);
  glow.addColorStop(0.42, `rgba(${palette.soft}, ${alpha * 0.14})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  shellCtx.fillStyle = glow;
  shellCtx.fillRect(asset.x, asset.y, asset.w, asset.h);
  shellCtx.restore();
}

export function drawComboHud(rt: GameCanvasRuntime, 
  shellCtx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  combo: number,
  scale: number,
): void {
  if (combo <= 1) return;
  const isMobile = rt.state.stageLayout?.profile === 'mobile';
  const displayCombo = combo;
  const tier = getComboHudTier(displayCombo);
  const palette = getComboFeedbackPalette(displayCombo);
  const color = palette.digitColor;
  const pulse = 0.5 + Math.sin(Date.now() / 140) * 0.5;
  const overloadProgress = getComboTier3Progress(displayCombo);
  const glowAlpha =
    0.28 +
    Math.min(0.3, displayCombo * 0.012) +
    pulse * 0.1 +
    (tier >= 3 ? 0.12 + overloadProgress * 0.16 : 0);
  const text = `x${displayCombo}`;
  const label = 'COMBO';
  /** Desktop: lift rail / digits / underline toward COMBO label; title stays at `y`. */
  const bodyLift = isMobile ? 0 : 4 * scale;

  shellCtx.save();
  shellCtx.textAlign = 'center';
  shellCtx.textBaseline = 'top';
  shellCtx.shadowColor = color;
  shellCtx.shadowBlur = 14 * scale;

  const asset = drawFilteredFeedbackAsset(rt, shellCtx,
    HUD_FEEDBACK_ASSETS.comboRail,
    cx,
    y + (isMobile ? 18 : 28) * scale - bodyLift,
    (isMobile ? 132 : 180) * scale,
    (isMobile ? 36 : 48) * scale,
    getComboRailFilter(displayCombo),
    1,
    0.9,
  );
  if (asset) {
    drawComboRailGlow(rt, shellCtx, asset, palette, glowAlpha);
    drawComboRailInteriorArcs(shellCtx, asset, displayCombo, palette, scale, Date.now());
  }
  if (!asset) {
    const glowR = isMobile ? 52 : 64;
    const glowCenterY = y + (isMobile ? 16 : 25) * scale - bodyLift;
    const glow = shellCtx.createRadialGradient(cx, glowCenterY, 2 * scale, cx, glowCenterY, glowR * scale);
    glow.addColorStop(0, comboHudGlowRgba(displayCombo, glowAlpha));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.fillStyle = glow;
    shellCtx.fillRect(cx - glowR * scale, glowCenterY - 4 * scale, glowR * 2 * scale, (isMobile ? 44 : 58) * scale);
  }

  shellCtx.fillStyle = `rgba(${palette.main}, 0.72)`;
  drawComboHudLabel(shellCtx, cx, y, label, palette, scale, displayCombo);

  shellCtx.globalAlpha = 1;
  const maxTextW = (asset?.w ?? (isMobile ? 120 : 168) * scale) * (tier >= 3 ? 0.78 : 0.58);
  const comboTextY = asset ? asset.y + asset.h * 0.54 : y + (isMobile ? 22 : 29) * scale - bodyLift;
  drawComboHudDigits(rt, shellCtx, cx, comboTextY, text, palette, scale, displayCombo, maxTextW);

  const underlineW = Math.min(
    tier >= 3 ? 120 * scale : 96 * scale,
    (tier >= 3 ? 40 : 32) * scale + String(displayCombo).length * (tier >= 3 ? 17 : 15) * scale,
  );
  const lineY = asset ? asset.y + asset.h * 0.8 : y + (isMobile ? 38 : 48) * scale - bodyLift;
  const gradient = shellCtx.createLinearGradient(cx - underlineW / 2, lineY, cx + underlineW / 2, lineY);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  shellCtx.shadowBlur = tier >= 3 ? 8 * scale : 0;
  shellCtx.shadowColor = color;
  shellCtx.fillStyle = gradient;
  shellCtx.fillRect(cx - underlineW / 2, lineY, underlineW, Math.max(1.5, (tier >= 3 ? 2.6 : 2) * scale));
  shellCtx.restore();
}
