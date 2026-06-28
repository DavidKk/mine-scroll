import type { GameCanvasRuntime } from '../runtime/context.ts';
import { clamp01, easeOutCubic } from '../../primitives/index.ts';
import { RUNTIME_CONSTANTS } from '../runtime/state.ts';

export interface GameIntroProgress {
  lineScale: number;
  hudAlpha: number;
  boardReveal: number;
  startPanelAlpha: number;
  startPanelScale: number;
  complete: boolean;
  interactable: boolean;
  animating: boolean;
}

const INTRO_SKIPPED = -1;
const INTRO_PENDING = 0;

const COMPLETE_PROGRESS: GameIntroProgress = {
  lineScale: 1,
  hudAlpha: 1,
  boardReveal: 1,
  startPanelAlpha: 1,
  startPanelScale: 1,
  complete: true,
  interactable: true,
  animating: false,
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function skipGameIntro(rt: GameCanvasRuntime): GameIntroProgress {
  rt.state.gameIntroStartedAt = INTRO_SKIPPED;
  rt.state.gameIntroComplete = true;
  return COMPLETE_PROGRESS;
}

export function shouldPlayGameIntro(rt: GameCanvasRuntime): boolean {
  return Boolean(rt.fullscreen) && rt.state.currentStatus === 'idle' && !rt.state.gameIntroComplete;
}

export function updateGameIntro(rt: GameCanvasRuntime, now: number): GameIntroProgress {
  if (rt.state.gameIntroComplete || rt.state.gameIntroStartedAt === INTRO_SKIPPED) {
    return COMPLETE_PROGRESS;
  }

  if (!rt.fullscreen || rt.state.currentStatus !== 'idle') {
    return skipGameIntro(rt);
  }

  if (rt.state.gameIntroStartedAt === INTRO_PENDING) {
    if (prefersReducedMotion()) return skipGameIntro(rt);
    rt.state.gameIntroStartedAt = now;
    rt.scheduleAnimationFrame();
  }

  const elapsed = now - rt.state.gameIntroStartedAt;
  const {
    GAME_INTRO_LINE_MS,
    GAME_INTRO_HUD_DELAY_MS,
    GAME_INTRO_HUD_MS,
    GAME_INTRO_BOARD_DELAY_MS,
    GAME_INTRO_BOARD_MS,
    GAME_INTRO_START_DELAY_MS,
    GAME_INTRO_START_MS,
    GAME_INTRO_TOTAL_MS,
  } = RUNTIME_CONSTANTS;

  const lineScale = easeOutCubic(clamp01(elapsed / GAME_INTRO_LINE_MS));
  const hudAlpha = easeOutCubic(clamp01((elapsed - GAME_INTRO_HUD_DELAY_MS) / GAME_INTRO_HUD_MS));
  const boardReveal = clamp01((elapsed - GAME_INTRO_BOARD_DELAY_MS) / GAME_INTRO_BOARD_MS);
  const startPanelAlpha = easeOutCubic(clamp01((elapsed - GAME_INTRO_START_DELAY_MS) / GAME_INTRO_START_MS));
  const startPanelScale = 0.94 + 0.06 * startPanelAlpha;
  const introComplete = elapsed >= GAME_INTRO_TOTAL_MS;
  const startReady = elapsed >= GAME_INTRO_START_DELAY_MS + GAME_INTRO_START_MS * 0.88;

  if (introComplete && !rt.state.gameIntroComplete) {
    rt.state.gameIntroComplete = true;
    rt.state.gameIntroStartedAt = INTRO_SKIPPED;
    rt.state.scrollButtonRevealStartedAt = 0;
  }

  const animating = !introComplete;
  const interactable = startReady && startPanelAlpha >= 0.92;

  if (animating) rt.scheduleAnimationFrame();

  return {
    lineScale,
    hudAlpha,
    boardReveal,
    startPanelAlpha,
    startPanelScale,
    complete: introComplete,
    interactable,
    animating,
  };
}

export function isGameIntroBlockingInput(rt: GameCanvasRuntime, now: number): boolean {
  if (rt.state.gameIntroComplete) return false;
  const progress = updateGameIntro(rt, now);
  return progress.animating || !progress.interactable;
}

/** Horizontal energy line expanding from center (top HUD rail + bottom rail). */
export function drawIntroEnergyLine(
  shellCtx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  fullWidth: number,
  scale: number,
  lineScale: number,
): void {
  if (lineScale <= 0.001 || fullWidth <= 0) return;
  const w = Math.max(1, fullWidth * clamp01(lineScale));
  const x = cx - w / 2;
  const line = shellCtx.createLinearGradient(x, y, x + w, y);
  line.addColorStop(0, 'rgba(59, 130, 246, 0)');
  line.addColorStop(0.18, 'rgba(59, 130, 246, 0.36)');
  line.addColorStop(0.82, 'rgba(59, 130, 246, 0.36)');
  line.addColorStop(1, 'rgba(59, 130, 246, 0)');
  shellCtx.fillStyle = line;
  shellCtx.fillRect(x, y, w, Math.max(1, scale));
}

export function drawGameIntroChrome(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  shellW: number,
  progress: GameIntroProgress,
): void {
  if (progress.complete || !rt.state.stageLayout) return;
  const stage = rt.state.stageLayout;
  const { scale } = stage;
  const topY = stage.hudY + stage.hudH + 2 * scale;
  drawIntroEnergyLine(shellCtx, shellW / 2, topY, shellW, scale, progress.lineScale);

  const rail = stage.bottomRailRect;
  const bottomY = rail.y + rail.h * 0.52;
  shellCtx.save();
  const bottomLine = shellCtx.createLinearGradient(rail.x, 0, rail.x + rail.w, 0);
  bottomLine.addColorStop(0, 'rgba(96, 165, 250, 0)');
  bottomLine.addColorStop(0.18, 'rgba(96, 165, 250, 0.28)');
  bottomLine.addColorStop(0.5, 'rgba(168, 85, 247, 0.36)');
  bottomLine.addColorStop(0.82, 'rgba(96, 165, 250, 0.28)');
  bottomLine.addColorStop(1, 'rgba(168, 85, 247, 0)');
  shellCtx.strokeStyle = bottomLine;
  shellCtx.lineWidth = Math.max(1.2, 1.8 * scale);
  shellCtx.lineCap = 'round';
  const w = Math.max(1, rail.w * progress.lineScale);
  const x = rail.x + (rail.w - w) / 2;
  shellCtx.beginPath();
  shellCtx.moveTo(x, bottomY);
  shellCtx.lineTo(x + w, bottomY);
  shellCtx.stroke();
  shellCtx.restore();
}
