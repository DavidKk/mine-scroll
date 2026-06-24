#!/usr/bin/env python3
"""One-off helper: split ambient-backdrop.ts into layered modules."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/ui/ambient-backdrop.ts"
OUT = ROOT / "src/ui/ambient-backdrop"

lines = SRC.read_text().splitlines(keepends=True)


def sl(start: int, end: int) -> str:
    return "".join(lines[start - 1 : end])


OUT.mkdir(parents=True, exist_ok=True)

types_ts = (
    "import type { GameStatus } from '../../core/types.ts';\n"
    "import type { ScrollPressureState } from '../renderer/index.ts';\n\n"
    + sl(9, 33)
    + "\n"
)

math_ts = sl(484, 495)

shared_ts = (
    "import { clamp01 } from './math.ts';\n\n"
    "export { clamp01, hash01, lerp } from './math.ts';\n\n"
    + sl(53, 57).replace("interface Vec3", "export interface Vec3")
    + sl(788, 791).replace("interface Point2", "export interface Point2")
    + sl(631, 640).replace("interface CosmicPalette", "export interface CosmicPalette")
    + sl(793, 838)
    + sl(642, 677).replace("function cosmicPalette", "export function cosmicPalette")
    + sl(679, 711)
    .replace("function drawDeepVoid", "export function drawDeepVoid")
    .replace("function drawSkyWash", "export function drawSkyWash")
    + sl(1723, 1745).replace("function drawEdgeFade", "export function drawEdgeFade")
)

mood_ts = (
    "import {\n"
    "  SCROLL_BATCH_TIERS,\n"
    "  SCROLL_INTERVAL_TIERS_MS,\n"
    "  getEndlessScrollProfile,\n"
    "} from '../../core/modes/endless/index.ts';\n"
    "import type { BackdropDifficultyInput, BackdropMood } from './types.ts';\n"
    "import { clamp01, lerp } from './math.ts';\n\n"
    + sl(451, 482)
    + """

/** Per-layer tuning — particles, glyphs, and shmup stay independent. */
export interface BackdropParticlesTuning {
  density: number;
  glow: number;
  drift: number;
  streakIntensity: number;
}

export interface BackdropGlyphsTuning {
  density: number;
  intensity: number;
  motion: number;
}

export interface BackdropShmupTuning {
  intensity: number;
}

export interface BackdropLayerTuning {
  particles: BackdropParticlesTuning;
  glyphs: BackdropGlyphsTuning;
  shmup: BackdropShmupTuning;
}

const GLYPH_MOTION_BASE = 0.82;

export function resolveBackdropLayers(mood: BackdropMood): BackdropLayerTuning {
  const vis = Math.max(mood.intensity, 0.16);
  return {
    particles: {
      density: 0.95 + vis * 0.65,
      glow: 1.02 + vis * 0.55,
      drift: mood.energy,
      streakIntensity: vis,
    },
    glyphs: {
      density: 0.95 + vis * 0.65,
      intensity: vis,
      motion: GLYPH_MOTION_BASE,
    },
    shmup: {
      intensity: Math.max(0.16, vis),
    },
  };
}

"""
    + sl(1772, 1792)
)

particles_ts = (
    "import { clamp01, hash01, lerp, type CosmicPalette } from './shared.ts';\n"
    "import type { BackdropParticlesTuning } from './mood.ts';\n\n"
    + sl(35, 41)
    + sl(497, 592)
    + sl(713, 785)
    + """

export function drawParticlesLayer(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  nowMs: number,
  colors: CosmicPalette,
  tuning: BackdropParticlesTuning,
): void {
  drawAmbientStarfield(ctx, shellW, shellH, nowMs, colors, tuning.density, tuning.glow);
  drawParallaxStarDrift(
    ctx,
    shellW,
    shellH,
    nowMs,
    colors,
    tuning.drift,
    tuning.density,
    tuning.glow,
    tuning.streakIntensity,
  );
}
"""
)

shmup_raw = sl(1309, 1600)
shmup_raw = shmup_raw.replace("function drawShmupLayer(", "function drawShmupLayerImpl(")
# Drop glyph knockback helper — shmup no longer touches glyphs.
start = shmup_raw.find("/** Auto-scroll + bullet-hit knockback")
end = shmup_raw.find("function drawShmupBulletTrail")
if start != -1 and end != -1:
    shmup_raw = shmup_raw[:start] + shmup_raw[end:]

shmup_ts = (
    "import { clamp01, strokeRoundedLoop, type CosmicPalette } from './shared.ts';\n"
    "import type { BackdropShmupTuning } from './mood.ts';\n\n"
    + shmup_raw
    + """

