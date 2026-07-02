/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#06060f',
          900: '#0c0c1d',
          800: '#13132a',
          700: '#1c1c38',
          600: '#252550',
        },
      },
    },
  },
  plugins: [],
};
