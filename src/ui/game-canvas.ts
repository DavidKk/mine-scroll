import type { CellView, GameStatus } from '../core/types.ts';
import type { AiHintDisplay } from '../core/ai/types.ts';
import { DEFAULT_CELL_SIZE } from './theme.ts';
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
  onRestart?: () => void;
  onSpace?: () => void;
  onDevAuto?: () => void;
}

export interface GameCanvasOptions {
  hexRadius?: number;
  /** 放宽棋盘最大像素，大格盘时格子更大 */
  maxGrid?: { width: number; height: number };
  /** 固定格宽（无尽卷轴模式） */
  fixedCellSize?: number;
  /** 固定棋盘行数（无尽卷轴：Canvas 高度不随缓冲变化） */
  fixedGridRows?: number;
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
  const getHudRightDisplayFn = canvasOptions.getHudRightDisplay;
  const getScrollPressureFn = canvasOptions.getScrollPressure;
  const fullscreen = canvasOptions.fullscreen;
  const hexLayout = isHex ? getHexLayoutMetrics(canvasOptions.hexRadius!) : null;
  let currentRows = fixedGridRows ?? rows;
  let currentCols = cols;
  let squareLayout: LayoutMetrics | null = isHex
    ? null
    : fullscreen
      ? getBoardOnlyLayoutMetrics(currentRows, cols, canvasOptions.maxGrid, fixedCellSize)
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

