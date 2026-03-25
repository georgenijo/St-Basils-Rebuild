import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFDF8',
          100: '#FFF9EF',
        },
        burgundy: {
          100: '#F5E6EB',
          700: '#9B1B3D',
          800: '#7A1530',
        },
        gold: {
          500: '#D4A017',
        },
        wood: {
          800: '#4A3729',
          900: '#352618',
        },
        charcoal: '#253341',
        sand: '#FAEDCD',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        arch: '50% 50% 0 0',
      },
      spacing: {
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
    },
  },
  plugins: [],
}

export default config
