import type { GameCanvasRuntime } from '../runtime/context.ts';
import { RUNTIME_CONSTANTS } from '../runtime/state.ts';
import { computeBackdropMood, drawAmbientBackdrop, smoothBackdropMood } from '../../ambient-backdrop.ts';

export function drawModernBackground(
  _rt: GameCanvasRuntime,
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

function backdropCacheKey(rt: GameCanvasRuntime, now: number): string {
  const bucket = Math.floor(now / RUNTIME_CONSTANTS.AMBIENT_FRAME_MS);
  const mood = rt.state.backdropMood;
  return `${rt.state.width}x${rt.state.height}|${bucket}|${Math.round(mood.heat * 100)}|${Math.round(mood.energy * 100)}|${Math.round(mood.intensity * 100)}|${rt.state.currentStatus}`;
}

export function drawAmbientShellBackdrop(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, now: number): void {
  if (!rt.fullscreen) return;
  const stats = rt.fullscreen.getStats?.();
  const target = computeBackdropMood(
    {
      status: rt.state.currentStatus,
      scrollElapsedMs: stats?.backdrop?.scrollElapsedMs ?? 0,
      scrollDepth: stats?.backdrop?.scrollDepth ?? 0,
      lives: stats?.backdrop?.livesCurrent ?? 5,
      maxLives: stats?.backdrop?.livesMax ?? 5,
    },
    stats?.combo ?? 0,
  );
  const dtMs = rt.state.lastBackdropSampleAt > 0 ? now - rt.state.lastBackdropSampleAt : RUNTIME_CONSTANTS.AMBIENT_FRAME_MS;
  rt.state.lastBackdropSampleAt = now;
  rt.state.backdropMood = smoothBackdropMood(rt.state.backdropMood, target, dtMs);

  const backdropInput = {
    shellW: rt.state.width,
    shellH: rt.state.height,
    nowMs: now,
    status: rt.state.currentStatus,
    mood: rt.state.backdropMood,
    boardSafeRect: rt.state.squareLayout
      ? {
          x: rt.state.boardOffsetX,
          y: rt.state.boardOffsetY,
          w: rt.state.squareLayout.width,
          h: rt.state.squareLayout.height,
        }
      : undefined,
  };

  try {
    const cacheKey = backdropCacheKey(rt, now);
    if (
      !rt.state.ambientBackdropCache ||
      rt.state.ambientBackdropCache.width !== rt.state.width ||
      rt.state.ambientBackdropCache.height !== rt.state.height
    ) {
      rt.state.ambientBackdropCache = document.createElement('canvas');
      rt.state.ambientBackdropCache.width = rt.state.width;
      rt.state.ambientBackdropCache.height = rt.state.height;
      rt.state.ambientBackdropCacheKey = '';
    }
    if (cacheKey !== rt.state.ambientBackdropCacheKey) {
      const cacheCtx = rt.state.ambientBackdropCache.getContext('2d');
      if (cacheCtx) {
        cacheCtx.clearRect(0, 0, rt.state.width, rt.state.height);
        drawAmbientBackdrop(cacheCtx, backdropInput);
        rt.state.ambientBackdropCacheKey = cacheKey;
      }
    }
    if (rt.state.ambientBackdropCache) {
      shellCtx.drawImage(rt.state.ambientBackdropCache, 0, 0);
    }
  } catch (err) {
    console.error('[backdrop]', err);
  }
}
