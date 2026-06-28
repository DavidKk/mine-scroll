import type { Metadata } from 'next'

import { BRAND_DESCRIPTION, BRAND_KEYWORDS, BRAND_NAME, BRAND_OG_IMAGE_PATH } from '@/lib/brand'

export const NOINDEX_ROBOTS: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
  },
}

export const PUBLIC_INDEX_ROBOTS: NonNullable<Metadata['robots']> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
}

const OG_LOCALE = 'zh_CN'

export function buildOpenGraph(metadataBase: URL, title: string, description: string, path = '/'): NonNullable<Metadata['openGraph']> {
  const canonical = new URL(path, metadataBase).toString()

  return {
    type: 'website',
    locale: OG_LOCALE,
    siteName: BRAND_NAME,
    title,
    description,
    url: canonical,
    images: [
      {
        url: BRAND_OG_IMAGE_PATH,
        width: 512,
        height: 512,
        alt: title,
      },
    ],
  }
}

export function buildTwitterCard(title: string, description: string): NonNullable<Metadata['twitter']> {
  return {
    card: 'summary',
    title,
    description,
    images: [BRAND_OG_IMAGE_PATH],
  }
}

type PublicPageMetadataOptions = {
  title: string
  description?: string
  path: string
}

/** Metadata for indexable public routes (canonical + OG/Twitter). */
export function buildPublicPageMetadata(metadataBase: URL, { title, description = BRAND_DESCRIPTION, path }: PublicPageMetadataOptions): Metadata {
  const canonical = new URL(path, metadataBase).toString()

  return {
    title,
    description,
    keywords: BRAND_KEYWORDS,
    alternates: {
      canonical,
    },
    robots: PUBLIC_INDEX_ROBOTS,
    openGraph: buildOpenGraph(metadataBase, title, description, path),
    twitter: buildTwitterCard(title, description),
  }
}

export function getVideoGameJsonLd(metadataBase: URL, path = '/play') {
  const url = new URL(path, metadataBase).toString()

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    url,
    inLanguage: 'zh-CN',
    gamePlatform: 'Web browser',
    applicationCategory: 'Game',
    genre: ['Puzzle', 'Strategy'],
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  }
}
