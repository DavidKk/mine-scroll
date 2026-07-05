import './globals.css'
import '@game-client/styles/main.css'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'

import { SiteJsonLd } from '@/app/components/site-json-ld'
import { VideoGameJsonLd } from '@/app/components/video-game-json-ld'
import { BRAND_DESCRIPTION, BRAND_KEYWORDS, BRAND_LOGO_PATH, BRAND_MARK_PATH, BRAND_NAME, BRAND_OG_IMAGE_PATH } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { buildOpenGraph, buildTwitterCard, PUBLIC_INDEX_ROBOTS } from '@/lib/seo'
import { preferWebpAssetPath } from '@/lib/server-raster-url'

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase()
  const brandMark = preferWebpAssetPath(BRAND_MARK_PATH)
  const brandLogo = preferWebpAssetPath(BRAND_LOGO_PATH)
  const brandOg = preferWebpAssetPath(BRAND_OG_IMAGE_PATH)

  return {
    metadataBase,
    title: {
      default: BRAND_NAME,
      template: `%s · ${BRAND_NAME}`,
    },
    description: BRAND_DESCRIPTION,
    keywords: BRAND_KEYWORDS,
    applicationName: BRAND_NAME,
    authors: [{ name: BRAND_NAME }],
    creator: BRAND_NAME,
    publisher: BRAND_NAME,
    category: 'game',
    formatDetection: {
      telephone: false,
    },
    appleWebApp: {
      capable: true,
      title: BRAND_NAME,
      statusBarStyle: 'black-translucent',
    },
    robots: PUBLIC_INDEX_ROBOTS,
    alternates: {
      canonical: '/',
    },
    icons: {
      icon: [{ url: brandMark, type: brandMark.endsWith('.webp') ? 'image/webp' : 'image/png' }],
      apple: [{ url: brandLogo, type: brandLogo.endsWith('.webp') ? 'image/webp' : 'image/png' }],
    },
    manifest: '/manifest.webmanifest',
    openGraph: buildOpenGraph(metadataBase, BRAND_NAME, BRAND_DESCRIPTION, '/', brandOg),
    twitter: buildTwitterCard(BRAND_NAME, BRAND_DESCRIPTION, brandOg),
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#2decff' },
    { media: '(prefers-color-scheme: light)', color: '#2decff' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Analytics />
      <SpeedInsights />
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,600;9..40,700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SiteJsonLd />
        <VideoGameJsonLd />
        {children}
      </body>
    </html>
  )
}
