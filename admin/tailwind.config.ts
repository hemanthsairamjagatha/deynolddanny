import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      colors: {
        ink: {
          50: '#f8f7f5',
          100: '#efede8',
          200: '#ddd9d0',
          300: '#c5bfb2',
          400: '#a99f8e',
          500: '#8f8370',
          600: '#7a6e5e',
          700: '#645a4e',
          800: '#534b43',
          900: '#463f38',
          950: '#252018',
        },
        gold: {
          50: '#fdfaf0',
          100: '#faf3d1',
          200: '#f5e49e',
          300: '#eece64',
          400: '#e5b534',
          500: '#d49a1b',
          600: '#b87a12',
          700: '#8f5811',
          800: '#764614',
          900: '#643b17',
          950: '#3a1e08',
        },
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
