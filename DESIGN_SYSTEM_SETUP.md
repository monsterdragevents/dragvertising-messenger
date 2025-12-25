# Design System Setup

This repo now uses the shared `@dragvertising/design-system` package to ensure consistent styling across all Dragvertising repositories.

## ✅ What Changed

- ✅ Added `@dragvertising/design-system` as a dependency
- ✅ Updated `tailwind.config.js` to use the shared preset
- ✅ All design tokens now come from a single source of truth

## Using Design Tokens

All design tokens are available via Tailwind classes with the `dv-` prefix:

```tsx
// Colors
<div className="bg-dv-purple-500 text-dv-pink-500">...</div>

// Spacing
<div className="p-dv-4 m-dv-6">...</div>

// Typography
<h1 className="text-dv-4xl font-dv-bold">...</h1>

// Border Radius
<button className="rounded-dv-lg">...</button>

// Shadows
<div className="shadow-dv-lg shadow-dv-glow-primary-light">...</div>
```

## Updating Design Tokens

When design tokens are updated:

1. Update tokens in `dragvertising-design-system/design-tokens/`
2. Run `npm run build` in the design-system repo
3. Run `npm install` in this repo to get the updated preset

Or use the workspace sync command from the root:

```bash
npm run sync:design-system
```





