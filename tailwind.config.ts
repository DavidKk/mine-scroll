import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './game-client/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#07080f',
          cyan: '#2decff',
          text: '#eef0f5',
          muted: '#8b92a3',
          panel: 'rgba(10, 14, 24, 0.96)',
          danger: '#ff4c56',
        },
        game: {
          bg: '#030408',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
