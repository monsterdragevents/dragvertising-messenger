import { createClient } from '@supabase/supabase-js';
import { createCrossDomainStorage } from '@/lib/storage/crossDomainStorage';

// Trim any whitespace/newlines from environment variables (common issue with .env files)
// Also remove any newline characters that might cause WebSocket connection failures
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY_RAW = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_ANON_KEY = SUPABASE_ANON_KEY_RAW?.trim().replace(/[\n\r]/g, '');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Warn if original key had newlines (helps debug deployment issues)
if (SUPABASE_ANON_KEY_RAW && (SUPABASE_ANON_KEY_RAW.includes('\n') || SUPABASE_ANON_KEY_RAW.includes('\r'))) {
  console.warn('[Supabase Client] WARNING: API key contained newline characters. Auto-fixed, but please update your environment variable in Vercel/deployment to remove them.');
}

// Create cross-domain storage adapter for subdomain support
// This enables authentication to work across dragvertising.com, messenger.dragvertising.com, etc.
const crossDomainStorage = typeof window !== 'undefined' ? createCrossDomainStorage() : localStorage;

// Sync existing session between localStorage and cookies on subdomains
// This ensures sessions from the main domain are accessible on subdomains
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  const isSubdomain = hostname !== 'dragvertising.com' && hostname.includes('.dragvertising.com');
  
  if (isSubdomain) {
    // On subdomain, try to sync session from cookies (set by main domain) or localStorage
    // The crossDomainStorage will handle this automatically, but we also manually sync here
    // to ensure immediate availability
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const projectId = supabaseUrl.split('//')[1]?.split('.')[0];
        if (projectId) {
          const authKey = `sb-${projectId}-auth-token`;
          
          // First, try to read from cookies (set by main domain with .dragvertising.com domain)
          const cookieValue = crossDomainStorage.getItem(authKey);
          
          // Also check localStorage (might have been set on this subdomain)
          const localValue = localStorage.getItem(authKey);
          
          // If we have a cookie value but not in localStorage, sync to localStorage for faster access
          if (cookieValue && !localValue) {
            try {
              localStorage.setItem(authKey, cookieValue);
              console.log('[Messenger Supabase] Synced auth session from cookies to localStorage for subdomain');
            } catch (e) {
              // Ignore localStorage errors (e.g., private browsing)
            }
          }
          
          // If we have localStorage but not cookies, sync to cookies for cross-domain sharing
          if (localValue && !cookieValue) {
            crossDomainStorage.setItem(authKey, localValue);
            console.log('[Messenger Supabase] Synced auth session from localStorage to cookies for cross-domain access');
          }
          
          // Log what we found for debugging
          if (cookieValue || localValue) {
            console.log('[Messenger Supabase] Found existing session on subdomain:', {
              fromCookie: !!cookieValue,
              fromLocalStorage: !!localValue,
              hostname
            });
          }
        }
      }
    } catch (error) {
      console.warn('[Messenger Supabase] Error syncing auth session:', error);
    }
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: crossDomainStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

