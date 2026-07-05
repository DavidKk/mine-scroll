/** Shared landing copy for UI and FAQ structured data. */

export const LANDING_HOW_TO = [
  {
    key: 'Reveal',
    question: 'How do I reveal cells in MineScroll?',
    answer: 'Left-click or tap a covered cell to open it. Numbers show how many adjacent mines surround that cell.',
  },
  {
    key: 'Flag',
    question: 'How do I flag mines in MineScroll?',
    answer: 'Right-click on desktop or swipe vertically on touch screens to mark suspected mines.',
  },
  {
    key: 'Chord',
    question: 'What is chord in MineScroll?',
    answer: 'Double-click or double-tap a revealed number when your flags match the mine count to open all remaining neighbors.',
  },
] as const
