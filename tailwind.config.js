/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Font family is set dynamically via CSS based on route (public vs authenticated)
        // Body copy: serif - ui-serif renders as system serif on Apple devices
        // Headlines: San Francisco (SF Pro) - system-ui renders as SF Pro on Apple devices
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'], // San Francisco for headlines and UI elements
        serif: ['ui-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Times New Roman"', 'Times', 'serif'], // Serif for body copy
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'], // San Francisco for display text
        lordrina: ['"Londrina Solid"', 'cursive'], // Londrina Solid for special headings
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Custom brand pink color
        pink: {
          500: "#FD0290", // Brand primary pink
        },
        // Dragvertising-inspired colors
        golden: {
          DEFAULT: "#FFA726", // Golden yellow accent
          400: "#FFB74D",
          500: "#FFA726",
          600: "#FF9800",
          700: "#F57C00",
        },
        warmOrange: {
          DEFAULT: "#FF6B35", // Warm orange for gradients
          400: "#FF8A65",
          500: "#FF6B35",
          600: "#F4511E",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // === Dragvertising Design System (DV) - Extracted from /design page ===
        // Brand Colors (from actual page usage)
        'dv-purple': {
          DEFAULT: '#a855f7',   // purple-500
          400: '#c084fc',        // purple-400
          500: '#a855f7',        // purple-500
          600: '#9333ea',        // purple-600
          900: '#581c87',        // purple-900
        },
        'dv-pink': {
          DEFAULT: '#ec4899',   // pink-500
          300: '#f9a8d4',        // pink-300
          400: '#f472b6',        // pink-400
          500: '#ec4899',        // pink-500
          600: '#db2777',        // pink-600
        },
        'dv-orange': {
          DEFAULT: '#fb923c',   // orange-400
          300: '#fdba74',        // orange-300
          400: '#fb923c',        // orange-400
          500: '#f97316',        // orange-500
          600: '#ea580c',        // orange-600
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // === Dragvertising Design System (DV) - Synced from Figma ===
        'dv-none': '0',
        'dv-sm': '0.375rem',    // 6px
        'dv-md': '0.5rem',      // 8px
        'dv-lg': '0.75rem',     // 12px
        'dv-xl': '1rem',        // 16px
        'dv-2xl': '1.5rem',     // 24px
        'dv-3xl': '2rem',       // 32px
        'dv-full': '9999px',
      },
      spacing: {
        // === Dragvertising Design System (DV) - Synced from Figma ===
        'dv-px': '1px',
        'dv-0': '0',
        'dv-0.5': '0.125rem',   // 2px
        'dv-1': '0.25rem',      // 4px
        'dv-1.5': '0.375rem',   // 6px
        'dv-2': '0.5rem',       // 8px
        'dv-2.5': '0.625rem',   // 10px
        'dv-3': '0.75rem',      // 12px
        'dv-3.5': '0.875rem',   // 14px
        'dv-4': '1rem',         // 16px
        'dv-5': '1.25rem',      // 20px
        'dv-6': '1.5rem',       // 24px
        'dv-7': '1.75rem',      // 28px
        'dv-8': '2rem',         // 32px
        'dv-9': '2.25rem',      // 36px
        'dv-10': '2.5rem',      // 40px
        'dv-11': '2.75rem',     // 44px
        'dv-12': '3rem',        // 48px
        'dv-14': '3.5rem',      // 56px
        'dv-16': '4rem',        // 64px
        'dv-20': '5rem',        // 80px
        'dv-24': '6rem',        // 96px
        'dv-28': '7rem',        // 112px
        'dv-32': '8rem',        // 128px
        'dv-36': '9rem',        // 144px
        'dv-40': '10rem',       // 160px
      },
      fontSize: {
        // === Dragvertising Design System (DV) - Synced from Figma ===
        'dv-xs': '0.75rem',     // 12px
        'dv-sm': '0.875rem',    // 14px
        'dv-base': '1rem',      // 16px
        'dv-lg': '1.125rem',    // 18px
        'dv-xl': '1.25rem',     // 20px
        'dv-2xl': '1.5rem',     // 24px
        'dv-3xl': '1.875rem',   // 30px
        'dv-4xl': '2.25rem',    // 36px
        'dv-5xl': '3rem',       // 48px
        'dv-6xl': '3.75rem',    // 60px
        'dv-7xl': '4.5rem',     // 72px
      },
      fontWeight: {
        // === Dragvertising Design System (DV) - Synced from Figma ===
        'dv-regular': '400',
        'dv-semibold': '600',
        'dv-bold': '700',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.3)" },
          "50%": { boxShadow: "0 0 40px hsl(var(--primary) / 0.6)" }
        },
        "gradient": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" }
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" }
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.6s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "gradient": "gradient 8s ease infinite",
        "shimmer": "shimmer 3s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
      },
      backgroundSize: {
        "300%": "300% 300%",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-secondary": "var(--gradient-secondary)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-dragvertising": "var(--gradient-dragvertising)",
        "gradient-golden": "var(--gradient-golden)",
        "grid-pattern": "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
