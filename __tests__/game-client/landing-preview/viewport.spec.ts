import { computeLandingPreviewScale, LANDING_PREVIEW_DESKTOP_MIN_SCALE, LANDING_PREVIEW_FRAME_INSET, LANDING_PREVIEW_VIEWPORT } from '@game-client/app/landing-preview/viewport.ts'

describe('computeLandingPreviewScale', () => {
  it('keeps desktop mockup scale above the visual minimum', () => {
    const frameW = 300
    const scale = computeLandingPreviewScale(frameW)
    expect(scale).toBe(LANDING_PREVIEW_DESKTOP_MIN_SCALE)
    expect(scale).toBeGreaterThan((frameW - LANDING_PREVIEW_FRAME_INSET) / LANDING_PREVIEW_VIEWPORT.width)
  })

  it('caps scale at 1 for wide containers', () => {
    expect(computeLandingPreviewScale(500)).toBe(1)
  })

  it('scales proportionally inside the framed desktop range', () => {
    const frameW = 418
    expect(computeLandingPreviewScale(frameW)).toBeCloseTo((frameW - LANDING_PREVIEW_FRAME_INSET) / LANDING_PREVIEW_VIEWPORT.width)
  })
})
