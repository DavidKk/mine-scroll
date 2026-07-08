import { BRAND_IDENTITY, BRAND_NAME } from '@/lib/brand'

/** Shared landing copy for UI and FAQ structured data. */

export const LANDING_WHAT_IS = {
  key: 'About',
  question: `What is ${BRAND_NAME}?`,
  answer: `${BRAND_IDENTITY} It follows classic minesweeper rules—reveal safe cells, flag mines, and chord numbered cells—with neon visuals and ranked arcade modes.`,
} as const

export const LANDING_HOW_TO = [
  LANDING_WHAT_IS,
  {
    key: 'Reveal',
    question: 'How do I reveal cells in this minesweeper game?',
    answer: 'Left-click or tap a covered cell to open it. Numbers show how many adjacent mines surround that cell.',
  },
  {
    key: 'Flag',
    question: 'How do I flag mines?',
    answer: 'Right-click on desktop or swipe vertically on touch screens to mark suspected mines.',
  },
  {
    key: 'Chord',
    question: 'What is chord in minesweeper?',
    answer: 'Double-click or double-tap a revealed number when your flags match the mine count to open all remaining neighbors.',
  },
] as const
