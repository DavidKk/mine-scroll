import './globals.css'
import '@game-client/styles/main.css'

import type { Metadata, Viewport } from 'next'

import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_OG_IMAGE_PATH, getMetadataBase } from '@/lib/brand'

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  openGraph: {
    type: 'website',
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    images: [
      {
        url: BRAND_OG_IMAGE_PATH,
        width: 512,
        height: 512,
        alt: BRAND_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    images: [BRAND_OG_IMAGE_PATH],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,600;9..40,700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
