import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5b6cff',
          dark: '#3b4ad6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
