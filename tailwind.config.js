/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        navy: {
          950: '#06060f',
          900: '#0d0d1f',
          800: '#13132b',
          700: '#1e1e3a',
          600: '#28285a',
        },
      },
    },
  },
  plugins: [],
};
