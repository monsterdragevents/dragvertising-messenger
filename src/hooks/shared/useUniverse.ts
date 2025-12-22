/**
 * Simplified Universe Hook for Messenger
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Universe {
  id: string;
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  role: string;
}

export function useUniverse() {
  const { user } = useAuth();
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUniverse(null);
      setIsLoading(false);
      return;
    }

    // Get active universe from localStorage or fetch first available
    const loadUniverse = async () => {
      try {
        // Check localStorage for active universe
        const storedUniverseId = localStorage.getItem('active_universe_id');
        
        if (storedUniverseId) {
          const { data, error } = await supabase
            .from('profile_universes')
            .select('id, handle, display_name, avatar_url, role')
            .eq('id', storedUniverseId)
            .eq('status', 'active')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!error && data) {
            setUniverse(data);
            setIsLoading(false);
            return;
          }
        }

        // Fallback: Get first active universe
        const { data: universes, error } = await supabase
          .from('profile_universes')
          .select('id, handle, display_name, avatar_url, role')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1);

        if (!error && universes && universes.length > 0) {
          const firstUniverse = universes[0];
          setUniverse(firstUniverse);
          localStorage.setItem('active_universe_id', firstUniverse.id);
        }
      } catch (error) {
        console.error('Error loading universe:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUniverse();
  }, [user]);

  return {
    universe,
    isLoading,
    role: universe?.role || null,
  };
}
