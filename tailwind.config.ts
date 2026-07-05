import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './game-client/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts}'],
  theme: {
    extend: {
      screens: {
        'landing-lg': '960px',
      },
      colors: {
        admin: {
          bg: '#030408',
          cyan: '#2decff',
          text: '#eef0f5',
          muted: '#8b92a3',
          panel: 'rgba(10, 14, 24, 0.96)',
          danger: '#ff4c56',
          gold: '#fde047',
        },
        game: {
          bg: '#030408',
        },
        landing: {
          cyan: '#2decff',
          indigo: '#818cf8',
          bg: '#030408',
          panel: 'rgba(22, 22, 31, 0.92)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'landing-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(4px)' },
        },
        'landing-lb-pulse': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
        'landing-scroll-shimmer': {
          '0%': { transform: 'translateY(-120%)' },
          '100%': { transform: 'translateY(120%)' },
        },
        'landing-sound-glow': {
          '0%, 100%': {
            boxShadow: '0 0 0 1px rgba(45, 236, 255, 0.14) inset, 0 0 22px rgba(45, 236, 255, 0.22), 0 14px 36px rgba(0, 0, 0, 0.48)',
          },
          '50%': {
            boxShadow: '0 0 0 1px rgba(45, 236, 255, 0.2) inset, 0 0 34px rgba(45, 236, 255, 0.38), 0 14px 36px rgba(0, 0, 0, 0.48)',
          },
        },
        'admin-skeleton-shimmer': {
          '0%': { backgroundPosition: '120% 0' },
          '100%': { backgroundPosition: '-120% 0' },
        },
      },
      animation: {
        'landing-bounce': 'landing-bounce 2s ease-in-out infinite',
        'landing-lb-pulse': 'landing-lb-pulse 1s ease-in-out infinite',
        'landing-scroll-shimmer': 'landing-scroll-shimmer 1.15s ease-in-out infinite',
        'landing-sound-glow': 'landing-sound-glow 2.8s ease-in-out infinite',
        'admin-skeleton-shimmer': 'admin-skeleton-shimmer 1.35s ease-in-out infinite',
      },
      backgroundImage: {
        'landing-scroll-host': 'linear-gradient(180deg, #06070d 0%, #030408 40%, #020205 100%)',
        'landing-scroll-track': 'linear-gradient(180deg, transparent 0%, rgba(45,236,255,0.08) 42%, rgba(129,140,248,0.16) 50%, rgba(45,236,255,0.08) 58%, transparent 100%)',
        'landing-scroll-thumb': 'linear-gradient(180deg, rgba(45,236,255,0.95) 0%, rgba(129,140,248,0.85) 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config
