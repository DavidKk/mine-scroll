import { drawHudIcon } from '../../hud-sprites.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { drawDesktopHudSideChipIcon, drawHudSideChipBackground, drawHudSideChipIcon, getHudSideChipLayout } from './side-chip-layout.ts'

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
  const chipRect = { x: rectX, y: rectY, w: hitSize, h: hitSize }

  rt.state.bgmMuteRect = chipRect

  const icon = muted ? (hovered ? 'volume-off-hover' : 'volume-off') : hovered ? 'volume-on-hover' : 'volume-on'
  const drawIcon = () =>
    drawHudIcon(shellCtx, icon, cx - iconSize / 2, cy - iconSize / 2, {
      size: iconSize,
    })

  if (layout.isMobile) {
    shellCtx.save()
    drawHudSideChipBackground(shellCtx, chipRect, scale, hovered, muted ? 'rose' : 'cyan', true)
    drawHudSideChipIcon(shellCtx, drawIcon, scale, muted ? 'rose' : 'cyan', hovered, true)
    shellCtx.restore()
    return
  }

  drawDesktopHudSideChipIcon(shellCtx, drawIcon, chipRect, iconSize, hovered, muted ? '255, 64, 82' : '45, 236, 255')
}
