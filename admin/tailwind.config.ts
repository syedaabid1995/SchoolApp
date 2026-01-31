import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './types/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#111318',
        slate: '#1f2937',
        steel: '#9aa4b2',
        sand: '#f6f5f2',
        accent: '#0ea5e9'
      }
    }
  },
  plugins: []
};

export default config;
