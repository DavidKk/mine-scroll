export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}
