/**
 * 🎨 Unified Design System Tokens 🎨
 * 
 * Single source of truth for all design tokens.
 * 
 * **Token Source**: `docs/design-system/DESIGN_TOKENS.json`
 * 
 * This file provides TypeScript types and helper functions for accessing tokens.
 * The actual token values are in the JSON file for easy editing and tooling support.
 * 
 * @example
 * ```tsx
 * import { tokens, colors, spacing } from '@/lib/designSystem/tokens';
 * 
 * const primaryColor = colors.primary.purple.light.hex;
 * const padding = spacing['4'];
 * ```
 */

// Type definitions matching DESIGN_TOKENS.json structure
export interface ColorToken {
  hex: string;
  rgb: string;
  hsl: string;
  tailwind: string;
}

export interface GradientToken {
  css: string;
  stops: Array<{ color: string; position: string }>;
  angle: string;
  usage: string;
}

export interface DesignTokens {
  colors: {
    primary: {
      purple: { light: ColorToken; dark: ColorToken };
      pink: { both: ColorToken };
      golden: { light: ColorToken; dark: ColorToken };
      warmOrange: { light: ColorToken; dark: ColorToken };
    };
    secondary: {
      muted: { light: ColorToken; dark: ColorToken };
      accent: { light: ColorToken; dark: ColorToken };
    };
    semantic: {
      success: ColorToken;
      destructive: ColorToken;
      warning: ColorToken;
      info: ColorToken;
    };
  };
  gradients: {
    dragvertising: GradientToken;
    golden: GradientToken;
    primary: GradientToken;
    hero: GradientToken;
  };
  typography: {
    fontFamily: Record<string, string>;
    fontSize: Record<string, { px: number; rem: number; tailwind: string }>;
    fontWeight: Record<string, { value: number; tailwind: string }>;
    lineHeight: Record<string, { value: number; tailwind: string }>;
  };
  spacing: Record<string, { px: number; rem: number; tailwind: string }>;
  borderRadius: Record<string, { px: number; tailwind: string; usage?: string }>;
  shadows: Record<string, { css: string; tailwind: string; usage?: string }> & {
    glow: {
      primary: { light: string; dark: string };
      golden: { light: string; dark: string };
    };
  };
  transitions: {
    duration: Record<string, { ms: number; tailwind: string }>;
    timing: Record<string, string>;
  };
  components: {
    button: {
      borderRadius: string;
      fontWeight: string;
      sizes: Record<string, any>;
      variants: Record<string, any>;
    };
    card: {
      borderRadius: string;
      shadow: string;
      borderWidth: string;
    };
  };
}

// Common token values (for quick access without async)
// These match the values in DESIGN_TOKENS.json
export const colors = {
  primary: {
    purple: {
      light: { hex: '#A855F7', rgb: 'rgb(168, 85, 247)', hsl: 'hsl(280, 85%, 50%)', tailwind: 'purple-600' },
      dark: { hex: '#B76EF7', rgb: 'rgb(183, 110, 247)', hsl: 'hsl(280, 85%, 60%)', tailwind: 'purple-500' },
    },
    pink: {
      both: { hex: '#FD0290', rgb: 'rgb(253, 2, 144)', hsl: 'hsl(326, 99%, 50%)', tailwind: 'pink-500' },
    },
    golden: {
      light: { hex: '#FFA726', rgb: 'rgb(255, 167, 38)', hsl: 'hsl(38, 100%, 57%)', tailwind: 'golden-500' },
      dark: { hex: '#FFB74D', rgb: 'rgb(255, 183, 77)', hsl: 'hsl(38, 100%, 65%)', tailwind: 'golden-400' },
    },
    warmOrange: {
      light: { hex: '#FF6B35', rgb: 'rgb(255, 107, 53)', hsl: 'hsl(16, 100%, 60%)', tailwind: 'warmOrange-500' },
      dark: { hex: '#FF8A65', rgb: 'rgb(255, 138, 101)', hsl: 'hsl(16, 100%, 68%)', tailwind: 'warmOrange-400' },
    },
  },
  secondary: {
    muted: {
      light: { hex: '#F5F3F6', rgb: 'rgb(245, 243, 246)', hsl: 'hsl(280, 10%, 95%)', tailwind: 'muted' },
      dark: { hex: '#2B2630', rgb: 'rgb(43, 38, 48)', hsl: 'hsl(280, 20%, 18%)', tailwind: 'muted' },
    },
    accent: {
      light: { hex: '#F9F7FA', rgb: 'rgb(249, 247, 250)', hsl: 'hsl(280, 85%, 96%)', tailwind: 'accent' },
      dark: { hex: '#352E3A', rgb: 'rgb(53, 46, 58)', hsl: 'hsl(280, 20%, 22%)', tailwind: 'accent' },
    },
  },
  semantic: {
    success: { hex: '#16A34A', rgb: 'rgb(22, 163, 74)', hsl: 'hsl(142, 76%, 36%)', tailwind: 'green-600' },
    destructive: { hex: '#DC2626', rgb: 'rgb(220, 38, 38)', hsl: 'hsl(0, 84%, 60%)', tailwind: 'red-600' },
    warning: { hex: '#EAB308', rgb: 'rgb(234, 179, 8)', hsl: 'hsl(45, 93%, 47%)', tailwind: 'yellow-500' },
    info: { hex: '#3B82F6', rgb: 'rgb(59, 130, 246)', hsl: 'hsl(217, 91%, 60%)', tailwind: 'blue-500' },
  },
} as const;