  function syncBoardSizeFromLayout(): void {
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

  function paint(): void {
    syncFullscreenCanvasSize();
    syncBoardSizeFromLayout();
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

    const bg = shellCtx.createRadialGradient(
      shellW * 0.5,
      shellH * 0.5,
      80,
      shellW * 0.5,
      shellH * 0.5,
      Math.max(shellW, shellH) * 0.74,
    );
    bg.addColorStop(0, '#171827');
    bg.addColorStop(0.55, '#0e1020');
    bg.addColorStop(1, '#070913');
    shellCtx.fillStyle = bg;
    shellCtx.fillRect(0, 0, shellW, shellH);

    shellCtx.save();
    shellCtx.globalAlpha = 0.18;
    shellCtx.strokeStyle = '#26324d';
    shellCtx.lineWidth = 1;
    const gridStep = 48;
    for (let x = (shellW % gridStep) - gridStep; x < shellW; x += gridStep) {
      shellCtx.beginPath();
      shellCtx.moveTo(x, 0);
      shellCtx.lineTo(x, shellH);
      shellCtx.stroke();
    }
    for (let y = (shellH % gridStep) - gridStep; y < shellH; y += gridStep) {
      shellCtx.beginPath();
      shellCtx.moveTo(0, y);
      shellCtx.lineTo(shellW, y);
      shellCtx.stroke();
    }
    shellCtx.restore();

    const safe = Math.max(18, Math.min(36, shellW * 0.028));
    const topReserve = shellW < 700 ? 110 : 88;
    const bottomReserve = shellW < 700 ? 126 : 104;
    const availableH = Math.max(260, shellH - topReserve - bottomReserve);
    boardOffsetX = Math.max(safe, (shellW - innerBoardW) / 2);
    boardOffsetY = topReserve + Math.max(0, (availableH - innerBoardH) / 2);

    const stats = shell.getStats?.();
    const hudW = shellW < 560 ? 178 : 238;
    const hudH = shellW < 560 ? 78 : 92;
    fillRounded(safe, safe, hudW, hudH, 14, 'rgba(7, 10, 22, 0.72)');
    strokeRounded(safe + 0.5, safe + 0.5, hudW - 1, hudH - 1, 14, 'rgba(129, 140, 248, 0.28)', 1.5);

    shellCtx.fillStyle = '#94a3b8';
    shellCtx.font = '800 11px "Inter", "Segoe UI", system-ui, sans-serif';
    shellCtx.textAlign = 'left';
    shellCtx.textBaseline = 'top';
    shellCtx.fillText('SCORE', safe + 16, safe + 13);

    shellCtx.fillStyle = '#f8fafc';
    shellCtx.font = `900 ${shellW < 560 ? 30 : 38}px "SF Mono", "JetBrains Mono", monospace`;
    shellCtx.fillText(String(stats?.score ?? 0).padStart(5, '0'), safe + 14, safe + 29);

    if ((stats?.combo ?? 0) > 0) {
      fillRounded(safe + hudW - 78, safe + 16, 58, 24, 12, 'rgba(251, 191, 36, 0.16)');
      shellCtx.fillStyle = '#fde68a';
      shellCtx.font = '800 13px "Inter", "Segoe UI", system-ui, sans-serif';
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText(`×${stats?.combo ?? 0}`, safe + hudW - 49, safe + 28);
    }

    const statusW = shellW < 560 ? 164 : 230;
    const statusX = shellW - safe - statusW;
    fillRounded(statusX, safe, statusW, hudH, 14, 'rgba(7, 10, 22, 0.62)');
    strokeRounded(statusX + 0.5, safe + 0.5, statusW - 1, hudH - 1, 14, 'rgba(255,255,255,0.08)');
    shellCtx.fillStyle = '#a5b4fc';
    shellCtx.font = '800 12px "Inter", "Segoe UI", system-ui, sans-serif';
    shellCtx.textAlign = 'right';
    shellCtx.textBaseline = 'top';
    shellCtx.fillText(stats?.status ?? shell.title, statusX + statusW - 14, safe + 13);

    shellCtx.fillStyle = '#cbd5e1';
    shellCtx.font = '700 13px "Inter", "Segoe UI", system-ui, sans-serif';
    const rightLine = stats?.lives ?? '';
    shellCtx.fillText(rightLine, statusX + statusW - 14, safe + 36);

    if (stats?.countdown) {
      const timerW = Math.max(88, Math.min(140, stats.countdown.length * 16 + 34));
      const timerX = (shellW - timerW) / 2;
      fillRounded(timerX, safe, timerW, 48, 24, 'rgba(251, 191, 36, 0.15)');
      strokeRounded(timerX + 0.5, safe + 0.5, timerW - 1, 47, 24, 'rgba(251, 191, 36, 0.38)', 1.5);
      shellCtx.fillStyle = '#fde68a';
      shellCtx.font = '900 20px "SF Mono", "JetBrains Mono", monospace';
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText(stats.countdown, shellW / 2, safe + 24);
    }

    const keyW = Math.min(300, Math.max(196, shellW * 0.28));
    const keyH = 54;
    const keyX = (shellW - keyW) / 2;
    const keyY = shellH - safe - keyH;
    spaceKeyRect = { x: keyX, y: keyY, w: keyW, h: keyH };
    const keyFill = stats?.spaceEnabled ? 'rgba(226, 232, 240, 0.13)' : 'rgba(71, 85, 105, 0.08)';
    fillRounded(keyX, keyY, keyW, keyH, 12, keyFill);
    strokeRounded(
      keyX + 0.5,
      keyY + 0.5,
      keyW - 1,
      keyH - 1,
      12,
      stats?.spaceEnabled ? 'rgba(226, 232, 240, 0.32)' : 'rgba(148, 163, 184, 0.16)',
      1.5,
    );
    shellCtx.fillStyle = stats?.spaceEnabled ? '#f8fafc' : '#94a3b8';
    shellCtx.font = '900 18px "SF Mono", "JetBrains Mono", monospace';
    shellCtx.textAlign = 'center';
    shellCtx.textBaseline = 'middle';
    shellCtx.fillText('SPACE', shellW / 2, keyY + 22);
    shellCtx.fillStyle = '#94a3b8';
    shellCtx.font = '700 11px "Inter", "Segoe UI", system-ui, sans-serif';
    shellCtx.fillText('上移 / 消费底部行', shellW / 2, keyY + 40);

    if (stats?.defused) {
      shellCtx.fillStyle = '#94a3b8';
      shellCtx.font = '700 12px "Inter", "Segoe UI", system-ui, sans-serif';
      shellCtx.textAlign = 'center';
      shellCtx.fillText(stats.defused, shellW / 2, keyY - 18);
    }

    if (stats?.devAutoVisible) {
      const autoW = 112;
      const autoH = 44;
      const autoX = shellW - safe - autoW;
      const autoY = shellH - safe - autoH;
      devAutoRect = { x: autoX, y: autoY, w: autoW, h: autoH };
      const active = Boolean(stats.devAutoActive);
      fillRounded(
        autoX,
        autoY,
        autoW,
        autoH,
        12,
        active ? 'rgba(79, 70, 229, 0.78)' : 'rgba(15, 23, 42, 0.72)',
      );
      strokeRounded(
        autoX + 0.5,
        autoY + 0.5,
        autoW - 1,
        autoH - 1,
        12,
        active ? 'rgba(199, 210, 254, 0.58)' : 'rgba(148, 163, 184, 0.24)',
        1.5,
      );
      shellCtx.fillStyle = active ? '#ffffff' : '#cbd5e1';
      shellCtx.font = '900 14px "SF Mono", "JetBrains Mono", monospace';
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText(active ? 'AUTO ON' : 'AUTO', autoX + autoW / 2, autoY + autoH / 2 + 1);
    }
  }

  function comboColor(combo: number): { fill: string; stroke: string; glow: string; text: string } {
    if (combo >= 50) {
      return {
        fill: 'rgba(80, 14, 112, 0.86)',
        stroke: 'rgba(244, 114, 182, 0.95)',
        glow: 'rgba(217, 70, 239, 0.42)',
        text: '#fdf4ff',
      };
    }
    if (combo >= 20) {
      return {
        fill: 'rgba(124, 45, 18, 0.86)',
        stroke: 'rgba(251, 146, 60, 0.95)',
        glow: 'rgba(249, 115, 22, 0.42)',
        text: '#fff7ed',
      };
    }
    if (combo >= 10) {
      return {
        fill: 'rgba(113, 63, 18, 0.86)',
        stroke: 'rgba(251, 191, 36, 0.95)',
        glow: 'rgba(251, 191, 36, 0.38)',
        text: '#fefce8',
      };
    }
    return {
      fill: 'rgba(20, 83, 45, 0.86)',
      stroke: 'rgba(74, 222, 128, 0.9)',
      glow: 'rgba(34, 197, 94, 0.34)',
      text: '#f0fdf4',
    };
  }

  function logColor(kind: GameCanvasLogLine['kind']): string {
    if (kind === 'danger') return '#fca5a5';
    if (kind === 'ai') return '#a5b4fc';
    if (kind === 'player') return '#86efac';
    if (kind === 'scroll') return '#fde68a';
    return '#cbd5e1';
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
      lastCombo = combo;
      if (combo > 1) comboFxStartedAt = performance.now();
    }

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

      const glow = shellCtx.createRadialGradient(0, 0, 10, 0, 0, badgeW * 0.78);
      glow.addColorStop(0, palette.glow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      shellCtx.fillStyle = glow;
      shellCtx.fillRect(-badgeW, -badgeH, badgeW * 2, badgeH * 2);

      fillRounded(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 22, palette.fill);
      strokeRounded(-badgeW / 2 + 0.5, -badgeH / 2 + 0.5, badgeW - 1, badgeH - 1, 22, palette.stroke, 2.5);
      shellCtx.fillStyle = palette.text;
      shellCtx.font = '900 18px "Inter", "Segoe UI", system-ui, sans-serif';
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText('COMBO', 0, -20);
      shellCtx.font = `900 ${Math.min(54, 34 + String(combo).length * 5)}px "SF Mono", "JetBrains Mono", monospace`;
      shellCtx.fillText(`×${combo}`, 0, 18);
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

    if (currentStatus === 'idle') {
      const w = Math.min(340, shellW - 64);
      const h = 78;
      const x = (shellW - w) / 2;
      const y = Math.max(120, boardOffsetY + boardHeight * 0.46 - h / 2);
      startRect = { x, y, w, h };
      shellCtx.save();
      shellCtx.fillStyle = 'rgba(2, 6, 23, 0.56)';
      shellCtx.fillRect(0, 0, shellW, shellH);
      fillRounded(x, y, w, h, 18, 'rgba(79, 70, 229, 0.88)');
      strokeRounded(x + 0.5, y + 0.5, w - 1, h - 1, 18, 'rgba(199, 210, 254, 0.72)', 2);
      shellCtx.fillStyle = '#ffffff';
      shellCtx.font = '900 28px "Inter", "Segoe UI", system-ui, sans-serif';
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText('START', shellW / 2, y + 34);
      shellCtx.fillStyle = 'rgba(224, 231, 255, 0.78)';
      shellCtx.font = '800 12px "Inter", "Segoe UI", system-ui, sans-serif';
      shellCtx.fillText('ENDLESS RUN', shellW / 2, y + 56);
      shellCtx.restore();
    }

    if (currentStatus === 'lost') {
      const panelW = Math.min(420, shellW - 48);
      const panelH = 190;
      const panelX = (shellW - panelW) / 2;
      const panelY = Math.max(96, boardOffsetY + boardHeight * 0.42 - panelH / 2);
      const retryW = Math.min(260, panelW - 56);
      const retryH = 58;
      const retryX = panelX + (panelW - retryW) / 2;
      const retryY = panelY + 106;
      retryRect = { x: retryX, y: retryY, w: retryW, h: retryH };

      shellCtx.save();
      shellCtx.fillStyle = 'rgba(2, 6, 23, 0.66)';
      shellCtx.fillRect(0, 0, shellW, shellH);
      fillRounded(panelX, panelY, panelW, panelH, 20, 'rgba(15, 23, 42, 0.94)');
      strokeRounded(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 20, 'rgba(248, 113, 113, 0.54)', 2);
      shellCtx.fillStyle = '#fecaca';
      shellCtx.font = '900 34px "Inter", "Segoe UI", system-ui, sans-serif';
      shellCtx.textAlign = 'center';
      shellCtx.textBaseline = 'middle';
      shellCtx.fillText('GAME OVER', shellW / 2, panelY + 46);
      shellCtx.fillStyle = '#cbd5e1';
      shellCtx.font = '800 14px "Inter", "Segoe UI", system-ui, sans-serif';
      shellCtx.fillText(`SCORE ${String(stats?.score ?? 0).padStart(5, '0')}`, shellW / 2, panelY + 78);

      fillRounded(retryX, retryY, retryW, retryH, 16, 'rgba(239, 68, 68, 0.82)');
      strokeRounded(retryX + 0.5, retryY + 0.5, retryW - 1, retryH - 1, 16, 'rgba(254, 202, 202, 0.62)', 2);
      shellCtx.fillStyle = '#fff1f2';
      shellCtx.font = '900 22px "Inter", "Segoe UI", system-ui, sans-serif';
      shellCtx.fillText('RETRY', shellW / 2, retryY + retryH / 2 + 1);
      shellCtx.restore();
    }

    if (!shell.isLogOpen?.()) return;
    const logs = shell.getRecentLogs?.() ?? [];
    const modalW = Math.min(860, shellW - 32);
    const modalH = Math.min(620, shellH - 64);
    const x = (shellW - modalW) / 2;
    const y = (shellH - modalH) / 2;

    shellCtx.save();
    shellCtx.fillStyle = 'rgba(2, 6, 23, 0.68)';
    shellCtx.fillRect(0, 0, shellW, shellH);
    fillRounded(x, y, modalW, modalH, 16, 'rgba(12, 15, 28, 0.94)');
    strokeRounded(x + 0.5, y + 0.5, modalW - 1, modalH - 1, 16, 'rgba(129, 140, 248, 0.34)', 1.5);
    shellCtx.fillStyle = '#f8fafc';
    shellCtx.font = '900 18px "Inter", "Segoe UI", system-ui, sans-serif';
    shellCtx.textAlign = 'left';
    shellCtx.textBaseline = 'top';
    shellCtx.fillText('对局日志', x + 24, y + 22);
    shellCtx.fillStyle = '#94a3b8';
    shellCtx.font = '700 12px "Inter", "Segoe UI", system-ui, sans-serif';
    shellCtx.textAlign = 'right';
    shellCtx.fillText('` / ESC 关闭', x + modalW - 24, y + 25);

    shellCtx.font = '600 13px "SF Mono", "JetBrains Mono", "Fira Code", monospace';
    shellCtx.textAlign = 'left';
    const lineH = 23;
    const maxLines = Math.max(8, Math.floor((modalH - 82) / lineH));
    let lineY = y + 64;
    for (const line of logs.slice(-maxLines)) {
      shellCtx.fillStyle = 'rgba(148, 163, 184, 0.72)';
      shellCtx.fillText(line.time, x + 24, lineY);
      shellCtx.fillStyle = logColor(line.kind);
      shellCtx.fillText(line.text, x + 98, lineY, modalW - 122);
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

    if (fullscreen && currentStatus === 'idle' && startRect) {
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
