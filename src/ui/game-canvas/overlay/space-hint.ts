import type { GameCanvasRuntime } from '../runtime/context.ts';
import { FONTS } from '../../theme.ts';
import type { ScrollPressureState } from '../../renderer/index.ts';
import { fillRounded, roundedRectPath, strokeRounded } from '../../primitives/index.ts';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function drawScrollArrowIcon(
  shellCtx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const half = size * 0.34;
  const headY = cy - size * 0.3;
  const tailY = cy + size * 0.3;

  shellCtx.save();
  shellCtx.strokeStyle = color;
  shellCtx.lineWidth = Math.max(2, size * 0.14);
  shellCtx.lineCap = 'round';
  shellCtx.lineJoin = 'round';
  shellCtx.beginPath();
  shellCtx.moveTo(cx, headY);
  shellCtx.lineTo(cx - half, cy + size * 0.02);
  shellCtx.moveTo(cx, headY);
  shellCtx.lineTo(cx + half, cy + size * 0.02);
  shellCtx.moveTo(cx, headY + size * 0.02);
  shellCtx.lineTo(cx, tailY);
  shellCtx.stroke();
  shellCtx.restore();
}

function drawMobileScrollButton(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  pressure: ScrollPressureState | undefined,
  scale: number,
): void {
  const progress = clamp01(pressure?.progress ?? 0);
  const urgent = Boolean(pressure?.urgent);
  const active = rt.state.uiHoverTarget === 'space';
  const pulse = 0.5 + Math.sin(Date.now() / (urgent ? 210 : 520)) * 0.5;
  const glowColor = urgent
    ? `rgba(251, 191, 36, ${0.48 + pulse * 0.22})`
    : `rgba(45, 236, 255, ${0.28 + progress * 0.22 + (active ? 0.16 : 0)})`;
  const borderA = urgent ? 'rgba(251, 191, 36, 0.92)' : 'rgba(45, 236, 255, 0.72)';
  const borderB = urgent ? 'rgba(239, 68, 68, 0.8)' : 'rgba(168, 85, 247, 0.62)';
  const labelColor = urgent ? '#fef08a' : '#dbeafe';
  const iconColor = urgent ? '#fff7ad' : '#cffafe';
  const radius = Math.min(12 * scale, rect.h * 0.28);

  shellCtx.save();
  shellCtx.shadowColor = glowColor;
  shellCtx.shadowBlur = (urgent ? 18 : 12) * scale;

  const bg = shellCtx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  bg.addColorStop(0, urgent ? 'rgba(69, 52, 8, 0.96)' : 'rgba(15, 23, 42, 0.94)');
  bg.addColorStop(0.52, urgent ? 'rgba(41, 18, 8, 0.92)' : 'rgba(3, 7, 18, 0.92)');
  bg.addColorStop(1, urgent ? 'rgba(127, 29, 29, 0.82)' : 'rgba(17, 24, 39, 0.86)');
  fillRounded(shellCtx, rect.x, rect.y, rect.w, rect.h, radius, bg);

  const border = shellCtx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
  border.addColorStop(0, borderB);
  border.addColorStop(0.5, borderA);
  border.addColorStop(1, borderB);
  strokeRounded(shellCtx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, radius, border, Math.max(1.2, 1.5 * scale));

  shellCtx.globalCompositeOperation = 'lighter';
  const sheen = shellCtx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(0.48, urgent ? 'rgba(251, 191, 36, 0.18)' : 'rgba(45, 236, 255, 0.13)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  shellCtx.fillStyle = sheen;
  shellCtx.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);

  shellCtx.shadowBlur = 0;
  const chargeH = Math.max(3, 4 * scale);
  const chargeW = Math.max(10 * scale, rect.w * (1 - progress));
  const chargeX = rect.x + (rect.w - chargeW) / 2;
  shellCtx.save();
  roundedRectPath(shellCtx, rect.x, rect.y, rect.w, rect.h, radius);
  shellCtx.clip();
  shellCtx.fillStyle = urgent ? 'rgba(254, 240, 138, 0.8)' : 'rgba(125, 211, 252, 0.62)';
  shellCtx.fillRect(chargeX, rect.y + rect.h - chargeH, chargeW, chargeH);
  shellCtx.restore();
  shellCtx.globalCompositeOperation = 'source-over';

  const iconSize = Math.max(18, Math.min(24 * scale, rect.h * 0.54));
  const iconCx = rect.x + Math.max(24, 27 * scale);
  const iconCy = rect.y + rect.h * 0.49;
  const iconBg = shellCtx.createRadialGradient(iconCx, iconCy, 0, iconCx, iconCy, iconSize * 0.86);
  iconBg.addColorStop(0, urgent ? 'rgba(251, 191, 36, 0.34)' : 'rgba(45, 236, 255, 0.24)');
  iconBg.addColorStop(1, 'rgba(15, 23, 42, 0)');
  shellCtx.fillStyle = iconBg;
  shellCtx.beginPath();
  shellCtx.arc(iconCx, iconCy, iconSize * 0.66, 0, Math.PI * 2);
  shellCtx.fill();
  drawScrollArrowIcon(shellCtx, iconCx, iconCy, iconSize * 0.72, iconColor);

  shellCtx.textAlign = 'left';
  shellCtx.textBaseline = 'middle';
  shellCtx.fillStyle = labelColor;
  shellCtx.font = `900 ${Math.max(10, 11 * scale)}px ${FONTS.mono}`;
  const labelX = rect.x + Math.max(42, 47 * scale);
  shellCtx.fillText('SCROLL', labelX, rect.y + rect.h * 0.5 + 0.5 * scale);
  shellCtx.restore();
}

