import type { CellView, GameStatus } from '../../core/types.ts';
import type { AiHintDisplay } from '../../core/ai/types.ts';
import { FONTS, THEME } from '../theme.ts';
import {
  drawHudIcon,
  drawIconTextButton,
  drawLivesRow,
  parseLivesDisplay,
  type HudIconName,
} from '../hud-sprites.ts';
import {
  getCanvasPointerCoords,
  getBoardOnlyLayoutMetrics,
  applyBoardPreviewBand,
  getLayoutMetrics,
  getBoardSideRailLayout,
  createBoardSideRailGradient,
  hitTestCellWithPreview,
  hitTestReset,
  renderBoardOnlyFrame,
  renderFrame,
  type LayoutMetrics,
  type ScrollPressureState,
} from '../renderer/index.ts';
import {
  GAME_ASSET_TUNING,
  drawImageContained,
  getGameFxBlendMode,
  getGameFxFrames,
  getGameUiPanel,
  type GameFxName,
  type GameUiPanelName,
} from '../game-assets.ts';
import {
  computeEndlessBoardCellSize,
  computeGameStageLayout,
  getBottomFeedbackSlots as resolveBottomFeedbackSlots,
  type GameStageLayout,
} from '../game-stage-layout.ts';
import {
  applyCanvasSize,
  type GameCanvasCallbacks,
  type GameCanvasController,
  type GameCanvasFullscreenOptions,
  type GameCanvasHudStats,
  type GameCanvasLogLine,
  type GameCanvasOptions,
} from './types.ts';

export type {
  GameCanvasCallbacks,
  GameCanvasController,
  GameCanvasFullscreenOptions,
  GameCanvasHudStats,
  GameCanvasLogLine,
  GameCanvasOptions,
  GameCanvasRenderOptions,
  ViewportFitOptions,
} from './types.ts';

