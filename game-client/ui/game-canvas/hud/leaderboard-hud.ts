import { fillRounded, strokeRounded } from '../../primitives/index.ts'
import { FONTS } from '../../theme.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { getHudSideChipLayout, stackHudSideChipBelow } from './side-chip-layout.ts'

export function drawLeaderboardHud(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  anchorX: number,
  hudY: number,
  livesRaw: string | undefined,
  scale: number,
  hovered: boolean
): void {
  const layout = getHudSideChipLayout(rt, anchorX, hudY, livesRaw, scale)
  const anchorRect = rt.state.bgmMuteRect ?? { y: layout.topY, h: layout.hitSize }
  const chipRect = stackHudSideChipBelow(anchorRect, layout)

  const rectX = chipRect.x
  const rectY = chipRect.y
  const chipSize = chipRect.w
  const { iconSize } = layout
  const cx = rectX + chipSize / 2
  const cy = rectY + chipSize / 2

  rt.state.leaderboardRect = chipRect

  shellCtx.save()
  if (hovered) {
    shellCtx.globalCompositeOperation = 'lighter'
    const glow = shellCtx.createRadialGradient(cx, cy, iconSize * 0.12, cx, cy, iconSize * 0.75)
    glow.addColorStop(0, 'rgba(250, 204, 21, 0.24)')
    glow.addColorStop(1, 'rgba(45, 236, 255, 0)')
    shellCtx.fillStyle = glow
    shellCtx.fillRect(rectX - iconSize * 0.35, rectY - iconSize * 0.35, chipSize + iconSize * 0.7, chipSize + iconSize * 0.7)
    shellCtx.globalCompositeOperation = 'source-over'
  }

  fillRounded(shellCtx, rectX + 1, rectY + 1, chipSize - 2, chipSize - 2, Math.min(8, chipSize / 3), hovered ? 'rgba(250, 204, 21, 0.16)' : 'rgba(8, 12, 22, 0.72)')
  strokeRounded(shellCtx, rectX + 1, rectY + 1, chipSize - 2, chipSize - 2, Math.min(8, chipSize / 3), hovered ? 'rgba(250, 204, 21, 0.72)' : 'rgba(45, 236, 255, 0.28)', 1.2)

  shellCtx.fillStyle = hovered ? '#fde68a' : '#fbbf24'
  shellCtx.font = `900 ${Math.max(9, 10 * scale)}px ${FONTS.mono}`
  shellCtx.textAlign = 'center'
  shellCtx.textBaseline = 'middle'
  shellCtx.fillText('TOP', cx, cy + 0.5 * scale)
  shellCtx.restore()
}
