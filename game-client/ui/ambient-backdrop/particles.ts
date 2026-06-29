import type { BackdropParticlesTuning } from './mood.ts'
import { clamp01, type CosmicPalette, hash01, lerp } from './shared.ts'

const PARALLAX_LAYERS = [
  { count: 300, speedY: 0.016, speedX: 0.003, size: 1.15, alpha: 0.78, streak: 0 },
  { count: 220, speedY: 0.03, speedX: 0.006, size: 1.55, alpha: 0.92, streak: 0.35 },
  { count: 140, speedY: 0.052, speedX: 0.011, size: 2, alpha: 1, streak: 0.65 },
] as const

const AMBIENT_STAR_COUNT = 220
/** Per-star base brightness + optional twinkle (steady / gentle pulse / sharp flicker). */
function starParticleBrightness(seed: number, nowMs: number): { alpha: number; sizeMul: number; kind: number } {
  const base = lerp(0.14, 0.96, Math.pow(hash01(seed + 31), 1.25))
  const kind = hash01(seed + 32)

  let tw = 1
  if (kind > 0.8) {
    const speed = 0.0024 + hash01(seed + 33) * 0.0052
    const phase = seed * 0.63
    const pulse = Math.abs(Math.sin(nowMs * speed + phase))
    const sparkle = Math.sin(nowMs * speed * 2.6 + phase * 1.35) ** 2
    tw = 0.22 + pulse * 0.52 + sparkle * 0.38
  } else if (kind > 0.38) {
    const speed = 0.00085 + hash01(seed + 34) * 0.0014
    tw = 0.68 + Math.sin(nowMs * speed + seed) * 0.32
  }

  const alpha = clamp01(base * tw)
  const sizeMul = 0.72 + base * 0.62 + (kind > 0.8 ? tw * 0.18 : 0)
  return { alpha, sizeMul, kind }
}

/**
 * Soft star bloom — radial halo + warm core (subtle; no heavy lens flare).
 */
function drawStarParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rgb: string, alpha: number, bright: number, kind: number, lite = false): void {
  if (alpha < 0.035) return

  if (lite || bright < 0.38) {
    ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.85})`
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.45, size * (lite ? 0.5 : 0.42)), 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const coreR = Math.max(0.4, size * 0.36)
  const glowR = size * (1.05 + bright * 1.35)
  const haloR = size * (1.85 + bright * 2.4)

  if (bright > 0.28) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR)
    halo.addColorStop(0, `rgba(${rgb}, ${alpha * 0.28})`)
    halo.addColorStop(0.4, `rgba(${rgb}, ${alpha * 0.09})`)
    halo.addColorStop(0.75, `rgba(${rgb}, ${alpha * 0.025})`)
    halo.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(x, y, haloR, 0, Math.PI * 2)
    ctx.fill()
  }

  const mid = ctx.createRadialGradient(x, y, 0, x, y, glowR)
  mid.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.5})`)
  mid.addColorStop(0.22, `rgba(${rgb}, ${alpha * 0.38})`)
  mid.addColorStop(0.58, `rgba(${rgb}, ${alpha * 0.08})`)
  mid.addColorStop(1, `rgba(${rgb}, 0)`)
  ctx.fillStyle = mid
  ctx.beginPath()
  ctx.arc(x, y, glowR, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.92, alpha * 0.88)})`
  ctx.beginPath()
  ctx.arc(x, y, coreR, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.78})`
  ctx.beginPath()
  ctx.arc(x, y, coreR * 0.68, 0, Math.PI * 2)
  ctx.fill()

  if (kind > 0.8 && bright > 0.62 && alpha > 0.18) {
    const flare = size * (1.4 + bright * 0.9)
    ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.11})`
    ctx.lineWidth = Math.max(0.3, size * 0.1)
    ctx.beginPath()
    ctx.moveTo(x - flare, y)
    ctx.lineTo(x + flare, y)
    ctx.moveTo(x, y - flare)
    ctx.lineTo(x, y + flare)
    ctx.stroke()
  }
}
/** Sparse full-screen star dust — always visible even at idle intensity. */
function drawAmbientStarfield(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  nowMs: number,
  colors: CosmicPalette,
  density: number,
  glow: number,
  liteStars: boolean
): void {
  const count = Math.floor(AMBIENT_STAR_COUNT * density)
  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const seed = i * 11.17 + 400
    const sx = hash01(seed) * shellW
    const sy = ((hash01(seed + 1) * shellH + nowMs * (0.012 + hash01(seed + 2) * 0.02) * glow) % (shellH + 20)) - 10
    const { alpha: bright, sizeMul, kind } = starParticleBrightness(seed, nowMs)
    const alpha = clamp01((0.18 + hash01(seed + 3) * 0.32) * bright * glow)
    const size = (1.1 + hash01(seed + 4) * 2.2) * sizeMul
    const rgb = hash01(seed + 5) > 0.82 ? colors.starWarm : colors.starCool
    drawStarParticle(ctx, sx, sy, size, rgb, alpha, bright, kind, liteStars)
  }
  ctx.restore()
}

/**
 * Uniform parallax star drift — stars spread across the full canvas and move
 * downward at layered speeds. No vanishing point or corner decoration.
 */
function drawParallaxStarDrift(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  nowMs: number,
  colors: CosmicPalette,
  drift: number,
  density: number,
  glow: number,
  intensity: number,
  liteStars: boolean
): void {
  ctx.save()
  const motion = drift * glow

  for (const layer of PARALLAX_LAYERS) {
    const count = Math.floor(layer.count * density)
    for (let i = 0; i < count; i += 1) {
      const seed = i * 23.11 + layer.speedY * 8000
      const baseX = hash01(seed) * shellW
      const baseY = hash01(seed + 1) * (shellH + 40)
      const sx = (baseX + nowMs * layer.speedX * motion + shellW) % shellW
      const sy = ((baseY + nowMs * layer.speedY * motion) % (shellH + 40)) - 20

      const { alpha: bright, sizeMul, kind } = starParticleBrightness(seed, nowMs)
      const alpha = clamp01((0.16 + hash01(seed + 2) * 0.38) * layer.alpha * bright * glow)
      const size = layer.size * (0.85 + hash01(seed + 3) * 0.75) * sizeMul
      const rgb = hash01(seed + 4) > 0.8 ? colors.starWarm : colors.starCool

      const streakChance = layer.streak * intensity
      if (streakChance > 0.08 && hash01(seed + 5) < streakChance) {
        const streakLen = size * (2.2 + intensity * 3.5)
        ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.42})`
        ctx.lineWidth = Math.max(0.45, size * 0.32)
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx - layer.speedX * motion * 18, sy - streakLen)
        ctx.stroke()
      }

      drawStarParticle(ctx, sx, sy, size, rgb, alpha, bright, kind, liteStars)
    }
  }
  ctx.restore()
}

export function drawParticlesLayer(ctx: CanvasRenderingContext2D, shellW: number, shellH: number, nowMs: number, colors: CosmicPalette, tuning: BackdropParticlesTuning): void {
  const lite = tuning.liteStars ?? false
  drawAmbientStarfield(ctx, shellW, shellH, nowMs, colors, tuning.density, tuning.glow, lite)
  drawParallaxStarDrift(ctx, shellW, shellH, nowMs, colors, tuning.drift, tuning.density, tuning.glow, tuning.streakIntensity, lite)
}
