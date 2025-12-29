/**
 * Simplified Auth Context for Messenger
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Immediately check for existing session from cross-domain storage
    // This ensures we detect sessions from the main domain before rendering
    const checkInitialSession = async () => {
      try {
        console.log('[Messenger AuthContext] Checking for existing session from cross-domain storage...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.warn('[Messenger AuthContext] Error getting session:', error);
        }

        if (initialSession) {
          console.log('[Messenger AuthContext] Found existing session:', initialSession.user.email);
          setSession(initialSession);
          setUser(initialSession.user);
        } else {
          console.log('[Messenger AuthContext] No existing session found');
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error('[Messenger AuthContext] Error checking initial session:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Check session immediately
    checkInitialSession();

    // Listen for auth changes (login, logout, token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      console.log('[Messenger AuthContext] Auth state changed:', event);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

