import type { GameCanvasRuntime } from './context.ts';
import { drawCellRevealTransitionOverlay, drawMineBurstSmoke } from '../../cell-fx.ts';
import { GAME_ASSET_TUNING, drawFxSpriteFrame, drawGameMineCutout, getGameCutout } from '../../game-assets.ts';
import { fillRounded, strokeRounded } from '../../primitives/index.ts';
import type { CellView } from '../../../core/types.ts';
import type { CellFxKind } from './state.ts';
import { cellPixelForFx } from './cell-fx-utils.ts';

export function viewKey(_rt: GameCanvasRuntime, view: CellView): string {
  return view.fxKey ?? `${view.row},${view.col}`;
}

function viewFxState(view: CellView): { revealed: boolean; flagged: boolean; isMine: boolean | null } {
  return { revealed: view.revealed, flagged: view.flagged, isMine: view.isMine };
}

export function queueCellEffect(rt: GameCanvasRuntime, kind: CellFxKind, row: number, col: number, now: number): void {
  const durationMs =
    kind === 'explode'
      ? GAME_ASSET_TUNING.fx.mineExplosion.durationMs
      : kind === 'flag' || kind === 'unflag'
        ? GAME_ASSET_TUNING.fx.flagPop.durationMs
        : GAME_ASSET_TUNING.fx.safeReveal.durationMs;
  rt.state.cellEffects.push({ kind, row, col, startedAt: now, durationMs });
  while (rt.state.cellEffects.length > 48) {
    rt.state.cellEffects.shift();
  }
}

export function collectCellEffects(rt: GameCanvasRuntime, previous: CellView[], next: CellView[]): void {
  if (!rt.fullscreen || previous.length === 0) return;
  const now = performance.now();
  const prevByKey = new Map(previous.map((view) => [viewKey(rt, view), view]));
  let queued = 0;
  for (const view of next) {
    if (view.preview) continue;
    const prev = prevByKey.get(viewKey(rt, view));
    const nextState = viewFxState(view);
    if (!prev) continue;
    const prevState = viewFxState(prev);
    if (!prevState.revealed && nextState.revealed) {
      queueCellEffect(rt, 'reveal', view.row, view.col, now);
      queued += 1;
      if (nextState.isMine) {
        queueCellEffect(rt, 'explode', view.row, view.col, now);
        queued += 1;
      }
    } else if (!prevState.flagged && nextState.flagged) {
      queueCellEffect(rt, 'flag', view.row, view.col, now);
      queued += 1;
    } else if (prevState.flagged && !nextState.flagged) {
      queueCellEffect(rt, 'unflag', view.row, view.col, now);
      queued += 1;
    }
    if (queued >= 24) break;
  }
  if (queued > 0) rt.scheduleAnimationFrame();
}

export function pruneEffects(rt: GameCanvasRuntime, now: number): void {
  for (let i = rt.state.cellEffects.length - 1; i >= 0; i -= 1) {
    const fx = rt.state.cellEffects[i]!;
    if (now - fx.startedAt > fx.durationMs) rt.state.cellEffects.splice(i, 1);
  }
  for (let i = rt.state.particles.length - 1; i >= 0; i -= 1) {
    const fx = rt.state.particles[i]!;
    if (now - fx.startedAt > fx.durationMs) rt.state.particles.splice(i, 1);
  }
}

export function drawMineExplosionVisual(rt: GameCanvasRuntime, 
  effectCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  t: number,
  options?: { forceExplosionSprite?: boolean },
): void {
  const cx = x + cellSize / 2;
  const cy = y + cellSize / 2;
  const useExplosionSprite = options?.forceExplosionSprite || !hasMineHitV3RuntimeAssets(rt);

  if (useExplosionSprite) {
    const blastFade = 1 - Math.max(0, (t - 0.42) / 0.58) ** 2;
    drawFxSpriteFrame(
      effectCtx,
      'mine-explosion',
      t,
      cx,
      cy,
      cellSize * GAME_ASSET_TUNING.fx.mineExplosion.spriteW,
      cellSize * GAME_ASSET_TUNING.fx.mineExplosion.spriteH,
      GAME_ASSET_TUNING.fx.mineExplosion.spriteAlpha * blastFade,
    );
  }

  if (t < 0.42) {
    const flash = getGameCutout('mine-hit-flash');
    if (flash) {
      const flashAlpha = (1 - t / 0.42) * 0.92;
      effectCtx.save();
      effectCtx.globalAlpha = flashAlpha;
      drawGameMineCutout(effectCtx, flash, x, y, cellSize);
      effectCtx.restore();
    }
  }

  const alpha = 1 - t;
  const radius = cellSize * (0.35 + t * 1.15);
  const glow = effectCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  glow.addColorStop(0, `rgba(248, 113, 113, ${0.48 * GAME_ASSET_TUNING.fx.mineExplosion.glowAlpha * alpha})`);
  glow.addColorStop(0.45, `rgba(251, 146, 60, ${0.28 * GAME_ASSET_TUNING.fx.mineExplosion.glowAlpha * alpha})`);
  glow.addColorStop(1, 'rgba(248, 113, 113, 0)');
  effectCtx.fillStyle = glow;
  effectCtx.beginPath();
  effectCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  effectCtx.fill();

  effectCtx.strokeStyle = `rgba(254, 202, 202, ${0.8 * GAME_ASSET_TUNING.fx.mineExplosion.streakAlpha * alpha})`;
  effectCtx.lineWidth = Math.max(1.5, cellSize * 0.05);
  effectCtx.lineCap = 'round';
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10 + t * 0.45;
    const inner = cellSize * (0.22 + t * 0.38);
    const outer = cellSize * (0.38 + t * 0.78);
    effectCtx.beginPath();
    effectCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    effectCtx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    effectCtx.stroke();
  }

  drawMineBurstSmoke(effectCtx, cx, cy, cellSize, t, 0.88);
  drawMineHitV3RuntimeOverlay(rt, effectCtx, cx, cy, x, y, cellSize, t);
}

