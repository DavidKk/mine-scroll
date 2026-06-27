import type { CellView, GameStatus } from '../../core/types.ts';
import type { AiHintDisplay } from '../../core/ai/types.ts';
import { FONTS, THEME } from '../theme.ts';
import {
  drawHudIcon,
  drawIconTextButton,
  drawLivesRow,
  parseLivesDisplay,
  type HudIconName,
  type LivesDisplay,
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
  renderBoardStaticFrame,
  renderBoardDynamicFrame,
  renderFrame,
  type LayoutMetrics,
  type ScrollPressureState,
  type RenderState,
} from '../renderer/index.ts';
import { drawCellRevealTransitionOverlay, drawMineBurstSmoke, drawPanelV3ScanBeams, type BoardPointerState } from '../cell-fx.ts';
import { FpsMeter, drawFpsHud } from '../fps-meter.ts';
import {
  GAME_ASSET_TUNING,
  drawFxSpriteFrame,
  drawGameMineCutout,
  drawImageContained,
  getGameCutout,
  getGameUiPanel,
  type GameUiPanelName,
} from '../game-assets.ts';
import {
  computeEndlessBoardCellSize,
  computeGameStageLayout,
  getBottomFeedbackSlots as resolveBottomFeedbackSlots,
  type GameStageLayout,
} from '../game-stage-layout.ts';
import {
  computeBackdropMood,
  drawAmbientBackdrop,
  smoothBackdropMood,
  type BackdropMood,
} from '../ambient-backdrop.ts';
import {
  applyCanvasSize,
  type GameCanvasCallbacks,
  type GameCanvasController,
  type GameCanvasFullscreenOptions,
  type GameCanvasHudStats,
  type GameCanvasLogLine,
  type GameCanvasOptions,
} from './types.ts';

const hudFeedbackAssets = {
  scoreStrip: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/score-energy-strip-v3.png'),
  scorePanelV6: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/score-energy-panel-v6.png'),
  comboRail: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/combo-energy-rail-v3.png'),
  scorePopBase: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/score-pop-energy-base-v3.png'),
  comboBurstBase: loadRuntimeImage('/assets/candidates/hud-feedback-v3/runtime/combo-burst-energy-base-v3.png'),
  speedUpAlert: loadRuntimeImage('/assets/candidates/hud-alerts-v3/runtime/speed-up-alert-v3.png'),
  dangerRiseAlert: loadRuntimeImage('/assets/candidates/hud-alerts-v3/runtime/danger-rise-alert-v3.png'),
};

const scoreDigitAssets = Array.from({ length: 10 }, (_, digit) =>
  loadRuntimeImage(`/assets/candidates/hud-feedback-v3/runtime/score-digits-v1/digit-${digit}.png`),
);

