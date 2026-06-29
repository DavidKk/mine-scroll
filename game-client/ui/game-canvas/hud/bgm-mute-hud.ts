import { drawHudIcon } from '../../hud-sprites.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { drawHudSideChipBackground, drawHudSideChipIcon, getHudSideChipLayout } from './side-chip-layout.ts'

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

  const emphasized = layout.isMobile
  shellCtx.save()
  drawHudSideChipBackground(shellCtx, { x: rectX, y: rectY, w: hitSize, h: hitSize }, scale, hovered, muted ? 'rose' : 'cyan', emphasized)
  const icon = muted ? (hovered ? 'volume-off-hover' : 'volume-off') : hovered ? 'volume-on-hover' : 'volume-on'
  drawHudSideChipIcon(
    shellCtx,
    () =>
      drawHudIcon(shellCtx, icon, cx - iconSize / 2, cy - iconSize / 2, {
        size: iconSize,
      }),
    scale,
    muted ? 'rose' : 'cyan',
    hovered,
    emphasized
  )
  shellCtx.restore()
}
