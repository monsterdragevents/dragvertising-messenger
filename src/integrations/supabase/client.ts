import { createClient } from '@supabase/supabase-js';
import { createCrossDomainStorage } from '@/lib/storage/crossDomainStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Create cross-domain storage adapter for subdomain support
// This enables authentication to work across dragvertising.com, messenger.dragvertising.com, etc.
const crossDomainStorage = typeof window !== 'undefined' ? createCrossDomainStorage() : localStorage;

// Sync existing localStorage session to cookies on subdomains
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  const isSubdomain = hostname !== 'dragvertising.com' && hostname.includes('.dragvertising.com');
  
  if (isSubdomain) {
    // On subdomain, try to sync session from cookies or localStorage
    // The crossDomainStorage will handle this, but we can also manually sync here
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const projectId = supabaseUrl.split('//')[1]?.split('.')[0];
        if (projectId) {
          const authKey = `sb-${projectId}-auth-token`;
          // Check if we have it in localStorage but not in cookies
          const localValue = localStorage.getItem(authKey);
          if (localValue) {
            // Sync to cookies
            crossDomainStorage.setItem(authKey, localValue);
            console.log('[Supabase] Synced auth session to cookies for subdomain access');
          }
        }
      }
    } catch (error) {
      console.warn('[Supabase] Error syncing auth session:', error);
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

