import type { Metadata } from 'next'

import { BRAND_ALTERNATE_NAMES, BRAND_DESCRIPTION, BRAND_GAME_GENRE, BRAND_IDENTITY, BRAND_KEYWORDS, BRAND_LOGO_PATH, BRAND_NAME, MINESWEEPER_SAME_AS } from '@/lib/brand'
import { LANDING_HOW_TO } from '@/lib/landing-content'

function minesweeperAboutEntity() {
  return {
    '@type': 'Thing',
    name: BRAND_GAME_GENRE,
    description: 'Classic single-player puzzle game where players clear a grid without detonating hidden mines.',
    sameAs: MINESWEEPER_SAME_AS,
  }
}

function siteEntityId(metadataBase: URL, fragment: string): string {
  return new URL(`#${fragment}`, metadataBase).toString()
}

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

const OG_LOCALE = 'en_US'
const OG_IMAGE_WIDTH = 512
const OG_IMAGE_HEIGHT = 512

export function buildOpenGraph(metadataBase: URL, title: string, description: string, path = '/', imagePath: string = BRAND_LOGO_PATH): NonNullable<Metadata['openGraph']> {
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
        url: imagePath,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: `${title} — ${BRAND_NAME}`,
      },
    ],
  }
}

export function buildTwitterCard(title: string, description: string, imagePath: string = BRAND_LOGO_PATH): NonNullable<Metadata['twitter']> {
  return {
    card: 'summary_large_image',
    title,
    description,
    images: [imagePath],
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

export function getWebSiteJsonLd(metadataBase: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': siteEntityId(metadataBase, 'website'),
    name: BRAND_NAME,
    alternateName: [...BRAND_ALTERNATE_NAMES],
    description: BRAND_DESCRIPTION,
    abstract: BRAND_IDENTITY,
    keywords: BRAND_KEYWORDS.join(', '),
    about: minesweeperAboutEntity(),
    url: metadataBase.toString(),
    inLanguage: 'en',
  }
}

export function getOrganizationJsonLd(metadataBase: URL, logoPath: string = BRAND_LOGO_PATH) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': siteEntityId(metadataBase, 'organization'),
    name: BRAND_NAME,
    alternateName: [...BRAND_ALTERNATE_NAMES],
    description: BRAND_IDENTITY,
    url: metadataBase.toString(),
    logo: new URL(logoPath, metadataBase).toString(),
    knowsAbout: [BRAND_GAME_GENRE, 'Online games', 'Browser games'],
  }
}

export function getFaqPageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: LANDING_HOW_TO.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

type BreadcrumbItem = {
  name: string
  path: string
}

export function getBreadcrumbJsonLd(metadataBase: URL, items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path, metadataBase).toString(),
    })),
  }
}

export function getVideoGameJsonLd(metadataBase: URL, path = '/play') {
  const url = new URL(path, metadataBase).toString()

  return {
    '@context': 'https://schema.org',
    '@type': ['VideoGame', 'WebApplication'],
    '@id': siteEntityId(metadataBase, 'game'),
    name: BRAND_NAME,
    alternateName: [...BRAND_ALTERNATE_NAMES],
    description: BRAND_DESCRIPTION,
    abstract: BRAND_IDENTITY,
    keywords: BRAND_KEYWORDS.join(', '),
    about: minesweeperAboutEntity(),
    url,
    inLanguage: 'en',
    gamePlatform: 'Web browser',
    operatingSystem: 'Any modern web browser',
    browserRequirements: 'Requires HTML5 Canvas and JavaScript',
    applicationCategory: 'GameApplication',
    genre: [BRAND_GAME_GENRE, 'Puzzle', 'Strategy', 'Arcade'],
    playMode: 'SinglePlayer',
    isAccessibleForFree: true,
    isPartOf: {
      '@id': siteEntityId(metadataBase, 'website'),
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  }
}
