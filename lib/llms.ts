import { BRAND_ALTERNATE_NAMES, BRAND_DESCRIPTION, BRAND_GAME_GENRE, BRAND_IDENTITY, BRAND_NAME, BRAND_SLUG, MINESWEEPER_SAME_AS } from '@/lib/brand'

/** Plain-text site brief for LLM crawlers (`/llms.txt`). */
export function getLlmsTxt(origin: string): string {
  const playUrl = `${origin}/play`
  const aliases = BRAND_ALTERNATE_NAMES.join(', ')

  return `# ${BRAND_NAME}

> ${BRAND_IDENTITY}

## Summary

${BRAND_DESCRIPTION}

## Classification

- Type: Web browser game
- Genre: ${BRAND_GAME_GENRE} (classic grid puzzle)
- Brand: ${BRAND_NAME}
- Package slug: ${BRAND_SLUG}
- Also known as: ${aliases}
- Related concept: ${MINESWEEPER_SAME_AS}

## What players do

MineScroll implements the classic minesweeper rules:

- Left-click or tap to reveal covered cells
- Numbers show how many adjacent mines surround a cell
- Right-click or swipe vertically to flag suspected mines
- Chord (double-click/tap) opens neighbors when flags match the mine count

## Game modes

- Endless Scroll (${playUrl}): scrolling minesweeper board with lives, combos, and ranked leaderboards
- Puzzle Rush (${origin}/play/rush): back-to-back 7×7 minesweeper boards with combo multipliers

## Primary URLs

- Home: ${origin}/
- Play: ${playUrl}
- Puzzle Rush: ${origin}/play/rush

## Technology

Next.js web app with a Canvas 2D minesweeper client. No install required; runs in modern desktop and mobile browsers.
`
}