export function drawSpaceHint(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  pressure: ScrollPressureState | undefined,
  scale: number,
): void {
  const flash = 0.32 + Math.sin(Date.now() / 520) * 0.32;
  const urgent = Boolean(pressure?.urgent);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const isMobile = rt.state.stageLayout?.profile === 'mobile';

  shellCtx.save();

  if (isMobile) {
    shellCtx.restore();
    drawMobileScrollButton(rt, shellCtx, rect, pressure, scale);
    rt.scheduleContinuousRepaint();
    return;
  } else {
    shellCtx.globalAlpha = flash;
    shellCtx.fillStyle = urgent ? '#fef08a' : '#cbd5e1';
    shellCtx.font = `600 ${Math.max(9, 10 * scale)}px ${FONTS.mono}`;
  }

  shellCtx.textAlign = 'center';
  shellCtx.textBaseline = 'middle';
  shellCtx.fillText('SPACE', cx, cy);
  shellCtx.restore();
  rt.scheduleContinuousRepaint();
}

export function getSpaceHintRect(
  rt: GameCanvasRuntime,
  pressure: ScrollPressureState | undefined,
): { x: number; y: number; w: number; h: number } | null {
  if (!rt.state.stageLayout || !rt.state.squareLayout) return null;
  const scale = rt.state.stageLayout.scale;
  const profile = rt.state.stageLayout.profile;

  if (profile === 'mobile') {
    return rt.state.stageLayout.spaceButtonRect;
  }

  const grid = rt.state.squareLayout.grid;
  const coveredRows = Math.max(1, Math.min(rt.state.currentRows, Math.floor(pressure?.batchRows ?? 1)));
  const dangerTop =
    rt.state.boardOffsetY +
    rt.state.squareLayout.gridOriginY +
    (rt.state.currentRows - coveredRows) * grid.cellStep -
    2;
  const hintH = Math.max(12 * scale, grid.cellSize * 0.28);
  const hintW = grid.cellStep * 2;
  const gridLeft = rt.state.boardOffsetX + rt.state.squareLayout.gridOriginX;
  const hintX = gridLeft + (rt.state.boardWidth - hintW) / 2;
  const hintY = dangerTop - hintH - 4 * scale;
  const minY = rt.state.boardOffsetY + rt.state.squareLayout.gridOriginY + 4 * scale;

  return {
    x: hintX,
    y: Math.max(minY, hintY),
    w: hintW,
    h: hintH,
  };
}
