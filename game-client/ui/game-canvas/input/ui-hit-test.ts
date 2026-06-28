import { hitTestReset } from '../../renderer/index.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'

export function insideRect(rect: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

export function hitReset(rt: GameCanvasRuntime, x: number, y: number): boolean {
  if (rt.fullscreen) return false
  return hitTestReset(rt.state.squareLayout!, x, y)
}

export function hitInteractiveUi(rt: GameCanvasRuntime, x: number, y: number): string | null {
  if (rt.state.bgmMuteRect && insideRect(rt.state.bgmMuteRect, x, y)) return 'bgm-mute'
  if (rt.state.leaderboardRect && insideRect(rt.state.leaderboardRect, x, y)) return 'leaderboard'
  if (rt.state.spaceHintRect && insideRect(rt.state.spaceHintRect, x, y)) return 'space'
  if (rt.state.devSpeedRect && rt.state.currentStatus === 'playing' && insideRect(rt.state.devSpeedRect, x, y)) {
    return 'dev-speed'
  }
  if (rt.state.devAutoRect && insideRect(rt.state.devAutoRect, x, y)) return 'dev-auto'
  if (rt.state.currentStatus === 'idle' && rt.state.startRect && (rt.fullscreen?.showStartOverlay?.() ?? true) && insideRect(rt.state.startRect, x, y)) {
    return 'start'
  }
  if (rt.state.currentStatus === 'lost' && rt.state.retryRect && insideRect(rt.state.retryRect, x, y)) {
    return 'retry'
  }
  if (hitReset(rt, x, y)) return 'reset'
  return null
}
