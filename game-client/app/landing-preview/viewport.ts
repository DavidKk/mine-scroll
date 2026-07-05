/** Logical preview viewport — matches mobile stage base size. */
export const LANDING_PREVIEW_VIEWPORT = { width: 390, height: 844 } as const

/** Frame padding on desktop mockup (14px × 2). */
export const LANDING_PREVIEW_FRAME_INSET = 28

/** Fixed frame box height (stage + vertical padding) — used to reserve hero layout. */
export const LANDING_PREVIEW_FRAME_HEIGHT = LANDING_PREVIEW_VIEWPORT.height + LANDING_PREVIEW_FRAME_INSET

/** Minimum scale when the phone mockup frame is shown (desktop). */
export const LANDING_PREVIEW_DESKTOP_MIN_SCALE = 0.72

/** Preview DEMO is shown at this breakpoint and above. */
export const LANDING_PREVIEW_FLAT_BREAKPOINT = 960

export const LANDING_PREVIEW_DESKTOP_MEDIA = `(min-width: ${LANDING_PREVIEW_FLAT_BREAKPOINT}px)` as const

export function computeLandingPreviewScale(frameWidth: number): number {
  const raw = (frameWidth - LANDING_PREVIEW_FRAME_INSET) / LANDING_PREVIEW_VIEWPORT.width
  return Math.min(1, Math.max(LANDING_PREVIEW_DESKTOP_MIN_SCALE, raw))
}
