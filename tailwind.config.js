/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f7a3a',
          dark: '#0a5e2c',
          light: '#1a9c4d',
        },
      },
    },
  },
  plugins: [],
};
