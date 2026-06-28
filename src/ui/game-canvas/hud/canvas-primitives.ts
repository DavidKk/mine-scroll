import type { GameCanvasRuntime } from '../runtime/context.ts';
import { clamp01, fillRounded, roundedRectPath, strokeRounded } from '../../primitives/index.ts';
import { RUNTIME_CONSTANTS } from '../runtime/state.ts';
import { drawPanelV3ScanBeams } from '../../cell-fx.ts';
import { getGameUiPanel, type GameUiPanelName } from '../../game-assets.ts';
import { FONTS, THEME } from '../../theme.ts';
import type { GameCanvasLogLine } from '../types.ts';
import type { HudIconName } from '../../hud-sprites.ts';
import { getComboHudAccentColors } from '../../hud-feedback-fx.ts';
import type { ScrollPressureState } from '../../renderer/index.ts';

export function drawArcadeGlow(_rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  intensity = 1,
): void {
  shellCtx.save();
  shellCtx.shadowColor = color;
  shellCtx.shadowBlur = 20 * intensity;
  shellCtx.strokeStyle = color;
  shellCtx.lineWidth = 1.5;
  roundedRectPath(shellCtx, x, y, w, h, Math.min(14, h / 3));
  shellCtx.stroke();
  shellCtx.restore();
}

export function drawRuntimePanelV3Fx(_rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: 'start' | 'game-over',
  nowMs: number,
  actionProgress = 0,
): void {
  const color = kind === 'start' ? '45, 236, 255' : '255, 76, 86';
  const accent = kind === 'start' ? '255, 213, 92' : '251, 146, 60';
  const phase = (nowMs % RUNTIME_CONSTANTS.PANEL_V3_MS) / RUNTIME_CONSTANTS.PANEL_V3_MS;
  const pulse = 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;

  shellCtx.save();
  shellCtx.globalCompositeOperation = 'lighter';
  const glow = shellCtx.createRadialGradient(
    x + w / 2,
    y + h / 2,
    w * 0.05,
    x + w / 2,
    y + h / 2,
    w * 0.62,
  );
  glow.addColorStop(0, `rgba(${color}, ${0.08 + pulse * 0.05})`);
  glow.addColorStop(1, `rgba(${color}, 0)`);
  shellCtx.fillStyle = glow;
  shellCtx.fillRect(x - w * 0.08, y - h * 0.12, w * 1.16, h * 1.24);

  drawPanelV3ScanBeams(shellCtx, { x, y, w, h }, color, phase, pulse);

  for (let i = 0; i < 8; i += 1) {
    const side = i % 4;
    const local = (phase + i * 0.137) % 1;
    const sparkX =
      side === 0
        ? x + w * local
        : side === 1
          ? x + w
          : side === 2
            ? x + w * (1 - local)
            : x;
    const sparkY =
      side === 0
        ? y
        : side === 1
          ? y + h * local
          : side === 2
            ? y + h
            : y + h * (1 - local);
    shellCtx.fillStyle = `rgba(${i % 3 === 0 ? accent : color}, ${0.26 + pulse * 0.18})`;
    shellCtx.beginPath();
    shellCtx.arc(sparkX, sparkY, Math.max(1.2, h * 0.008), 0, Math.PI * 2);
    shellCtx.fill();
  }

  if (kind === 'game-over') {
    shellCtx.globalAlpha = 0.22 + pulse * 0.08;
    shellCtx.strokeStyle = `rgba(${color}, 0.42)`;
    shellCtx.lineWidth = Math.max(1, h * 0.006);
    for (let i = 0; i < 6; i += 1) {
      const lineY = y + h * (0.2 + i * 0.11 + phase * 0.05);
      shellCtx.beginPath();
      shellCtx.moveTo(x + w * 0.08, lineY);
      shellCtx.lineTo(x + w * 0.92, lineY);
      shellCtx.stroke();
    }
  }

  if (actionProgress > 0) {
    const t = clamp01(actionProgress);
    const fade = 1 - t;
    const centerY = y + h * (kind === 'start' ? 0.5 : 0.68);
    const burst = shellCtx.createRadialGradient(
      x + w / 2,
      centerY,
      h * (0.08 + t * 0.1),
      x + w / 2,
      centerY,
      h * (0.32 + t * 0.62),
    );
    burst.addColorStop(0, `rgba(${kind === 'start' ? color : accent}, ${0.42 * fade})`);
    burst.addColorStop(0.42, `rgba(${kind === 'start' ? color : accent}, ${0.18 * fade})`);
    burst.addColorStop(1, 'rgba(255,255,255,0)');
    shellCtx.globalAlpha = 1;
    shellCtx.fillStyle = burst;
    shellCtx.fillRect(x, y, w, h);
  }

  shellCtx.restore();
}

