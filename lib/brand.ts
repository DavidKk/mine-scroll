export const BRAND_NAME = 'MineScroll'

/** npm package name and service-worker cache namespace. */
export const BRAND_SLUG = 'mine-scroll'

export const BRAND_DESCRIPTION = 'Neon minesweeper with classic, hex, and endless scroll modes plus ranked leaderboards.'

/** Homepage title tuned for search snippets. */
export const BRAND_HOME_TITLE = `${BRAND_NAME} — Free Online Neon Minesweeper`

export const PLAY_PAGE_DESCRIPTION = 'Play Endless Scroll minesweeper in your browser. Survive the upward scroll, manage five lives, and compete on ranked leaderboards.'

export const RUSH_PAGE_DESCRIPTION = 'Play Puzzle Rush minesweeper. Clear 7×7 boards in a row, stack combo multipliers, and climb the rush leaderboard.'

export const BRAND_KEYWORDS = [
  'minesweeper',
  'mine scroll',
  'minescroll',
  'free minesweeper',
  'online minesweeper',
  'web game',
  'browser game',
  'endless mode',
  'hex minesweeper',
  'puzzle rush',
  'leaderboard',
  'neon minesweeper',
  'puzzle game',
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