export function drawCellEffects(rt: GameCanvasRuntime, effectCtx: CanvasRenderingContext2D, now: number): void {
  if (!rt.state.squareLayout || rt.state.cellEffects.length === 0) return;
  const { gridOriginX, gridOriginY, grid } = rt.state.squareLayout;

  effectCtx.save();
  for (const fx of rt.state.cellEffects) {
    if (fx.kind === 'scroll-mine-ghost') continue;
    const age = now - fx.startedAt;
    const t = Math.max(0, Math.min(1, age / fx.durationMs));
    const { x, y } = cellPixelForFx(fx.row, fx.col, gridOriginX, gridOriginY, grid);
    const cx = x + grid.cellSize / 2;
    const cy = y + grid.cellSize / 2;

    if (fx.kind === 'reveal') {
      drawCellRevealTransitionOverlay(effectCtx, x, y, grid, t);
      drawFxSpriteFrame(
        effectCtx,
        'safe-reveal',
        t,
        cx,
        cy,
        grid.cellSize * GAME_ASSET_TUNING.fx.safeReveal.spriteW,
        grid.cellSize * GAME_ASSET_TUNING.fx.safeReveal.spriteH,
        GAME_ASSET_TUNING.fx.safeReveal.spriteAlpha,
      );
    } else if (fx.kind === 'flag') {
      drawFxSpriteFrame(
        effectCtx,
        'flag-pop',
        t,
        cx,
        cy,
        grid.cellSize * GAME_ASSET_TUNING.fx.flagPop.spriteW,
        grid.cellSize * GAME_ASSET_TUNING.fx.flagPop.spriteH,
        GAME_ASSET_TUNING.fx.flagPop.spriteAlpha,
      );
    } else if (fx.kind === 'explode') {
      drawMineExplosionVisual(rt, effectCtx, x, y, grid.cellSize, t);
    }

    if (fx.kind === 'reveal') {
      const alpha = 1 - t;
      const pad = 2 + t * grid.cellSize * 0.18;
      fillRounded(effectCtx,
        x - pad,
        y - pad,
        grid.cellSize + pad * 2,
        grid.cellSize + pad * 2,
        grid.cellRadius + 4,
        `rgba(96, 165, 250, ${0.18 * GAME_ASSET_TUNING.fx.safeReveal.ringAlpha * alpha})`,
      );
      strokeRounded(effectCtx,
        x - pad + 0.5,
        y - pad + 0.5,
        grid.cellSize + pad * 2 - 1,
        grid.cellSize + pad * 2 - 1,
        grid.cellRadius + 4,
        `rgba(147, 197, 253, ${0.65 * GAME_ASSET_TUNING.fx.safeReveal.ringAlpha * alpha})`,
        1.5,
      );
    }

    if (fx.kind === 'flag' || fx.kind === 'unflag') {
      const alpha = 1 - t;
      const radius = grid.cellSize * (0.28 + t * 0.42);
      effectCtx.strokeStyle =
        fx.kind === 'flag'
          ? `rgba(99, 102, 241, ${0.7 * GAME_ASSET_TUNING.fx.flagPop.ringAlpha * alpha})`
          : `rgba(245, 158, 11, ${0.65 * GAME_ASSET_TUNING.fx.flagPop.ringAlpha * alpha})`;
      effectCtx.lineWidth = Math.max(1, grid.cellSize * 0.055);
      effectCtx.beginPath();
      effectCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      effectCtx.stroke();
    }
  }
  effectCtx.restore();

  if (rt.state.cellEffects.length > 0) rt.scheduleAnimationFrame();
}

