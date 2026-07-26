import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'oklch(var(--border) / <alpha-value>)',
        input: 'oklch(var(--input) / <alpha-value>)',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
          foreground: 'oklch(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
          foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
          foreground: 'oklch(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
          foreground: 'oklch(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          foreground: 'oklch(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
          foreground: 'oklch(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'oklch(var(--card) / <alpha-value>)',
          foreground: 'oklch(var(--card-foreground) / <alpha-value>)',
        },
        navy: {
          DEFAULT: '#232f3e',
          container: '#0e1a28',
          dim: '#bbc7db',
        },
        brand: {
          primary: '#232f3e',
          'primary-container': '#0e1a28',
          secondary: '#fe9800',
          'secondary-container': '#fe9800',
          'on-secondary-container': '#643900',
          'on-secondary-fixed-variant': '#693c00',
        },
        'surface-neutral': '#FAFBFB',
        'surface-subtle': '#F2F3F3',
        'border-standard': '#D5DBDB',
        'on-surface': '#1b1b1d',
        'on-surface-variant': '#44474c',
        'outline-tv': '#75777c',
        'status-info': '#0073BB',
        'status-success': '#067F68',
        'status-error': '#D91515',
        'status-warning': '#EB5F07',
        'code-bg': '#161B22',
      },
      spacing: {
        'stack-sm': '8px',
        'stack-md': '16px',
        'stack-lg': '32px',
        'container-padding': '24px',
        unit: '4px',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        tv: '0.5rem',
      },
      fontFamily: {
        hanken: ['var(--font-hanken)', 'system-ui', 'sans-serif'],
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        jetbrains: ['var(--font-jetbrains)', 'monospace'],
      },
      boxShadow: {
        'tv-card': '0px 4px 20px rgba(0,0,0,0.04)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
