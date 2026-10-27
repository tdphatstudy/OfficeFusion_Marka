import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        prose: ['Lora', 'Georgia', 'serif']
      },
      colors: {
        // Design tokens — override in CSS variables for theming
        surface: {
          DEFAULT: 'hsl(var(--color-surface) / <alpha-value>)',
          raised: 'hsl(var(--color-surface-raised) / <alpha-value>)',
          overlay: 'hsl(var(--color-surface-overlay) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'hsl(var(--color-accent) / <alpha-value>)',
          hover: 'hsl(var(--color-accent-hover) / <alpha-value>)'
        },
        text: {
          primary: 'hsl(var(--color-text-primary) / <alpha-value>)',
          secondary: 'hsl(var(--color-text-secondary) / <alpha-value>)',
          muted: 'hsl(var(--color-text-muted) / <alpha-value>)'
        },
        border: 'hsl(var(--color-border) / <alpha-value>)'
      },
      typography: theme => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'hsl(var(--color-text-primary))',
            a: {
              color: 'hsl(var(--color-accent))'
            }
          }
        }
      })
    }
  },
  plugins: [typography]
}
