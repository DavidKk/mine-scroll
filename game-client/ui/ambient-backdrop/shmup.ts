import type { BackdropShmupTuning } from './mood.ts'
import { clamp01, type CosmicPalette, lerp, strokeRoundedLoop } from './shared.ts'
import { SHMUP_NOSE_LEN, shmupBulletSpeed, type ShmupShipMotion, shmupShipMotion, shmupShipNoseAt, shmupShipSize, shmupShotAtBirth } from './shmup-motion.ts'

/* ── Shmup vignette — faint background easter-egg, not a playable layer ── */

const SHMUP_SHIP_VIS = 0.38
/** Thruster reads brighter than the ship outline — still a background easter-egg. */
const SHMUP_THRUSTER_VIS = 0.82
/** Bullets need to read over the starfield — brighter than the ship silhouette. */
const SHMUP_BULLET_VIS = 0.78
const SHMUP_MAX_BULLETS = 3
/** Long pause between volleys, then 1–3 discrete shots. */
const SHMUP_BURST_CYCLE_MS = 3400
const SHMUP_BURST_GAP_MS = 380

interface ShmupBullet {
  x: number
  y: number
  age: number
  birthMs: number
  aim: number
  travel: number
}

function shmupVolleySize(cycleIndex: number): number {
  return (Math.abs(cycleIndex) % 3) + 1
}

function shmupActiveBullets(nowMs: number, shellW: number, shellH: number): ShmupBullet[] {
  const speed = shmupBulletSpeed(shellW, shellH)
  const maxTravel = Math.hypot(shellW, shellH) * 0.52
  const maxAge = maxTravel / speed
  const cycleIndex = Math.floor(nowMs / SHMUP_BURST_CYCLE_MS)
  const cyclesBack = Math.ceil(maxAge / SHMUP_BURST_CYCLE_MS) + 1
  const candidates: ShmupBullet[] = []

  for (let c = cycleIndex; c >= cycleIndex - cyclesBack; c -= 1) {
    const cycleStart = c * SHMUP_BURST_CYCLE_MS
    const volley = shmupVolleySize(c)
    for (let i = 0; i < volley; i += 1) {
      const birthMs = cycleStart + i * SHMUP_BURST_GAP_MS
      if (birthMs > nowMs) continue
      const age = nowMs - birthMs
      if (age > maxAge) continue

      const shot = shmupShotAtBirth(birthMs, shellW, shellH)
      const travel = Math.min(age * speed, maxTravel)
      candidates.push({
        x: shot.noseX + Math.cos(shot.aim) * travel,
        y: shot.noseY + Math.sin(shot.aim) * travel,
        age,
        birthMs,
        aim: shot.aim,
        travel,
      })
    }
  }

  candidates.sort((a, b) => b.birthMs - a.birthMs)
  return candidates.slice(0, SHMUP_MAX_BULLETS)
}

