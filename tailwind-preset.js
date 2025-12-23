/** 
 * Dragvertising Design System - Tailwind CSS Preset
 * 
 * This file is auto-generated from design tokens.
 * DO NOT EDIT MANUALLY - update in dragvertising-design-system repo and copy here.
 * 
 * Generated: 2025-12-23T12:57:35.567Z
 */

const preset = {
  "theme": {
    "extend": {
      "fontFamily": {
        "sans": [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ],
        "serif": [
          "ui-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Times New Roman",
          "Times",
          "serif"
        ],
        "display": [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ],
        "lordrina": [
          "Londrina Solid",
          "cursive"
        ]
      },
      "colors": {
        "pink": {
          "500": "#FD0290"
        },
        "golden": {
          "DEFAULT": "#FFA726",
          "400": "#FFB74D",
          "500": "#FFA726",
          "600": "#FF9800",
          "700": "#F57C00"
        },
        "warmOrange": {
          "DEFAULT": "#FF6B35",
          "400": "#FF8A65",
          "500": "#FF6B35",
          "600": "#F4511E"
        },
        "dv-purple": {
          "DEFAULT": "#a855f7",
          "400": "#c084fc",
          "500": "#a855f7",
          "600": "#9333ea",
          "900": "#581c87"
        },
        "dv-pink": {
          "DEFAULT": "#ec4899",
          "300": "#f9a8d4",
          "400": "#f472b6",
          "500": "#ec4899",
          "600": "#db2777"
        },
        "dv-orange": {
          "DEFAULT": "#fb923c",
          "300": "#fdba74",
          "400": "#fb923c",
          "500": "#f97316",
          "600": "#ea580c"
        },
        "border": "hsl(var(--border))",
        "input": "hsl(var(--input))",
        "ring": "hsl(var(--ring))",
        "background": "hsl(var(--background))",
        "foreground": "hsl(var(--foreground))",
        "primary": {
          "DEFAULT": "hsl(var(--primary))",
          "foreground": "hsl(var(--primary-foreground))"
        },
        "secondary": {
          "DEFAULT": "hsl(var(--secondary))",
          "foreground": "hsl(var(--secondary-foreground))"
        },
        "destructive": {
          "DEFAULT": "hsl(var(--destructive))",
          "foreground": "hsl(var(--destructive-foreground))"
        },
        "muted": {
          "DEFAULT": "hsl(var(--muted))",
          "foreground": "hsl(var(--muted-foreground))"
        },
        "accent": {
          "DEFAULT": "hsl(var(--accent))",
          "foreground": "hsl(var(--accent-foreground))"
        },
        "popover": {
          "DEFAULT": "hsl(var(--popover))",
          "foreground": "hsl(var(--popover-foreground))"
        },
        "card": {
          "DEFAULT": "hsl(var(--card))",
          "foreground": "hsl(var(--card-foreground))"
        },
        "sidebar": {
          "DEFAULT": "hsl(var(--sidebar-background))",
          "foreground": "hsl(var(--sidebar-foreground))",
          "primary": "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          "accent": "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          "border": "hsl(var(--sidebar-border))",
          "ring": "hsl(var(--sidebar-ring))"
        }
      },
      "borderRadius": {
        "lg": "var(--radius)",
        "md": "calc(var(--radius) - 2px)",
        "sm": "calc(var(--radius) - 4px)",
        "dv-none": "0",
        "dv-sm": "0.375rem",
        "dv-md": "0.5rem",
        "dv-lg": "0.75rem",
        "dv-xl": "1rem",
        "dv-2xl": "1.5rem",
        "dv-3xl": "2rem",
        "dv-full": "9999px"
      },
      "spacing": {
        "dv-px": "1px",
        "dv-0": "0",
        "dv-0.5": "0.125rem",
        "dv-1": "0.25rem",
        "dv-1.5": "0.375rem",
        "dv-2": "0.5rem",
        "dv-2.5": "0.625rem",
        "dv-3": "0.75rem",
        "dv-3.5": "0.875rem",
        "dv-4": "1rem",
        "dv-5": "1.25rem",
        "dv-6": "1.5rem",
        "dv-7": "1.75rem",
        "dv-8": "2rem",
        "dv-9": "2.25rem",
        "dv-10": "2.5rem",
        "dv-11": "2.75rem",
        "dv-12": "3rem",
        "dv-14": "3.5rem",
        "dv-16": "4rem",
        "dv-20": "5rem",
        "dv-24": "6rem",
        "dv-28": "7rem",
        "dv-32": "8rem",
        "dv-36": "9rem",
        "dv-40": "10rem"
      },
      "fontSize": {
        "dv-xs": "0.75rem",
        "dv-sm": "0.875rem",
        "dv-base": "1rem",
        "dv-lg": "1.125rem",
        "dv-xl": "1.25rem",
        "dv-2xl": "1.5rem",
        "dv-3xl": "1.875rem",
        "dv-4xl": "2.25rem",
        "dv-5xl": "3rem",
        "dv-6xl": "3.75rem",
        "dv-7xl": "4.5rem"
      },
      "fontWeight": {
        "dv-regular": "400",
        "dv-semibold": "600",
        "dv-bold": "700"
      },
      "keyframes": {
        "accordion-down": {
          "from": { "height": "0" },
          "to": { "height": "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          "from": { "height": "var(--radix-accordion-content-height)" },
          "to": { "height": "0" }
        },
        "fade-in": {
          "0%": { "opacity": "0", "transform": "translateY(10px)" },
          "100%": { "opacity": "1", "transform": "translateY(0)" }
        },
        "slide-up": {
          "0%": { "opacity": "0", "transform": "translateY(20px)" },
          "100%": { "opacity": "1", "transform": "translateY(0)" }
        },
        "glow-pulse": {
          "0%, 100%": { "boxShadow": "0 0 20px hsl(var(--primary) / 0.3)" },
          "50%": { "boxShadow": "0 0 40px hsl(var(--primary) / 0.6)" }
        },
        "gradient": {
          "0%, 100%": { "backgroundPosition": "0% 50%" },
          "50%": { "backgroundPosition": "100% 50%" }
        },
        "shimmer": {
          "0%": { "backgroundPosition": "-200% center" },
          "100%": { "backgroundPosition": "200% center" }
        },
        "float": {
          "0%, 100%": { "transform": "translateY(0)" },
          "50%": { "transform": "translateY(-10px)" }
        }
      },
      "animation": {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.6s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "gradient": "gradient 8s ease infinite",
        "shimmer": "shimmer 3s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "dv-fast": "all 150ms ease-in-out",
        "dv-base": "all 200ms ease-in-out",
        "dv-slow": "all 300ms ease-in-out",
        "dv-slower": "all 500ms ease-in-out"
      },
      "transitionDuration": {
        "dv-fast": "150ms",
        "dv-base": "200ms",
        "dv-slow": "300ms",
        "dv-slower": "500ms"
      },
      "transitionTimingFunction": {
        "dv-linear": "linear",
        "dv-ease": "ease",
        "dv-ease-in": "ease-in",
        "dv-ease-out": "ease-out",
        "dv-ease-in-out": "ease-in-out"
      },
      "boxShadow": {
        "dv-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "dv-base": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "dv-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "dv-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        "dv-xl": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        "dv-2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
        "dv-glow-primary-light": "0 0 40px hsl(280 85% 50% / 0.3)",
        "dv-glow-primary-dark": "0 0 50px hsl(280 85% 60% / 0.5)",
        "dv-glow-golden-light": "0 0 30px hsl(38 100% 57% / 0.3)",
        "dv-glow-golden-dark": "0 0 40px hsl(38 100% 65% / 0.5)"
      },
      "backgroundImage": {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-secondary": "var(--gradient-secondary)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-dragvertising": "linear-gradient(135deg, hsl(38, 100%, 57%), #FD0290, hsl(280, 85%, 50%))",
        "gradient-golden": "linear-gradient(135deg, hsl(38, 100%, 57%), hsl(16, 100%, 60%))",
        "grid-pattern": "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)"
      },
      "backgroundSize": {
        "300%": "300% 300%"
      }
    }
  }
};

// Support both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = preset;
}
if (typeof exports !== 'undefined') {
  exports.default = preset;
}
export default preset;

