export const BRAND_NAME = 'MineScroll'

/** Canonical game genre — repeated in meta, JSON-LD, and llms.txt for machine readers. */
export const BRAND_GAME_GENRE = 'Minesweeper'

/** Short genre label — visible on landing, manifest, and social previews. */
export const BRAND_TAGLINE = 'Free Online Minesweeper Game'

/**
 * One-sentence identity statement. Used in hero copy, meta descriptions, and llms.txt so
 * crawlers and agents can classify the site without inferring from the brand name alone.
 */
export const BRAND_IDENTITY = `${BRAND_NAME} is a free online minesweeper game you play in your web browser.`

/** Supporting marketing copy — paired with {@link BRAND_IDENTITY} on the landing hero. */
export const BRAND_DETAILS = 'Clear hidden mines on neon arcade boards, compete in ranked Endless Scroll and Puzzle Rush modes, and climb verified leaderboards.'

/** npm package name and service-worker cache namespace. */
export const BRAND_SLUG = 'mine-scroll'

/** Default site description — shared by layout, manifest, JSON-LD, and landing hero. */
export const BRAND_DESCRIPTION = `${BRAND_IDENTITY} ${BRAND_DETAILS}`

/** Homepage title — lead with minesweeper for search and link previews. */
export const BRAND_HOME_TITLE = `${BRAND_NAME} — Free Online Minesweeper Game`

/** Root layout default `<title>` when a page does not override it. */
export const BRAND_DEFAULT_TITLE = `${BRAND_NAME} — ${BRAND_TAGLINE}`

/** Wikipedia entry used in structured data to anchor the game genre. */
export const MINESWEEPER_SAME_AS = 'https://en.wikipedia.org/wiki/Minesweeper_(video_game)'

export const PLAY_PAGE_TITLE = 'Endless Scroll — Online Minesweeper Mode'

export const PLAY_PAGE_DESCRIPTION =
  'Play ranked Endless Scroll minesweeper online. Survive the upward scroll with five lives, dynamic mines, and server-verified scores on the global leaderboard.'

export const RUSH_PAGE_TITLE = 'Puzzle Rush — Online Minesweeper Mode'

export const RUSH_PAGE_DESCRIPTION = 'Puzzle Rush minesweeper streak mode. Clear 7×7 boards back-to-back, stack combo multipliers, and push your rush rank on the leaderboard.'

export const BRAND_KEYWORDS = [
  'minesweeper',
  'online minesweeper',
  'free minesweeper',
  'browser minesweeper',
  'play minesweeper online',
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

/** Structured-data aliases so search engines map the brand to the classic game name. */
export const BRAND_ALTERNATE_NAMES = ['Minesweeper', 'Online Minesweeper', 'Browser Minesweeper', 'Mine Scroll', 'MineScroll Minesweeper'] as const

/** Canonical logo served from `public/assets/brand/`. */
export const BRAND_LOGO_PATH = '/assets/brand/logo.png'

/** Small mark for admin chrome and other in-app UI. */
export const BRAND_MARK_PATH = '/assets/brand/logo-mark.png'

/** Dev console prefix, e.g. `[mine-scroll]` or `[mine-scroll ranked]`. */
export function brandLogPrefix(scope?: string): string {
  return scope ? `[${BRAND_SLUG} ${scope}]` : `[${BRAND_SLUG}]`
}

export function brandServiceWorkerCacheName(version: string): string {
  return `${BRAND_SLUG}-v${version}`
}
