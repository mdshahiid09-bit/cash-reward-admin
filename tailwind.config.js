/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        admin: {
          50: '#F0FDF4',
          500: '#10B981',
          600: '#059669',
          900: '#064E3B',
          950: '#022C22',
        }
      }
    },
  },
  plugins: [],
}