export const gradients = {
  dragvertising: {
    css: 'linear-gradient(135deg, #FFA726, #FD0290, #A855F7)',
    stops: [
      { color: '#FFA726', position: '0%' },
      { color: '#FD0290', position: '50%' },
      { color: '#A855F7', position: '100%' },
    ],
    angle: '135deg',
    usage: 'Primary hero sections, featured CTAs',
  },
  golden: {
    css: 'linear-gradient(135deg, #FFA726, #FF6B35)',
    stops: [
      { color: '#FFA726', position: '0%' },
      { color: '#FF6B35', position: '100%' },
    ],
    angle: '135deg',
    usage: 'Secondary CTAs, accent buttons',
  },
  primary: {
    css: 'linear-gradient(135deg, hsl(280 85% 50%), #FD0290)',
    stops: [
      { color: 'hsl(280, 85%, 50%)', position: '0%' },
      { color: '#FD0290', position: '100%' },
    ],
    angle: '135deg',
    usage: 'Brand consistency, existing components',
  },
  hero: {
    css: 'linear-gradient(135deg, hsl(280 85% 50%) 0%, #FD0290 50%, hsl(45 100% 55%) 100%)',
    stops: [
      { color: 'hsl(280, 85%, 50%)', position: '0%' },
      { color: '#FD0290', position: '50%' },
      { color: 'hsl(45, 100%, 55%)', position: '100%' },
    ],
    angle: '135deg',
    usage: 'Hero backgrounds, full-page gradients',
  },
} as const;

export const spacing = {
  '0': { px: 0, rem: 0, tailwind: '0' },
  '1': { px: 4, rem: 0.25, tailwind: '1' },
  '2': { px: 8, rem: 0.5, tailwind: '2' },
  '3': { px: 12, rem: 0.75, tailwind: '3' },
  '4': { px: 16, rem: 1, tailwind: '4' },
  '5': { px: 20, rem: 1.25, tailwind: '5' },
  '6': { px: 24, rem: 1.5, tailwind: '6' },
  '8': { px: 32, rem: 2, tailwind: '8' },
  '10': { px: 40, rem: 2.5, tailwind: '10' },
  '12': { px: 48, rem: 3, tailwind: '12' },
  '16': { px: 64, rem: 4, tailwind: '16' },
  '20': { px: 80, rem: 5, tailwind: '20' },
  '24': { px: 96, rem: 6, tailwind: '24' },
} as const;

