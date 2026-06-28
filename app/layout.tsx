import './globals.css'
import '@game-client/styles/main.css'

import type { Metadata, Viewport } from 'next'

import { VideoGameJsonLd } from '@/app/components/video-game-json-ld'
import { BRAND_DESCRIPTION, BRAND_KEYWORDS, BRAND_LOGO_PATH, BRAND_MARK_PATH, BRAND_NAME } from '@/lib/brand'
import { getRequestMetadataBase } from '@/lib/request-origin'
import { buildOpenGraph, buildTwitterCard, PUBLIC_INDEX_ROBOTS } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase()

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
    robots: PUBLIC_INDEX_ROBOTS,
    alternates: {
      canonical: '/play',
    },
    icons: {
      icon: [{ url: BRAND_MARK_PATH, type: 'image/png' }],
      apple: [{ url: BRAND_LOGO_PATH, type: 'image/png' }],
    },
    manifest: '/manifest.webmanifest',
    openGraph: buildOpenGraph(metadataBase, BRAND_NAME, BRAND_DESCRIPTION, '/play'),
    twitter: buildTwitterCard(BRAND_NAME, BRAND_DESCRIPTION),
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
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,600;9..40,700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <VideoGameJsonLd />
        {children}
      </body>
    </html>
  )
}
