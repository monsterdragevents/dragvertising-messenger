/**
 * Cross-Domain Storage Adapter for Supabase
 * 
 * Enables authentication to work across subdomains by using cookies
 * with a shared domain (.dragvertising.com) instead of localStorage
 */

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Cookie-based storage that works across subdomains
 * Uses .dragvertising.com domain so cookies are shared between
 * dragvertising.com, messenger.dragvertising.com, etc.
 */
class CookieStorage implements StorageAdapter {
  private domain: string;
  private path: string;
  private secure: boolean;
  private sameSite: 'strict' | 'lax' | 'none';

  constructor() {
    // Use shared domain for cookies to work across subdomains
    this.domain = '.dragvertising.com';
    this.path = '/';
    this.secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    this.sameSite = this.secure ? 'lax' : 'lax';
  }

  private getCookieName(key: string): string {
    // Prefix with sb- to match Supabase's naming convention
    return `sb-auth-${key}`;
  }

  getItem(key: string): string | null {
    if (typeof document === 'undefined') return null;
    
    const cookieName = this.getCookieName(key);
    const cookies = document.cookie.split(';');
    
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === cookieName) {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      }
    }
    
    // Fallback to localStorage for backward compatibility
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof document === 'undefined') return;
    
    const cookieName = this.getCookieName(key);
    const expires = new Date();
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
    
    const cookieValue = encodeURIComponent(value);
    let cookie = `${cookieName}=${cookieValue}; expires=${expires.toUTCString()}; path=${this.path}`;
    
    // Only set domain if we're on a subdomain (not localhost)
    if (this.domain && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      cookie += `; domain=${this.domain}`;
    }
    
    if (this.secure) {
      cookie += '; secure';
    }
    
    cookie += `; samesite=${this.sameSite}`;
    
    document.cookie = cookie;
    
    // Also store in localStorage for backward compatibility and faster access
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore localStorage errors (e.g., in private browsing)
    }
  }

  removeItem(key: string): void {
    if (typeof document === 'undefined') return;
    
    const cookieName = this.getCookieName(key);
    const expires = new Date(0).toUTCString();
    
    let cookie = `${cookieName}=; expires=${expires}; path=${this.path}`;
    
    // Only set domain if we're on a subdomain (not localhost)
    if (this.domain && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      cookie += `; domain=${this.domain}`;
    }
    
    document.cookie = cookie;
    
    // Also remove from localStorage
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Hybrid storage that uses cookies for cross-domain and localStorage for same-domain
 * This provides the best of both worlds: cross-subdomain sharing + fast local access
 */
class HybridStorage implements StorageAdapter {
  private cookieStorage: CookieStorage;
  private localStorage: Storage;

  constructor() {
    this.cookieStorage = new CookieStorage();
    this.localStorage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage);
  }

  getItem(key: string): string | null {
    // Try localStorage first (faster)
    try {
      const localValue = this.localStorage.getItem(key);
      if (localValue) return localValue;
    } catch {
      // Ignore localStorage errors
    }
    
    // Fallback to cookie storage (works across subdomains)
    return this.cookieStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    // Store in both for redundancy
    try {
      this.localStorage.setItem(key, value);
    } catch {
      // Ignore localStorage errors
    }
    
    this.cookieStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    try {
      this.localStorage.removeItem(key);
    } catch {
      // Ignore localStorage errors
    }
    
    this.cookieStorage.removeItem(key);
  }
}

/**
 * Create a storage adapter for Supabase that works across subdomains
 */
export function createCrossDomainStorage(): StorageAdapter {
  // Use hybrid storage for best compatibility
  return new HybridStorage();
}
