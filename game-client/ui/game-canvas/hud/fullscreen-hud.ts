import { parseLivesDisplay } from '../../hud-sprites.ts'
import type { GameIntroProgress } from '../overlay/game-intro.ts'
import type { GameCanvasRuntime } from '../runtime/context.ts'
import type { GameCanvasFullscreenOptions } from '../types.ts'
import { drawBgmMuteHud } from './bgm-mute-hud.ts'
import { drawComboHud } from './combo-hud.ts'
import { drawDevAutoButton, drawDevSpeedUpButton } from './dev-controls.ts'
import { drawLeaderboardHud } from './leaderboard-hud.ts'
import { drawLivesHud } from './lives-hud.ts'
import { drawScoreHud } from './score-hud.ts'

export function drawFullscreenHud(
  rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  shell: GameCanvasFullscreenOptions,
  shellW: number,
  _shellH: number,
  intro: GameIntroProgress | null = null
): void {
  if (!rt.state.stageLayout) return
  const stats = shell.getStats?.()
  const stage = rt.state.stageLayout
  const { scale } = stage
  const isMobile = stage.profile === 'mobile'
  const hudAlpha = intro && !intro.complete ? intro.hudAlpha : 1
  const showIntroLineOnly = intro && !intro.complete

  if (!isMobile && !showIntroLineOnly) {
    const barX = 0
    const barY = stage.hudY
    const barW = shellW
    const topBarH = stage.hudH
    const topLine = shellCtx.createLinearGradient(barX, barY, barX + barW, barY)
    topLine.addColorStop(0, 'rgba(59, 130, 246, 0)')
    topLine.addColorStop(0.18, 'rgba(59, 130, 246, 0.36)')
    topLine.addColorStop(0.82, 'rgba(59, 130, 246, 0.36)')
    topLine.addColorStop(1, 'rgba(59, 130, 246, 0)')
    shellCtx.fillStyle = topLine
    shellCtx.fillRect(barX, barY + topBarH + 2 * scale, barW, Math.max(1, scale))
  }

  if (hudAlpha <= 0.01) return

  shellCtx.save()
  shellCtx.globalAlpha = hudAlpha

  const livesRaw = stats?.lives
  const barY = stage.hudY
  const hudY = barY + (isMobile ? 3 : 7) * scale
  drawScoreHud(rt, shellCtx, stage.scoreAnchor.x, hudY, stats?.score ?? 0, scale)
  if (!isMobile) {
    drawComboHud(rt, shellCtx, stage.comboHudAnchor.x, hudY, stats?.combo ?? 0, scale)
  }
  drawLivesHud(rt, shellCtx, stage.livesAnchor.x, hudY, livesRaw, scale)
  const showPreStartControls = rt.state.currentStatus === 'idle'
  if (showPreStartControls && shell.getBgmMuted && shell.onToggleBgmMute) {
    drawBgmMuteHud(rt, shellCtx, stage.sideControlsAnchor.x, stage.sideControlsAnchor.y, livesRaw, scale, shell.getBgmMuted(), rt.state.uiHoverTarget === 'bgm-mute')
  } else {
    rt.state.bgmMuteRect = null
  }

  if (showPreStartControls && shell.onOpenLeaderboard) {
    const unseenUpdate = shell.hasLeaderboardUnseenUpdate?.() ?? false
    drawLeaderboardHud(rt, shellCtx, stage.sideControlsAnchor.x, stage.sideControlsAnchor.y, livesRaw, scale, rt.state.uiHoverTarget === 'leaderboard', unseenUpdate)
  } else {
    rt.state.leaderboardRect = null
  }

  const livesParsed = parseLivesDisplay(livesRaw)
  if (livesParsed) {
    if (rt.state.lastLivesCurrent >= 0 && livesParsed.current > rt.state.lastLivesCurrent) {
      rt.state.heartRefillFxStartedAt = performance.now()
      rt.state.heartRefillTargetIndex = Math.max(0, Math.min(livesParsed.max - 1, livesParsed.current - 1))
      rt.state.heartRefillMax = livesParsed.max
      rt.scheduleAnimationFrame()
    }
    rt.state.lastLivesCurrent = livesParsed.current
  }

  if (stats?.devAutoVisible) {
    const { x: autoX, y: autoY, w: autoW, h: autoH } = stage.autoRect
    rt.state.devAutoRect = { x: autoX, y: autoY, w: autoW, h: autoH }
    const active = Boolean(stats.devAutoActive)
    drawDevAutoButton(rt, shellCtx, rt.state.devAutoRect, active, scale)
    if (stats.devSpeedVisible !== false) {
      const speed = stage.devSpeedRect
      rt.state.devSpeedRect = { x: speed.x, y: speed.y, w: speed.w, h: speed.h }
      drawDevSpeedUpButton(rt, shellCtx, rt.state.devSpeedRect, rt.state.currentStatus === 'playing', scale)
    } else {
      rt.state.devSpeedRect = null
    }
  }

  shellCtx.restore()
}
