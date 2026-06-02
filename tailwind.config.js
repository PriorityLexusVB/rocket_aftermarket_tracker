export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        'card-foreground': 'rgb(var(--card-foreground) / <alpha-value>)',
        popover: 'rgb(var(--popover) / <alpha-value>)',
        'popover-foreground': 'rgb(var(--popover-foreground) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--primary-foreground) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        'secondary-foreground': 'rgb(var(--secondary-foreground) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--accent-foreground) / <alpha-value>)',
        destructive: 'rgb(var(--destructive) / <alpha-value>)',
        'destructive-foreground': 'rgb(var(--destructive-foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        // Wave J — Lexus brand tokens (see theme-neutral.css for source).
        // NOT a replacement for the ops palette above — these power the
        // masthead identity surface and Hero strips only.
        'lex-brand': '#0E1418',
        'lex-card-elevated': '#162033',
        'lex-ink-inv': '#F8FAFC',
        'lex-ink-inv-muted': '#94A3B8',
        'lex-platinum': '#D6DAE0',
        'lex-urgent': '#CE0A26',
        'lex-success': '#15803D',
      },
      fontFamily: {
        // Wave J — Inter Tight for display-grade headlines (Lexus DESIGN.md).
        // Use via `font-display` Tailwind utility on Hero strip titles +
        // masthead wordmarks. System Inter remains the body default.
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Wave J — Lexus Hero card layered shadow per DESIGN.md spec.
        // 3 layers: depth shadow, inner top-light specular, ring rim.
        'lex-hero':
          '0 4px 32px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
}
