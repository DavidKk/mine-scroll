import { hash01 } from './shared.ts'

/** Bullets must outrun peak ship drift — margin over analytic max speed. */
const SHMUP_BULLET_SPEED_MARGIN = 1.45
export const SHMUP_NOSE_LEN = 1
const SHMUP_MOTION_DT_MS = 32

export interface ShmupShipMotion {
  x: number
  y: number
  vx: number
  vy: number
  heading: number
}

export interface ShmupShotSnapshot {
  motion: ShmupShipMotion
  aim: number
  noseX: number
  noseY: number
}

export function shmupShipSize(shellW: number): number {
  return Math.max(9, Math.min(16, shellW * 0.024))
}

function shmupShipHeading(vx: number, vy: number): number {
  if (Math.hypot(vx, vy) < 1e-6) return -Math.PI / 2
  return Math.atan2(vy, vx)
}

/** Smooth full-screen drift — continuous position/velocity, no waypoint teleports. */
function shmupShipRawPos(nowMs: number, shellW: number, shellH: number): { x: number; y: number } {
  const t = nowMs * 0.001
  const marginX = shellW * 0.06
  const marginY = shellH * 0.08
  const rangeX = Math.max(1, shellW - marginX * 2)
  const rangeY = Math.max(1, shellH - marginY * 2)
  const cx = marginX + rangeX * 0.5
  const cy = marginY + rangeY * 0.5

  const nx = Math.sin(t * 0.71 + 1.2) * 0.36 + Math.sin(t * 1.33 + 2.8) * 0.22 + Math.cos(t * 0.39 + 0.5) * 0.16 + Math.sin(t * 1.97 + 4.1) * 0.1
  const ny = Math.sin(t * 0.88 + 3.1) * 0.4 + Math.cos(t * 1.49 + 1.7) * 0.26 + Math.sin(t * 0.63 + 2.2) * 0.14

  return {
    x: cx + (nx / 0.84) * rangeX * 0.48,
    y: cy + (ny / 0.8) * rangeY * 0.48,
  }
}

export function shmupShipMotion(nowMs: number, shellW: number, shellH: number): ShmupShipMotion {
  const { x, y } = shmupShipRawPos(nowMs, shellW, shellH)
  const next = shmupShipRawPos(nowMs + SHMUP_MOTION_DT_MS, shellW, shellH)
  const vx = (next.x - x) / SHMUP_MOTION_DT_MS
  const vy = (next.y - y) / SHMUP_MOTION_DT_MS
  return { x, y, vx, vy, heading: shmupShipHeading(vx, vy) }
}

/** Upper bound on ship drift speed (px/ms) from sinusoid amplitudes/frequencies. */
export function shmupMaxShipSpeed(shellW: number, shellH: number): number {
  const marginX = shellW * 0.06
  const marginY = shellH * 0.08
  const rangeX = Math.max(1, shellW - marginX * 2)
  const rangeY = Math.max(1, shellH - marginY * 2)
  const nxRate = (0.36 * 0.71 + 0.22 * 1.33 + 0.16 * 0.39 + 0.1 * 1.97) * 0.001
  const nyRate = (0.4 * 0.88 + 0.26 * 1.49 + 0.14 * 0.63) * 0.001
  const vxMax = (nxRate / 0.84) * rangeX * 0.48
  const vyMax = (nyRate / 0.8) * rangeY * 0.48
  return Math.hypot(vxMax, vyMax)
}

export function shmupBulletSpeed(shellW: number, shellH: number): number {
  return shmupMaxShipSpeed(shellW, shellH) * SHMUP_BULLET_SPEED_MARGIN
}

function shmupSpreadAim(motion: ShmupShipMotion, birthMs: number): number {
  const spread = (hash01(birthMs * 0.0173 + 891.1) - 0.5) * 0.55
  return motion.heading + spread
}

function shmupNoseFromMotion(motion: ShmupShipMotion, shellW: number): { x: number; y: number } {
  const noseDist = shmupShipSize(shellW) * SHMUP_NOSE_LEN
  return {
    x: motion.x + Math.cos(motion.heading) * noseDist,
    y: motion.y + Math.sin(motion.heading) * noseDist,
  }
}

/** One motion sample — aim + muzzle for a fired shot. */
export function shmupShotAtBirth(birthMs: number, shellW: number, shellH: number): ShmupShotSnapshot {
  const motion = shmupShipMotion(birthMs, shellW, shellH)
  const aim = shmupSpreadAim(motion, birthMs)
  const nose = shmupNoseFromMotion(motion, shellW)
  return { motion, aim, noseX: nose.x, noseY: nose.y }
}

export function shmupShipNoseAt(nowMs: number, shellW: number, shellH: number) {
  const motion = shmupShipMotion(nowMs, shellW, shellH)
  const nose = shmupNoseFromMotion(motion, shellW)
  return { x: nose.x, y: nose.y, size: shmupShipSize(shellW) }
}
