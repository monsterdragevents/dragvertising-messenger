/**
 * Simplified Universe Hook for Messenger
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/shared/use-toast';

export interface Universe {
  id: string;
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  role: string;
}

export function useUniverse() {
  const { user } = useAuth();
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [availableUniverses, setAvailableUniverses] = useState<Universe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load available universes
  const loadAvailableUniverses = useCallback(async () => {
    if (!user) {
      setAvailableUniverses([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profile_universes')
        .select('id, handle, display_name, avatar_url, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Filter out galaxy_holder and superadmin universes - they don't have messaging access
        const filteredUniverses = data.filter(
          u => u.role !== 'galaxy_holder' && u.role !== 'superadmin'
        );
        setAvailableUniverses(filteredUniverses);
      }
    } catch (error) {
      console.error('Error loading available universes:', error);
    }
  }, [user]);

  // Load active universe
  useEffect(() => {
    if (!user) {
      setUniverse(null);
      setIsLoading(false);
      return;
    }

    const loadUniverse = async () => {
      try {
        // Load available universes first
        await loadAvailableUniverses();

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
            // Don't set galaxy_holder or superadmin universes - they don't have messaging access
            if (data.role !== 'galaxy_holder' && data.role !== 'superadmin') {
              setUniverse(data);
              setIsLoading(false);
              return;
            } else {
              // Clear invalid stored universe
              localStorage.removeItem('active_universe_id');
            }
          }
        }

        // Fallback: Get first active universe (excluding galaxy_holder and superadmin)
        const { data: universes, error } = await supabase
          .from('profile_universes')
          .select('id, handle, display_name, avatar_url, role')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .neq('role', 'galaxy_holder')
          .neq('role', 'superadmin')
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
  }, [user, loadAvailableUniverses]);

  // Switch universe function
  const switchUniverse = useCallback(async (universeId: string) => {
    if (!user) {
      toast.error('You must be logged in to switch universes');
      return;
    }

    // Find the universe in available universes
    const targetUniverse = availableUniverses.find(u => u.id === universeId);
    if (!targetUniverse) {
      toast.error('Universe not found');
      return;
    }

    // Check if already on this universe
    if (universe?.id === universeId) {
      return;
    }

    try {
      // Update localStorage
      localStorage.setItem('active_universe_id', universeId);
      
      // Update state
      setUniverse(targetUniverse);
      
      toast.success(`Switched to ${targetUniverse.display_name}`);
    } catch (error) {
      console.error('Error switching universe:', error);
      toast.error('Failed to switch universe');
    }
  }, [user, universe, availableUniverses]);

  return {
    universe,
    availableUniverses,
    isLoading,
    role: universe?.role || null,
    switchUniverse,
    refreshUniverses: loadAvailableUniverses,
  };
}

