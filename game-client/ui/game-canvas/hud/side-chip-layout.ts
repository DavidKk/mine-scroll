import { parseLivesDisplay } from '../../hud-sprites.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { hudHeartIconSize, hudHeartRowMetrics } from './lives-hud.ts'

export interface HudSideChipLayout {
  hitSize: number
  rectX: number
  topY: number
  iconSize: number
  isMobile: boolean
  scale: number
}

/** Shared hit target geometry for mute / leaderboard chips under the lives HUD. */
export function getHudSideChipLayout(rt: GameCanvasRuntime, anchorX: number, hudY: number, livesRaw: string | undefined, scale: number): HudSideChipLayout {
  const lives = parseLivesDisplay(livesRaw)
  const isMobile = rt.state.stageLayout?.profile === 'mobile'
  const heartIconSize = hudHeartIconSize(rt, scale)
  const gridCellSize = rt.state.squareLayout?.grid.cellSize ?? 32 * scale
  const iconSize = isMobile ? Math.max(18, Math.min(24, gridCellSize * 0.58)) : Math.max(24, Math.min(34, gridCellSize * 0.82))
  const hitPad = isMobile ? Math.max(6, 7 * scale) : Math.max(8, 10 * scale)
  const hitSize = iconSize + hitPad
  const metrics = lives ? hudHeartRowMetrics(rt, anchorX, hudY, lives, scale) : { x: anchorX - hitSize, cy: hudY + 31 * scale, iconSize: heartIconSize, gap: 0, rowW: hitSize }

  return {
    hitSize,
    rectX: anchorX - hitSize,
    topY: metrics.cy + heartIconSize / 2 + (isMobile ? 8 : 12) * scale,
    iconSize,
    isMobile,
    scale,
  }
}

export function stackHudSideChipBelow(rect: { y: number; h: number }, layout: HudSideChipLayout): { x: number; y: number; w: number; h: number } {
  const gap = (layout.isMobile ? 4 : 6) * layout.scale
  return {
    x: layout.rectX,
    y: rect.y + rect.h + gap,
    w: layout.hitSize,
    h: layout.hitSize,
  }
}
