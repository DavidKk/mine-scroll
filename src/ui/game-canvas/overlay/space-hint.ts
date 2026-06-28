import type { GameCanvasRuntime } from '../runtime/context.ts';
import { FONTS } from '../../theme.ts';
import type { ScrollPressureState } from '../../renderer/index.ts';

export function drawSpaceHint(rt: GameCanvasRuntime, 
  shellCtx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  pressure: ScrollPressureState | undefined,
  scale: number,
): void {
  const flash = 0.32 + Math.sin(Date.now() / 520) * 0.32;
  const urgent = Boolean(pressure?.urgent);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;

  shellCtx.save();
  shellCtx.globalAlpha = flash;
  shellCtx.fillStyle = urgent ? '#fef08a' : '#cbd5e1';
  shellCtx.font = `600 ${Math.max(9, 10 * scale)}px ${FONTS.mono}`;
  shellCtx.textAlign = 'center';
  shellCtx.textBaseline = 'middle';
  shellCtx.fillText('SPACE', cx, cy);
  shellCtx.restore();

  rt.scheduleContinuousRepaint();
}

export function getSpaceHintRect(rt: GameCanvasRuntime, 
  pressure: ScrollPressureState | undefined,
): { x: number; y: number; w: number; h: number } | null {
  if (!rt.state.stageLayout || !rt.state.squareLayout) return null;
  const scale = rt.state.stageLayout.scale;
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