export function containedImageRect(_rt: GameCanvasRuntime,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 1,
): { x: number; y: number; w: number; h: number } {
  const sourceW = 'naturalWidth' in img ? img.naturalWidth : 'width' in img ? Number(img.width) : w;
  const sourceH = 'naturalHeight' in img ? img.naturalHeight : 'height' in img ? Number(img.height) : h;
  const fit = Math.min(w / sourceW, h / sourceH) * scale;
  const drawW = sourceW * fit;
  const drawH = sourceH * fit;
  return { x: x + (w - drawW) / 2, y: y + (h - drawH) / 2, w: drawW, h: drawH };
}

export function drawUiPanelImageBounds(rt: GameCanvasRuntime, 
  shellCtx: CanvasRenderingContext2D,
  name: GameUiPanelName,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 1,
): { x: number; y: number; w: number; h: number } | null {
  const img = getGameUiPanel(name);
  if (!img) return null;
  const rect = containedImageRect(rt, img, x, y, w, h, scale);
  shellCtx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  return rect;
}

export function drawUiPanelImage(rt: GameCanvasRuntime, 
  shellCtx: CanvasRenderingContext2D,
  name: GameUiPanelName,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 1,
): boolean {
  return drawUiPanelImageBounds(rt, shellCtx, name, x, y, w, h, scale) !== null;
}

export function drawFeedbackAsset(_rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
  const fit = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight) * scale;
  const w = image.naturalWidth * fit;
  const h = image.naturalHeight * fit;
  const x = cx - w / 2;
  const y = cy - h / 2;
  shellCtx.save();
  shellCtx.globalAlpha = alpha;
  shellCtx.drawImage(image, x, y, w, h);
  shellCtx.restore();
  return { x, y, w, h };
}

export function drawFilteredFeedbackAsset(_rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  filter: string,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
  const fit = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight) * scale;
  const w = image.naturalWidth * fit;
  const h = image.naturalHeight * fit;
  const x = cx - w / 2;
  const y = cy - h / 2;
  shellCtx.save();
  shellCtx.globalAlpha = alpha;
  shellCtx.filter = filter;
  shellCtx.drawImage(image, x, y, w, h);
  shellCtx.restore();
  return { x, y, w, h };
}

export function drawSheetFrameContained(_rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frameIndex: number,
  frameCount: number,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0 || frameCount <= 0) return null;
  const frameW = image.naturalWidth / frameCount;
  const frameH = image.naturalHeight;
  const index = Math.min(frameCount - 1, Math.max(0, Math.floor(frameIndex)));
  const fit = Math.min(maxW / frameW, maxH / frameH) * scale;
  const w = frameW * fit;
  const h = frameH * fit;
  const x = cx - w / 2;
  const y = cy - h / 2;
  shellCtx.save();
  shellCtx.globalAlpha = alpha;
  shellCtx.drawImage(image, index * frameW, 0, frameW, frameH, x, y, w, h);
  shellCtx.restore();
  return { x, y, w, h };
}