export function createGameCanvas(
  container: HTMLElement,
  rows: number,
  cols: number,
  mineTotal: number,
  callbacks: GameCanvasCallbacks,
  canvasOptions: GameCanvasOptions = {},
): GameCanvasController {
  const fixedCellSize = canvasOptions.fixedCellSize;
  const fixedGridRows = canvasOptions.fixedGridRows;
  const fitViewport = canvasOptions.fitViewport;
  const getScrollPressureFn = canvasOptions.getScrollPressure;
  const fullscreen = canvasOptions.fullscreen;
  const endlessPreviewRows = canvasOptions.endlessPreviewRows ?? 0;
  let currentRows = fixedGridRows ?? rows;
  let currentCols = cols;
  let fittedCellSize: number | undefined = fixedCellSize;

  function fitCellSizeForViewport(viewportW?: number, viewportH?: number): number {
    const gridRows = (fitViewport?.rows ?? currentRows) + currentPreviewRows;
    const gridCols = fitViewport?.cols ?? currentCols;
    const vw =
      viewportW ??
      (fullscreen ? Math.max(320, window.innerWidth) : width);
    const vh =
      viewportH ??
      (fullscreen ? Math.max(480, window.innerHeight) : height);
    return computeEndlessBoardCellSize(gridCols, gridRows, vw, vh, {
      min: fitViewport?.minCellSize ?? 18,
      max: fitViewport?.maxCellSize ?? 36,
    });
  }

  function resolveInitialCellSize(): number | undefined {
    if (fixedCellSize !== undefined) return fixedCellSize;
    if (!fitViewport || !fullscreen) return undefined;
    return fitCellSizeForViewport(
      Math.max(320, window.innerWidth),
      Math.max(480, window.innerHeight),
    );
  }

  let currentPreviewRows = 0;

  fittedCellSize = resolveInitialCellSize();

  function boardBaseLayout(nextRows: number, nextCols: number): LayoutMetrics {
    return fullscreen
      ? getBoardOnlyLayoutMetrics(nextRows, nextCols, canvasOptions.maxGrid, fittedCellSize)
      : getLayoutMetrics(nextRows, nextCols, canvasOptions.maxGrid, fixedCellSize);
  }

  function withPreviewBand(layout: LayoutMetrics, previewRows: number): LayoutMetrics {
    return fullscreen && previewRows > 0
      ? applyBoardPreviewBand(layout, previewRows)
      : layout;
  }

  function applySquareLayout(nextRows: number, nextCols: number, previewRows = currentPreviewRows): void {
    squareLayout = withPreviewBand(boardBaseLayout(nextRows, nextCols), previewRows);
    boardWidth = squareLayout.width;
    boardHeight = squareLayout.height;
  }

  function syncPreviewLayout(previewRows: number): void {
    if (!squareLayout) return;
    const capped =
      endlessPreviewRows > 0 ? Math.min(previewRows, endlessPreviewRows) : previewRows;
    if (capped === currentPreviewRows) return;
    currentPreviewRows = capped;
    applySquareLayout(currentRows, currentCols, currentPreviewRows);
  }

  let squareLayout: LayoutMetrics | null = withPreviewBand(
    boardBaseLayout(currentRows, cols),
    currentPreviewRows,
  );

  const canvas = document.createElement('canvas');
  canvas.className = fullscreen ? 'game-canvas game-canvas--fullscreen' : 'game-canvas';
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', '扫雷棋盘');
  container.appendChild(canvas);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context not available');
  }
  const ctx = context;

  let boardWidth = squareLayout!.width;
  let boardHeight = squareLayout!.height;
  let width = fullscreen ? window.innerWidth : boardWidth;
  let height = fullscreen ? window.innerHeight : boardHeight;
  let boardOffsetX = 0;
  let boardOffsetY = 0;
  let stageLayout: GameStageLayout | null = null;
  let spaceKeyRect: { x: number; y: number; w: number; h: number } | null = null;
  let startRect: { x: number; y: number; w: number; h: number } | null = null;
  let retryRect: { x: number; y: number; w: number; h: number } | null = null;
  let devAutoRect: { x: number; y: number; w: number; h: number } | null = null;
  applyCanvasSize(canvas, ctx, width, height);

  let elapsed = 0;
  let timerId: number | null = null;
  let pressureRepaintId: number | null = null;
  let currentViews: CellView[] = [];
  let currentStatus: GameStatus = 'idle';
  let currentFlagCount = 0;
  let currentHudLeftDisplay: string | undefined;
  let currentHudRightDisplay: string | undefined;
  let currentAiHint: AiHintDisplay | null | undefined;
  let lastCombo = 0;
  let comboFxStartedAt = 0;
  let lastScoreEventId = 0;
  let scoreFxStartedAt = 0;
  let activeScoreEvent: GameCanvasHudStats['scoreEvent'] | null = null;
  let lastBreakEventId = 0;
  let breakFxStartedAt = 0;
  let activeBreakEvent: GameCanvasHudStats['breakEvent'] | null = null;
  let animationFrameId: number | null = null;

  type CellFxKind = 'reveal' | 'flag' | 'unflag' | 'explode';
  interface CellFx {
    kind: CellFxKind;
    row: number;
    col: number;
    startedAt: number;
    durationMs: number;
  }

  interface ParticleFx {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    startedAt: number;
    durationMs: number;
  }

  const cellEffects: CellFx[] = [];
  const particles: ParticleFx[] = [];

  function syncFullscreenCanvasSize(): void {
    if (!fullscreen) return;
    const nextWidth = Math.max(320, window.innerWidth);
    const nextHeight = Math.max(480, window.innerHeight);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    applyCanvasSize(canvas, ctx, width, height);
  }

  function syncSquareLayout(nextRows: number, nextCols: number): void {
    if (!squareLayout || fixedGridRows !== undefined) return;
    applySquareLayout(nextRows, nextCols, currentPreviewRows);
    if (!fullscreen) {
      width = boardWidth;
      height = boardHeight;
      applyCanvasSize(canvas, ctx, width, height);
    }
  }

  function syncViewportFitLayout(): void {
    if (!fitViewport || !squareLayout) return;
    const nextCell = fitCellSizeForViewport(width, height);
    if (nextCell === fittedCellSize) return;
    fittedCellSize = nextCell;
    applySquareLayout(fitViewport.rows, fitViewport.cols, currentPreviewRows);
  }

  function syncBoardSizeFromLayout(): void {
    if (fullscreen && fitViewport) syncViewportFitLayout();
    boardWidth = squareLayout!.width;
    boardHeight = squareLayout!.height;
    if (fullscreen) {
      stageLayout = computeGameStageLayout(width, height, boardWidth, boardHeight);
      boardOffsetX = stageLayout.boardX;
      boardOffsetY = stageLayout.boardY;
    }
  }

  function stopPressureRepaint(): void {
    if (pressureRepaintId !== null) {
      window.clearInterval(pressureRepaintId);
      pressureRepaintId = null;
    }
  }

  function syncPressureRepaint(): void {
    if (!getScrollPressureFn || currentStatus !== 'playing' || !getScrollPressureFn()) {
      stopPressureRepaint();
      return;
    }
    if (pressureRepaintId !== null) return;
    pressureRepaintId = window.setInterval(() => {
      if (!getScrollPressureFn?.() || currentStatus !== 'playing') {
        stopPressureRepaint();
        return;
      }
      paint();
    }, 100);
  }

  function scheduleAnimationFrame(): void {
    if (animationFrameId !== null) return;
    animationFrameId = window.requestAnimationFrame(() => {
      animationFrameId = null;
      paint();
    });
  }

  function viewKey(view: CellView): string {
    return view.fxKey ?? `${view.row},${view.col}`;
  }

  function viewFxState(view: CellView): { revealed: boolean; flagged: boolean; isMine: boolean | null } {
    return { revealed: view.revealed, flagged: view.flagged, isMine: view.isMine };
  }

  function queueCellEffect(kind: CellFxKind, row: number, col: number, now: number): void {
    const durationMs =
      kind === 'explode'
        ? GAME_ASSET_TUNING.fx.mineExplosion.durationMs
        : kind === 'flag' || kind === 'unflag'
          ? GAME_ASSET_TUNING.fx.flagPop.durationMs
          : GAME_ASSET_TUNING.fx.safeReveal.durationMs;
    cellEffects.push({ kind, row, col, startedAt: now, durationMs });
    while (cellEffects.length > 48) {
      cellEffects.shift();
    }
  }

  function collectCellEffects(previous: CellView[], next: CellView[]): void {
    if (!fullscreen || previous.length === 0) return;
    const now = performance.now();
    const prevByKey = new Map(previous.map((view) => [viewKey(view), view]));
    let queued = 0;
    for (const view of next) {
      if (view.preview) continue;
      const prev = prevByKey.get(viewKey(view));
      const nextState = viewFxState(view);
      if (!prev) continue;
      const prevState = viewFxState(prev);
      if (!prevState.revealed && nextState.revealed) {
        queueCellEffect('reveal', view.row, view.col, now);
        queued += 1;
        if (nextState.isMine) {
          queueCellEffect('explode', view.row, view.col, now);
          queued += 1;
        }
      } else if (!prevState.flagged && nextState.flagged) {
        queueCellEffect('flag', view.row, view.col, now);
        queued += 1;
      } else if (prevState.flagged && !nextState.flagged) {
        queueCellEffect('unflag', view.row, view.col, now);
        queued += 1;
      }
      if (queued >= 24) break;
    }
    if (queued > 0) scheduleAnimationFrame();
  }

  function pruneEffects(now: number): void {
    for (let i = cellEffects.length - 1; i >= 0; i -= 1) {
      const fx = cellEffects[i]!;
      if (now - fx.startedAt > fx.durationMs) cellEffects.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const fx = particles[i]!;
      if (now - fx.startedAt > fx.durationMs) particles.splice(i, 1);
    }
  }

  function drawCellEffects(effectCtx: CanvasRenderingContext2D, now: number): void {
    if (!squareLayout || cellEffects.length === 0) return;
    const { gridOriginX, gridOriginY, grid } = squareLayout;

    effectCtx.save();
    for (const fx of cellEffects) {
      const age = now - fx.startedAt;
      const t = Math.max(0, Math.min(1, age / fx.durationMs));
      const { x, y } = cellPixelForFx(fx.row, fx.col, gridOriginX, gridOriginY, grid);
      const cx = x + grid.cellSize / 2;
      const cy = y + grid.cellSize / 2;

      if (fx.kind === 'reveal') {
        drawFxFrame(
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
        drawFxFrame(
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
        drawFxFrame(
          effectCtx,
          'mine-explosion',
          t,
          cx,
          cy,
          grid.cellSize * GAME_ASSET_TUNING.fx.mineExplosion.spriteW,
          grid.cellSize * GAME_ASSET_TUNING.fx.mineExplosion.spriteH,
          GAME_ASSET_TUNING.fx.mineExplosion.spriteAlpha,
        );
      }

      if (fx.kind === 'reveal') {
        const alpha = 1 - t;
        const pad = 2 + t * grid.cellSize * 0.18;
        fillRounded(
          x - pad,
          y - pad,
          grid.cellSize + pad * 2,
          grid.cellSize + pad * 2,
          grid.cellRadius + 4,
          `rgba(96, 165, 250, ${0.18 * GAME_ASSET_TUNING.fx.safeReveal.ringAlpha * alpha})`,
        );
        strokeRounded(
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

      if (fx.kind === 'explode') {
        const alpha = 1 - t;
        const radius = grid.cellSize * (0.35 + t * 1.15);
        const glow = effectCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        glow.addColorStop(0, `rgba(248, 113, 113, ${0.48 * GAME_ASSET_TUNING.fx.mineExplosion.glowAlpha * alpha})`);
        glow.addColorStop(0.45, `rgba(251, 146, 60, ${0.28 * GAME_ASSET_TUNING.fx.mineExplosion.glowAlpha * alpha})`);
        glow.addColorStop(1, 'rgba(248, 113, 113, 0)');
        effectCtx.fillStyle = glow;
        effectCtx.beginPath();
        effectCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        effectCtx.fill();

        effectCtx.strokeStyle = `rgba(254, 202, 202, ${0.8 * GAME_ASSET_TUNING.fx.mineExplosion.streakAlpha * alpha})`;
        effectCtx.lineWidth = Math.max(1.5, grid.cellSize * 0.05);
        effectCtx.lineCap = 'round';
        for (let i = 0; i < 10; i += 1) {
          const angle = (Math.PI * 2 * i) / 10 + t * 0.45;
          const inner = grid.cellSize * (0.22 + t * 0.38);
          const outer = grid.cellSize * (0.38 + t * 0.78);
          effectCtx.beginPath();
          effectCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
          effectCtx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
          effectCtx.stroke();
        }
      }
    }
    effectCtx.restore();

    if (cellEffects.length > 0) scheduleAnimationFrame();
  }

  function drawFxFrame(
    fxCtx: CanvasRenderingContext2D,
    name: GameFxName,
    t: number,
    cx: number,
    cy: number,
    w: number,
    h: number,
    alphaScale = 1,
  ): boolean {
    const frames = getGameFxFrames(name);
    if (!frames || frames.length === 0) return false;
    const index = Math.min(frames.length - 1, Math.floor(t * frames.length));
    const frame = frames[index];
    if (!frame) return false;

    fxCtx.save();
    fxCtx.globalCompositeOperation = getGameFxBlendMode(name);
    fxCtx.globalAlpha = alphaScale * Math.max(0, Math.min(1, 1 - Math.max(0, t - 0.72) / 0.28));
    drawImageContained(fxCtx, frame, cx - w / 2, cy - h / 2, w, h, 1);
    fxCtx.restore();
    return true;
  }

  function cellPixelForFx(
    row: number,
    col: number,
    gridOriginX: number,
    gridOriginY: number,
    grid: LayoutMetrics['grid'],
  ): { x: number; y: number } {
    return {
      x: gridOriginX + col * grid.cellStep,
      y: gridOriginY + row * grid.cellStep,
    };
  }

  /** 消雷连击反馈锚点：底行离屏区（与卷轴触发带对齐） */
  function getComboFeedbackAnchor(): { x: number; y: number } {
    return getBottomFeedbackSlots().comboBurst;
  }

  function getBottomFeedbackSlots(): { comboBurst: { x: number; y: number }; scorePop: { x: number; y: number } } {
    const layout =
      stageLayout && squareLayout
        ? {
            scale: stageLayout.scale,
            boardOffsetY: boardOffsetY,
            gridOriginY: squareLayout.gridOriginY,
            cellStep: squareLayout.grid.cellStep,
            cellSize: squareLayout.grid.cellSize,
            visibleRows: currentRows,
            bottomRailY: stageLayout.bottomRailRect.y,
          }
        : null;
    return resolveBottomFeedbackSlots(width, height, layout);
  }

  function spawnComboParticles(combo: number): void {
    const now = performance.now();
    const palette = comboColor(combo);
    const count = Math.max(6, Math.round(Math.min(42, 14 + Math.floor(combo / 2)) * GAME_ASSET_TUNING.fx.comboBurst.particleScale));
    const { x: originX, y: originY } = getComboFeedbackAnchor();

    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45;
      const speed = 1.4 + Math.random() * 3.1 + Math.min(3, combo / 24);
      particles.push({
        x: originX + (Math.random() - 0.5) * 80,
        y: originY + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.6,
        size: (2.2 + Math.random() * 3.8) * GAME_ASSET_TUNING.fx.comboBurst.particleScale,
        color: palette.stroke,
        startedAt: now,
        durationMs: GAME_ASSET_TUNING.fx.comboBurst.durationMs + Math.random() * 260,
      });
    }
    while (particles.length > 120) {
      particles.shift();
    }
    scheduleAnimationFrame();
  }

  function drawParticles(particleCtx: CanvasRenderingContext2D, now: number): void {
    if (particles.length === 0) return;
    particleCtx.save();
    for (const fx of particles) {
      const t = Math.max(0, Math.min(1, (now - fx.startedAt) / fx.durationMs));
      const alpha = 1 - t;
      const gravity = 2.2 * t * t;
      const x = fx.x + fx.vx * t * 42;
      const y = fx.y + fx.vy * t * 42 + gravity * 16;
      particleCtx.globalAlpha = alpha;
      particleCtx.fillStyle = fx.color;
      particleCtx.beginPath();
      particleCtx.arc(x, y, fx.size * (1 - t * 0.35), 0, Math.PI * 2);
      particleCtx.fill();
    }
    particleCtx.restore();
    if (particles.length > 0) scheduleAnimationFrame();
  }

  function paint(): void {
    syncFullscreenCanvasSize();
    syncBoardSizeFromLayout();
    const now = performance.now();
    pruneEffects(now);
    const scrollPressure = getScrollPressureFn?.();
    const renderState = {
      views: currentViews,
      status: currentStatus,
      mineTotal,
      flagCount: currentFlagCount,
      elapsedSeconds: elapsed,
      scrollPressure,
      aiHint: currentAiHint,
      previewRows: currentPreviewRows > 0 ? currentPreviewRows : undefined,
      ...(fullscreen
        ? {}
        : {
            hudLeftDisplay: currentHudLeftDisplay,
            hudRightDisplay: currentHudRightDisplay,
          }),
    };

    if (fullscreen) {
      spaceKeyRect = null;
      startRect = null;
      retryRect = null;
      devAutoRect = null;
      ctx.clearRect(0, 0, width, height);
      drawModernBackground(ctx, width, height);
      ctx.save();
      ctx.translate(boardOffsetX, boardOffsetY);
    }

    if (fullscreen) {
      renderBoardOnlyFrame(ctx, squareLayout!, {
        ...renderState,
        rows: currentRows,
        cols: currentCols,
      });
    } else {
      renderFrame(ctx, squareLayout!, {
        ...renderState,
        rows: currentRows,
        cols: currentCols,
      });
    }

    drawCellEffects(ctx, now);

    if (fullscreen) {
      ctx.restore();
      drawFullscreenOverlay(ctx, fullscreen, width, height);
      drawFullscreenHud(ctx, fullscreen, width, height);
    }
    syncPressureRepaint();
  }

  function roundedPath(x: number, y: number, w: number, h: number, r: number): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function fillRounded(x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient): void {
    roundedPath(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRounded(x: number, y: number, w: number, h: number, r: number, stroke: string, lineWidth = 1): void {
    roundedPath(x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function drawArcadeGlow(
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
    roundedPath(x, y, w, h, Math.min(14, h / 3));
    shellCtx.stroke();
    shellCtx.restore();
  }

  function drawUiPanelImage(
    shellCtx: CanvasRenderingContext2D,
    name: GameUiPanelName,
    x: number,
    y: number,
    w: number,
    h: number,
    scale = 1,
  ): boolean {
    const img = getGameUiPanel(name);
    if (!img) return false;
    drawImageContained(shellCtx, img, x, y, w, h, scale);
    return true;
  }

  function drawArcadePanel(
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
    fillRounded(x, y, w, h, 12, fill);
    strokeRounded(x + 0.5, y + 0.5, w - 1, h - 1, 12, color, 1.5);
    shellCtx.globalAlpha = 0.36;
    strokeRounded(x + 8, y + 8, w - 16, h - 16, 8, color, 1);
    shellCtx.restore();
  }

  function comboHudColor(combo: number): string {
    if (combo >= 50) return '#c4b5fd';
    if (combo >= 20) return '#fb923c';
    if (combo >= 10) return '#facc15';
    if (combo >= 5) return '#4ade80';
    return '#93c5fd';
  }

  function comboHudGlow(combo: number, alpha: number): string {
    if (combo >= 50) return `rgba(196, 181, 253, ${alpha})`;
    if (combo >= 20) return `rgba(251, 146, 60, ${alpha})`;
    if (combo >= 10) return `rgba(250, 204, 21, ${alpha})`;
    if (combo >= 5) return `rgba(74, 222, 128, ${alpha})`;
    return `rgba(147, 197, 253, ${alpha})`;
  }

  function drawScoreHud(
    shellCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    score: number,
    scale: number,
  ): void {
    shellCtx.save();
    shellCtx.textAlign = 'left';
    shellCtx.textBaseline = 'top';
    shellCtx.fillStyle = THEME.hudMuted;
    shellCtx.font = `700 ${9 * scale}px ${FONTS.display}`;
    shellCtx.fillText('SCORE', x, y);

    shellCtx.shadowColor = 'rgba(59, 130, 246, 0.42)';
    shellCtx.shadowBlur = 9 * scale;
    shellCtx.fillStyle = THEME.hudText;
    shellCtx.font = `800 ${22 * scale}px ${FONTS.mono}`;
    shellCtx.fillText(String(score).padStart(5, '0'), x, y + 15 * scale);
    shellCtx.restore();
  }

  function drawComboHud(
    shellCtx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    combo: number,
    scale: number,
  ): void {
    if (combo <= 1) return;
    const displayCombo = combo;
    const color = comboHudColor(displayCombo);
    const pulse = 0.5 + Math.sin(Date.now() / 140) * 0.5;
    const glowAlpha = 0.28 + Math.min(0.3, displayCombo * 0.012) + pulse * 0.1;
    const text = `x${displayCombo}`;
    const label = 'COMBO';

    shellCtx.save();
    shellCtx.textAlign = 'center';
    shellCtx.textBaseline = 'top';
    shellCtx.shadowColor = color;
    shellCtx.shadowBlur = 14 * scale;

    const glow = shellCtx.createRadialGradient(cx, y + 25 * scale, 2 * scale, cx, y + 25 * scale, 64 * scale);
    glow.addColorStop(0, comboHudGlow(displayCombo, glowAlpha));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.fillStyle = glow;
    shellCtx.fillRect(cx - 76 * scale, y - 4 * scale, 152 * scale, 58 * scale);

    shellCtx.fillStyle = color;
    shellCtx.font = `900 ${10 * scale}px ${FONTS.display}`;
    shellCtx.globalAlpha = 0.9;
    shellCtx.fillText(label, cx, y);

    shellCtx.globalAlpha = 1;
    shellCtx.font = `900 ${28 * scale}px ${FONTS.mono}`;
    shellCtx.lineWidth = Math.max(2, 3 * scale);
    shellCtx.strokeStyle = 'rgba(2, 6, 23, 0.88)';
    shellCtx.strokeText(text, cx, y + 14 * scale);
    shellCtx.fillStyle = color;
    shellCtx.fillText(text, cx, y + 14 * scale);

    const underlineW = Math.min(96 * scale, 32 * scale + String(displayCombo).length * 15 * scale);
    const lineY = y + 48 * scale;
    const gradient = shellCtx.createLinearGradient(cx - underlineW / 2, lineY, cx + underlineW / 2, lineY);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.shadowBlur = 0;
    shellCtx.fillStyle = gradient;
    shellCtx.fillRect(cx - underlineW / 2, lineY, underlineW, Math.max(1.5, 2 * scale));
    shellCtx.restore();
  }

  function drawLivesHud(shellCtx: CanvasRenderingContext2D, x: number, y: number, raw: string | undefined, scale: number): void {
    const lives = parseLivesDisplay(raw);
    if (!lives) return;
    const iconSize = Math.max(15, Math.min(20, 18 * scale));
    const gap = 3 * scale;
    const rowW = lives.max * iconSize + (lives.max - 1) * gap;
    shellCtx.save();
    shellCtx.shadowColor = 'rgba(239, 68, 68, 0.36)';
    shellCtx.shadowBlur = 8 * scale;
    if (!drawLivesRow(shellCtx, x - rowW, y + 28 * scale, lives, iconSize, gap)) {
      shellCtx.fillStyle = '#ef4444';
      shellCtx.font = `700 ${16 * scale}px ${FONTS.mono}`;
      shellCtx.textAlign = 'right';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText(raw ?? '', x, y + 28 * scale);
    }
    shellCtx.restore();
  }

  function drawSpaceHint(
    shellCtx: CanvasRenderingContext2D,
    rect: { x: number; y: number; w: number; h: number },
    pressure: ScrollPressureState | undefined,
    scale: number,
  ): void {
    const pulse = 0.5 + Math.sin(Date.now() / 170) * 0.5;
    const urgent = Boolean(pressure?.urgent);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const alpha = urgent ? 0.62 + pulse * 0.34 : 0.42 + pulse * 0.28;
    const color = urgent ? '#fef08a' : '#dbeafe';
    const glow = urgent ? 'rgba(250, 204, 21, 0.55)' : 'rgba(96, 165, 250, 0.42)';
    const rail = urgent
      ? `rgba(250, 204, 21, ${0.28 + pulse * 0.35})`
      : `rgba(96, 165, 250, ${0.18 + pulse * 0.26})`;
    const railW = Math.max(9 * scale, rect.w * 0.24);
    const railGap = Math.max(18 * scale, rect.w * 0.42);

    shellCtx.save();
    shellCtx.globalAlpha = alpha;
    shellCtx.shadowColor = glow;
    shellCtx.shadowBlur = ((urgent ? 12 : 8) + pulse * 4) * scale;
    shellCtx.strokeStyle = rail;
    shellCtx.lineWidth = Math.max(1, 1.2 * scale);
    shellCtx.lineCap = 'round';
    shellCtx.beginPath();
    shellCtx.moveTo(cx - railGap - railW, cy + 7 * scale);
    shellCtx.lineTo(cx - railGap, cy + 7 * scale);
    shellCtx.moveTo(cx + railGap, cy + 7 * scale);
    shellCtx.lineTo(cx + railGap + railW, cy + 7 * scale);
    shellCtx.stroke();

    shellCtx.fillStyle = color;
    shellCtx.font = `900 ${Math.max(9, 10 * scale)}px ${FONTS.display}`;
    shellCtx.textAlign = 'center';
    shellCtx.textBaseline = 'middle';
    shellCtx.fillText('SPACE', cx, cy);
    shellCtx.restore();

    if (currentStatus === 'playing') scheduleAnimationFrame();
  }

  function drawBottomEnergyRail(
    shellCtx: CanvasRenderingContext2D,
    pressure: ScrollPressureState | undefined,
    shellW: number,
    _shellH: number,
  ): void {
    if (!stageLayout) return;
    const scale = stageLayout.scale;
    const rail = stageLayout.bottomRailRect;
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

    if (currentStatus === 'playing') scheduleAnimationFrame();
  }

  function getSpaceHintRect(pressure: ScrollPressureState | undefined): { x: number; y: number; w: number; h: number } | null {
    if (!stageLayout || !squareLayout) return null;
    const scale = stageLayout.scale;
    const hintW = (stageLayout.viewportW < 560 ? 52 : 60) * scale;
    const hintH = (stageLayout.viewportW < 560 ? 16 : 18) * scale;
    const coveredRows = Math.max(1, Math.min(currentRows, Math.floor(pressure?.batchRows ?? 1)));
    const dangerTop =
      boardOffsetY +
      squareLayout.gridOriginY +
      (currentRows - coveredRows) * squareLayout.grid.cellStep -
      2;
    const preferredY = pressure
      ? dangerTop - hintH - 4 * scale
      : boardOffsetY + boardHeight - hintH - 18 * scale;
    const minY = boardOffsetY + squareLayout.gridOriginY + 4 * scale;
    return {
      x: boardOffsetX + boardWidth / 2 - hintW / 2,
      y: Math.max(minY, preferredY),
      w: hintW,
      h: hintH,
    };
  }

  function drawDevAutoButton(
    shellCtx: CanvasRenderingContext2D,
    rect: { x: number; y: number; w: number; h: number },
    active: boolean,
    scale: number,
  ): void {
    drawArcadePanel(
      shellCtx,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      active ? 'rgba(74, 222, 128, 0.68)' : 'rgba(148, 163, 184, 0.34)',
      active ? 'rgba(7, 25, 18, 0.82)' : 'rgba(18, 20, 28, 0.68)',
    );
    shellCtx.fillStyle = active ? '#86efac' : '#cbd5e1';
    shellCtx.font = `800 ${18 * scale}px ${FONTS.display}`;
    shellCtx.textAlign = 'center';
    shellCtx.textBaseline = 'middle';
    shellCtx.fillText('AI', rect.x + rect.w / 2, rect.y + rect.h / 2 + 1 * scale);
    shellCtx.fillStyle = active ? '#22c55e' : '#64748b';
    shellCtx.beginPath();
    shellCtx.arc(rect.x + rect.w - 13 * scale, rect.y + 13 * scale, 3 * scale, 0, Math.PI * 2);
    shellCtx.fill();
  }

  function drawModernBackground(
    shellCtx: CanvasRenderingContext2D,
    shellW: number,
    shellH: number,
  ): void {
    const bg = shellCtx.createLinearGradient(0, 0, 0, shellH);
    bg.addColorStop(0, '#0b0d16');
    bg.addColorStop(0.55, '#090a12');
    bg.addColorStop(1, '#05060b');
    shellCtx.fillStyle = bg;
    shellCtx.fillRect(0, 0, shellW, shellH);

    shellCtx.save();
    shellCtx.globalAlpha = 0.22;
    shellCtx.strokeStyle = '#1f2a44';
    shellCtx.lineWidth = 1;
    const step = 48;
    for (let x = (shellW % step) - step; x <= shellW; x += step) {
      shellCtx.beginPath();
      shellCtx.moveTo(x, 0);
      shellCtx.lineTo(x, shellH);
      shellCtx.stroke();
    }
    for (let y = (shellH % step) - step; y <= shellH; y += step) {
      shellCtx.beginPath();
      shellCtx.moveTo(0, y);
      shellCtx.lineTo(shellW, y);
      shellCtx.stroke();
    }
    shellCtx.globalAlpha = 0.08;
    shellCtx.fillStyle = '#ffffff';
    for (let y = 0; y < shellH; y += 4) {
      shellCtx.fillRect(0, y, shellW, 1);
    }
    shellCtx.restore();

    const vignette = shellCtx.createLinearGradient(0, 0, shellW, 0);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    vignette.addColorStop(0.18, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.82, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    shellCtx.fillStyle = vignette;
    shellCtx.fillRect(0, 0, shellW, shellH);
  }

  function drawFullscreenHud(
    shellCtx: CanvasRenderingContext2D,
    shell: GameCanvasFullscreenOptions,
    shellW: number,
    _shellH: number,
  ): void {
    if (!stageLayout) return;
    const stats = shell.getStats?.();
    const stage = stageLayout;
    const { scale } = stage;
    const topBarH = stage.hudH;

    // 顶栏全宽贴顶
    const barX = 0;
    const barY = stage.hudY;
    const barW = shellW;
    const topLine = shellCtx.createLinearGradient(barX, barY, barX + barW, barY);
    topLine.addColorStop(0, 'rgba(59, 130, 246, 0)');
    topLine.addColorStop(0.18, 'rgba(59, 130, 246, 0.36)');
    topLine.addColorStop(0.82, 'rgba(59, 130, 246, 0.36)');
    topLine.addColorStop(1, 'rgba(59, 130, 246, 0)');
    shellCtx.fillStyle = topLine;
    shellCtx.fillRect(barX, barY + topBarH + 2 * scale, barW, Math.max(1, scale));

    const livesRaw = stats?.lives;
    const hudY = barY + 7 * scale;
    drawScoreHud(shellCtx, stage.scoreAnchor.x, hudY, stats?.score ?? 0, scale);
    drawComboHud(shellCtx, stage.countdownAnchor.x, hudY, stats?.combo ?? 0, scale);
    drawLivesHud(shellCtx, stage.livesAnchor.x, hudY, livesRaw, scale);

    spaceKeyRect = null;

    if (stats?.devAutoVisible) {
      const { x: autoX, y: autoY, w: autoW, h: autoH } = stage.autoRect;
      devAutoRect = { x: autoX, y: autoY, w: autoW, h: autoH };
      const active = Boolean(stats.devAutoActive);
      drawDevAutoButton(shellCtx, devAutoRect, active, scale);
    }
  }

  function comboColor(combo: number): { fill: string; stroke: string; glow: string; text: string } {
    if (combo >= 50) {
      return {
        fill: 'rgba(99, 102, 241, 0.92)',
        stroke: 'rgba(129, 140, 248, 0.6)',
        glow: 'rgba(99, 102, 241, 0.25)',
        text: '#ffffff',
      };
    }
    if (combo >= 20) {
      return {
        fill: 'rgba(245, 158, 11, 0.92)',
        stroke: 'rgba(251, 191, 36, 0.5)',
        glow: 'rgba(245, 158, 11, 0.2)',
        text: '#ffffff',
      };
    }
    if (combo >= 10) {
      return {
        fill: 'rgba(34, 197, 94, 0.88)',
        stroke: 'rgba(74, 222, 128, 0.45)',
        glow: 'rgba(34, 197, 94, 0.18)',
        text: '#ffffff',
      };
    }
    return {
      fill: 'rgba(39, 39, 42, 0.92)',
      stroke: THEME.panelBorder,
      glow: 'rgba(99, 102, 241, 0.12)',
      text: THEME.hudText,
    };
  }

  function logIcon(kind: GameCanvasLogLine['kind']): HudIconName {
    if (kind === 'danger') return 'warning';
    if (kind === 'ai') return 'wand';
    if (kind === 'player') return 'flag';
    if (kind === 'scroll') return 'timer';
    return 'info';
  }

  function logColor(kind: GameCanvasLogLine['kind']): string {
    if (kind === 'danger') return THEME.danger;
    if (kind === 'ai') return THEME.accent;
    if (kind === 'player') return THEME.success;
    if (kind === 'scroll') return THEME.warning;
    return THEME.hudMuted;
  }

  function drawFullscreenScrollWarning(
    shellCtx: CanvasRenderingContext2D,
    pressure: ScrollPressureState | undefined,
    shellW: number,
    shellH: number,
  ): void {
    if (!pressure || currentStatus !== 'playing') return;

    const urgentPulse = pressure.urgent ? 0.5 + Math.sin(Date.now() / 90) * 0.5 : 0;
    const alpha = pressure.urgent
      ? 0.12 + urgentPulse * 0.1
      : Math.max(0, pressure.progress - 0.55) * 0.12;
    if (alpha > 0) {
      shellCtx.save();
      const top = shellCtx.createLinearGradient(0, 0, 0, shellH);
      top.addColorStop(0, `rgba(239, 68, 68, ${alpha * 0.25})`);
      top.addColorStop(0.7, 'rgba(239, 68, 68, 0)');
      top.addColorStop(1, `rgba(239, 68, 68, ${alpha})`);
      shellCtx.fillStyle = top;
      shellCtx.fillRect(0, 0, shellW, shellH);
      shellCtx.restore();
    }

    if (pressure.urgent) scheduleAnimationFrame();
  }

  function drawScoreEvent(
    shellCtx: CanvasRenderingContext2D,
    event: GameCanvasHudStats['scoreEvent'] | null,
    startedAt: number,
    _shellW: number,
  ): void {
    if (!event || startedAt <= 0) return;
    const durationMs = GAME_ASSET_TUNING.fx.scorePop.durationMs;
    const t = Math.min(1, (performance.now() - startedAt) / durationMs);
    if (t >= 1) {
      activeScoreEvent = null;
      scoreFxStartedAt = 0;
      return;
    }
    const alpha = Math.max(0, 1 - t);
    const stageScale = stageLayout?.scale ?? 1;
    const pop = 1 + Math.sin(Math.min(1, t * 2.2) * Math.PI) * 0.12;
    const anchor = getBottomFeedbackSlots().scorePop;
    const x = anchor.x;
    const y = anchor.y - t * 36 * stageScale;
    const palette = comboColor(event.comboAfter);

    shellCtx.save();
    shellCtx.globalAlpha = alpha;
    shellCtx.translate(x, y);
    shellCtx.scale(pop, pop);
    drawFxFrame(shellCtx, 'score-pop', t, 0, 0, 132 * stageScale, 56 * stageScale, GAME_ASSET_TUNING.fx.scorePop.spriteAlpha);
    shellCtx.textAlign = 'center';
    shellCtx.textBaseline = 'middle';
    shellCtx.shadowColor = palette.stroke;
    shellCtx.shadowBlur = 10 * stageScale;
    shellCtx.font = `900 ${22 * stageScale}px ${FONTS.mono}`;
    shellCtx.fillStyle = event.comboAfter >= 10 ? '#fef08a' : '#dbeafe';
    shellCtx.fillText(`+${event.scoreAdded}`, 0, 0);
    shellCtx.restore();

    if (t < 1) scheduleAnimationFrame();
  }

  function drawBreakEvent(
    shellCtx: CanvasRenderingContext2D,
    event: GameCanvasHudStats['breakEvent'] | null,
    startedAt: number,
    shellW: number,
    shellH: number,
  ): void {
    if (!event || startedAt <= 0) return;
    const durationMs = GAME_ASSET_TUNING.fx.break.durationMs;
    const t = Math.min(1, (performance.now() - startedAt) / durationMs);
    if (t >= 1) {
      activeBreakEvent = null;
      breakFxStartedAt = 0;
      return;
    }
    const alpha = Math.max(0, 1 - t);
    const cx = shellW / 2;
    const stageScale = stageLayout?.scale ?? 1;
    const isMobile = (stageLayout?.viewportW ?? shellW) < 560;
    const cy = Math.max(96, boardOffsetY - 4 * stageScale);
    const scale = 0.9 + Math.sin(Math.min(1, t * 2.3) * Math.PI) * 0.18;

    shellCtx.save();
    shellCtx.globalAlpha = Math.min(GAME_ASSET_TUNING.fx.break.flashAlpha, alpha * GAME_ASSET_TUNING.fx.break.flashAlpha);
    shellCtx.fillStyle = '#ef4444';
    shellCtx.fillRect(0, 0, shellW, shellH);
    shellCtx.restore();

    shellCtx.save();
    shellCtx.globalAlpha = alpha;
    shellCtx.translate(cx, cy);
    shellCtx.scale(scale, scale);
    drawFxFrame(shellCtx, 'wrong-flag-break', t, 0, 6, 190 * stageScale, 108 * stageScale, GAME_ASSET_TUNING.fx.break.spriteAlpha);
    shellCtx.textAlign = 'center';
    shellCtx.textBaseline = 'middle';
    shellCtx.shadowColor = 'rgba(239, 68, 68, 0.9)';
    shellCtx.shadowBlur = 14 * stageScale;
    shellCtx.font = `900 ${28 * stageScale}px ${FONTS.display}`;
    shellCtx.fillStyle = '#fecaca';
    shellCtx.fillText(`BREAK x${event.comboCleared}`, 0, -6 * stageScale);
    shellCtx.font = `900 ${13 * stageScale}px ${FONTS.mono}`;
    shellCtx.fillStyle = '#ff4d3d';
    shellCtx.fillText(isMobile ? 'RESET' : `DEFUSE ${event.minesCleared}->0`, 0, 22 * stageScale);
    shellCtx.restore();

    if (t < 1) scheduleAnimationFrame();
  }

  function drawFullscreenOverlay(
    shellCtx: CanvasRenderingContext2D,
    shell: GameCanvasFullscreenOptions,
    shellW: number,
    shellH: number,
  ): void {
    const stats = shell.getStats?.();
    const combo = stats?.combo ?? 0;
    const scrollPressure = getScrollPressureFn?.();

    if (stats?.scoreEvent && stats.scoreEvent.id !== lastScoreEventId) {
      lastScoreEventId = stats.scoreEvent.id;
      activeScoreEvent = stats.scoreEvent;
      scoreFxStartedAt = performance.now();
      scheduleAnimationFrame();
    }
    if (stats?.breakEvent && stats.breakEvent.id !== lastBreakEventId) {
      lastBreakEventId = stats.breakEvent.id;
      activeBreakEvent = stats.breakEvent;
      breakFxStartedAt = performance.now();
      scheduleAnimationFrame();
    }

    if (combo !== lastCombo) {
      if (combo > lastCombo && combo > 1) spawnComboParticles(combo);
      lastCombo = combo;
      if (combo > 1) comboFxStartedAt = performance.now();
    }

    drawBottomEnergyRail(shellCtx, scrollPressure, shellW, shellH);
    drawFullscreenScrollWarning(shellCtx, scrollPressure, shellW, shellH);
    drawParticles(shellCtx, performance.now());
    drawScoreEvent(shellCtx, activeScoreEvent, scoreFxStartedAt, shellW);
    drawBreakEvent(shellCtx, activeBreakEvent, breakFxStartedAt, shellW, shellH);

    spaceKeyRect = stats?.spaceEnabled ? getSpaceHintRect(scrollPressure) : null;
    if (spaceKeyRect) {
      drawSpaceHint(shellCtx, spaceKeyRect, scrollPressure, stageLayout?.scale ?? 1);
    }

    if (combo > 1 && comboFxStartedAt > 0) {
      const elapsedMs = performance.now() - comboFxStartedAt;
      const durationMs = GAME_ASSET_TUNING.fx.comboBurst.durationMs;
      const t = Math.min(1, elapsedMs / durationMs);
      const alpha = Math.max(0, 1 - t);
      const stageScale = stageLayout?.scale ?? 1;
      const isMobile = (stageLayout?.viewportW ?? shellW) < 560;
      const pop = 1.12 + Math.sin(Math.min(1, t * 2.5) * Math.PI) * (GAME_ASSET_TUNING.fx.comboBurst.maxScale - 1);
      const burstScale = Math.max(0.9, Math.min(GAME_ASSET_TUNING.fx.comboBurst.maxScale, pop));
      const palette = comboColor(combo);
      const slots = getBottomFeedbackSlots();
      const cx = slots.comboBurst.x;
      const cy = slots.comboBurst.y - t * 10 * stageScale;
      const burstW = (isMobile ? 150 : 190) * stageScale;
      const burstH = (isMobile ? 66 : 80) * stageScale;

      shellCtx.save();
      shellCtx.globalAlpha = alpha;
      shellCtx.translate(cx, cy);
      shellCtx.scale(burstScale, burstScale);

      drawFxFrame(
        shellCtx,
        'combo-burst',
        t,
        0,
        0,
        burstW * GAME_ASSET_TUNING.fx.comboBurst.spriteW,
        burstH * GAME_ASSET_TUNING.fx.comboBurst.spriteH,
        GAME_ASSET_TUNING.fx.comboBurst.spriteAlpha,
      );

      const glow = shellCtx.createRadialGradient(0, 0, 10, 0, 0, burstW * 0.52);
      glow.addColorStop(0, palette.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      shellCtx.fillStyle = glow;
      shellCtx.fillRect(-burstW / 2, -burstH / 2, burstW, burstH);

      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.lineWidth = Math.max(3, 5 * stageScale);
      shellCtx.strokeStyle = 'rgba(15, 23, 42, 0.86)';
      shellCtx.fillStyle = comboHudColor(combo);
      shellCtx.font = `900 ${Math.min(isMobile ? 42 : 56, (isMobile ? 34 : 44) + String(combo).length * 3) * stageScale}px ${FONTS.mono}`;
      shellCtx.strokeText(`x${combo}`, 0, -4 * stageScale);
      shellCtx.fillText(`x${combo}`, 0, -4 * stageScale);
      shellCtx.font = `900 ${11 * stageScale}px ${FONTS.display}`;
      shellCtx.fillStyle = palette.text;
      shellCtx.globalAlpha = alpha * 0.76;
      shellCtx.fillText('COMBO', 0, 28 * stageScale);
      shellCtx.restore();

      if (t < 1) scheduleAnimationFrame();
    }

    if (combo > 1) {
      const pulse = 0.5 + Math.sin(Date.now() / 120) * 0.5;
      const palette = comboColor(combo);

      const railAlpha = Math.min(0.62, 0.22 + combo * 0.035 + pulse * 0.2);
      shellCtx.save();
      const previewRows = currentPreviewRows > 0 ? currentPreviewRows : 0;
      const railLayout = squareLayout
        ? getBoardSideRailLayout(squareLayout, previewRows)
        : { top: 6, bottom: boardHeight - 6, fadeInStart: null, fadeInEnd: null };
      const railTop = boardOffsetY + railLayout.top;
      const railBottom = boardOffsetY + railLayout.bottom;
      const peakStroke = palette.stroke.replace(/[\d.]+\)$/u, `${railAlpha})`);
      const railGradient = createBoardSideRailGradient(
        shellCtx,
        railTop,
        railBottom,
        peakStroke,
        railLayout.fadeInStart !== null ? boardOffsetY + railLayout.fadeInStart : null,
        railLayout.fadeInEnd !== null ? boardOffsetY + railLayout.fadeInEnd : null,
      );
      shellCtx.strokeStyle = railGradient;
      shellCtx.lineWidth = 2;
      shellCtx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const x = side < 0 ? boardOffsetX - 16 : boardOffsetX + boardWidth + 16;
        shellCtx.beginPath();
        shellCtx.moveTo(x, railTop);
        shellCtx.lineTo(x, railBottom);
        shellCtx.stroke();
      }
      shellCtx.restore();
    }

    if (currentStatus === 'idle' && (shell.showStartOverlay?.() ?? true)) {
      const w = Math.min(420, shellW - 40, Math.max(280, boardWidth * 1.08));
      const h = Math.round(w * (246 / 364));
      const x = (shellW - w) / 2;
      const y = Math.max(120, boardOffsetY + boardHeight * 0.46 - h / 2);
      startRect = { x, y, w, h };
      shellCtx.save();
      shellCtx.fillStyle = THEME.overlayScrim;
      shellCtx.fillRect(0, 0, shellW, shellH);
      if (!drawUiPanelImage(shellCtx, 'start-panel', x, y, w, h, 1.03)) {
        drawArcadePanel(shellCtx, x, y, w, h, 'rgba(59, 130, 246, 0.78)', 'rgba(3, 8, 20, 0.95)');
        drawHudIcon(shellCtx, 'play', shellW / 2 - 12, y + 32, { size: 24 });
        shellCtx.fillStyle = '#fde047';
        shellCtx.font = `900 46px ${FONTS.display}`;
        shellCtx.textAlign = 'center';
        shellCtx.textBaseline = 'middle';
        shellCtx.fillText('START', shellW / 2, y + h / 2 + 8);
      }
      drawArcadeGlow(shellCtx, x + 8, y + 8, w - 16, h - 16, 'rgba(59, 130, 246, 0.62)', 0.9);
      shellCtx.restore();
    }

    if (currentStatus === 'lost') {
      const panelW = Math.min(480, shellW - 40, Math.max(300, boardWidth * 1.18));
      const panelH = Math.round(panelW * (269 / 430));
      const panelX = (shellW - panelW) / 2;
      const panelY = Math.max(96, boardOffsetY + boardHeight * 0.42 - panelH / 2);
      const retryW = panelW * 0.52;
      const retryH = panelH * 0.2;
      const retryX = panelX + (panelW - retryW) / 2;
      const retryY = panelY + panelH * 0.68;
      retryRect = { x: retryX, y: retryY, w: retryW, h: retryH };

      shellCtx.save();
      shellCtx.fillStyle = THEME.overlayScrim;
      shellCtx.fillRect(0, 0, shellW, shellH);
      if (!drawUiPanelImage(shellCtx, 'game-over-panel', panelX, panelY, panelW, panelH, 1.03)) {
        drawArcadePanel(shellCtx, panelX, panelY, panelW, panelH, 'rgba(239, 68, 68, 0.8)', 'rgba(24, 3, 5, 0.95)');
        drawHudIcon(shellCtx, 'skull', shellW / 2 - 16, panelY + 26, { size: 32 });
        shellCtx.fillStyle = '#ff453a';
        shellCtx.font = `900 42px ${FONTS.display}`;
        shellCtx.textAlign = 'center';
        shellCtx.textBaseline = 'middle';
        shellCtx.fillText('GAME OVER', shellW / 2, panelY + panelH * 0.46);
        fillRounded(retryX, retryY, retryW, retryH, 10, THEME.danger);
        shellCtx.fillStyle = '#ffffff';
        shellCtx.font = `700 18px ${FONTS.display}`;
        if (
          !drawIconTextButton(shellCtx, shellW / 2, retryY + retryH / 2 + 1, 'refresh', 'RETRY', {
            iconSize: 16,
            font: `700 18px ${FONTS.display}`,
          })
        ) {
          shellCtx.fillText('RETRY', shellW / 2, retryY + retryH / 2 + 1);
        }
      }
      drawArcadeGlow(shellCtx, panelX + 8, panelY + 8, panelW - 16, panelH - 16, 'rgba(239, 68, 68, 0.72)', 1);
      shellCtx.fillStyle = '#fee2e2';
      shellCtx.font = `700 15px ${FONTS.mono}`;
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'top';
      shellCtx.fillText(`SCORE ${String(stats?.score ?? 0).padStart(5, '0')}`, shellW / 2, panelY + panelH + 12);
      shellCtx.restore();
    }

    if (!shell.isLogOpen?.()) return;
    const logs = shell.getRecentLogs?.() ?? [];
    const modalW = Math.min(720, shellW - 32);
    const modalH = Math.min(560, shellH - 64);
    const x = (shellW - modalW) / 2;
    const y = (shellH - modalH) / 2;

    shellCtx.save();
    shellCtx.fillStyle = THEME.overlayScrim;
    shellCtx.fillRect(0, 0, shellW, shellH);
    drawArcadePanel(shellCtx, x, y, modalW, modalH, 'rgba(59, 130, 246, 0.72)', 'rgba(3, 8, 18, 0.96)');
    drawArcadeGlow(shellCtx, x + 10, y + 10, modalW - 20, modalH - 20, 'rgba(59, 130, 246, 0.46)', 0.7);
    shellCtx.fillStyle = '#60a5fa';
    shellCtx.font = `800 18px ${FONTS.display}`;
    shellCtx.textAlign = 'left';
    shellCtx.textBaseline = 'top';
    drawHudIcon(shellCtx, 'info', x + 24, y + 22, { size: 14 });
    shellCtx.fillText('LOG', x + 44, y + 20);
    shellCtx.fillStyle = THEME.hudMuted;
    shellCtx.font = `500 11px ${FONTS.display}`;
    shellCtx.textAlign = 'right';
    shellCtx.fillText('` / Esc 关闭', x + modalW - 24, y + 25);

    shellCtx.fillStyle = 'rgba(10, 16, 32, 0.74)';
    fillRounded(x + 18, y + 54, modalW - 36, modalH - 74, 8, 'rgba(10, 16, 32, 0.74)');
    strokeRounded(x + 18.5, y + 54.5, modalW - 37, modalH - 75, 8, 'rgba(59, 130, 246, 0.24)');

    shellCtx.font = `500 13px ${FONTS.mono}`;
    shellCtx.textAlign = 'left';
    const lineH = 22;
    const maxLines = Math.max(8, Math.floor((modalH - 92) / lineH));
    let lineY = y + 68;
    for (const line of logs.slice(-maxLines)) {
      shellCtx.fillStyle = THEME.hudMuted;
      shellCtx.fillText(line.time, x + 30, lineY);
      drawHudIcon(shellCtx, logIcon(line.kind), x + 84, lineY + 1, { size: 12 });
      shellCtx.fillStyle = logColor(line.kind);
      shellCtx.fillText(line.text, x + 102, lineY, modalW - 132);
      lineY += lineH;
    }
    shellCtx.restore();
  }

  function hitReset(x: number, y: number): boolean {
    if (fullscreen) return false;
    return hitTestReset(squareLayout!, x, y);
  }

  function cellAtCoords(x: number, y: number): { row: number; col: number } | null {
    if (fullscreen) {
      x -= boardOffsetX;
      y -= boardOffsetY;
    }
    const hit = hitTestCellWithPreview(
      squareLayout!,
      currentRows,
      currentCols,
      currentPreviewRows,
      x,
      y,
    );
    if (!hit) return null;
    return hit;
  }

  function canvasCoords(event: MouseEvent): { x: number; y: number } {
    return getCanvasPointerCoords(canvas, event, { width, height });
  }

  function cellAt(event: MouseEvent): { row: number; col: number } | null {
    const { x, y } = canvasCoords(event);
    if (hitReset(x, y)) return null;
    return cellAtCoords(x, y);
  }

  function isBothButtons(event: MouseEvent): boolean {
    return (event.buttons & 1) !== 0 && (event.buttons & 2) !== 0;
  }

  function onMouseDown(event: MouseEvent): void {
    const { x, y } = canvasCoords(event);

    if (fullscreen?.isLogOpen?.()) return;

    if (fullscreen && devAutoRect) {
      const insideAuto =
        x >= devAutoRect.x &&
        x <= devAutoRect.x + devAutoRect.w &&
        y >= devAutoRect.y &&
        y <= devAutoRect.y + devAutoRect.h;
      if (insideAuto) {
        event.preventDefault();
        fullscreen.onDevAuto?.();
        return;
      }
    }

    if (
      fullscreen &&
      currentStatus === 'idle' &&
      startRect &&
      (fullscreen.showStartOverlay?.() ?? true)
    ) {
      const insideStart =
        x >= startRect.x &&
        x <= startRect.x + startRect.w &&
        y >= startRect.y &&
        y <= startRect.y + startRect.h;
      if (insideStart) {
        event.preventDefault();
        fullscreen.onStart?.();
        return;
      }
      return;
    }

    if (fullscreen && currentStatus === 'lost' && retryRect) {
      const insideRetry =
        x >= retryRect.x &&
        x <= retryRect.x + retryRect.w &&
        y >= retryRect.y &&
        y <= retryRect.y + retryRect.h;
      if (insideRetry) {
        event.preventDefault();
        fullscreen.onRestart?.();
        return;
      }
      return;
    }

    if (fullscreen && spaceKeyRect) {
      const insideSpace =
        x >= spaceKeyRect.x &&
        x <= spaceKeyRect.x + spaceKeyRect.w &&
        y >= spaceKeyRect.y &&
        y <= spaceKeyRect.y + spaceKeyRect.h;
      if (insideSpace) {
        event.preventDefault();
        fullscreen.onSpace?.();
        return;
      }
    }

    if (hitReset(x, y)) {
      if (event.button === 0) callbacks.onReset();
      return;
    }

    const cell = cellAtCoords(x, y);
    if (!cell) return;

    if (isBothButtons(event)) {
      event.preventDefault();
      callbacks.onChord(cell.row, cell.col);
      return;
    }

    if (event.button === 0) {
      callbacks.onReveal(cell.row, cell.col);
    }
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (isBothButtons(event)) {
      const cell = cellAt(event);
      if (cell) callbacks.onChord(cell.row, cell.col);
      return;
    }
    const cell = cellAt(event);
    if (cell) {
      callbacks.onToggleFlag(cell.row, cell.col);
    }
  }

  function onDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    const cell = cellAt(event);
    if (cell) {
      callbacks.onChord(cell.row, cell.col);
    }
  }

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('dblclick', onDoubleClick);
  if (fullscreen) {
    window.addEventListener('resize', paint);
  }

  return {
    render(views, status, flagCount, options) {
      const nextRows = fixedGridRows ?? options?.rows ?? currentRows;
      const nextCols = options?.cols ?? currentCols;

      if (!fixedGridRows && (nextRows !== currentRows || nextCols !== currentCols)) {
        syncSquareLayout(nextRows, nextCols);
        currentRows = nextRows;
        currentCols = nextCols;
      }

      syncPreviewLayout(options?.previewRows ?? 0);

      collectCellEffects(currentViews, views);
      if (status === 'idle' && currentStatus !== 'idle') {
        cellEffects.length = 0;
        particles.length = 0;
        lastCombo = 0;
        comboFxStartedAt = 0;
      }

      currentViews = views;
      currentStatus = status;
      currentFlagCount = flagCount;
      currentHudLeftDisplay = options?.hudLeftDisplay;
      currentHudRightDisplay = options?.hudRightDisplay;
      currentAiHint = options?.aiHint;
      paint();
    },
    startTimer() {
      if (timerId !== null) return;
      timerId = window.setInterval(() => {
        elapsed += 1;
        paint();
      }, 1000);
    },
    stopTimer() {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    },
    resetTimer() {
      this.stopTimer();
      elapsed = 0;
      paint();
    },
    repaint() {
      paint();
    },
    destroy() {
      this.stopTimer();
      stopPressureRepaint();
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('dblclick', onDoubleClick);
      if (fullscreen) {
        window.removeEventListener('resize', paint);
      }
      canvas.remove();
    },
  };
}
