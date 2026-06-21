import type { CellView, GameStatus } from '../core/types.ts';
import type { AiHintDisplay } from '../core/ai/types.ts';
import { DEFAULT_CELL_SIZE, FONTS, THEME, computeViewportCellSize } from './theme.ts';
import {
  drawChipLabel,
  drawHudIcon,
  drawIconTextButton,
  drawLivesRow,
  parseLivesDisplay,
  type HudIconName,
} from './hud-sprites.ts';
import {
  getHexLayoutMetrics,
  hitTestHexCell,
  hitTestHexReset,
  renderHexFrame,
} from './hex-grid.ts';
import {
  getCanvasPointerCoords,
  getBoardOnlyLayoutMetrics,
  getLayoutMetrics,
  hitTestCell,
  hitTestReset,
  renderBoardOnlyFrame,
  renderFrame,
  type LayoutMetrics,
  type ScrollPressureState,
} from './renderer.ts';
import {
  drawImageContained,
  getGameFxBlendMode,
  getGameFxFrames,
  type GameFxName,
} from './game-assets.ts';

export interface GameCanvasCallbacks {
  onReveal(row: number, col: number): void;
  onToggleFlag(row: number, col: number): void;
  onChord(row: number, col: number): void;
  onReset(): void;
}

export interface GameCanvasLogLine {
  time: string;
  text: string;
  kind: 'ai' | 'player' | 'scroll' | 'danger' | 'system';
}

export interface GameCanvasHudStats {
  score: number;
  combo: number;
  lives?: string;
  defused?: string;
  depth?: number;
  status: string;
  countdown?: string;
  spaceEnabled: boolean;
  devAutoVisible?: boolean;
  devAutoActive?: boolean;
}

export interface GameCanvasFullscreenOptions {
  title: string;
  getAiStatus?: () => string;
  getStats?: () => GameCanvasHudStats;
  getRecentLogs?: () => GameCanvasLogLine[];
  isLogOpen?: () => boolean;
  onStart?: () => void;
  /** idle 时是否仍显示「开始」遮罩（false = 已点开始，等待玩家首击） */
  showStartOverlay?: () => boolean;
  onRestart?: () => void;
  onSpace?: () => void;
  onDevAuto?: () => void;
}

export interface ViewportFitOptions {
  cols: number;
  rows: number;
  minCellSize?: number;
  maxCellSize?: number;
  safe?: number;
  topReserve?: number;
  bottomReserve?: number;
}

export interface GameCanvasOptions {
  hexRadius?: number;
  /** 放宽棋盘最大像素，大格盘时格子更大 */
  maxGrid?: { width: number; height: number };
  /** 固定格宽（无尽卷轴模式） */
  fixedCellSize?: number;
  /** 固定棋盘行数（无尽卷轴：Canvas 高度不随缓冲变化） */
  fixedGridRows?: number;
  /** 全屏时按视口拟合格子尺寸（竖长无尽盘） */
  fitViewport?: ViewportFitOptions;
  /** 每次绘制时读取右侧 HUD（卷轴倒计时等） */
  getHudRightDisplay?: () => string | undefined;
  /** 无尽卷轴压迫感（准备上移倒数） */
  getScrollPressure?: () => ScrollPressureState | undefined;
  /** 游戏页全屏 Canvas Shell（HUD、操作、日志都画在同一张 Canvas） */
  fullscreen?: GameCanvasFullscreenOptions;
}

export interface GameCanvasRenderOptions {
  hudLeftDisplay?: string;
  hudDefusedDisplay?: string;
  hudRightDisplay?: string;
  rows?: number;
  cols?: number;
  aiHint?: AiHintDisplay | null;
}

export interface GameCanvasController {
  render(
    views: CellView[],
    status: GameStatus,
    flagCount: number,
    options?: GameCanvasRenderOptions,
  ): void;
  startTimer(): void;
  stopTimer(): void;
  resetTimer(): void;
  /** 仅重绘（卷轴倒数动画） */
  repaint(): void;
  destroy(): void;
}