export function setFittedMonoFont(_rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number,
  weight = 900,
): number {
  let size = startPx;
  do {
    shellCtx.font = `${weight} ${size}px ${FONTS.mono}`;
    if (shellCtx.measureText(text).width <= maxWidth || size <= minPx) return size;
    size -= 1;
  } while (size > minPx);
  return size;
}

export function drawArcadePanel(_rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  fill = 'rgba(3, 8, 18, 0.9)',
): void {
  shellCtx.save();
  shellCtx.shadowColor = color;
  shellCtx.shadowBlur = 16;
  fillRounded(shellCtx, x, y, w, h, 12, fill);
  strokeRounded(shellCtx, x + 0.5, y + 0.5, w - 1, h - 1, 12, color, 1.5);
  shellCtx.globalAlpha = 0.36;
  strokeRounded(shellCtx, x + 8, y + 8, w - 16, h - 16, 8, color, 1);
  shellCtx.restore();
}

export function drawTopHudChip(rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  align: 'left' | 'right' | 'center' = 'left',
): void {
  const pulse = 0.5 + Math.sin(Date.now() / 900) * 0.5;
  const radius = Math.min(10 * (rt.state.stageLayout?.scale ?? 1), h * 0.24);
  const cx = align === 'right' ? x + w : align === 'center' ? x + w / 2 : x;
  shellCtx.save();
  shellCtx.shadowColor = color;
  shellCtx.shadowBlur = 7 + pulse * 5;

  const bg = shellCtx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
  bg.addColorStop(0.55, 'rgba(3, 7, 18, 0.78)');
  bg.addColorStop(1, 'rgba(2, 6, 23, 0.62)');
  fillRounded(shellCtx, x, y, w, h, radius, bg);

  const border = shellCtx.createLinearGradient(x, y, x + w, y);
  border.addColorStop(0, align === 'right' ? 'rgba(45, 236, 255, 0)' : color);
  border.addColorStop(0.5, 'rgba(45, 236, 255, 0.46)');
  border.addColorStop(1, align === 'left' ? 'rgba(45, 236, 255, 0)' : color);
  strokeRounded(shellCtx, x + 0.5, y + 0.5, w - 1, h - 1, radius, border, 1.15);

  shellCtx.globalCompositeOperation = 'lighter';
  const glow = shellCtx.createRadialGradient(cx, y + h * 0.55, 0, cx, y + h * 0.55, w * 0.65);
  glow.addColorStop(0, color.replace('0.68', `${0.12 + pulse * 0.06}`));
  glow.addColorStop(1, 'rgba(45, 236, 255, 0)');
  shellCtx.fillStyle = glow;
  shellCtx.fillRect(x, y, w, h);
  shellCtx.restore();
}

