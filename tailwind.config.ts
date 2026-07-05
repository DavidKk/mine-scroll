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
          bg: '#07080f',
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
        'landing-aurora': {
          '0%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '100%': { transform: 'translate3d(-2%, 3%, 0) scale(1.06)' },
        },
        'landing-twinkle': {
          '0%': { opacity: '0.45' },
          '100%': { opacity: '0.85' },
        },
        'landing-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(4px)' },
        },
        'landing-scan': {
          '0%': { transform: 'translateY(-35%)' },
          '100%': { transform: 'translateY(35%)' },
        },
        'landing-orb-a': {
          '0%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '100%': { transform: 'translate3d(6%, 8%, 0) scale(1.12)' },
        },
        'landing-orb-b': {
          '0%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '100%': { transform: 'translate3d(-8%, -6%, 0) scale(1.08)' },
        },
        'landing-orb-c': {
          '0%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '100%': { transform: 'translate3d(4%, -10%, 0) scale(1.15)' },
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
        'admin-aurora-drift': {
          '0%': { transform: 'translate3d(-2%, -1%, 0) scale(1)' },
          '100%': { transform: 'translate3d(2%, 1%, 0) scale(1.04)' },
        },
        'admin-star-twinkle': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.75' },
        },
      },
      animation: {
        'landing-aurora': 'landing-aurora 18s ease-in-out infinite alternate',
        'landing-twinkle': 'landing-twinkle 5s ease-in-out infinite alternate',
        'landing-twinkle-fast': 'landing-twinkle 3.2s ease-in-out infinite alternate-reverse',
        'landing-bounce': 'landing-bounce 2s ease-in-out infinite',
        'landing-scan': 'landing-scan 11s linear infinite',
        'landing-orb-a': 'landing-orb-a 24s ease-in-out infinite alternate',
        'landing-orb-b': 'landing-orb-b 28s ease-in-out infinite alternate-reverse',
        'landing-orb-c': 'landing-orb-c 20s ease-in-out infinite alternate',
        'landing-lb-pulse': 'landing-lb-pulse 1s ease-in-out infinite',
        'landing-scroll-shimmer': 'landing-scroll-shimmer 1.15s ease-in-out infinite',
        'landing-sound-glow': 'landing-sound-glow 2.8s ease-in-out infinite',
        'admin-skeleton-shimmer': 'admin-skeleton-shimmer 1.35s ease-in-out infinite',
        'admin-aurora-drift': 'admin-aurora-drift 16s ease-in-out infinite alternate',
        'admin-star-twinkle': 'admin-star-twinkle 8s ease-in-out infinite',
      },
      backgroundImage: {
        'landing-aurora':
          'radial-gradient(circle at 18% 22%, rgba(45, 236, 255, 0.14), transparent 42%), radial-gradient(circle at 78% 68%, rgba(59, 130, 246, 0.12), transparent 38%), radial-gradient(circle at 52% 88%, rgba(129, 140, 248, 0.08), transparent 34%)',
        'landing-stars-far':
          'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 30% 65%, rgba(255,255,255,0.35), transparent), radial-gradient(1px 1px at 55% 15%, rgba(255,255,255,0.45), transparent), radial-gradient(1px 1px at 72% 42%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 88% 78%, rgba(255,255,255,0.4), transparent)',
        'landing-stars-near':
          'radial-gradient(1.5px 1.5px at 15% 35%, rgba(199,210,254,0.75), transparent), radial-gradient(2px 2px at 82% 28%, rgba(129,140,248,0.65), transparent)',
        'landing-grid': 'linear-gradient(rgba(45,236,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(45,236,255,0.35) 1px, transparent 1px)',
        'landing-scroll-host': 'linear-gradient(180deg, #06070d 0%, #030408 40%, #020205 100%)',
        'landing-scroll-track': 'linear-gradient(180deg, transparent 0%, rgba(45,236,255,0.08) 42%, rgba(129,140,248,0.16) 50%, rgba(45,236,255,0.08) 58%, transparent 100%)',
        'landing-scroll-thumb': 'linear-gradient(180deg, rgba(45,236,255,0.95) 0%, rgba(129,140,248,0.85) 100%)',
        'admin-aurora':
          'radial-gradient(circle at 18% 22%, rgba(45,236,255,0.08), transparent 40%), radial-gradient(circle at 78% 68%, rgba(59,130,246,0.06), transparent 36%), radial-gradient(circle at 52% 88%, rgba(56,189,248,0.04), transparent 32%)',
        'admin-stars-far':
          'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.45), transparent), radial-gradient(1px 1px at 30% 65%, rgba(255,255,255,0.28), transparent), radial-gradient(1px 1px at 55% 15%, rgba(255,255,255,0.35), transparent), radial-gradient(1px 1px at 72% 42%, rgba(255,255,255,0.22), transparent), radial-gradient(1px 1px at 88% 78%, rgba(255,255,255,0.3), transparent)',
        'admin-stars-near': 'radial-gradient(1.5px 1.5px at 15% 35%, rgba(45,236,255,0.5), transparent), radial-gradient(1px 1px at 48% 72%, rgba(255,255,255,0.35), transparent)',
        'admin-grid': 'linear-gradient(rgba(45,236,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(45,236,255,0.025) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config
