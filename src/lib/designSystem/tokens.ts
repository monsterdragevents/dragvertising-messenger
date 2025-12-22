/**
 * Design System Tokens
 * 
 * Core design values used throughout the application for consistent spacing,
 * sizing, typography, and visual effects.
 */

export const ds = {
  spacing: { 
    xxs: 4, 
    xs: 8, 
    sm: 12, 
    md: 16, 
    lg: 24, 
    xl: 32 
  },
  radius: { 
    sm: 6, 
    md: 10, 
    lg: 14 
  },
  shadow: { 
    sm: '0 1px 2px rgba(0,0,0,.06)', 
    md: '0 4px 14px rgba(0,0,0,.08)' 
  },
  text: { 
    xs: '0.8rem', 
    sm: '0.9rem', 
    md: '1rem', 
    lg: '1.25rem', 
    xl: '1.5rem' 
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
