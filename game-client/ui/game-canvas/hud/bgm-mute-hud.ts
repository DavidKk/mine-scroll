import { drawHudIcon } from '../../hud-sprites.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { getHudSideChipLayout } from './side-chip-layout.ts'

export function drawBgmMuteHud(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  anchorX: number,
  hudY: number,
  livesRaw: string | undefined,
  scale: number,
  muted: boolean,
  hovered: boolean
): void {
  const layout = getHudSideChipLayout(rt, anchorX, hudY, livesRaw, scale)
  const rectX = layout.rectX
  const rectY = layout.topY
  const { hitSize, iconSize } = layout
  const cx = rectX + hitSize / 2
  const cy = rectY + hitSize / 2

  rt.state.bgmMuteRect = { x: rectX, y: rectY, w: hitSize, h: hitSize }

  shellCtx.save()
  if (hovered) {
    shellCtx.globalCompositeOperation = 'lighter'
    const glow = shellCtx.createRadialGradient(cx, cy, iconSize * 0.16, cx, cy, iconSize * 0.72)
    glow.addColorStop(0, muted ? 'rgba(255, 64, 82, 0.2)' : 'rgba(45, 236, 255, 0.22)')
    glow.addColorStop(1, 'rgba(45, 236, 255, 0)')
    shellCtx.fillStyle = glow
    shellCtx.fillRect(rectX - iconSize * 0.35, rectY - iconSize * 0.35, hitSize + iconSize * 0.7, hitSize + iconSize * 0.7)
    shellCtx.globalCompositeOperation = 'source-over'
  }
  shellCtx.globalAlpha = hovered ? 1 : 0.9
  const icon = muted ? (hovered ? 'volume-off-hover' : 'volume-off') : hovered ? 'volume-on-hover' : 'volume-on'
  drawHudIcon(shellCtx, icon, cx - iconSize / 2, cy - iconSize / 2, {
    size: iconSize,
  })
  shellCtx.restore()
}