function applyCanvasSize(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function createGameCanvas(
  container: HTMLElement,
  rows: number,
  cols: number,
  mineTotal: number,
  callbacks: GameCanvasCallbacks,
  canvasOptions: GameCanvasOptions = {},
): GameCanvasController {
  const isHex = canvasOptions.hexRadius !== undefined;
  const fixedCellSize = canvasOptions.fixedCellSize;
  const fixedGridRows = canvasOptions.fixedGridRows;
  const fitViewport = canvasOptions.fitViewport;
  const getHudRightDisplayFn = canvasOptions.getHudRightDisplay;
  const getScrollPressureFn = canvasOptions.getScrollPressure;
  const fullscreen = canvasOptions.fullscreen;
  const hexLayout = isHex ? getHexLayoutMetrics(canvasOptions.hexRadius!) : null;
  let currentRows = fixedGridRows ?? rows;
  let currentCols = cols;
  let fittedCellSize: number | undefined = fixedCellSize;

  function getFullscreenBoardReserves(shellW: number): { safe: number; top: number; bottom: number } {
    const safe = Math.max(16, Math.min(28, shellW * 0.028));
    const topBarH = shellW < 560 ? 68 : 76;
    return {
      safe,
      top: topBarH + safe * 2,
      bottom: 80 + safe + 16,
    };
  }

  function resolveInitialCellSize(): number | undefined {
    if (fixedCellSize !== undefined) return fixedCellSize;
    if (!fitViewport || !fullscreen) return undefined;
    const reserves = getFullscreenBoardReserves(window.innerWidth);
    return computeViewportCellSize(
      fitViewport.cols,
      fitViewport.rows,
      window.innerWidth,
      window.innerHeight,
      reserves,
      { min: fitViewport.minCellSize, max: fitViewport.maxCellSize },
    );
  }

  fittedCellSize = resolveInitialCellSize();

  let squareLayout: LayoutMetrics | null = isHex
    ? null
    : fullscreen
      ? getBoardOnlyLayoutMetrics(currentRows, cols, canvasOptions.maxGrid, fittedCellSize)
      : getLayoutMetrics(currentRows, cols, canvasOptions.maxGrid, fixedCellSize);

  const canvas = document.createElement('canvas');
  canvas.className = fullscreen ? 'game-canvas game-canvas--fullscreen' : 'game-canvas';
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', isHex ? '六边形扫雷棋盘' : '扫雷棋盘');
  container.appendChild(canvas);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context not available');
  }
  const ctx = context;

  let boardWidth = isHex ? hexLayout!.width : squareLayout!.width;
  let boardHeight = isHex ? hexLayout!.height : squareLayout!.height;
  let width = fullscreen ? window.innerWidth : boardWidth;
  let height = fullscreen ? window.innerHeight : boardHeight;
  let boardOffsetX = 0;
  let boardOffsetY = 0;
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
  let currentHudDefusedDisplay: string | undefined;
  let currentHudRightDisplay: string | undefined;
  let currentAiHint: AiHintDisplay | null | undefined;
  let lastCombo = 0;
  let comboFxStartedAt = 0;
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
    if (isHex || !squareLayout || fixedGridRows !== undefined) return;
    squareLayout = fullscreen
      ? getBoardOnlyLayoutMetrics(nextRows, nextCols, canvasOptions.maxGrid, fixedCellSize)
      : getLayoutMetrics(nextRows, nextCols, canvasOptions.maxGrid, fixedCellSize);
    boardWidth = squareLayout.width;
    boardHeight = squareLayout.height;
    if (!fullscreen) {
      width = boardWidth;
      height = boardHeight;
      applyCanvasSize(canvas, ctx, width, height);
    }
  }

  function syncViewportFitLayout(): void {
    if (!fitViewport || isHex || !squareLayout) return;
    const reserves = getFullscreenBoardReserves(width);
    const nextCell = computeViewportCellSize(
      fitViewport.cols,
      fitViewport.rows,
      width,
      height,
      reserves,
      { min: fitViewport.minCellSize, max: fitViewport.maxCellSize },
    );
    if (nextCell === fittedCellSize) return;
    fittedCellSize = nextCell;
    squareLayout = getBoardOnlyLayoutMetrics(
      fitViewport.rows,
      fitViewport.cols,
      canvasOptions.maxGrid,
      nextCell,
    );
    boardWidth = squareLayout.width;
    boardHeight = squareLayout.height;
  }

  function syncBoardSizeFromLayout(): void {
    if (fullscreen && fitViewport) syncViewportFitLayout();
    boardWidth = isHex ? hexLayout!.width : squareLayout!.width;
    boardHeight = isHex ? hexLayout!.height : squareLayout!.height;
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
    return `${view.row},${view.col}`;
  }

  function queueCellEffect(kind: CellFxKind, row: number, col: number, now: number): void {
    const durationMs =
      kind === 'explode' ? 760 : kind === 'flag' || kind === 'unflag' ? 360 : 420;
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
      const prev = prevByKey.get(viewKey(view));
      if (!prev) continue;
      if (!prev.revealed && view.revealed) {
        queueCellEffect('reveal', view.row, view.col, now);
        queued += 1;
        if (view.isMine) {
          queueCellEffect('explode', view.row, view.col, now);
          queued += 1;
        }
      } else if (!prev.flagged && view.flagged) {
        queueCellEffect('flag', view.row, view.col, now);
        queued += 1;
      } else if (prev.flagged && !view.flagged) {
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
    if (isHex || !squareLayout || cellEffects.length === 0) return;
    const { gridOriginX, gridOriginY, grid } = squareLayout;

    effectCtx.save();
    for (const fx of cellEffects) {
      const age = now - fx.startedAt;
      const t = Math.max(0, Math.min(1, age / fx.durationMs));
      const { x, y } = cellPixelForFx(fx.row, fx.col, gridOriginX, gridOriginY, grid);
      const cx = x + grid.cellSize / 2;
      const cy = y + grid.cellSize / 2;

      if (fx.kind === 'reveal') {
        drawFxFrame(effectCtx, 'safe-reveal', t, cx, cy, grid.cellSize * 2.1, grid.cellSize * 2.1);
      } else if (fx.kind === 'flag') {
        drawFxFrame(effectCtx, 'flag-pop', t, cx, cy, grid.cellSize * 2.2, grid.cellSize * 1.7);
      } else if (fx.kind === 'explode') {
        drawFxFrame(effectCtx, 'mine-explosion', t, cx, cy, grid.cellSize * 3.2, grid.cellSize * 2.4);
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
          `rgba(96, 165, 250, ${0.18 * alpha})`,
        );
        strokeRounded(
          x - pad + 0.5,
          y - pad + 0.5,
          grid.cellSize + pad * 2 - 1,
          grid.cellSize + pad * 2 - 1,
          grid.cellRadius + 4,
          `rgba(147, 197, 253, ${0.65 * alpha})`,
          1.5,
        );
      }

      if (fx.kind === 'flag' || fx.kind === 'unflag') {
        const alpha = 1 - t;
        const radius = grid.cellSize * (0.28 + t * 0.42);
        effectCtx.strokeStyle =
          fx.kind === 'flag'
            ? `rgba(99, 102, 241, ${0.7 * alpha})`
            : `rgba(245, 158, 11, ${0.65 * alpha})`;
        effectCtx.lineWidth = Math.max(1, grid.cellSize * 0.055);
        effectCtx.beginPath();
        effectCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        effectCtx.stroke();
      }

      if (fx.kind === 'explode') {
        const alpha = 1 - t;
        const radius = grid.cellSize * (0.35 + t * 1.15);
        const glow = effectCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        glow.addColorStop(0, `rgba(248, 113, 113, ${0.48 * alpha})`);
        glow.addColorStop(0.45, `rgba(251, 146, 60, ${0.28 * alpha})`);
        glow.addColorStop(1, 'rgba(248, 113, 113, 0)');
        effectCtx.fillStyle = glow;
        effectCtx.beginPath();
        effectCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        effectCtx.fill();

        effectCtx.strokeStyle = `rgba(254, 202, 202, ${0.8 * alpha})`;
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
  ): boolean {
    const frames = getGameFxFrames(name);
    if (!frames || frames.length === 0) return false;
    const index = Math.min(frames.length - 1, Math.floor(t * frames.length));
    const frame = frames[index];
    if (!frame) return false;

    fxCtx.save();
    fxCtx.globalCompositeOperation = getGameFxBlendMode(name);
    fxCtx.globalAlpha = Math.max(0, Math.min(1, 1 - Math.max(0, t - 0.82) / 0.18));
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

  function spawnComboParticles(combo: number): void {
    const now = performance.now();
    const palette = comboColor(combo);
    const count = Math.min(42, 14 + Math.floor(combo / 2));
    const originX = width / 2;
    const originY = Math.max(120, boardOffsetY + boardHeight * 0.34);

    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45;
      const speed = 1.4 + Math.random() * 3.1 + Math.min(3, combo / 24);
      particles.push({
        x: originX + (Math.random() - 0.5) * 80,
        y: originY + (Math.random() - 0.5) * 28,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 2.2 + Math.random() * 3.8,
        color: palette.stroke,
        startedAt: now,
        durationMs: 680 + Math.random() * 420,
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
    const hudRight = getHudRightDisplayFn?.() ?? currentHudRightDisplay;
    const scrollPressure = getScrollPressureFn?.();
    const renderState = {
      views: currentViews,
      status: currentStatus,
      mineTotal,
      flagCount: currentFlagCount,
      elapsedSeconds: elapsed,
      hudLeftDisplay: currentHudLeftDisplay,
      hudDefusedDisplay: currentHudDefusedDisplay,
      hudRightDisplay: hudRight,
      scrollPressure,
      aiHint: currentAiHint,
    };

    if (fullscreen) {
      drawFullscreenShell(ctx, fullscreen, width, height, boardWidth, boardHeight);
      ctx.save();
      ctx.translate(boardOffsetX, boardOffsetY);
    }

    if (isHex && hexLayout) {
      renderHexFrame(ctx, hexLayout, {
        ...renderState,
        aiHint: currentAiHint,
      });
    } else if (fullscreen) {
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

  function drawChip(
    shellCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
    align: 'left' | 'center' | 'right' = 'left',
    labelIcon?: HudIconName,
  ): void {
    fillRounded(x, y, w, h, 10, THEME.hudPillBg);
    strokeRounded(x + 0.5, y + 0.5, w - 1, h - 1, 10, THEME.hudPillBorder);
    shellCtx.fillStyle = THEME.hudMuted;
    shellCtx.font = `600 10px ${FONTS.display}`;
    shellCtx.textAlign = 'left';
    shellCtx.textBaseline = 'top';
    drawChipLabel(shellCtx, x, y + 8, label, align, w, labelIcon);

    const lives = parseLivesDisplay(value);
    if (lives) {
      const iconSize = 18;
      const rowW = lives.max * iconSize + (lives.max - 1) * 4;
      const rowX =
        align === 'left' ? x + 12 : align === 'right' ? x + w - 12 - rowW : x + (w - rowW) / 2;
      if (!drawLivesRow(shellCtx, rowX, y + 36, lives, iconSize, 4)) {
        shellCtx.fillStyle = '#ef4444';
        shellCtx.font = `600 15px ${FONTS.mono}`;
        shellCtx.textAlign = align;
        shellCtx.fillText(value, align === 'left' ? x + 12 : align === 'right' ? x + w - 12 : x + w / 2, y + 24);
      }
      return;
    }

    shellCtx.fillStyle = THEME.hudText;
    shellCtx.font = `600 15px ${FONTS.mono}`;
    shellCtx.textAlign = align;
    shellCtx.textBaseline = 'top';
    const valueX = align === 'left' ? x + 12 : align === 'right' ? x + w - 12 : x + w / 2;
    shellCtx.fillText(value, valueX, y + 24);
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

  function drawFullscreenShell(
    shellCtx: CanvasRenderingContext2D,
    shell: GameCanvasFullscreenOptions,
    shellW: number,
    shellH: number,
    innerBoardW: number,
    innerBoardH: number,
  ): void {
    shellCtx.clearRect(0, 0, shellW, shellH);
    spaceKeyRect = null;
    startRect = null;
    retryRect = null;
    devAutoRect = null;

    drawModernBackground(shellCtx, shellW, shellH);

    const { safe, top: topReserve, bottom: bottomReserve } = getFullscreenBoardReserves(shellW);
    const topBarH = shellW < 560 ? 68 : 76;
    const availableH = Math.max(200, shellH - topReserve - bottomReserve);
    boardOffsetX = Math.max(safe, (shellW - innerBoardW) / 2);
    boardOffsetY = topReserve + Math.max(0, (availableH - innerBoardH) / 2);

    const stats = shell.getStats?.();

    // 浮动顶栏
    const barX = safe;
    const barY = safe;
    const barW = shellW - safe * 2;
    fillRounded(barX, barY, barW, topBarH, 14, THEME.hudPanelBg);
    strokeRounded(barX + 0.5, barY + 0.5, barW - 1, topBarH - 1, 14, THEME.panelBorder);

    const chipH = topBarH - 16;
    const chipY = barY + 8;
    const chipW = shellW < 560 ? 96 : 112;

    drawChip(
      shellCtx,
      barX + 12,
      chipY,
      chipW,
      chipH,
      'SCORE',
      String(stats?.score ?? 0).padStart(5, '0'),
      'left',
    );

    if ((stats?.combo ?? 0) > 0) {
      drawChip(
        shellCtx,
        barX + 12 + chipW + 8,
        chipY,
        72,
        chipH,
        'COMBO',
        `×${stats?.combo ?? 0}`,
        'left',
      );
    }

    if (stats?.countdown) {
      const timerW = Math.max(118, Math.min(158, stats.countdown.length * 14 + 56));
      const timerX = (shellW - timerW) / 2;
      fillRounded(timerX, chipY, timerW, chipH, 10, THEME.warningSoft);
      strokeRounded(timerX + 0.5, chipY + 0.5, timerW - 1, chipH - 1, 10, 'rgba(245, 158, 11, 0.35)');
      shellCtx.fillStyle = THEME.hudMuted;
      shellCtx.font = `600 10px ${FONTS.display}`;
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'top';
      shellCtx.fillText('SCROLL', shellW / 2, chipY + 8);
      shellCtx.fillStyle = THEME.warning;
      shellCtx.font = `600 16px ${FONTS.mono}`;
      shellCtx.fillText(stats.countdown, shellW / 2, chipY + 24);
    }

    const rightChipX = barX + barW - chipW - 12;
    const livesRaw = stats?.lives;
    const hasLives = Boolean(livesRaw && livesRaw.includes('♥'));
    drawChip(
      shellCtx,
      rightChipX,
      chipY,
      chipW,
      chipH,
      hasLives ? 'LIVES' : 'STATUS',
      livesRaw ?? stats?.status ?? shell.title,
      'right',
    );

    // 底栏：Space 键
    const keyW = Math.min(280, Math.max(180, shellW * 0.34));
    const keyH = 44;
    const keyX = (shellW - keyW) / 2;
    const keyY = shellH - safe - keyH;
    spaceKeyRect = { x: keyX, y: keyY, w: keyW, h: keyH };
    const keyEnabled = stats?.spaceEnabled;

    fillRounded(
      keyX,
      keyY,
      keyW,
      keyH,
      10,
      keyEnabled ? THEME.accentSoft : 'rgba(39, 39, 42, 0.6)',
    );
    strokeRounded(
      keyX + 0.5,
      keyY + 0.5,
      keyW - 1,
      keyH - 1,
      10,
      keyEnabled ? THEME.accentMuted : THEME.panelBorder,
    );
    shellCtx.fillStyle = keyEnabled ? THEME.hudText : THEME.hudMuted;
    shellCtx.font = `600 14px ${FONTS.display}`;
    shellCtx.textAlign = 'center';
    shellCtx.textBaseline = 'middle';
    shellCtx.fillText('SPACE · 上移', shellW / 2, keyY + keyH / 2);

    if (stats?.defused) {
      shellCtx.fillStyle = THEME.hudMuted;
      shellCtx.font = `500 11px ${FONTS.mono}`;
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'bottom';
      const defusedText = stats.defused;
      shellCtx.fillText(defusedText, shellW / 2, keyY - 12);
    }

    if (stats?.devAutoVisible) {
      const autoW = 88;
      const autoH = 36;
      const autoX = shellW - safe - autoW;
      const autoY = shellH - safe - autoH;
      devAutoRect = { x: autoX, y: autoY, w: autoW, h: autoH };
      const active = Boolean(stats.devAutoActive);
      fillRounded(autoX, autoY, autoW, autoH, 8, active ? THEME.accent : THEME.hudPillBg);
      strokeRounded(
        autoX + 0.5,
        autoY + 0.5,
        autoW - 1,
        autoH - 1,
        8,
        active ? THEME.accent : THEME.panelBorder,
      );
      shellCtx.fillStyle = active ? '#ffffff' : THEME.hudMuted;
      shellCtx.font = `600 12px ${FONTS.display}`;
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText(active ? 'AUTO ON' : 'AUTO', autoX + autoW / 2, autoY + autoH / 2);
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

  function drawFullscreenOverlay(
    shellCtx: CanvasRenderingContext2D,
    shell: GameCanvasFullscreenOptions,
    shellW: number,
    shellH: number,
  ): void {
    const stats = shell.getStats?.();
    const combo = stats?.combo ?? 0;
    if (combo !== lastCombo) {
      if (combo > lastCombo && combo > 1) spawnComboParticles(combo);
      lastCombo = combo;
      if (combo > 1) comboFxStartedAt = performance.now();
    }

    drawParticles(shellCtx, performance.now());

    if (combo > 1 && comboFxStartedAt > 0) {
      const elapsedMs = performance.now() - comboFxStartedAt;
      const durationMs = 960;
      const t = Math.min(1, elapsedMs / durationMs);
      const alpha = Math.max(0, 1 - t);
      const pop = 1.44 - Math.abs(t - 0.22) * 1.15;
      const scale = Math.max(0.82, Math.min(1.42, pop));
      const palette = comboColor(combo);
      const cx = shellW / 2;
      const cy = Math.max(128, boardOffsetY + boardHeight * 0.36);
      const badgeW = Math.min(340, 150 + String(combo).length * 42);
      const badgeH = 82;

      shellCtx.save();
      shellCtx.globalAlpha = alpha;
      shellCtx.translate(cx, cy);
      shellCtx.scale(scale, scale);

      drawFxFrame(shellCtx, 'combo-burst', t, 0, 0, badgeW * 1.9, badgeH * 2.7);

      const glow = shellCtx.createRadialGradient(0, 0, 10, 0, 0, badgeW * 0.78);
      glow.addColorStop(0, palette.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      shellCtx.fillStyle = glow;
      shellCtx.fillRect(-badgeW, -badgeH, badgeW * 2, badgeH * 2);

      fillRounded(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 12, palette.fill);
      strokeRounded(-badgeW / 2 + 0.5, -badgeH / 2 + 0.5, badgeW - 1, badgeH - 1, 12, palette.stroke, 1.5);
      shellCtx.fillStyle = palette.text;
      shellCtx.font = `600 13px ${FONTS.display}`;
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      const comboLabel = 'Combo';
      const comboLabelW = shellCtx.measureText(comboLabel).width;
      const comboIconSize = 13;
      const comboBlockW = comboIconSize + 5 + comboLabelW;
      drawHudIcon(shellCtx, 'medal', -comboBlockW / 2, -18 - comboIconSize / 2, {
        size: comboIconSize,
      });
      shellCtx.textAlign = 'left';
      shellCtx.fillText(comboLabel, -comboBlockW / 2 + comboIconSize + 5, -18);
      shellCtx.textAlign = 'center';
      shellCtx.font = `600 ${Math.min(48, 30 + String(combo).length * 4)}px ${FONTS.mono}`;
      shellCtx.fillText(`×${combo}`, 0, 16);
      shellCtx.restore();

      if (t < 1) scheduleAnimationFrame();
    }

    if (combo > 1) {
      const pulse = 0.5 + Math.sin(Date.now() / 120) * 0.5;
      const palette = comboColor(combo);

      const railAlpha = Math.min(0.62, 0.22 + combo * 0.035 + pulse * 0.2);
      shellCtx.save();
      shellCtx.strokeStyle = palette.stroke.replace(/[\d.]+\)$/u, `${railAlpha})`);
      shellCtx.lineWidth = 2;
      shellCtx.lineCap = 'round';
      const railTop = boardOffsetY + 6;
      const railBottom = boardOffsetY + boardHeight - 6;
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
      const w = Math.min(320, shellW - 64);
      const h = 88;
      const x = (shellW - w) / 2;
      const y = Math.max(120, boardOffsetY + boardHeight * 0.46 - h / 2);
      startRect = { x, y, w, h };
      shellCtx.save();
      shellCtx.fillStyle = THEME.overlayScrim;
      shellCtx.fillRect(0, 0, shellW, shellH);
      fillRounded(x, y, w, h, 14, THEME.panelElevated);
      strokeRounded(x + 0.5, y + 0.5, w - 1, h - 1, 14, THEME.panelBorder);
      drawHudIcon(shellCtx, 'play', shellW / 2 - 12, y + 10, { size: 24 });
      shellCtx.fillStyle = THEME.hudText;
      shellCtx.font = `700 22px ${FONTS.display}`;
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText('开始游戏', shellW / 2, y + 38);
      shellCtx.fillStyle = THEME.hudMuted;
      shellCtx.font = `500 12px ${FONTS.display}`;
      shellCtx.fillText('点击后自行选择首格', shellW / 2, y + 58);
      shellCtx.restore();
    }

    if (currentStatus === 'lost') {
      const panelW = Math.min(380, shellW - 48);
      const panelH = 196;
      const panelX = (shellW - panelW) / 2;
      const panelY = Math.max(96, boardOffsetY + boardHeight * 0.42 - panelH / 2);
      const retryW = Math.min(220, panelW - 48);
      const retryH = 48;
      const retryX = panelX + (panelW - retryW) / 2;
      const retryY = panelY + 118;
      retryRect = { x: retryX, y: retryY, w: retryW, h: retryH };

      shellCtx.save();
      shellCtx.fillStyle = THEME.overlayScrim;
      shellCtx.fillRect(0, 0, shellW, shellH);
      fillRounded(panelX, panelY, panelW, panelH, 16, THEME.panelElevated);
      strokeRounded(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 16, THEME.panelBorder);
      drawHudIcon(shellCtx, 'skull', shellW / 2 - 16, panelY + 16, { size: 32 });
      shellCtx.fillStyle = THEME.hudText;
      shellCtx.font = `700 26px ${FONTS.display}`;
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText('游戏结束', shellW / 2, panelY + 64);
      shellCtx.fillStyle = THEME.hudMuted;
      shellCtx.font = `500 14px ${FONTS.mono}`;
      shellCtx.fillText(`得分 ${String(stats?.score ?? 0).padStart(5, '0')}`, shellW / 2, panelY + 92);

      fillRounded(retryX, retryY, retryW, retryH, 10, THEME.danger);
      shellCtx.fillStyle = '#ffffff';
      shellCtx.font = `600 16px ${FONTS.display}`;
      if (
        !drawIconTextButton(shellCtx, shellW / 2, retryY + retryH / 2 + 1, 'refresh', '再来一局', {
          iconSize: 16,
          font: `600 16px ${FONTS.display}`,
        })
      ) {
        shellCtx.fillText('再来一局', shellW / 2, retryY + retryH / 2 + 1);
      }
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
    fillRounded(x, y, modalW, modalH, 16, THEME.panelElevated);
    strokeRounded(x + 0.5, y + 0.5, modalW - 1, modalH - 1, 16, THEME.panelBorder);
    shellCtx.fillStyle = THEME.hudText;
    shellCtx.font = `700 16px ${FONTS.display}`;
    shellCtx.textAlign = 'left';
    shellCtx.textBaseline = 'top';
    drawHudIcon(shellCtx, 'info', x + 24, y + 22, { size: 14 });
    shellCtx.fillText('对局日志', x + 44, y + 22);
    shellCtx.fillStyle = THEME.hudMuted;
    shellCtx.font = `500 11px ${FONTS.display}`;
    shellCtx.textAlign = 'right';
    shellCtx.fillText('` / Esc 关闭', x + modalW - 24, y + 25);

    shellCtx.font = `500 13px ${FONTS.mono}`;
    shellCtx.textAlign = 'left';
    const lineH = 22;
    const maxLines = Math.max(8, Math.floor((modalH - 82) / lineH));
    let lineY = y + 64;
    for (const line of logs.slice(-maxLines)) {
      shellCtx.fillStyle = THEME.hudMuted;
      shellCtx.fillText(line.time, x + 24, lineY);
      drawHudIcon(shellCtx, logIcon(line.kind), x + 78, lineY + 1, { size: 12 });
      shellCtx.fillStyle = logColor(line.kind);
      shellCtx.fillText(line.text, x + 96, lineY, modalW - 120);
      lineY += lineH;
    }
    shellCtx.restore();
  }

  function hitReset(x: number, y: number): boolean {
    if (fullscreen) return false;
    if (isHex && hexLayout) return hitTestHexReset(hexLayout, x, y);
    return hitTestReset(squareLayout!, x, y);
  }

  function cellAtCoords(x: number, y: number): { row: number; col: number } | null {
    if (fullscreen) {
      x -= boardOffsetX;
      y -= boardOffsetY;
    }
    if (isHex && hexLayout) return hitTestHexCell(hexLayout, currentViews, x, y);
    return hitTestCell(squareLayout!, currentRows, currentCols, x, y);
  }

  function cellAt(event: MouseEvent): { row: number; col: number } | null {
    const { x, y } = getCanvasPointerCoords(canvas, event);
    if (hitReset(x, y)) return null;
    return cellAtCoords(x, y);
  }

  function isBothButtons(event: MouseEvent): boolean {
    return (event.buttons & 1) !== 0 && (event.buttons & 2) !== 0;
  }

  function onMouseDown(event: MouseEvent): void {
    const { x, y } = getCanvasPointerCoords(canvas, event);

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

      if (!isHex && !fixedGridRows && (nextRows !== currentRows || nextCols !== currentCols)) {
        syncSquareLayout(nextRows, nextCols);
        currentRows = nextRows;
        currentCols = nextCols;
      }

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
      currentHudDefusedDisplay = options?.hudDefusedDisplay;
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

export { DEFAULT_CELL_SIZE };
