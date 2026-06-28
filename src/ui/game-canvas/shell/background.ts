import type { GameCanvasRuntime } from '../runtime/context.ts';
import { drawModernBackground } from './ambient-shell.ts';

export function drawShellBackground(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D): void {
  const key = `${rt.state.width}x${rt.state.height}`;
  if (key !== rt.state.shellBgCacheKey || !rt.state.shellBgCache) {
    rt.state.shellBgCache = document.createElement('canvas');
    rt.state.shellBgCache.width = rt.state.width;
    rt.state.shellBgCache.height = rt.state.height;
    const bgCtx = rt.state.shellBgCache.getContext('2d');
    if (bgCtx) drawModernBackground(rt, bgCtx, rt.state.width, rt.state.height);
    rt.state.shellBgCacheKey = key;
  }
  shellCtx.drawImage(rt.state.shellBgCache, 0, 0);
}
