/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0faf5',
          100: '#d4ede3',
          200: '#a8d5bc',
          300: '#6db892',
          400: '#3d6b55',
          500: '#2d5040',
          600: '#1e3a2f',
          700: '#162b22',
          800: '#0f1e17',
          900: '#0a1410',
        },
        gold: {
          DEFAULT: '#b8935a',
          light:   '#c9a96e',
          dark:    '#8a6535',
        },
        surface: {
          DEFAULT: '#f5f2ec',
          2: '#edeae2',
          3: '#e4e0d6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'spin-slow': 'spin 0.7s linear infinite',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
