/**
 * Simplified Universe Hook for Messenger
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

  // Extract userId - ensure it's always a string or undefined (never null)
  const userId = user?.id;

  // Load available universes
  const loadAvailableUniverses = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) {
      setAvailableUniverses([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profile_universes')
        .select('id, handle, display_name, avatar_url, role')
        .eq('user_id', currentUserId)
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

  // Load active universe from active_universe_state table
  useEffect(() => {
    const currentUserId = user?.id;
    if (!currentUserId) {
      setUniverse(null);
      setIsLoading(false);
      return;
    }

    const loadUniverse = async () => {
      try {
        // Load available universes first
        await loadAvailableUniverses();

        // Get active universe from active_universe_state table
        const { data: activeState, error: stateError } = await supabase
          .from('active_universe_state')
          .select('active_profile_universe_id')
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!stateError && activeState?.active_profile_universe_id) {
          const { data, error } = await supabase
            .from('profile_universes')
            .select('id, handle, display_name, avatar_url, role')
            .eq('id', activeState.active_profile_universe_id)
            .eq('status', 'active')
            .eq('user_id', currentUserId)
            .maybeSingle();

          if (!error && data) {
            // Don't set galaxy_holder or superadmin universes - they don't have messaging access
            if (data.role !== 'galaxy_holder' && data.role !== 'superadmin') {
              setUniverse(data);
              setIsLoading(false);
              return;
            }
          }
        }

        // Fallback: Get first active universe (excluding galaxy_holder and superadmin)
        const { data: universes, error } = await supabase
          .from('profile_universes')
          .select('id, handle, display_name, avatar_url, role')
          .eq('user_id', currentUserId)
          .eq('status', 'active')
          .neq('role', 'galaxy_holder')
          .neq('role', 'superadmin')
          .limit(1);

        if (!error && universes && universes.length > 0) {
          const firstUniverse = universes[0];
          // Ensure firstUniverse exists and has required properties
          if (firstUniverse && firstUniverse.id) {
            setUniverse(firstUniverse);
            
            // Update active_universe_state in database
            await supabase
              .from('active_universe_state')
              .upsert({
                user_id: currentUserId,
                active_profile_universe_id: firstUniverse.id,
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id' });
          }
        } else {
          // No valid universes found - set to null and stop loading
          setUniverse(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading universe:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUniverse();
  }, [user, loadAvailableUniverses]);

  // Use refs to avoid array dependencies in useCallback
  const availableUniversesRef = useRef(availableUniverses);
  const universeRef = useRef(universe);
  
  useEffect(() => {
    availableUniversesRef.current = availableUniverses;
  }, [availableUniverses]);
  
  useEffect(() => {
    universeRef.current = universe;
  }, [universe]);

  // Switch universe function
  const switchUniverse = useCallback(async (universeId: string) => {
    const currentUserId = user?.id;
    if (!currentUserId) {
      toast.error('You must be logged in to switch universes');
      return;
    }

    // Find the universe in available universes using ref
    const targetUniverse = availableUniversesRef.current.find(u => u.id === universeId);
    if (!targetUniverse) {
      toast.error('Universe not found');
      return;
    }

    // Check if already on this universe using ref
    if (universeRef.current?.id === universeId) {
      return;
    }

    try {
      // Update active_universe_state in database
      const { error: updateError } = await supabase
        .from('active_universe_state')
        .upsert({
          user_id: currentUserId,
          active_profile_universe_id: universeId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (updateError) {
        throw updateError;
      }
      
      // Update state
      setUniverse(targetUniverse);
      
      toast.success(`Switched to ${targetUniverse.display_name}`);
    } catch (error) {
      console.error('Error switching universe:', error);
      toast.error('Failed to switch universe');
    }
  }, [user]);

  return {
    universe,
    availableUniverses,
    isLoading,
    role: universe?.role || null,
    switchUniverse,
    refreshUniverses: loadAvailableUniverses,
  };
}

