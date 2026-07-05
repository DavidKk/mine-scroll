export const BRAND_NAME = 'MineScroll'

/** npm package name and service-worker cache namespace. */
export const BRAND_SLUG = 'mine-scroll'

/** Default site description — shared by layout, manifest, JSON-LD, and landing hero. */
export const BRAND_DESCRIPTION = 'Neon minesweeper built for ranked challenge runs. Survive Endless Scroll, chain Puzzle Rush combos, and climb verified leaderboards.'

/** Homepage title tuned around ranked challenge runs rather than generic SEO terms. */
export const BRAND_HOME_TITLE = `${BRAND_NAME} — Ranked Minesweeper Challenge Runs`

export const PLAY_PAGE_TITLE = 'Endless Scroll Ranked Runs'

export const PLAY_PAGE_DESCRIPTION =
  'Ranked Endless Scroll minesweeper. Survive the upward scroll with five lives, dynamic mines, and server-verified scores on the global leaderboard.'

export const RUSH_PAGE_TITLE = 'Puzzle Rush Streak Challenge'

export const RUSH_PAGE_DESCRIPTION = 'Puzzle Rush streak mode. Clear 7×7 boards back-to-back, stack combo multipliers, and push your rush rank on the leaderboard.'

export const BRAND_KEYWORDS = [
  'minesweeper',
  'mine scroll',
  'minescroll',
  'ranked minesweeper',
  'minesweeper leaderboard',
  'endless scroll',
  'puzzle rush',
  'combo streak',
  'challenge mode',
  'neon minesweeper',
  'arcade puzzle',
  'web game',
]

/** Canonical logo served from `public/assets/brand/`. */
export const BRAND_LOGO_PATH = '/assets/brand/logo.png'

/** Small mark for admin chrome and other in-app UI. */
export const BRAND_MARK_PATH = '/assets/brand/logo-mark.png'

export const BRAND_OG_IMAGE_PATH = '/assets/brand/og.png'

/** Dev console prefix, e.g. `[mine-scroll]` or `[mine-scroll ranked]`. */
export function brandLogPrefix(scope?: string): string {
  return scope ? `[${BRAND_SLUG} ${scope}]` : `[${BRAND_SLUG}]`
}

export function brandServiceWorkerCacheName(version: string): string {
  return `${BRAND_SLUG}-v${version}`
}
