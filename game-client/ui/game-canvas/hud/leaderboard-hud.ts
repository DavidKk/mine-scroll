import { drawHudIcon } from '../../hud-sprites.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import { getHudSideChipLayout, stackHudSideChipBelow } from './side-chip-layout.ts'

function drawLeaderboardUnseenFx(
  shellCtx: CanvasRenderingContext2D,
  rectX: number,
  rectY: number,
  chipSize: number,
  cx: number,
  cy: number,
  iconSize: number,
  scale: number
): void {
  const pulse = 0.5 + Math.sin(Date.now() / 260) * 0.5
  const ringRadius = chipSize * 0.54 + pulse * iconSize * 0.14

  shellCtx.save()
  shellCtx.globalCompositeOperation = 'lighter'

  const glow = shellCtx.createRadialGradient(cx, cy, iconSize * 0.08, cx, cy, chipSize * 0.72)
  glow.addColorStop(0, `rgba(250, 204, 21, ${0.22 + pulse * 0.18})`)
  glow.addColorStop(0.45, `rgba(45, 236, 255, ${0.14 + pulse * 0.12})`)
  glow.addColorStop(1, 'rgba(45, 236, 255, 0)')
  shellCtx.fillStyle = glow
  shellCtx.fillRect(rectX - iconSize * 0.45, rectY - iconSize * 0.45, chipSize + iconSize * 0.9, chipSize + iconSize * 0.9)

  shellCtx.globalCompositeOperation = 'source-over'
  shellCtx.lineWidth = Math.max(1.4, 1.2 * scale)
  shellCtx.strokeStyle = `rgba(250, 204, 21, ${0.42 + pulse * 0.38})`
  shellCtx.beginPath()
  shellCtx.arc(cx, cy, ringRadius, 0, Math.PI * 2)
  shellCtx.stroke()

  shellCtx.lineWidth = Math.max(1, scale)
  shellCtx.strokeStyle = `rgba(45, 236, 255, ${0.24 + pulse * 0.22})`
  shellCtx.beginPath()
  shellCtx.arc(cx, cy, ringRadius + Math.max(2, 2.5 * scale), 0, Math.PI * 2)
  shellCtx.stroke()

  const badgeR = Math.max(3.2, 3.6 * scale)
  const badgeX = rectX + chipSize - badgeR * 0.35
  const badgeY = rectY + badgeR * 0.55
  shellCtx.fillStyle = '#fde047'
  shellCtx.shadowColor = 'rgba(250, 204, 21, 0.85)'
  shellCtx.shadowBlur = 8 * scale
  shellCtx.beginPath()
  shellCtx.arc(badgeX, badgeY, badgeR + pulse * scale * 0.8, 0, Math.PI * 2)
  shellCtx.fill()
  shellCtx.shadowBlur = 0
  shellCtx.fillStyle = '#111827'
  shellCtx.font = `700 ${Math.max(7, 7.5 * scale)}px "IBM Plex Mono", monospace`
  shellCtx.textAlign = 'center'
  shellCtx.textBaseline = 'middle'
  shellCtx.fillText('!', badgeX, badgeY + scale * 0.2)

  shellCtx.restore()
}

export function drawLeaderboardHud(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  anchorX: number,
  hudY: number,
  livesRaw: string | undefined,
  scale: number,
  hovered: boolean,
  unseenUpdate = false
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
  if (unseenUpdate) {
    drawLeaderboardUnseenFx(shellCtx, rectX, rectY, chipSize, cx, cy, iconSize, scale)
    rt.scheduleAnimationFrame?.()
  }

  if (hovered) {
    shellCtx.globalCompositeOperation = 'lighter'
    const glow = shellCtx.createRadialGradient(cx, cy, iconSize * 0.12, cx, cy, iconSize * 0.75)
    glow.addColorStop(0, 'rgba(45, 236, 255, 0.22)')
    glow.addColorStop(1, 'rgba(45, 236, 255, 0)')
    shellCtx.fillStyle = glow
    shellCtx.fillRect(rectX - iconSize * 0.35, rectY - iconSize * 0.35, chipSize + iconSize * 0.7, chipSize + iconSize * 0.7)
    shellCtx.globalCompositeOperation = 'source-over'
  }

  const iconDrawSize = unseenUpdate ? iconSize * (1 + (0.5 + Math.sin(Date.now() / 260) * 0.5) * 0.05) : iconSize
  const iconOffset = (iconSize - iconDrawSize) / 2

  shellCtx.globalAlpha = hovered || unseenUpdate ? 1 : 0.9
  drawHudIcon(shellCtx, hovered ? 'leaderboard-hover' : 'leaderboard', cx - iconSize / 2 + iconOffset, cy - iconSize / 2 + iconOffset, {
    size: iconDrawSize,
  })
  shellCtx.restore()
}