export const typography = {
  fontFamily: {
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  fontSize: {
    xs: { px: 12, rem: 0.75, tailwind: 'text-xs' },
    sm: { px: 14, rem: 0.875, tailwind: 'text-sm' },
    base: { px: 16, rem: 1, tailwind: 'text-base' },
    lg: { px: 18, rem: 1.125, tailwind: 'text-lg' },
    xl: { px: 20, rem: 1.25, tailwind: 'text-xl' },
    '2xl': { px: 24, rem: 1.5, tailwind: 'text-2xl' },
    '3xl': { px: 30, rem: 1.875, tailwind: 'text-3xl' },
    '4xl': { px: 36, rem: 2.25, tailwind: 'text-4xl' },
    '5xl': { px: 48, rem: 3, tailwind: 'text-5xl' },
    '6xl': { px: 60, rem: 3.75, tailwind: 'text-6xl' },
    '7xl': { px: 72, rem: 4.5, tailwind: 'text-7xl' },
    '8xl': { px: 96, rem: 6, tailwind: 'text-8xl' },
  },
  fontWeight: {
    regular: { value: 400, tailwind: 'font-normal' },
    medium: { value: 500, tailwind: 'font-medium' },
    semibold: { value: 600, tailwind: 'font-semibold' },
    bold: { value: 700, tailwind: 'font-bold' },
    black: { value: 900, tailwind: 'font-black' },
  },
  lineHeight: {
    tight: { value: 1.1, tailwind: 'leading-tight' },
    snug: { value: 1.375, tailwind: 'leading-snug' },
    normal: { value: 1.5, tailwind: 'leading-normal' },
    relaxed: { value: 1.625, tailwind: 'leading-relaxed' },
  },
} as const;

export const borderRadius = {
  none: { px: 0, tailwind: 'rounded-none' },
  sm: { px: 2, tailwind: 'rounded-sm' },
  base: { px: 4, tailwind: 'rounded' },
  md: { px: 6, tailwind: 'rounded-md' },
  lg: { px: 8, tailwind: 'rounded-lg' },
  xl: { px: 12, tailwind: 'rounded-xl', usage: 'Buttons (V2)' },
  '2xl': { px: 16, tailwind: 'rounded-2xl', usage: 'Cards (V2)' },
  '3xl': { px: 24, tailwind: 'rounded-3xl' },
  full: { px: 9999, tailwind: 'rounded-full' },
} as const;

export const shadows = {
  sm: { css: '0 1px 2px 0 rgb(0 0 0 / 0.05)', tailwind: 'shadow-sm' },
  base: { css: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', tailwind: 'shadow' },
  md: { css: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', tailwind: 'shadow-md' },
  lg: { css: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', tailwind: 'shadow-lg', usage: 'Buttons' },
  xl: { css: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', tailwind: 'shadow-xl', usage: 'Cards, Button hover' },
  '2xl': { css: '0 25px 50px -12px rgb(0 0 0 / 0.25)', tailwind: 'shadow-2xl', usage: 'Hero CTAs' },
  glow: {
    primary: {
      light: '0 0 40px hsl(280 85% 50% / 0.3)',
      dark: '0 0 50px hsl(280 85% 60% / 0.5)',
    },
    golden: {
      light: '0 0 30px hsl(38 100% 57% / 0.3)',
      dark: '0 0 40px hsl(38 100% 65% / 0.5)',
    },
  },
} as const;

export const transitions = {
  duration: {
    fast: { ms: 150, tailwind: 'duration-150' },
    base: { ms: 200, tailwind: 'duration-200' },
    slow: { ms: 300, tailwind: 'duration-300' },
    slower: { ms: 500, tailwind: 'duration-500' },
  },
  timing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// Main tokens object
export const tokens = {
  colors,
  gradients,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  components: {
    button: {
      borderRadius: 'rounded-xl',
      fontWeight: 'font-semibold',
      sizes: {},
      variants: {},
    },
    card: {
      borderRadius: 'rounded-2xl',
      shadow: 'shadow-xl',
      borderWidth: '2px',
    },
  },
} as const;

// Legacy compatibility - maintain old ds export structure
export const ds = {
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,.06)',
    md: '0 4px 14px rgba(0,0,0,.08)',
  },
  text: {
    xs: '0.8rem',
    sm: '0.9rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
  },
};

// CSS Variables for use in styled components or inline styles
export const cssVariables = {
  '--spacing-xxs': `${ds.spacing.xxs}px`,
  '--spacing-xs': `${ds.spacing.xs}px`,
  '--spacing-sm': `${ds.spacing.sm}px`,
  '--spacing-md': `${ds.spacing.md}px`,
  '--spacing-lg': `${ds.spacing.lg}px`,
  '--spacing-xl': `${ds.spacing.xl}px`,
  
  '--radius-sm': `${ds.radius.sm}px`,
  '--radius-md': `${ds.radius.md}px`,
  '--radius-lg': `${ds.radius.lg}px`,
  
  '--shadow-sm': ds.shadow.sm,
  '--shadow-md': ds.shadow.md,
  
  '--text-xs': ds.text.xs,
  '--text-sm': ds.text.sm,
  '--text-md': ds.text.md,
  '--text-lg': ds.text.lg,
  '--text-xl': ds.text.xl,
};
