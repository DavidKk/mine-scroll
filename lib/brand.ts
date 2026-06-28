export const BRAND_NAME = 'Minesweeper'

export const BRAND_DESCRIPTION = 'Neon minesweeper with ranked runs and asset tooling.'

/** Canonical logo served from `public/assets/brand/`. */
export const BRAND_LOGO_PATH = '/assets/brand/logo.png'

/** Small mark for admin chrome and other in-app UI. */
export const BRAND_MARK_PATH = '/assets/brand/logo-mark.png'

export const BRAND_OG_IMAGE_PATH = '/assets/brand/og.png'

export function getMetadataBase(): URL {
  const fromEnv =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

  if (fromEnv) {
    return new URL(fromEnv)
  }

  const port = process.env.PORT ?? '3000'
  return new URL(`http://localhost:${port}`)
}