function loadRuntimeImage(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

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
  canvas.setAttribute('aria-label', 'Minesweeper board');
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
  let startRect: { x: number; y: number; w: number; h: number } | null = null;
  let retryRect: { x: number; y: number; w: number; h: number } | null = null;
  let devAutoRect: { x: number; y: number; w: number; h: number } | null = null;
  let bgmMuteRect: { x: number; y: number; w: number; h: number } | null = null;
  let uiHoverTarget: string | null = null;
  let pendingPanelTransition:
    | {
        kind: 'start' | 'retry';
        startedAt: number;
        durationMs: number;
        timerId: number;
      }
    | null = null;
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
  let lastDifficultySpeedTier: number | null = null;
  let lastDifficultyBatchTier: number | null = null;
  let activeDifficultyAlert: { kind: 'speed-up' | 'danger-rise'; startedAt: number } | null = null;
  let animationFrameId: number | null = null;
  let ambientDelayId: number | null = null;
  let lastPaintAt = 0;
  const fpsMeter = new FpsMeter();
  /** Live wallpaper target rate (~40 FPS). */
  const AMBIENT_FRAME_MS = 1000 / 40;
  const PANEL_V3_MS = 1480;
  const DIFFICULTY_ALERT_MS = 1260;
  let boardLayerCache: HTMLCanvasElement | null = null;
  let boardLayerCacheCtx: CanvasRenderingContext2D | null = null;
  let boardLayerCacheKey = '';
  let boardLayerCacheDpr = 0;
  let shellBgCache: HTMLCanvasElement | null = null;
  let shellBgCacheKey = '';
  let boardPointer: BoardPointerState | null = null;
  let lastLivesCurrent = -1;
  let heartRefillFxStartedAt = 0;
  let heartRefillTargetIndex = 0;
  let heartRefillMax = 5;
  let levelUpFxStartedAt = 0;
  let backdropMood: BackdropMood = { heat: 0.15, energy: 0.88, intensity: 0 };
  let lastBackdropSampleAt = 0;

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
  const SCORE_HUD_PULSE_MS = 420;

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
      boardOffsetX = Math.round(stageLayout.boardX);
      boardOffsetY = Math.round(stageLayout.boardY);
    }
  }

  function stopPressureRepaint(): void {
    if (pressureRepaintId !== null) {
      window.clearInterval(pressureRepaintId);
      pressureRepaintId = null;
    }
    if (ambientDelayId !== null) {
      window.clearTimeout(ambientDelayId);
      ambientDelayId = null;
    }
  }

  function needsContinuousRepaint(now: number): 'full' | 'ambient' | false {
    if (cellEffects.length > 0 || particles.length > 0) return 'full';
    if (
      heartRefillFxStartedAt > 0 &&
      now - heartRefillFxStartedAt < GAME_ASSET_TUNING.fx.heartRefillHud.durationMs
    ) {
      return 'full';
    }
    if (levelUpFxStartedAt > 0 && now - levelUpFxStartedAt < GAME_ASSET_TUNING.fx.levelUp.durationMs) {
      return 'full';
    }
    if (pendingPanelTransition) return 'full';
    if (activeDifficultyAlert && now - activeDifficultyAlert.startedAt < DIFFICULTY_ALERT_MS) return 'full';
    if (activeScoreEvent && scoreFxStartedAt > 0) return 'full';
    if (activeBreakEvent && breakFxStartedAt > 0) return 'full';
    if (lastCombo > 1 && comboFxStartedAt > 0) {
      const comboAge = now - comboFxStartedAt;
      if (comboAge < GAME_ASSET_TUNING.fx.comboBurst.durationMs) return 'full';
    }
    if (fullscreen) return 'ambient';
    if (currentStatus === 'idle') return 'ambient';
    if (currentStatus !== 'playing') return false;
    if (boardPointer !== null) return 'ambient';
    if (getScrollPressureFn?.()) return 'ambient';
    return false;
  }

  function computeBoardLayerCacheKey(state: {
    views: CellView[];
    status: GameStatus;
    flagCount: number;
    rows: number;
    previewRows?: number;
    aiHint?: AiHintDisplay | null;
  }): string {
    const layout = squareLayout;
    const parts: string[] = [
      state.status,
      String(state.flagCount),
      String(state.rows),
      String(state.previewRows ?? 0),
      String(layout?.width ?? 0),
      String(layout?.height ?? 0),
      String(layout?.grid.cellSize ?? 0),
    ];
    for (const view of state.views) {
      parts.push(
        `${view.row},${view.col}:${view.preview ? 'p' : ''}${view.revealed ? 1 : 0}${view.flagged ? 1 : 0}${view.adjacentMines ?? '-'}${view.isMine ?? '-'}${view.mineHit ? 'h' : ''}`,
      );
    }
    if (state.aiHint) {
      parts.push(`hint:${state.aiHint.row},${state.aiHint.col},${state.aiHint.kind}`);
    }
    return parts.join('|');
  }

  function ensureBoardLayerCache(
    state: RenderState & { rows: number; cols: number },
  ): void {
    const layout = squareLayout!;
    const key = computeBoardLayerCacheKey(state);
    const dpr = window.devicePixelRatio || 1;
    const cacheW = Math.round(layout.width * dpr);
    const cacheH = Math.round(layout.height * dpr);

    if (
      key !== boardLayerCacheKey ||
      !boardLayerCache ||
      boardLayerCache.width !== cacheW ||
      boardLayerCache.height !== cacheH ||
      boardLayerCacheDpr !== dpr
    ) {
      boardLayerCache = document.createElement('canvas');
      boardLayerCache.width = cacheW;
      boardLayerCache.height = cacheH;
      boardLayerCacheCtx = boardLayerCache.getContext('2d');
      boardLayerCacheDpr = dpr;
      boardLayerCacheKey = '';
    }
    if (key === boardLayerCacheKey && boardLayerCache) return;

    if (!boardLayerCacheCtx) return;

    boardLayerCacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    boardLayerCacheCtx.imageSmoothingEnabled = false;
    renderBoardStaticFrame(boardLayerCacheCtx, layout, {
      ...state,
      nowMs: 0,
      pointer: null,
      scrollPressure: undefined,
    });
    boardLayerCacheKey = key;
  }

  function drawShellBackground(shellCtx: CanvasRenderingContext2D): void {
    const key = `${width}x${height}`;
    if (key !== shellBgCacheKey || !shellBgCache) {
      shellBgCache = document.createElement('canvas');
      shellBgCache.width = width;
      shellBgCache.height = height;
      const bgCtx = shellBgCache.getContext('2d');
      if (bgCtx) drawModernBackground(bgCtx, width, height);
      shellBgCacheKey = key;
    }
    shellCtx.drawImage(shellBgCache, 0, 0);
  }

  function drawAmbientShellBackdrop(shellCtx: CanvasRenderingContext2D, now: number): void {
    if (!fullscreen) return;
    const stats = fullscreen.getStats?.();
    const target = computeBackdropMood(
      {
        status: currentStatus,
        scrollElapsedMs: stats?.backdrop?.scrollElapsedMs ?? 0,
        scrollDepth: stats?.backdrop?.scrollDepth ?? 0,
        lives: stats?.backdrop?.livesCurrent ?? 5,
        maxLives: stats?.backdrop?.livesMax ?? 5,
      },
      stats?.combo ?? 0,
    );
    const dtMs = lastBackdropSampleAt > 0 ? now - lastBackdropSampleAt : AMBIENT_FRAME_MS;
    lastBackdropSampleAt = now;
    backdropMood = smoothBackdropMood(backdropMood, target, dtMs);

    try {
      drawAmbientBackdrop(shellCtx, {
        shellW: width,
        shellH: height,
        nowMs: now,
        status: currentStatus,
        mood: backdropMood,
        boardSafeRect: squareLayout
          ? {
              x: boardOffsetX,
              y: boardOffsetY,
              w: squareLayout.width,
              h: squareLayout.height,
            }
          : undefined,
      });
    } catch (err) {
      console.error('[backdrop]', err);
    }
  }

  function startAmbientLoop(): void {
    if (!fullscreen) return;
    lastBackdropSampleAt = 0;
    scheduleContinuousRepaint();
  }

  function scheduleContinuousRepaint(): void {
    const mode = needsContinuousRepaint(performance.now());
    if (!mode) return;
    if (animationFrameId !== null) return;
    if (mode === 'ambient' && ambientDelayId !== null) return;

    const delay =
      mode === 'full' ? 0 : Math.max(0, AMBIENT_FRAME_MS - (performance.now() - lastPaintAt));
    if (delay <= 1) {
      scheduleAnimationFrame();
      return;
    }
    ambientDelayId = window.setTimeout(() => {
      ambientDelayId = null;
      scheduleAnimationFrame();
    }, delay);
  }

  function syncPressureRepaint(): void {
    if (!getScrollPressureFn || currentStatus !== 'playing' || !getScrollPressureFn()) {
      stopPressureRepaint();
      return;
    }
    scheduleContinuousRepaint();
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
        if (!hasMineHitV3RuntimeAssets()) {
          const blastFade = 1 - Math.max(0, (t - 0.42) / 0.58) ** 2;
          drawFxSpriteFrame(
            effectCtx,
            'mine-explosion',
            t,
            cx,
            cy,
            grid.cellSize * GAME_ASSET_TUNING.fx.mineExplosion.spriteW,
            grid.cellSize * GAME_ASSET_TUNING.fx.mineExplosion.spriteH,
            GAME_ASSET_TUNING.fx.mineExplosion.spriteAlpha * blastFade,
          );
        }
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
        if (t < 0.42) {
          const flash = getGameCutout('mine-hit-flash');
          if (flash) {
            const flashAlpha = (1 - t / 0.42) * 0.92;
            effectCtx.save();
            effectCtx.globalAlpha = flashAlpha;
            drawGameMineCutout(effectCtx, flash, x, y, grid.cellSize);
            effectCtx.restore();
          }
        }

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

        drawMineBurstSmoke(effectCtx, cx, cy, grid.cellSize, t, 0.88);
        drawMineHitV3RuntimeOverlay(effectCtx, cx, cy, x, y, grid.cellSize, t);
      }
    }
    effectCtx.restore();

    if (cellEffects.length > 0) scheduleAnimationFrame();
  }

  function hasMineHitV3RuntimeAssets(): boolean {
    return Boolean(getGameCutout('mine-cracked') ?? getGameCutout('mine-exploded') ?? getGameCutout('mine-hit-flash'));
  }

  function drawMineHitV3RuntimeOverlay(
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
        const leftY = cy + Math.sin(angle - 0.55) * inner + Math.sin(angle + Math.PI / 2) * width;
        const rightX = cx + Math.cos(angle + 0.55) * inner + Math.cos(angle - Math.PI / 2) * width;
        const rightY = cy + Math.sin(angle + 0.55) * inner + Math.sin(angle - Math.PI / 2) * width;
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

  /** Defuse combo feedback anchor: bottom row scroll-off band */
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

  function spawnScoreHudParticles(): void {
    if (!stageLayout) return;
    const now = performance.now();
    const scale = stageLayout.scale;
    const hudY = stageLayout.hudY + 7 * scale;
    const panelCx = stageLayout.scoreAnchor.x + 118 * scale;
    const panelCy = hudY + 27 * scale;
    const maxW = 248 * scale;
    const maxH = 80 * scale;
    const fit =
      hudFeedbackAssets.scorePanelV6.complete && hudFeedbackAssets.scorePanelV6.naturalWidth > 0
        ? Math.min(maxW / hudFeedbackAssets.scorePanelV6.naturalWidth, maxH / hudFeedbackAssets.scorePanelV6.naturalHeight)
        : 1;
    const panelW = hudFeedbackAssets.scorePanelV6.complete ? hudFeedbackAssets.scorePanelV6.naturalWidth * fit : maxW;
    const panelH = hudFeedbackAssets.scorePanelV6.complete ? hudFeedbackAssets.scorePanelV6.naturalHeight * fit : maxH;
    const left = panelCx - panelW / 2 + panelW * 0.34;
    const right = left + panelW * 0.52;
    const cy = panelCy - panelH / 2 + panelH * 0.475;
    const count = Math.max(8, Math.round(12 * scale));

    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI * (0.18 + Math.random() * 0.64);
      const speed = 0.8 + Math.random() * 1.8;
      particles.push({
        x: left + Math.random() * Math.max(8, right - left),
        y: cy + (Math.random() - 0.5) * 10 * scale,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        size: (1.2 + Math.random() * 2.1) * scale,
        color: Math.random() > 0.78 ? 'rgba(255, 190, 55, 0.95)' : 'rgba(76, 232, 255, 0.95)',
        startedAt: now,
        durationMs: 360 + Math.random() * 180,
      });
    }
    while (particles.length > 140) particles.shift();
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
      nowMs: now,
      pointer: boardPointer,
      ...(fullscreen
        ? {}
        : {
            hudLeftDisplay: currentHudLeftDisplay,
            hudRightDisplay: currentHudRightDisplay,
          }),
    };

    if (fullscreen) {
      startRect = null;
      retryRect = null;
      devAutoRect = null;
      ctx.clearRect(0, 0, width, height);
      drawShellBackground(ctx);
      drawAmbientShellBackdrop(ctx, now);
      ctx.save();
      ctx.translate(boardOffsetX, boardOffsetY);
    }

    const boardState = {
      ...renderState,
      rows: currentRows,
      cols: currentCols,
    };

    if (fullscreen) {
      ensureBoardLayerCache(boardState);
      if (boardLayerCache) {
        const prevSmooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(boardLayerCache, 0, 0, squareLayout!.width, squareLayout!.height);
        ctx.imageSmoothingEnabled = prevSmooth;
      } else {
        renderBoardStaticFrame(ctx, squareLayout!, boardState);
      }
      renderBoardDynamicFrame(ctx, squareLayout!, boardState);
    } else {
      renderFrame(ctx, squareLayout!, boardState);
    }

    drawCellEffects(ctx, now);
    fpsMeter.tick(now);
    const fps = fpsMeter.getFps();
    const frameMs = fpsMeter.getFrameMs();

    if (fullscreen) {
      ctx.restore();
      drawFullscreenOverlay(ctx, fullscreen, width, height);
      drawFullscreenHud(ctx, fullscreen, width, height, fps, frameMs);
    } else {
      drawFpsHud(ctx, width - 8, 8, fps, frameMs, 1);
    }

    lastPaintAt = now;
    syncPressureRepaint();
    scheduleContinuousRepaint();
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

  function strokeRounded(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    stroke: string | CanvasGradient,
    lineWidth = 1,
  ): void {
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

  function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  function panelTransitionProgress(kind: 'start' | 'retry', now: number): number {
    if (!pendingPanelTransition || pendingPanelTransition.kind !== kind) return 0;
    return clamp01((now - pendingPanelTransition.startedAt) / pendingPanelTransition.durationMs);
  }

  function clearPendingPanelTransition(): void {
    if (!pendingPanelTransition) return;
    window.clearTimeout(pendingPanelTransition.timerId);
    pendingPanelTransition = null;
  }

  function beginPanelTransition(kind: 'start' | 'retry', action: () => void): void {
    if (pendingPanelTransition) return;
    const durationMs = 420;
    const startedAt = performance.now();
    const timerId = window.setTimeout(() => {
      if (!pendingPanelTransition || pendingPanelTransition.startedAt !== startedAt) return;
      pendingPanelTransition = null;
      action();
      scheduleAnimationFrame();
    }, durationMs);
    pendingPanelTransition = { kind, startedAt, durationMs, timerId };
    scheduleAnimationFrame();
  }

  function drawRuntimePanelV3Fx(
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
    const phase = (nowMs % PANEL_V3_MS) / PANEL_V3_MS;
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

  function containedImageRect(
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

  function drawUiPanelImageBounds(
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
    const rect = containedImageRect(img, x, y, w, h, scale);
    shellCtx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    return rect;
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
    return drawUiPanelImageBounds(shellCtx, name, x, y, w, h, scale) !== null;
  }

  function drawFeedbackAsset(
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

  function drawFilteredFeedbackAsset(
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

  function setFittedMonoFont(
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

  function drawScoreDigits(
    shellCtx: CanvasRenderingContext2D,
    text: string,
    x: number,
    cy: number,
    maxW: number,
    maxH: number,
  ): boolean {
    const digits: HTMLImageElement[] = [];
    for (const ch of text) {
      const image = scoreDigitAssets[Number(ch)];
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

  function comboRailFilter(combo: number): string {
    if (combo >= 50) return 'hue-rotate(145deg) saturate(1.55) brightness(1.08)';
    if (combo >= 20) return 'hue-rotate(-150deg) saturate(1.45) brightness(1.08)';
    if (combo >= 10) return 'hue-rotate(-118deg) saturate(1.45) brightness(1.08)';
    if (combo >= 5) return 'hue-rotate(-58deg) saturate(1.32) brightness(1.05)';
    return 'none';
  }

  function drawComboRailGlow(
    shellCtx: CanvasRenderingContext2D,
    asset: { x: number; y: number; w: number; h: number },
    combo: number,
    alpha: number,
  ): void {
    const cx = asset.x + asset.w / 2;
    const cy = asset.y + asset.h * 0.54;
    shellCtx.save();
    shellCtx.globalCompositeOperation = 'lighter';
    const glow = shellCtx.createRadialGradient(cx, cy, 0, cx, cy, asset.w * 0.58);
    glow.addColorStop(0, comboHudGlow(combo, alpha * 0.34));
    glow.addColorStop(0.42, comboHudGlow(combo, alpha * 0.16));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.fillStyle = glow;
    shellCtx.fillRect(asset.x, asset.y, asset.w, asset.h);
    shellCtx.restore();
  }

  function drawTopHudChip(
    shellCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    align: 'left' | 'right' | 'center' = 'left',
  ): void {
    const pulse = 0.5 + Math.sin(Date.now() / 900) * 0.5;
    const radius = Math.min(10 * (stageLayout?.scale ?? 1), h * 0.24);
    const cx = align === 'right' ? x + w : align === 'center' ? x + w / 2 : x;
    shellCtx.save();
    shellCtx.shadowColor = color;
    shellCtx.shadowBlur = 7 + pulse * 5;

    const bg = shellCtx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
    bg.addColorStop(0.55, 'rgba(3, 7, 18, 0.78)');
    bg.addColorStop(1, 'rgba(2, 6, 23, 0.62)');
    fillRounded(x, y, w, h, radius, bg);

    const border = shellCtx.createLinearGradient(x, y, x + w, y);
    border.addColorStop(0, align === 'right' ? 'rgba(45, 236, 255, 0)' : color);
    border.addColorStop(0.5, 'rgba(45, 236, 255, 0.46)');
    border.addColorStop(1, align === 'left' ? 'rgba(45, 236, 255, 0)' : color);
    strokeRounded(x + 0.5, y + 0.5, w - 1, h - 1, radius, border, 1.15);

    shellCtx.globalCompositeOperation = 'lighter';
    const glow = shellCtx.createRadialGradient(cx, y + h * 0.55, 0, cx, y + h * 0.55, w * 0.65);
    glow.addColorStop(0, color.replace('0.68', `${0.12 + pulse * 0.06}`));
    glow.addColorStop(1, 'rgba(45, 236, 255, 0)');
    shellCtx.fillStyle = glow;
    shellCtx.fillRect(x, y, w, h);
    shellCtx.restore();
  }

  function drawScoreHud(
    shellCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    score: number,
    scale: number,
  ): void {
    const pulseElapsed = scoreFxStartedAt > 0 ? performance.now() - scoreFxStartedAt : SCORE_HUD_PULSE_MS;
    const pulseT = Math.max(0, Math.min(1, pulseElapsed / SCORE_HUD_PULSE_MS));
    const pulse = pulseElapsed < SCORE_HUD_PULSE_MS ? Math.sin(pulseT * Math.PI) * (1 - pulseT * 0.35) : 0;
    const asset = drawFeedbackAsset(
      shellCtx,
      hudFeedbackAssets.scorePanelV6,
      x + 118 * scale,
      y + 27 * scale,
      248 * scale,
      80 * scale,
      1 + pulse * 0.018,
      0.92,
    );
    if (!asset) {
      drawTopHudChip(shellCtx, x - 10 * scale, y - 4 * scale, 116 * scale, 46 * scale, 'rgba(96, 165, 250, 0.68)', 'left');
      shellCtx.save();
      shellCtx.textAlign = 'left';
      shellCtx.textBaseline = 'top';
      shellCtx.fillStyle = '#7dd3fc';
      shellCtx.font = `800 ${7.5 * scale}px ${FONTS.display}`;
      shellCtx.fillText('SCORE', x - 2 * scale, y);
      shellCtx.shadowColor = 'rgba(45, 236, 255, 0.42)';
      shellCtx.shadowBlur = 7 * scale;
      shellCtx.fillStyle = THEME.hudText;
      const fallbackText = String(score).padStart(5, '0');
      setFittedMonoFont(shellCtx, fallbackText, 86 * scale, 15 * scale, 10 * scale, 850);
      shellCtx.fillText(fallbackText, x - 2 * scale, y + 15 * scale);
      shellCtx.restore();
      return;
    }

    const text = String(score).padStart(5, '0');
    const drewDigits = drawScoreDigits(
      shellCtx,
      text,
      asset.x + asset.w * 0.34,
      asset.y + asset.h * 0.475,
      asset.w * 0.52,
      Math.min(asset.h * (0.16 + pulse * 0.018), 15 * scale * (1 + pulse * 0.12)),
    );
    if (drewDigits) return;

    shellCtx.save();
    shellCtx.textAlign = 'left';
    shellCtx.textBaseline = 'middle';
    shellCtx.shadowColor = 'rgba(45, 236, 255, 0.42)';
    shellCtx.shadowBlur = 7 * scale;
    shellCtx.fillStyle = '#d8fbff';
    setFittedMonoFont(shellCtx, text, asset.w * 0.52, 15 * scale, 10 * scale, 850);
    shellCtx.fillText(text, asset.x + asset.w * 0.34, asset.y + asset.h * 0.475);
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

    const asset = drawFilteredFeedbackAsset(
      shellCtx,
      hudFeedbackAssets.comboRail,
      cx,
      y + 28 * scale,
      180 * scale,
      48 * scale,
      comboRailFilter(displayCombo),
      1,
      0.9,
    );
    if (asset) {
      drawComboRailGlow(shellCtx, asset, displayCombo, glowAlpha);
    }
    if (!asset) {
      const glow = shellCtx.createRadialGradient(cx, y + 25 * scale, 2 * scale, cx, y + 25 * scale, 64 * scale);
      glow.addColorStop(0, comboHudGlow(displayCombo, glowAlpha));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      shellCtx.fillStyle = glow;
      shellCtx.fillRect(cx - 76 * scale, y - 4 * scale, 152 * scale, 58 * scale);
    }

    shellCtx.fillStyle = color;
    shellCtx.font = `900 ${10 * scale}px ${FONTS.display}`;
    shellCtx.globalAlpha = 0.9;
    shellCtx.fillText(label, cx, y);

    shellCtx.globalAlpha = 1;
    const maxTextW = (asset?.w ?? 168 * scale) * 0.58;
    const fontSize = setFittedMonoFont(shellCtx, text, maxTextW, 21 * scale, 12 * scale, 900);
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

  function drawLivesHud(shellCtx: CanvasRenderingContext2D, x: number, y: number, raw: string | undefined, scale: number): void {
    const lives = parseLivesDisplay(raw);
    if (!lives) return;
    const metrics = hudHeartRowMetrics(x, y, lives, scale);
    shellCtx.save();
    shellCtx.shadowColor = 'rgba(248, 113, 113, 0.44)';
    shellCtx.shadowBlur = 12 * scale;
    if (!drawLivesRow(shellCtx, metrics.x, metrics.cy, lives, metrics.iconSize, metrics.gap)) {
      shellCtx.fillStyle = '#ef4444';
      shellCtx.font = `700 ${16 * scale}px ${FONTS.mono}`;
      shellCtx.textAlign = 'right';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText(raw ?? '', x, metrics.cy);
    }
    shellCtx.restore();
  }

  function hudHeartIconSize(scale: number): number {
    return Math.max(28, Math.min(38, 34 * scale));
  }

  function hudHeartGap(scale: number): number {
    return Math.max(5, 7 * scale);
  }

  function hudHeartRowMetrics(
    anchorX: number,
    hudY: number,
    lives: LivesDisplay,
    scale: number,
  ): { x: number; cy: number; iconSize: number; gap: number; rowW: number } {
    const iconSize = hudHeartIconSize(scale);
    const gap = hudHeartGap(scale);
    const rowW = lives.max * iconSize + (lives.max - 1) * gap;
    return {
      x: anchorX - rowW,
      cy: hudY + 31 * scale,
      iconSize,
      gap,
      rowW,
    };
  }

  function drawBgmMuteHud(
    shellCtx: CanvasRenderingContext2D,
    anchorX: number,
    hudY: number,
    livesRaw: string | undefined,
    scale: number,
    muted: boolean,
    hovered: boolean,
  ): void {
    const lives = parseLivesDisplay(livesRaw);
    const heartIconSize = hudHeartIconSize(scale);
    const iconSize = Math.max(14, Math.min(18, 16 * scale));
    const hitSize = Math.max(26, 28 * scale);
    const heartRowY = hudY + 31 * scale;
    const rectX = anchorX - hitSize;
    const rectY = heartRowY + (lives ? heartIconSize / 2 : 12 * scale) + 6 * scale;
    const cx = rectX + hitSize / 2;
    const cy = rectY + hitSize / 2;

    bgmMuteRect = { x: rectX, y: rectY, w: hitSize, h: hitSize };

    shellCtx.save();
    if (hovered) {
      fillRounded(rectX, rectY, hitSize, hitSize, 8 * scale, 'rgba(59, 130, 246, 0.14)');
    }
    shellCtx.globalAlpha = hovered ? 1 : 0.82;
    const icon = muted
      ? hovered ? 'volume-off-hover' : 'volume-off'
      : hovered ? 'volume-on-hover' : 'volume-on';
    drawHudIcon(shellCtx, icon, cx - iconSize / 2, cy - iconSize / 2, {
      size: iconSize,
    });
    shellCtx.restore();
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
  }

  function drawDevAutoButton(
    shellCtx: CanvasRenderingContext2D,
    rect: { x: number; y: number; w: number; h: number },
    active: boolean,
    scale: number,
  ): void {
    if (drawUiPanelImage(shellCtx, active ? 'auto-on' : 'auto-off', rect.x, rect.y, rect.w, rect.h, 0.98)) {
      return;
    }

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
    bg.addColorStop(0, '#06070d');
    bg.addColorStop(1, '#030408');
    shellCtx.fillStyle = bg;
    shellCtx.fillRect(0, 0, shellW, shellH);
  }

  function drawFullscreenHud(
    shellCtx: CanvasRenderingContext2D,
    shell: GameCanvasFullscreenOptions,
    shellW: number,
    _shellH: number,
    fps: number,
    frameMs: number,
  ): void {
    if (!stageLayout) return;
    const stats = shell.getStats?.();
    const stage = stageLayout;
    const { scale } = stage;
    const topBarH = stage.hudH;

    // Full-width HUD pinned to top
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
    if (shell.getBgmMuted && shell.onToggleBgmMute) {
      drawBgmMuteHud(
        shellCtx,
        stage.livesAnchor.x,
        hudY,
        livesRaw,
        scale,
        shell.getBgmMuted(),
        uiHoverTarget === 'bgm-mute',
      );
    } else {
      bgmMuteRect = null;
    }

    const livesParsed = parseLivesDisplay(livesRaw);
    if (livesParsed) {
      if (lastLivesCurrent >= 0 && livesParsed.current > lastLivesCurrent) {
        heartRefillFxStartedAt = performance.now();
        heartRefillTargetIndex = Math.max(0, Math.min(livesParsed.max - 1, livesParsed.current - 1));
        heartRefillMax = livesParsed.max;
        scheduleAnimationFrame();
      }
      lastLivesCurrent = livesParsed.current;
    }

    if (stats?.devAutoVisible) {
      const { x: autoX, y: autoY, w: autoW, h: autoH } = stage.autoRect;
      devAutoRect = { x: autoX, y: autoY, w: autoW, h: autoH };
      const active = Boolean(stats.devAutoActive);
      drawDevAutoButton(shellCtx, devAutoRect, active, scale);
    }

    drawFpsHud(shellCtx, shellW - 10 * scale, barY + 2 * scale, fps, frameMs, scale);
  }

  function heartCutoutVisualOffset(iconSize: number, containerScale = 1): { x: number; y: number } {
    const drawW = iconSize * containerScale * 1.18 * (320 / 471);
    const drawH = iconSize * containerScale * 1.18;
    return {
      x: (0.503125 - 0.5) * drawW,
      y: (0.382166 - 0.5) * drawH,
    };
  }

  function drawHeartRefillFx(shellCtx: CanvasRenderingContext2D, _shellW: number, _shellH: number): void {
    if (heartRefillFxStartedAt <= 0 || !stageLayout) return;
    const durationMs = GAME_ASSET_TUNING.fx.heartRefillHud.durationMs;
    const t = Math.min(1, (performance.now() - heartRefillFxStartedAt) / durationMs);
    if (t >= 1) {
      heartRefillFxStartedAt = 0;
      return;
    }
    const stageScale = stageLayout.scale;
    const hudY = stageLayout.hudY + 7 * stageScale;
    const lives: LivesDisplay = { current: heartRefillTargetIndex + 1, max: heartRefillMax };
    const metrics = hudHeartRowMetrics(stageLayout.livesAnchor.x, hudY, lives, stageScale);
    const slotCx = metrics.x + heartRefillTargetIndex * (metrics.iconSize + metrics.gap) + metrics.iconSize / 2;
    const slotCy = metrics.cy;
    const burst = Math.max(0, Math.min(1, t / 0.68));
    const popIn = Math.max(0, Math.min(1, (t - 0.08) / 0.38));
    const settle = Math.max(0, Math.min(1, (t - 0.5) / 0.26));
    const popScale = settle > 0
      ? 1.12 - 0.12 * (1 - (1 - settle) ** 3)
      : 0.72 + Math.sin(popIn * Math.PI * 0.5) * 0.4;
    const iconSize = metrics.iconSize;
    const drawScale = Math.max(0.72, popScale);
    const visualOffset = heartCutoutVisualOffset(iconSize, drawScale);
    const cx = slotCx + visualOffset.x;
    const cy = slotCy + visualOffset.y;

    shellCtx.save();
    shellCtx.globalCompositeOperation = 'lighter';
    const ringAlpha = (1 - burst) * 0.72;
    if (ringAlpha > 0) {
      shellCtx.strokeStyle = `rgba(255, 213, 92, ${ringAlpha})`;
      shellCtx.lineWidth = Math.max(1.2, 2.5 * stageScale * (1 - burst * 0.55));
      shellCtx.beginPath();
      shellCtx.arc(cx, cy, iconSize * (0.42 + burst * 0.72), 0, Math.PI * 2);
      shellCtx.stroke();
      shellCtx.strokeStyle = `rgba(45, 236, 255, ${ringAlpha * 0.55})`;
      shellCtx.lineWidth = Math.max(1, 1.7 * stageScale * (1 - burst * 0.4));
      shellCtx.beginPath();
      shellCtx.arc(cx, cy, iconSize * (0.28 + burst * 0.52), 0, Math.PI * 2);
      shellCtx.stroke();
    }

    for (let i = 0; i < 10; i += 1) {
      const angle = i * (Math.PI * 2 / 10) - Math.PI / 2;
      const dist = iconSize * (0.28 + burst * 0.82) * (i % 2 === 0 ? 1 : 0.72);
      const alpha = (1 - burst) * 0.72;
      shellCtx.fillStyle = i % 3 === 0 ? `rgba(255, 213, 92, ${alpha})` : `rgba(45, 236, 255, ${alpha})`;
      shellCtx.beginPath();
      shellCtx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.82, Math.max(1.1, iconSize * (0.065 - burst * 0.035)), 0, Math.PI * 2);
      shellCtx.fill();
    }

    shellCtx.globalCompositeOperation = 'source-over';
    const refillCutout = getGameCutout('heart-refill');
    if (refillCutout) {
      const drawSize = iconSize * drawScale;
      shellCtx.globalAlpha = Math.min(1, 0.35 + popIn * 0.9);
      shellCtx.shadowColor = 'rgba(255, 213, 92, 0.5)';
      shellCtx.shadowBlur = iconSize * 0.34;
      drawImageContained(shellCtx, refillCutout, slotCx - drawSize / 2, slotCy - drawSize / 2, drawSize, drawSize, 1.18);
    }
    shellCtx.restore();

    if (t < 1) scheduleAnimationFrame();
  }

  function drawLevelUpFx(shellCtx: CanvasRenderingContext2D, shellW: number, shellH: number): void {
    if (levelUpFxStartedAt <= 0) return;
    const durationMs = GAME_ASSET_TUNING.fx.levelUp.durationMs;
    const t = Math.min(1, (performance.now() - levelUpFxStartedAt) / durationMs);
    if (t >= 1) {
      levelUpFxStartedAt = 0;
      return;
    }
    const alpha = Math.max(0, 1 - t * 0.85);
    const stageScale = stageLayout?.scale ?? 1;
    const cx = shellW / 2;
    const cy = shellH * 0.38;

    shellCtx.save();
    shellCtx.globalAlpha = alpha;
    drawFxSpriteFrame(
      shellCtx,
      'level-up',
      t,
      cx,
      cy,
      180 * stageScale * GAME_ASSET_TUNING.fx.levelUp.spriteW,
      120 * stageScale * GAME_ASSET_TUNING.fx.levelUp.spriteH,
      GAME_ASSET_TUNING.fx.levelUp.spriteAlpha,
    );
    shellCtx.restore();

    if (t < 1) scheduleAnimationFrame();
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

  function drawSpaceHint(
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

    scheduleContinuousRepaint();
  }

  function getSpaceHintRect(
    pressure: ScrollPressureState | undefined,
  ): { x: number; y: number; w: number; h: number } | null {
    if (!stageLayout || !squareLayout) return null;
    const scale = stageLayout.scale;
    const grid = squareLayout.grid;
    const coveredRows = Math.max(1, Math.min(currentRows, Math.floor(pressure?.batchRows ?? 1)));
    const dangerTop =
      boardOffsetY +
      squareLayout.gridOriginY +
      (currentRows - coveredRows) * grid.cellStep -
      2;
    const hintH = Math.max(12 * scale, grid.cellSize * 0.28);
    const hintW = grid.cellStep * 2;
    const gridLeft = boardOffsetX + squareLayout.gridOriginX;
    const hintX = gridLeft + (boardWidth - hintW) / 2;
    const hintY = dangerTop - hintH - 4 * scale;
    const minY = boardOffsetY + squareLayout.gridOriginY + 4 * scale;
    return {
      x: hintX,
      y: Math.max(minY, hintY),
      w: hintW,
      h: hintH,
    };
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
    const scorePopAsset = drawFeedbackAsset(
      shellCtx,
      hudFeedbackAssets.scorePopBase,
      0,
      8 * stageScale,
      152 * stageScale,
      92 * stageScale,
      0.92,
      Math.min(0.92, alpha),
    );
    if (!scorePopAsset) {
      drawFxSpriteFrame(shellCtx, 'score-pop', t, 0, 0, 132 * stageScale, 56 * stageScale, GAME_ASSET_TUNING.fx.scorePop.spriteAlpha);
    }
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
    drawFxSpriteFrame(shellCtx, 'wrong-flag-break', t, 0, 6, 190 * stageScale, 108 * stageScale, GAME_ASSET_TUNING.fx.break.spriteAlpha);
    drawUiPanelImage(shellCtx, 'break-chip', -52 * stageScale, -42 * stageScale, 104 * stageScale, 32 * stageScale, 1);
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

  function drawDifficultyAlert(shellCtx: CanvasRenderingContext2D, shellW: number): void {
    if (!activeDifficultyAlert) return;
    const elapsedMs = performance.now() - activeDifficultyAlert.startedAt;
    const t = Math.max(0, Math.min(1, elapsedMs / DIFFICULTY_ALERT_MS));
    if (t >= 1) {
      activeDifficultyAlert = null;
      return;
    }

    const stageScale = stageLayout?.scale ?? 1;
    const kind = activeDifficultyAlert.kind;
    const isDanger = kind === 'danger-rise';
    const image = isDanger ? hudFeedbackAssets.dangerRiseAlert : hudFeedbackAssets.speedUpAlert;
    const label = isDanger ? 'DANGER RISE' : 'SPEED UP';
    const main = isDanger ? '255, 76, 86' : '255, 190, 55';
    const soft = isDanger ? '251, 113, 36' : '45, 236, 255';
    const textColor = isDanger ? '#ffe4e6' : '#fef3c7';
    const enter = Math.min(1, t / 0.18);
    const exit = t > 0.78 ? Math.min(1, (t - 0.78) / 0.22) : 0;
    const alpha = Math.sin(enter * Math.PI * 0.5) * (1 - exit);
    const impact = t < 0.25 ? 1 - t / 0.25 : 0;
    const shake = isDanger ? Math.sin(t * Math.PI * 18) * impact * 3 * stageScale : 0;
    const cx = shellW / 2 + shake;
    const cy = stageLayout ? Math.max(stageLayout.hudH + 18 * stageScale, stageLayout.boardY - 14 * stageScale) : 92 * stageScale;
    const maxW = Math.min(shellW * 0.58, 300 * stageScale);
    const maxH = 60 * stageScale;
    const asset = drawFeedbackAsset(shellCtx, image, cx, cy, maxW, maxH, 0.98 + impact * 0.035, alpha);
    if (!asset) return;

    shellCtx.save();
    shellCtx.globalAlpha = alpha;
    shellCtx.globalCompositeOperation = 'lighter';
    const scanX = asset.x + ((t * 1.35) % 1) * asset.w;
    const scan = shellCtx.createLinearGradient(scanX - asset.w * 0.12, 0, scanX + asset.w * 0.12, 0);
    scan.addColorStop(0, 'rgba(255,255,255,0)');
    scan.addColorStop(0.5, `rgba(${soft}, ${0.2 + impact * 0.16})`);
    scan.addColorStop(1, 'rgba(255,255,255,0)');
    shellCtx.fillStyle = scan;
    shellCtx.fillRect(asset.x + asset.w * 0.1, asset.y + asset.h * 0.24, asset.w * 0.8, asset.h * 0.52);

    for (let i = 0; i < 10; i += 1) {
      const p = (t + i * 0.083) % 1;
      const px = asset.x + asset.w * (0.2 + p * 0.6);
      const py = asset.y + asset.h * (isDanger ? 0.74 - p * 0.44 : 0.38 + Math.sin(i) * 0.1);
      shellCtx.fillStyle = i % 3 === 0 ? `rgba(${main}, ${alpha * (1 - p)})` : `rgba(${soft}, ${alpha * 0.7 * (1 - p)})`;
      shellCtx.fillRect(px, py, Math.max(1, 1.4 * stageScale), Math.max(1, 1.3 * stageScale + (isDanger ? p * 7 * stageScale : 0)));
      if (!isDanger) shellCtx.fillRect(px - 10 * stageScale, py, 9 * stageScale, Math.max(1, 1.2 * stageScale));
    }

    shellCtx.globalCompositeOperation = 'source-over';
    shellCtx.textAlign = 'center';
    shellCtx.textBaseline = 'middle';
    shellCtx.font = `1000 ${Math.min(19 * stageScale, asset.h * 0.28)}px ${FONTS.mono}`;
    shellCtx.lineWidth = Math.max(2, asset.h * 0.04);
    shellCtx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
    shellCtx.shadowColor = `rgba(${main}, ${0.72 + impact * 0.18})`;
    shellCtx.shadowBlur = asset.h * (0.12 + impact * 0.07);
    shellCtx.strokeText(label, asset.x + asset.w / 2, asset.y + asset.h * 0.52);
    shellCtx.fillStyle = textColor;
    shellCtx.fillText(label, asset.x + asset.w / 2, asset.y + asset.h * 0.52);
    shellCtx.restore();

    scheduleAnimationFrame();
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
    const difficulty = stats?.difficulty;

    if (difficulty) {
      if (lastDifficultySpeedTier === null || lastDifficultyBatchTier === null) {
        lastDifficultySpeedTier = difficulty.speedTier;
        lastDifficultyBatchTier = difficulty.batchTier;
      } else {
        if (difficulty.batchTier > lastDifficultyBatchTier) {
          activeDifficultyAlert = { kind: 'danger-rise', startedAt: performance.now() };
          scheduleAnimationFrame();
        } else if (difficulty.speedTier > lastDifficultySpeedTier) {
          activeDifficultyAlert = { kind: 'speed-up', startedAt: performance.now() };
          scheduleAnimationFrame();
        }
        lastDifficultySpeedTier = difficulty.speedTier;
        lastDifficultyBatchTier = difficulty.batchTier;
      }
    }

    if (stats?.scoreEvent && stats.scoreEvent.id !== lastScoreEventId) {
      lastScoreEventId = stats.scoreEvent.id;
      activeScoreEvent = stats.scoreEvent;
      scoreFxStartedAt = performance.now();
      spawnScoreHudParticles();
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
      const levelThresholds = [10, 20, 50];
      for (const threshold of levelThresholds) {
        if (lastCombo < threshold && combo >= threshold) {
          levelUpFxStartedAt = performance.now();
          scheduleAnimationFrame();
          break;
        }
      }
      lastCombo = combo;
      if (combo > 1) comboFxStartedAt = performance.now();
    }

    drawHeartRefillFx(shellCtx, shellW, shellH);
    drawLevelUpFx(shellCtx, shellW, shellH);

    drawBottomEnergyRail(shellCtx, scrollPressure, shellW, shellH);
    drawFullscreenScrollWarning(shellCtx, scrollPressure, shellW, shellH);

    if (stats?.spaceEnabled) {
      const spaceRect = getSpaceHintRect(scrollPressure);
      if (spaceRect) {
        drawSpaceHint(shellCtx, spaceRect, scrollPressure, stageLayout?.scale ?? 1);
      }
    }

    drawParticles(shellCtx, performance.now());
    drawDifficultyAlert(shellCtx, shellW);
    drawBreakEvent(shellCtx, activeBreakEvent, breakFxStartedAt, shellW, shellH);

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
      const burstW = (isMobile ? 150 : 190) * stageScale;
      const burstH = (isMobile ? 66 : 80) * stageScale;
      const halfBurstH =
        burstH * GAME_ASSET_TUNING.fx.comboBurst.spriteH * burstScale * 0.5;
      const railTop = stageLayout?.bottomRailRect.y ?? shellH;
      const cy = Math.min(
        slots.comboBurst.y - t * 10 * stageScale,
        railTop - halfBurstH - 8 * stageScale,
      );

      shellCtx.save();
      shellCtx.globalAlpha = alpha;
      shellCtx.translate(cx, cy);
      shellCtx.scale(burstScale, burstScale);

      const comboBurstAsset = drawFeedbackAsset(
        shellCtx,
        hudFeedbackAssets.comboBurstBase,
        0,
        0,
        burstW * GAME_ASSET_TUNING.fx.comboBurst.spriteW,
        burstH * GAME_ASSET_TUNING.fx.comboBurst.spriteH,
        1,
        Math.min(0.9, alpha),
      );
      if (!comboBurstAsset) {
        drawFxSpriteFrame(
          shellCtx,
          'combo-burst',
          t,
          0,
          0,
          burstW * GAME_ASSET_TUNING.fx.comboBurst.spriteW,
          burstH * GAME_ASSET_TUNING.fx.comboBurst.spriteH,
          GAME_ASSET_TUNING.fx.comboBurst.spriteAlpha,
        );
      }

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

    drawScoreEvent(shellCtx, activeScoreEvent, scoreFxStartedAt, shellW);

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
      const now = performance.now();
      const action = panelTransitionProgress('start', now);
      const pop = action > 0 ? 1 - Math.sin(action * Math.PI) * 0.025 : 1;
      startRect = { x, y, w, h };
      shellCtx.save();
      const panelBounds = drawUiPanelImageBounds(shellCtx, 'start-panel', x, y, w, h, 1.03 * pop);
      if (!panelBounds) {
        drawArcadePanel(shellCtx, x, y, w, h, 'rgba(59, 130, 246, 0.78)', 'rgba(3, 8, 20, 0.95)');
        drawHudIcon(shellCtx, 'play', shellW / 2 - 12, y + 32, { size: 24 });
        shellCtx.fillStyle = '#fde047';
        shellCtx.font = `900 46px ${FONTS.display}`;
        shellCtx.textAlign = 'center';
        shellCtx.textBaseline = 'middle';
        shellCtx.fillText('START', shellW / 2, y + h / 2 + 8);
      }
      drawRuntimePanelV3Fx(shellCtx, panelBounds?.x ?? x, panelBounds?.y ?? y, panelBounds?.w ?? w, panelBounds?.h ?? h, 'start', now, action);
      shellCtx.restore();
    }

    if (currentStatus === 'lost') {
      const panelW = Math.min(480, shellW - 40, Math.max(300, boardWidth * 1.18));
      const panelH = Math.round(panelW * (269 / 430));
      const panelX = (shellW - panelW) / 2;
      const panelY = Math.max(96, boardOffsetY + boardHeight * 0.42 - panelH / 2);
      const now = performance.now();
      const action = panelTransitionProgress('retry', now);
      const shake =
        action > 0 && action < 0.55 ? Math.sin(action * Math.PI * 18) * (1 - action) * Math.min(panelW, panelH) * 0.012 : 0;
      const pop = action > 0 ? 1 - Math.sin(action * Math.PI) * 0.025 : 1;
      const retryW = panelW * 0.52;
      const retryH = panelH * 0.2;
      const retryX = panelX + (panelW - retryW) / 2;
      const retryY = panelY + panelH * 0.68;
      retryRect = { x: retryX, y: retryY, w: retryW, h: retryH };

      shellCtx.save();
      shellCtx.fillStyle = THEME.overlayScrim;
      shellCtx.fillRect(0, 0, shellW, shellH);
      const panelBounds = drawUiPanelImageBounds(shellCtx, 'game-over-panel', panelX + shake, panelY, panelW, panelH, 1.03 * pop);
      if (!panelBounds) {
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
      drawRuntimePanelV3Fx(
        shellCtx,
        panelBounds?.x ?? panelX,
        panelBounds?.y ?? panelY,
        panelBounds?.w ?? panelW,
        panelBounds?.h ?? panelH,
        'game-over',
        now,
        action,
      );
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
    if (!drawUiPanelImage(shellCtx, 'log-panel', x, y, modalW, modalH, 1.02)) {
      drawArcadePanel(shellCtx, x, y, modalW, modalH, 'rgba(59, 130, 246, 0.72)', 'rgba(3, 8, 18, 0.96)');
    }
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
    shellCtx.fillText('` / Esc close', x + modalW - 24, y + 25);

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

  function updateBoardPointer(x: number, y: number, pressed: boolean): void {
    if (currentStatus !== 'playing') {
      boardPointer = null;
      return;
    }
    const cell = cellAtCoords(x, y);
    if (cell) {
      boardPointer = { row: cell.row, col: cell.col, pressed };
      scheduleAnimationFrame();
      return;
    }
    if (!pressed) boardPointer = null;
  }

  function onMouseDown(event: MouseEvent): void {
    const { x, y } = canvasCoords(event);
    if (event.button === 0) updateBoardPointer(x, y, true);
    unlockAudioFromPointer();

    if (fullscreen?.isLogOpen?.()) return;
    if (pendingPanelTransition) {
      event.preventDefault();
      return;
    }

    if (fullscreen && bgmMuteRect && insideRect(bgmMuteRect, x, y)) {
      event.preventDefault();
      fullscreen.onUiClick?.();
      fullscreen.onToggleBgmMute?.();
      scheduleAnimationFrame();
      return;
    }

    if (fullscreen && devAutoRect) {
      const insideAuto =
        x >= devAutoRect.x &&
        x <= devAutoRect.x + devAutoRect.w &&
        y >= devAutoRect.y &&
        y <= devAutoRect.y + devAutoRect.h;
      if (insideAuto) {
        event.preventDefault();
        fullscreen.onUiClick?.();
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
        fullscreen.onUiClick?.();
        beginPanelTransition('start', () => fullscreen.onStart?.());
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
        fullscreen.onUiClick?.();
        beginPanelTransition('retry', () => fullscreen.onRestart?.());
        return;
      }
      return;
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

  function insideRect(
    rect: { x: number; y: number; w: number; h: number },
    x: number,
    y: number,
  ): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function hitInteractiveUi(x: number, y: number): string | null {
    if (bgmMuteRect && insideRect(bgmMuteRect, x, y)) return 'bgm-mute';
    if (devAutoRect && insideRect(devAutoRect, x, y)) return 'dev-auto';
    if (
      currentStatus === 'idle' &&
      startRect &&
      (fullscreen?.showStartOverlay?.() ?? true) &&
      insideRect(startRect, x, y)
    ) {
      return 'start';
    }
    if (currentStatus === 'lost' && retryRect && insideRect(retryRect, x, y)) return 'retry';
    if (hitReset(x, y)) return 'reset';
    return null;
  }

  function updateUiHover(x: number, y: number): void {
    if (!fullscreen?.onUiHover) return;
    const target = hitInteractiveUi(x, y);
    if (target && target !== uiHoverTarget) {
      fullscreen.onUiHover();
    }
    uiHoverTarget = target;
  }

  function onMouseMove(event: MouseEvent): void {
    const { x, y } = canvasCoords(event);
    const pressed = (event.buttons & 1) !== 0;
    updateBoardPointer(x, y, pressed);
    updateUiHover(x, y);
  }

  function onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      const { x, y } = canvasCoords(event);
      updateBoardPointer(x, y, false);
    }
  }

  function onMouseLeave(): void {
    boardPointer = null;
    uiHoverTarget = null;
  }

  function unlockAudioFromPointer(): void {
    fullscreen?.onPointerDown?.();
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse') return;
    unlockAudioFromPointer();
  }

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('dblclick', onDoubleClick);
  if (fullscreen) {
    window.addEventListener('resize', paint);
    startAmbientLoop();
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
        activeDifficultyAlert = null;
        lastDifficultySpeedTier = null;
        lastDifficultyBatchTier = null;
        boardLayerCacheKey = '';
      }
      if (
        pendingPanelTransition &&
        ((pendingPanelTransition.kind === 'start' && status !== 'idle') ||
          (pendingPanelTransition.kind === 'retry' && status !== 'lost'))
      ) {
        clearPendingPanelTransition();
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
      clearPendingPanelTransition();
      stopPressureRepaint();
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('dblclick', onDoubleClick);
      if (fullscreen) {
        window.removeEventListener('resize', paint);
      }
      canvas.remove();
    },
  };
}
