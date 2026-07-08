import {
  BRAND_ALTERNATE_NAMES,
  BRAND_DEFAULT_TITLE,
  BRAND_DESCRIPTION,
  BRAND_DETAILS,
  BRAND_GAME_GENRE,
  BRAND_HOME_TITLE,
  BRAND_IDENTITY,
  BRAND_KEYWORDS,
  BRAND_LOGO_PATH,
  BRAND_MARK_PATH,
  BRAND_NAME,
  BRAND_SLUG,
  BRAND_TAGLINE,
  brandLogPrefix,
  brandServiceWorkerCacheName,
} from '@/lib/brand'

describe('lib/brand', () => {
  it('exposes MineScroll display name and npm slug', () => {
    expect(BRAND_NAME).toBe('MineScroll')
    expect(BRAND_SLUG).toBe('mine-scroll')
    expect(BRAND_GAME_GENRE).toBe('Minesweeper')
    expect(BRAND_TAGLINE).toMatch(/minesweeper/i)
    expect(BRAND_IDENTITY).toMatch(/minesweeper game/i)
    expect(BRAND_DESCRIPTION).toMatch(/minesweeper/i)
    expect(BRAND_DETAILS).toMatch(/mines/i)
    expect(BRAND_HOME_TITLE).toMatch(/minesweeper/i)
    expect(BRAND_DEFAULT_TITLE).toMatch(/minesweeper/i)
  })

  it('keeps minesweeper-related SEO keywords', () => {
    expect(BRAND_KEYWORDS).toEqual(expect.arrayContaining(['minesweeper', 'online minesweeper', 'minescroll', 'mine scroll']))
    expect(BRAND_ALTERNATE_NAMES).toEqual(expect.arrayContaining(['Minesweeper', 'Online Minesweeper']))
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
    for (const path of [BRAND_LOGO_PATH, BRAND_MARK_PATH]) {
      expect(path).toMatch(/^\/assets\/brand\//)
    }
  })
})