export function drawBottomEnergyRail(rt: GameCanvasRuntime, 
  shellCtx: CanvasRenderingContext2D,
  pressure: ScrollPressureState | undefined,
  shellW: number,
  _shellH: number,
): void {
  if (!rt.state.stageLayout) return;
  const scale = rt.state.stageLayout.scale;
  const rail = rt.state.stageLayout.bottomRailRect;
  const top = rail.y;
  const bottom = rail.y + rail.h;
  const h = rail.h;
  if (h <= 4 * scale) return;

  const progress = Math.max(0, Math.min(1, pressure?.progress ?? 0));
  const urgent = Boolean(pressure?.urgent);
  const pulse = 0.5 + Math.sin(Date.now() / 420) * 0.5;
  const flow = ((Date.now() / 42) % shellW) - shellW;
  const baseAlpha = urgent ? 0.32 + pulse * 0.12 : 0.14 + progress * 0.14;
  const colorA = urgent ? '239, 68, 68' : progress > 0.66 ? '245, 158, 11' : '96, 165, 250';
  const colorB = urgent ? '251, 146, 60' : progress > 0.66 ? '250, 204, 21' : '168, 85, 247';
  const railW = rail.w;
  const x = rail.x;
  const y = top + h * 0.52;

  shellCtx.save();
  const fade = shellCtx.createLinearGradient(0, top, 0, bottom);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.35, `rgba(${colorA}, ${baseAlpha * 0.18})`);
  fade.addColorStop(1, `rgba(${colorB}, ${baseAlpha * 0.08})`);
  shellCtx.fillStyle = fade;
  shellCtx.fillRect(0, top, shellW, h);

  shellCtx.globalCompositeOperation = 'lighter';
  shellCtx.shadowColor = `rgba(${colorB}, ${0.32 + progress * 0.28})`;
  shellCtx.shadowBlur = (urgent ? 18 : 12) * scale;
  shellCtx.lineCap = 'round';

  const railGradient = shellCtx.createLinearGradient(x, 0, x + railW, 0);
  railGradient.addColorStop(0, `rgba(${colorA}, 0)`);
  railGradient.addColorStop(0.18, `rgba(${colorA}, ${baseAlpha})`);
  railGradient.addColorStop(0.5, `rgba(${colorB}, ${baseAlpha + 0.12})`);
  railGradient.addColorStop(0.82, `rgba(${colorA}, ${baseAlpha})`);
  railGradient.addColorStop(1, `rgba(${colorB}, 0)`);
  shellCtx.strokeStyle = railGradient;
  shellCtx.lineWidth = Math.max(1.2, 1.8 * scale);
  shellCtx.beginPath();
  shellCtx.moveTo(x, y);
  shellCtx.lineTo(x + railW, y);
  shellCtx.stroke();

  for (let i = 0; i < 3; i += 1) {
    const scanX = x + ((flow + i * railW * 0.48) % (railW + shellW * 0.2));
    const scan = shellCtx.createLinearGradient(scanX - 36 * scale, 0, scanX + 36 * scale, 0);
    scan.addColorStop(0, 'rgba(255,255,255,0)');
    scan.addColorStop(0.5, `rgba(${colorB}, ${urgent ? 0.46 : 0.28 + progress * 0.18})`);
    scan.addColorStop(1, 'rgba(255,255,255,0)');
    shellCtx.strokeStyle = scan;
    shellCtx.lineWidth = Math.max(1.5, 2.4 * scale);
    shellCtx.beginPath();
    shellCtx.moveTo(scanX - 42 * scale, y);
    shellCtx.lineTo(scanX + 42 * scale, y);
    shellCtx.stroke();
  }

  const markerCount = 7;
  shellCtx.shadowBlur = 0;
  for (let i = 0; i < markerCount; i += 1) {
    const t = i / (markerCount - 1);
    const mx = x + railW * t;
    const markerAlpha = (urgent ? 0.36 : 0.2) + Math.sin(Date.now() / 620 + i) * 0.06;
    shellCtx.fillStyle = `rgba(${colorA}, ${markerAlpha})`;
    shellCtx.fillRect(mx - 0.5 * scale, y - 6 * scale, Math.max(1, scale), 12 * scale);
  }
  shellCtx.restore();
}

export function comboColor(_rt: GameCanvasRuntime, combo: number): { fill: string; stroke: string; glow: string; text: string } {
  return getComboHudAccentColors(combo);
}

export function logIcon(_rt: GameCanvasRuntime, kind: GameCanvasLogLine['kind']): HudIconName {
  if (kind === 'danger') return 'info';
  if (kind === 'ai') return 'wand';
  if (kind === 'player') return 'flag';
  if (kind === 'scroll') return 'timer';
  return 'info';
}

export function logColor(_rt: GameCanvasRuntime, kind: GameCanvasLogLine['kind']): string {
  if (kind === 'danger') return THEME.danger;
  if (kind === 'ai') return THEME.accent;
  if (kind === 'player') return THEME.success;
  if (kind === 'scroll') return THEME.warning;
  return THEME.hudMuted;
}