export function drawShmupLayer(
  ctx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
  nowMs: number,
  colors: CosmicPalette,
  tuning: BackdropShmupTuning,
): void {
  drawShmupLayerImpl(ctx, shellW, shellH, nowMs, colors, tuning.intensity);
}
"""
)

glyphs_ts = (
    "import {\n"
    "  clamp01,\n"
    "  hash01,\n"
    "  lerp,\n"
    "  dist2,\n"
    "  lerpPt2,\n"
    "  strokeRoundedLoop,\n"
    "  type CosmicPalette,\n"
    "  type Point2,\n"
    "  type Vec3,\n"
    "} from './shared.ts';\n"
    "import type { BackdropGlyphsTuning } from './mood.ts';\n\n"
    + sl(43, 449)
    + sl(594, 629)
    + sl(787, 791)
    + sl(840, 883)
    + sl(884, 1307)
)

glyphs_ts = glyphs_ts.replace("function drawAsteroidQuads(", "export function drawFloatingGlyphsLayer(")
glyphs_ts = glyphs_ts.replace(
    "  drift: number,\n  density: number,\n  _glow: number,\n  intensity: number,\n): void {",
    "  tuning: BackdropGlyphsTuning,\n): void {",
)
glyphs_ts = glyphs_ts.replace(
    "  const motion = drift;",
    "  const motion = tuning.motion;\n  const density = tuning.density;\n  const intensity = tuning.intensity;",
)
glyphs_ts = glyphs_ts.replace("  const bullets = shmupActiveBullets(nowMs, shellW, shellH);\n\n", "")
glyphs_ts = glyphs_ts.replace(
    "      const shift = shmupGlyphShift(seed, cx, cy, nowMs, shellH, bullets);\n"
    "      const gx = cx + shift.x;\n"
    "      const gy = cy + shift.y;\n",
    "      const shift = glyphFloatShift(seed, nowMs, shellH);\n"
    "      const gx = cx + shift.x;\n"
    "      const gy = cy + shift.y;\n",
)
glyphs_ts = glyphs_ts.replace(
    "export function drawFloatingGlyphsLayer(",
    """/** Independent glyph drift — not driven by shmup or scroll energy. */
function glyphFloatShift(seed: number, nowMs: number, shellH: number): Point2 {
  const scroll = (nowMs * (0.016 + hash01(seed + 55) * 0.012)) % Math.max(1, shellH);
  return {
    x: Math.sin(nowMs * 0.00042 + seed * 0.13) * 10,
    y: scroll * 0.22,
  };
}

export function drawFloatingGlyphsLayer(""",
)

index_ts = (
    "import type { GameStatus } from '../../core/types.ts';\n"
    "import type { AmbientBackdropInput, BackdropMood } from './types.ts';\n"
    "import { cosmicPalette, drawDeepVoid, drawEdgeFade, drawSkyWash } from './shared.ts';\n"
    "import { computeBackdropMood, resolveBackdropLayers, smoothBackdropMood } from './mood.ts';\n"
    "import { drawParticlesLayer } from './particles.ts';\n"
    "import { drawFloatingGlyphsLayer } from './glyphs.ts';\n"
    "import { drawShmupLayer } from './shmup.ts';\n\n"
    "export type {\n"
    "  AmbientBackdropInput,\n"
    "  BackdropDifficultyInput,\n"
    "  BackdropMood,\n"
    "} from './types.ts';\n"
    "export {\n"
    "  computeBackdropMood,\n"
    "  smoothBackdropMood,\n"
    "  resolveBackdropLayers,\n"
    "  computeBackdropIntensity,\n"
    "  smoothBackdropIntensity,\n"
    "  type BackdropLayerTuning,\n"
    "  type BackdropParticlesTuning,\n"
    "  type BackdropGlyphsTuning,\n"
    "  type BackdropShmupTuning,\n"
    "} from './mood.ts';\n\n"
    """/** Full-screen cosmic backdrop — particles, glyphs, and shmup are independent layers. */
export function drawAmbientBackdrop(
  ctx: CanvasRenderingContext2D,
  input: AmbientBackdropInput,
): void {
  const { shellW, shellH, nowMs, mood } = input;
  if (shellW <= 0 || shellH <= 0) return;

  const colors = cosmicPalette(mood.heat);
  const layers = resolveBackdropLayers(mood);

  ctx.save();
  drawDeepVoid(ctx, shellW, shellH, colors);
  drawSkyWash(ctx, shellW, shellH, colors, layers.particles.glow);
  drawFloatingGlyphsLayer(ctx, shellW, shellH, nowMs, colors, layers.glyphs);
  drawParticlesLayer(ctx, shellW, shellH, nowMs, colors, layers.particles);
  drawShmupLayer(ctx, shellW, shellH, nowMs, colors, layers.shmup);
  drawEdgeFade(ctx, shellW, shellH, mood.intensity);
  ctx.restore();
}

export interface BackdropLabPreset {
  id: string;
  label: string;
  description: string;
  mood: BackdropMood;
  status: GameStatus;
}

"""
    + sl(1802, 1852).replace(
        "watch-only shmup vignette: arrow ship auto-fires at drifting glyphs.",
        "watch-only shmup vignette — independent from glyph drift.",
    )
)

(OUT / "types.ts").write_text(types_ts)
(OUT / "math.ts").write_text(math_ts)
(OUT / "shared.ts").write_text(shared_ts)
(OUT / "mood.ts").write_text(mood_ts)
(OUT / "particles.ts").write_text(particles_ts)
(OUT / "glyphs.ts").write_text(glyphs_ts)
(OUT / "shmup.ts").write_text(shmup_ts)
(OUT / "index.ts").write_text(index_ts)
SRC.write_text('export * from "./ambient-backdrop/index.ts";\n')
print("Split complete ->", OUT)