/** Single projectile — near (large/bright) → far (small/faint). No long beam. */
function drawShmupBullet(ctx: CanvasRenderingContext2D, b: ShmupBullet, shellW: number, shellH: number, colors: CosmicPalette, intensity: number): void {
  const maxTravel = Math.hypot(shellW, shellH) * 0.52
  const farNorm = clamp01(b.travel / maxTravel)

  const fade = SHMUP_BULLET_VIS * lerp(0.92, 0.48, farNorm) * (0.62 + intensity * 0.2)
  if (fade < 0.05) return

  const headInset = lerp(5, 2, farNorm)
  const headX = b.x - Math.cos(b.aim) * headInset
  const headY = b.y - Math.sin(b.aim) * headInset
  const rx = lerp(3.4, 1.3, farNorm)
  const ry = lerp(7, 2.4, farNorm)
  const trailLen = lerp(22, 8, farNorm)

  ctx.save()
  ctx.translate(headX, headY)
  ctx.rotate(b.aim + Math.PI / 2)

  if (trailLen > 2) {
    const grad = ctx.createLinearGradient(0, -headInset, 0, -headInset + trailLen)
    grad.addColorStop(0, `rgba(255, 255, 255, ${fade * 0.45})`)
    grad.addColorStop(0.25, `rgba(${colors.starCool}, ${fade * 0.7})`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.strokeStyle = grad
    ctx.lineWidth = lerp(2, 0.9, farNorm)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 1)
    ctx.lineTo(0, trailLen)
    ctx.stroke()
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 2.6)
  core.addColorStop(0, `rgba(255, 255, 255, ${fade * 0.75})`)
  core.addColorStop(0.35, `rgba(${colors.starCool}, ${fade * 0.9})`)
  core.addColorStop(0.7, `rgba(${colors.starWarm}, ${fade * 0.55})`)
  core.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawShmupMuzzleFlash(
  ctx: CanvasRenderingContext2D,
  bullets: ShmupBullet[],
  nowMs: number,
  shellW: number,
  shellH: number,
  colors: CosmicPalette,
  intensity: number
): void {
  const hasYoungShot = bullets.some((b) => b.age <= 90)
  if (!hasYoungShot) return

  const nose = shmupShipNoseAt(nowMs, shellW, shellH)
  const youngest = Math.min(...bullets.filter((b) => b.age <= 90).map((b) => b.age))
  const t = 1 - youngest / 90
  const alpha = t * SHMUP_BULLET_VIS * (0.5 + intensity * 0.15)
  if (alpha < 0.05) return

  ctx.save()
  const flash = ctx.createRadialGradient(nose.x, nose.y, 0, nose.x, nose.y, 8 * t + 2)
  flash.addColorStop(0, `rgba(${colors.starCool}, ${alpha * 0.65})`)
  flash.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = flash
  ctx.beginPath()
  ctx.arc(nose.x, nose.y, 3 + t * 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawShmupThruster(ctx: CanvasRenderingContext2D, size: number, nowMs: number, colors: CosmicPalette, intensity: number): void {
  const flicker = 0.72 + Math.sin(nowMs * 0.031) * 0.18 + Math.sin(nowMs * 0.047 + 1.2) * 0.1
  const engineY = size * 0.55
  const plumeLen = size * (0.95 + flicker * 0.55)
  const nozzleW = size * 0.22
  const vis = SHMUP_THRUSTER_VIS * (0.72 + intensity * 0.2) * flicker

  const plume = ctx.createLinearGradient(0, engineY, 0, engineY + plumeLen)
  plume.addColorStop(0, `rgba(255, 230, 190, ${vis * 0.95})`)
  plume.addColorStop(0.22, `rgba(${colors.horizon}, ${vis * 0.82})`)
  plume.addColorStop(0.55, `rgba(${colors.starWarm}, ${vis * 0.45})`)
  plume.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = plume
  ctx.beginPath()
  ctx.moveTo(-nozzleW, engineY)
  ctx.lineTo(nozzleW, engineY)
  ctx.lineTo(0, engineY + plumeLen)
  ctx.closePath()
  ctx.fill()

  for (const side of [-1, 1]) {
    const wispLen = plumeLen * 0.72
    const wispX = side * size * 0.24
    const wisp = ctx.createLinearGradient(wispX, engineY, wispX + side * size * 0.1, engineY + wispLen)
    wisp.addColorStop(0, `rgba(${colors.horizon}, ${vis * 0.55})`)
    wisp.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = wisp
    ctx.beginPath()
    ctx.moveTo(wispX - side * size * 0.06, engineY)
    ctx.lineTo(wispX + side * size * 0.06, engineY)
    ctx.lineTo(wispX + side * size * 0.14, engineY + wispLen)
    ctx.closePath()
    ctx.fill()
  }

  const core = ctx.createRadialGradient(0, engineY, 0, 0, engineY, size * 0.42)
  core.addColorStop(0, `rgba(255, 255, 255, ${vis * 0.7})`)
  core.addColorStop(0.4, `rgba(${colors.horizon}, ${vis * 0.55})`)
  core.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.ellipse(0, engineY, size * 0.2, size * 0.32, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawShmupArrowShip(ctx: CanvasRenderingContext2D, motion: ShmupShipMotion, nowMs: number, colors: CosmicPalette, intensity: number, shellW: number): void {
  const size = shmupShipSize(shellW)
  const wobble = Math.sin(nowMs * 0.0018) * 0.04
  const tip = { x: 0, y: -size * SHMUP_NOSE_LEN }
  const left = { x: -size * 0.75, y: size * 0.55 }
  const right = { x: size * 0.75, y: size * 0.55 }
  const alpha = SHMUP_SHIP_VIS * (0.48 + intensity * 0.12)
  const lineW = Math.max(1.3, size * 0.12)

  ctx.save()
  ctx.translate(motion.x, motion.y)
  ctx.rotate(motion.heading + Math.PI / 2 + wobble)

  ctx.globalAlpha = alpha
  strokeRoundedLoop(ctx, [tip, right, left], lineW, size * 0.18, `rgba(${colors.starCool}, 0.88)`)

  ctx.globalAlpha = 1
  drawShmupThruster(ctx, size, nowMs, colors, intensity)

  ctx.restore()
}

function drawShmupLayerImpl(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  nowMs: number,
  colors: CosmicPalette,
  intensity: number,
  pass: 'ship' | 'bullets'
): void {
  ctx.save()

  if (pass === 'ship') {
    const motion = shmupShipMotion(nowMs, shellW, shellH)
    drawShmupArrowShip(ctx, motion, nowMs, colors, intensity, shellW)
  } else {
    const bullets = shmupActiveBullets(nowMs, shellW, shellH)
    for (const b of bullets) {
      drawShmupBullet(ctx, b, shellW, shellH, colors, intensity)
    }
    drawShmupMuzzleFlash(ctx, bullets, nowMs, shellW, shellH, colors, intensity)
  }

  ctx.restore()
}

/** Faint ship — draw under starfield. */
export function drawShmupShipLayer(ctx: CanvasRenderingContext2D, shellW: number, shellH: number, nowMs: number, colors: CosmicPalette, tuning: BackdropShmupTuning): void {
  drawShmupLayerImpl(ctx, shellW, shellH, nowMs, colors, tuning.intensity, 'ship')
}

/** Discrete bullets — draw over starfield so they stay visible. */
export function drawShmupBulletsLayer(ctx: CanvasRenderingContext2D, shellW: number, shellH: number, nowMs: number, colors: CosmicPalette, tuning: BackdropShmupTuning): void {
  drawShmupLayerImpl(ctx, shellW, shellH, nowMs, colors, tuning.intensity, 'bullets')
}
