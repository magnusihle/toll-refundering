/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))', input: 'hsl(var(--input))', ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
        'surface-sunken': 'hsl(var(--surface-sunken))',
        'secondary-strong': 'hsl(var(--secondary-strong))',
        'border-strong': 'hsl(var(--border-strong))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))', foreground: 'hsl(var(--sidebar-foreground))',
          accent: 'hsl(var(--sidebar-accent))', 'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))', ring: 'hsl(var(--sidebar-ring))',
        },
      },
      // Samme stack som landingssiden, slik at typografien flytter seg inn i
      // appen uten font-loading-risiko (DESIGN.md).
      fontFamily: {
        sans: ['"Helvetica Neue"', '"Neue Haas Grotesk"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      transitionTimingFunction: { 'out-strong': 'cubic-bezier(0.16, 1, 0.3, 1)' },
      // ÉN elevasjon, og den er DESIGN.md sitt tak. Alt som svever (meny,
      // popover, tooltip, ark, toast) bruker denne; ingenting annet får skygge —
      // dybde ellers er flatekontrast og 1px kant.
      boxShadow: {
        overlay: '0 16px 44px rgba(23, 35, 29, 0.14)',
        none: 'none',
      },
      // ÉN radiustrapp. Før dette levde elleve ulike verdier side om side
      // (rounded-md/-xl/-sm/-[9px]/-[8px]/-[4px]/-[14px]/-2xl …).
      borderRadius: {
        xxs: '2px',                             // fargeprikker og små swatcher
        xs: '4px',                              // markører, badges, små brikker
        sm: 'calc(var(--radius) - 5px)',        // 6px  — brikker i tabell
        md: 'calc(var(--radius) - 3px)',        // 8px  — små knapper, felt
        lg: 'var(--radius)',                    // 11px — knapper, input
        xl: 'calc(var(--radius) + 3px)',        // 14px — menyer, popovers
        '2xl': 'calc(var(--radius) + 7px)',     // 18px — ark, dialoger
      },
      // ÉN typeskala, delt av både text-* og t-*-klassene. Steg ~1.15–1.2, fast
      // rem (ikke flytende) — produkt-UI leses på konsistent DPI, og en h1 som
      // krymper i en smal spalte ser verre ut, ikke bedre.
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1.35' }], // 11 — eyebrow, kolonnetittel
        xs: ['0.75rem', { lineHeight: '1.45' }],      // 12 — tellere, hjelpetekst
        sm: ['0.875rem', { lineHeight: '1.5' }],      // 14 — UI, knapper, sekundær
        base: ['0.9375rem', { lineHeight: '1.55' }],  // 15 — brødtekst, tabell
        lg: ['1.0625rem', { lineHeight: '1.5' }],     // 17 — ingress
        xl: ['1.25rem', { lineHeight: '1.25' }],      // 20 — seksjonstittel
        '2xl': ['1.5rem', { lineHeight: '1.15' }],    // 24
        '3xl': ['1.75rem', { lineHeight: '1.1' }],    // 28 — sidetittel mobil
        '4xl': ['2.125rem', { lineHeight: '1.05' }],  // 34 — sidetittel desktop
        '5xl': ['2.75rem', { lineHeight: '1' }],      // 44 — helte-tall mobil
        '6xl': ['3.25rem', { lineHeight: '0.98' }],   // 52 — helte-tall desktop
      },
      keyframes: {
        'fade-in-up': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: { 'accordion-down': 'accordion-down 0.2s ease-out', 'accordion-up': 'accordion-up 0.2s ease-out', 'fade-in-up': 'fade-in-up 0.25s ease-out both' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
