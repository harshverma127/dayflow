/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        border: 'rgb(var(--border) / <alpha-value>)',
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          faint: 'rgb(var(--content-faint) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg) / <alpha-value>)',
        },
        accent: {
          sage: 'rgb(var(--accent-sage) / <alpha-value>)',
          lavender: 'rgb(var(--accent-lavender) / <alpha-value>)',
          peach: 'rgb(var(--accent-peach) / <alpha-value>)',
          clay: 'rgb(var(--accent-clay) / <alpha-value>)',
          sky: 'rgb(var(--accent-sky) / <alpha-value>)',
          sand: 'rgb(var(--accent-sand) / <alpha-value>)',
          rose: 'rgb(var(--accent-rose) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(60 50 40 / 0.04), 0 2px 6px rgb(60 50 40 / 0.03)',
        lift: '0 6px 20px rgb(45 40 34 / 0.08)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'pop': { '0%': { transform: 'scale(0.9)' }, '60%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.14s ease-out',
        'slide-up': 'slide-up 0.16s ease-out',
        'slide-in-right': 'slide-in-right 0.2s ease-out',
        pop: 'pop 0.22s ease-out',
      },
    },
  },
  plugins: [],
};