export function hasMineHitV3RuntimeAssets(_rt: GameCanvasRuntime,): boolean {
  return Boolean(getGameCutout('mine-cracked') ?? getGameCutout('mine-exploded') ?? getGameCutout('mine-hit-flash'));
}

export function drawMineHitV3RuntimeOverlay(
  rt: GameCanvasRuntime,
  effectCtx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  x: number,
  y: number,
  cellSize: number,
  progress: number,
): void {
  const t = Math.max(0, Math.min(1, progress));
  const shock = Math.max(0, Math.min(1, (t - 0.08) / 0.36));
  if (shock > 0 && shock < 1) {
    const alpha = (1 - shock) * 0.78;
    effectCtx.save();
    effectCtx.globalCompositeOperation = 'lighter';
    effectCtx.strokeStyle = `rgba(255, 76, 86, ${alpha})`;
    effectCtx.lineWidth = Math.max(1.5, cellSize * (0.12 - shock * 0.08));
    effectCtx.beginPath();
    effectCtx.arc(cx, cy, cellSize * (0.2 + shock * 0.95), 0, Math.PI * 2);
    effectCtx.stroke();
    effectCtx.restore();
  }

  const burst = Math.max(0, Math.min(1, (t - 0.16) / 0.38));
  if (burst > 0 && burst < 1) {
    const fade = Math.sin(burst * Math.PI);
    effectCtx.save();
    effectCtx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i += 1) {
      const angle = i * (Math.PI * 2 / 12) + burst * 0.45;
      const inner = cellSize * (0.08 + burst * 0.12);
      const outer = cellSize * (0.26 + burst * 0.72) * (i % 2 === 0 ? 1.08 : 0.82);
      const width = cellSize * (0.12 - burst * 0.07);
      const tipX = cx + Math.cos(angle) * outer;
      const tipY = cy + Math.sin(angle) * outer;
      const leftX = cx + Math.cos(angle - 0.55) * inner + Math.cos(angle + Math.PI / 2) * width;
      const leftY = cy + Math.sin(angle - 0.55) * inner + Math.sin(angle + Math.PI / 2) * rt.state.width;
      const rightX = cx + Math.cos(angle + 0.55) * inner + Math.cos(angle - Math.PI / 2) * rt.state.width;
      const rightY = cy + Math.sin(angle + 0.55) * inner + Math.sin(angle - Math.PI / 2) * rt.state.width;
      const flame = effectCtx.createRadialGradient(cx, cy, cellSize * 0.02, tipX, tipY, outer * 0.42);
      flame.addColorStop(0, `rgba(255, 252, 218, ${0.85 * fade})`);
      flame.addColorStop(0.36, `rgba(255, 179, 48, ${0.78 * fade})`);
      flame.addColorStop(0.72, `rgba(255, 65, 40, ${0.48 * fade})`);
      flame.addColorStop(1, 'rgba(255, 65, 40, 0)');
      effectCtx.fillStyle = flame;
      effectCtx.beginPath();
      effectCtx.moveTo(leftX, leftY);
      effectCtx.quadraticCurveTo(cx + Math.cos(angle - 0.18) * cellSize * 0.3, cy + Math.sin(angle - 0.18) * cellSize * 0.3, tipX, tipY);
      effectCtx.quadraticCurveTo(cx + Math.cos(angle + 0.18) * cellSize * 0.24, cy + Math.sin(angle + 0.18) * cellSize * 0.24, rightX, rightY);
      effectCtx.closePath();
      effectCtx.fill();
    }

    const core = effectCtx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * (0.18 + burst * 0.36));
    core.addColorStop(0, `rgba(255, 255, 238, ${0.95 * fade})`);
    core.addColorStop(0.2, `rgba(255, 213, 92, ${0.86 * fade})`);
    core.addColorStop(0.52, `rgba(255, 71, 82, ${0.58 * fade})`);
    core.addColorStop(1, 'rgba(255, 71, 82, 0)');
    effectCtx.fillStyle = core;
    effectCtx.beginPath();
    effectCtx.arc(cx, cy, cellSize * 0.58, 0, Math.PI * 2);
    effectCtx.fill();
    effectCtx.restore();
  }

  const cracked = t > 0.48 ? getGameCutout('mine-cracked') ?? getGameCutout('mine-exploded') : null;
  if (cracked) {
    const alpha = Math.min(1, (t - 0.48) / 0.18) * (1 - Math.max(0, (t - 0.86) / 0.14) * 0.35);
    const pop = t < 0.65 ? 1.08 - (t - 0.48) * 0.28 : 1;
    effectCtx.save();
    effectCtx.globalAlpha = alpha;
    drawGameMineCutout(effectCtx, cracked, x, y, cellSize, GAME_ASSET_TUNING.cutouts.mineScale * pop);
    effectCtx.restore();
  }
}
