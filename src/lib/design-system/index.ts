/**
 * 🎨 Unified Design System Index 🎨
 * 
 * Single source of truth for all design system exports.
 * Import everything you need from this file.
 * 
 * When you update a component in the design system, it automatically
 * propagates throughout the entire app.
 * 
 * @example
 * ```tsx
 * // Import primitives
 * import { Button, Card, Avatar } from '@/lib/design-system';
 * 
 * // Import tokens
 * import { tokens, colors } from '@/lib/design-system';
 * ```
 */

// ============================================================================
// Design Tokens - Single source of truth
// ============================================================================
// Re-export tokens from designSystem folder (note: different casing in messenger)
export * from '@/lib/designSystem/tokens';

// ============================================================================
// UI Primitives - Base shadcn/ui components
// ============================================================================
// These are the foundational components that all other components build upon.
// When you update a primitive here, it automatically updates everywhere.

export * from '@/ui/primitives/button';
export * from '@/ui/primitives/avatar';
export * from '@/ui/primitives/dialog';
export * from '@/ui/primitives/input';
export * from '@/ui/primitives/textarea';
export * from '@/ui/primitives/scroll-area';
export * from '@/ui/primitives/badge';
export * from '@/ui/primitives/popover';
export * from '@/ui/primitives/dropdown-menu';
