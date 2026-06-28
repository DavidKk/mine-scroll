import type { GameCanvasRuntime } from '../runtime/context.ts';
import { HUD_FEEDBACK_ASSETS } from '../assets/hud-feedback-assets.ts';
import { FONTS } from '../../theme.ts';
import { comboHudGlowRgba, drawComboRailInteriorArcs, getComboFeedbackPalette, getComboRailFilter } from '../../hud-feedback-fx.ts';
import { drawFilteredFeedbackAsset, setFittedMonoFont } from './canvas-primitives.ts';

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
  const displayCombo = combo;
  const palette = getComboFeedbackPalette(displayCombo);
  const color = palette.digitColor;
  const pulse = 0.5 + Math.sin(Date.now() / 140) * 0.5;
  const glowAlpha = 0.28 + Math.min(0.3, displayCombo * 0.012) + pulse * 0.1;
  const text = `x${displayCombo}`;
  const label = 'COMBO';

  shellCtx.save();
  shellCtx.textAlign = 'center';
  shellCtx.textBaseline = 'top';
  shellCtx.shadowColor = color;
  shellCtx.shadowBlur = 14 * scale;

  const asset = drawFilteredFeedbackAsset(rt, shellCtx,
    HUD_FEEDBACK_ASSETS.comboRail,
    cx,
    y + 28 * scale,
    180 * scale,
    48 * scale,
    getComboRailFilter(displayCombo),
    1,
    0.9,
  );
  if (asset) {
    drawComboRailGlow(rt, shellCtx, asset, palette, glowAlpha);
    drawComboRailInteriorArcs(shellCtx, asset, displayCombo, palette, scale, Date.now());
  }
  if (!asset) {
    const glow = shellCtx.createRadialGradient(cx, y + 25 * scale, 2 * scale, cx, y + 25 * scale, 64 * scale);
    glow.addColorStop(0, comboHudGlowRgba(displayCombo, glowAlpha));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.fillStyle = glow;
    shellCtx.fillRect(cx - 76 * scale, y - 4 * scale, 152 * scale, 58 * scale);
  }

  shellCtx.fillStyle = `rgba(${palette.main}, 0.72)`;
  shellCtx.font = `900 ${10 * scale}px ${FONTS.display}`;
  shellCtx.globalAlpha = 0.9;
  shellCtx.fillText(label, cx, y);

  shellCtx.globalAlpha = 1;
  const maxTextW = (asset?.w ?? 168 * scale) * 0.58;
  const fontSize = setFittedMonoFont(rt, shellCtx, text, maxTextW, 21 * scale, 12 * scale, 900);
  shellCtx.lineWidth = Math.max(1.5, fontSize * 0.09);
  shellCtx.strokeStyle = 'rgba(2, 6, 23, 0.88)';
  shellCtx.textBaseline = 'middle';
  const comboTextY = asset ? asset.y + asset.h * 0.54 : y + 29 * scale;
  shellCtx.strokeText(text, cx, comboTextY);
  shellCtx.fillStyle = color;
  shellCtx.fillText(text, cx, comboTextY);

  const underlineW = Math.min(96 * scale, 32 * scale + String(displayCombo).length * 15 * scale);
  const lineY = asset ? asset.y + asset.h * 0.8 : y + 48 * scale;
  const gradient = shellCtx.createLinearGradient(cx - underlineW / 2, lineY, cx + underlineW / 2, lineY);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  shellCtx.shadowBlur = 0;
  shellCtx.fillStyle = gradient;
  shellCtx.fillRect(cx - underlineW / 2, lineY, underlineW, Math.max(1.5, 2 * scale));
  shellCtx.restore();
}
