/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background surfaces
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        // Text
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-mono': 'var(--text-mono)',
        // Brand accent
        accent: 'var(--accent)',
        // Functional
        win: 'var(--win)',
        loss: 'var(--loss)',
        // Chart lines
        'ema-fast': 'var(--ema-fast)',
        'ema-slow': 'var(--ema-slow)',
        'rsi-line': 'var(--rsi-line)',
        // shadcn compat
        background: 'var(--bg-base)',
        foreground: 'var(--text-primary)',
        border: 'var(--border)',
        muted: {
          DEFAULT: 'var(--bg-elevated)',
          foreground: 'var(--text-secondary)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
