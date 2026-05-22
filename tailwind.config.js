/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Talent Shield palette — keep in sync with web_frontend Login.js
        ts: {
          ink: '#2f3e46',
          slate: '#354f52',
          moss: '#52796f',
          sage: '#84a98c',
          mist: '#cad2c5',
          cream: '#f7f8f6',
          border: '#d4ddd6',
          danger: '#c0756a',
        },
        // Back-compat aliases used by older mobile screens
        brand: {
          DEFAULT: '#52796f',
          dark: '#354f52',
          light: '#84a98c',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'serif'],
      },
    },
  },
  plugins: [],
};
