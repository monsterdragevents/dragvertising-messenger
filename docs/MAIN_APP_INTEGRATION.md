# Main App Integration Guide

This document describes how the Dragvertising Messenger integrates with the main DragvertisingApp.

## Directory Structure

The messenger is a **child application** of the main Dragvertising app:

```
/Users/michaelryanwhitson/
├── DragvertisingApp/          # Main Dragvertising application
│   ├── src/
│   ├── package.json
│   └── ...
└── dragvertising-messenger/   # This messenger (child app)
    ├── src/
    ├── package.json
    └── ...
```

## Integration Points

### 1. Shared Supabase Instance

Both apps use the **same Supabase project**:
- Same database tables
- Same authentication system
- Same realtime subscriptions
- Same storage buckets

**Configuration:**
```env
# Both apps use the same Supabase credentials
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Shared Authentication

Users authenticate once and can access both apps:
- Login credentials work in both apps
- Session is shared via Supabase auth
- Universe selection is preserved across apps

### 3. Navigation Link

The messenger header includes a link back to the main app:

```tsx
// In RealtimeMessenger.tsx
<a href={import.meta.env.VITE_MAIN_APP_URL}>
  <Sparkles /> Dragvertising
</a>
```

**Configuration:**
```env
# Set the main app URL
VITE_MAIN_APP_URL=https://dragvertising.app
# Or for local development:
# VITE_MAIN_APP_URL=http://localhost:3000
```

### 4. Shared Universe System

Both apps use the same universe/role system:
- Same `profile_universes` table
- Same role definitions
- Same universe switching logic
- Universe context is shared via Supabase

## Development Workflow

### Local Development

1. **Start Main App:**
   ```bash
   cd ../DragvertisingApp
   npm run dev  # Usually runs on http://localhost:3000
   ```

2. **Start Messenger:**
   ```bash
   cd dragvertising-messenger
   npm run dev  # Runs on http://localhost:5173
   ```

3. **Configure Environment:**
   ```env
   # In dragvertising-messenger/.env.local
   VITE_MAIN_APP_URL=http://localhost:3000
   ```

### Production Deployment

1. **Main App:** Deployed at `https://dragvertising.app`
2. **Messenger:** Deployed at `https://messenger.dragvertising.com`

**Configuration:**
```env
# In dragvertising-messenger/.env.production
VITE_MAIN_APP_URL=https://dragvertising.app
```

## Shared Components & Utilities

While the apps are separate, they share:
- Same Supabase client configuration
- Same authentication patterns
- Same universe management logic
- Same database schema

## Cross-App Navigation

Users can navigate between apps:
- **Main App → Messenger:** Direct link or subdomain
- **Messenger → Main App:** Click the header logo/name

The navigation preserves:
- Authentication state
- Universe selection
- User context

## Deployment Considerations

### Subdomain Setup

The messenger is typically deployed on a subdomain:
- Main app: `dragvertising.app`
- Messenger: `messenger.dragvertising.com`

### Environment Variables

Both apps need:
- Same Supabase credentials
- Messenger needs `VITE_MAIN_APP_URL` pointing to main app

### CORS & Security

- Both apps should allow cross-origin requests for shared auth
- Supabase handles CORS for API requests
- Session cookies work across subdomains

## Troubleshooting

### Navigation Not Working

1. Check `VITE_MAIN_APP_URL` is set correctly
2. Verify main app is accessible at that URL
3. Check browser console for CORS errors

### Auth Not Shared

1. Verify both apps use same Supabase project
2. Check Supabase auth settings allow cross-origin
3. Ensure session cookies are set correctly

### Universe Context Lost

1. Verify universe is stored in Supabase (not just local storage)
2. Check `useUniverse` hook is working correctly
3. Ensure both apps read from same Supabase tables

