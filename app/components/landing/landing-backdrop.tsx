'use client'

import { type RefObject, useEffect, useRef } from 'react'

import { cn } from '@/lib/cn'
import { NEON_BACKDROP } from '@/lib/neon-backdrop'

type LandingBackdropProps = {
  scrollRootRef: RefObject<HTMLElement | null>
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  cyan: boolean
  alpha: number
}

const PARTICLE_COUNT = 28
const MAX_DPR = 1.5
const FRAME_INTERVAL_MS = 1000 / 24
const CYAN_FILL = 'rgba(45, 236, 255, 0.85)'
const INDIGO_FILL = 'rgba(129, 140, 248, 0.75)'

function createParticles(width: number, height: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: 0.08 + Math.random() * 0.28,
      r: 0.6 + Math.random() * 1.8,
      cyan: Math.random() > 0.35,
      alpha: 0.18 + Math.random() * 0.42,
    })
  }
  return particles
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  const pulseAt = (particle: Particle) => 0.75 + Math.sin((particle.x + particle.y) * 0.018) * 0.25

  ctx.fillStyle = CYAN_FILL
  for (const particle of particles) {
    if (!particle.cyan) continue
    ctx.globalAlpha = particle.alpha * pulseAt(particle)
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.r * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = INDIGO_FILL
  for (const particle of particles) {
    if (particle.cyan) continue
    ctx.globalAlpha = particle.alpha * pulseAt(particle)
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.r * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function stepParticles(particles: Particle[], width: number, height: number): void {
  for (const particle of particles) {
    particle.x += particle.vx
    particle.y += particle.vy

    if (particle.x < -8) particle.x = width + 8
    if (particle.x > width + 8) particle.x = -8
    if (particle.y > height + 8) {
      particle.y = -8
      particle.x = Math.random() * width
    }
  }
}

export function LandingBackdrop({ scrollRootRef }: LandingBackdropProps) {
  const auroraRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const timerRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const lastDrawRef = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = scrollRootRef.current
    const aurora = auroraRef.current
    const grid = gridRef.current
    if (reduced || !root || !aurora || !grid) return

    let parallaxRaf = 0
    let lastScroll = -1

    const applyParallax = (scrollTop: number) => {
      if (Math.abs(scrollTop - lastScroll) < 2) return
      lastScroll = scrollTop
      const y = scrollTop * 0.22
      const tint = Math.min(1, scrollTop / 900)
      aurora.style.transform = `translate3d(0, ${y * 0.35}px, 0) scale(${1 + tint * 0.04})`
      grid.style.transform = `translate3d(0, ${y * 0.55}px, 0)`
      aurora.style.filter = `hue-rotate(${tint * 18}deg)`
    }

    const onScroll = () => {
      if (parallaxRaf) return
      parallaxRaf = window.requestAnimationFrame(() => {
        parallaxRaf = 0
        applyParallax(root.scrollTop)
      })
    }

    applyParallax(root.scrollTop)
    root.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      root.removeEventListener('scroll', onScroll)
      if (parallaxRaf) window.cancelAnimationFrame(parallaxRaf)
    }
  }, [scrollRootRef])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = canvasRef.current
    if (reduced || !canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let active = document.visibilityState === 'visible'
    let resizeTimer = 0

    const stopLoop = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const scheduleNext = () => {
      if (!active || timerRef.current !== null) return
      const delay = Math.max(0, FRAME_INTERVAL_MS - (performance.now() - lastDrawRef.current))
      timerRef.current = window.setTimeout(tick, delay)
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const width = window.innerWidth
      const height = window.innerHeight
      sizeRef.current = { width, height }
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particlesRef.current = createParticles(width, height)
    }

    const tick = () => {
      timerRef.current = null
      if (!active) return

      const { width, height } = sizeRef.current
      if (width > 0 && height > 0) {
        stepParticles(particlesRef.current, width, height)
        ctx.clearRect(0, 0, width, height)
        ctx.globalCompositeOperation = 'lighter'
        drawParticles(ctx, particlesRef.current)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
        lastDrawRef.current = performance.now()
      }

      scheduleNext()
    }

    const onVisibility = () => {
      active = document.visibilityState === 'visible'
      if (active) scheduleNext()
      else stopLoop()
    }

    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(resize, 120)
    }

    resize()
    lastDrawRef.current = 0
    scheduleNext()
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopLoop()
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div className={cn(NEON_BACKDROP.root, 'fixed inset-0')} aria-hidden="true">
      <div ref={auroraRef} className={cn(NEON_BACKDROP.aurora, 'will-change-transform motion-reduce:animate-none')} />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-85 mix-blend-screen motion-reduce:hidden" />
      <div className={NEON_BACKDROP.orbs}>
        <span className={cn(NEON_BACKDROP.orbA, 'motion-reduce:animate-none')} aria-hidden="true" />
        <span className={cn(NEON_BACKDROP.orbB, 'motion-reduce:animate-none')} aria-hidden="true" />
        <span className={cn(NEON_BACKDROP.orbC, 'motion-reduce:animate-none')} aria-hidden="true" />
      </div>
      <div className={cn(NEON_BACKDROP.starsFar, 'motion-reduce:animate-none')} />
      <div className={cn(NEON_BACKDROP.starsNear, 'motion-reduce:animate-none')} />
      <div ref={gridRef} className={cn(NEON_BACKDROP.grid, 'will-change-transform')} />
      <div className={cn(NEON_BACKDROP.scan, 'motion-reduce:animate-none')} />
      <div className={NEON_BACKDROP.vignette} />
    </div>
  )
}
