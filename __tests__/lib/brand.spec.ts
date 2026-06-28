import {
  BRAND_DESCRIPTION,
  BRAND_KEYWORDS,
  BRAND_LOGO_PATH,
  BRAND_MARK_PATH,
  BRAND_NAME,
  BRAND_OG_IMAGE_PATH,
  BRAND_SLUG,
  brandLogPrefix,
  brandServiceWorkerCacheName,
} from '@/lib/brand'

describe('lib/brand', () => {
  it('exposes MineScroll display name and npm slug', () => {
    expect(BRAND_NAME).toBe('MineScroll')
    expect(BRAND_SLUG).toBe('mine-scroll')
    expect(BRAND_DESCRIPTION).toMatch(/minesweeper/i)
  })

  it('keeps minesweeper-related SEO keywords', () => {
    expect(BRAND_KEYWORDS).toEqual(expect.arrayContaining(['minesweeper', 'minescroll', 'mine scroll']))
  })

  it('builds stable dev log prefixes', () => {
    expect(brandLogPrefix()).toBe('[mine-scroll]')
    expect(brandLogPrefix('ranked')).toBe('[mine-scroll ranked]')
    expect(brandLogPrefix('service-worker')).toBe('[mine-scroll service-worker]')
  })

  it('builds versioned service worker cache names', () => {
    expect(brandServiceWorkerCacheName('0.1.0')).toBe('mine-scroll-v0.1.0')
  })

  it('serves brand images from public/assets/brand', () => {
    for (const path of [BRAND_LOGO_PATH, BRAND_MARK_PATH, BRAND_OG_IMAGE_PATH]) {
      expect(path).toMatch(/^\/assets\/brand\//)
    }
  })
})
