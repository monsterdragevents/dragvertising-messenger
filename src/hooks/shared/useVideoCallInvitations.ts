/**
 * Video Call Invitation Hook
 * Manages video call invitations via Supabase Realtime
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/shared/use-toast';

export interface VideoCall {
  id: string;
  conversation_id: string;
  room_name: string;
  caller_user_id: string;
  caller_profile_universe_id: string;
  callee_user_id: string;
  callee_profile_universe_id: string;
  status: 'initiating' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed' | 'busy';
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  ended_at?: string;
  end_reason?: string;
}

export interface UseVideoCallInvitationsProps {
  onIncomingCall?: (call: VideoCall) => void;
  onCallStatusChange?: (call: VideoCall) => void;
}

export function useVideoCallInvitations({
  onIncomingCall,
  onCallStatusChange
}: UseVideoCallInvitationsProps = {}) {
  const { user, session } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const processedCallIdsRef = useRef<Set<string>>(new Set());

  // Define handleCallChange before it's used in useEffect
  const handleCallChange = useCallback((payload: any) => {
    const call = payload.new as VideoCall;
    const oldCall = payload.old as VideoCall;

    console.log('[VideoCallInvitations] handleCallChange:', {
      eventType: payload.eventType,
      callStatus: call?.status,
      calleeUserId: call?.callee_user_id,
      callerUserId: call?.caller_user_id,
      currentUserId: user?.id,
      isIncoming: call?.callee_user_id === user?.id,
      callId: call?.id,
      fullPayload: payload
    });

    // Validate we have a call object
    if (!call) {
      console.warn('[VideoCallInvitations] No call data in payload:', payload);
      return;
    }

    switch (payload.eventType) {
      case 'INSERT':
        // Check if this is an incoming call for the current user
        if (call.callee_user_id === user?.id && call.status === 'ringing') {
          // Mark as processed to avoid duplicate notifications
          if (!processedCallIdsRef.current.has(call.id)) {
            processedCallIdsRef.current.add(call.id);
            console.log('[VideoCallInvitations] Incoming call detected - triggering onIncomingCall callback', {
              callId: call.id,
              callerUserId: call.caller_user_id,
              calleeUserId: call.callee_user_id,
              status: call.status
            });
            onIncomingCall?.(call);
          } else {
            console.log('[VideoCallInvitations] Call already processed, skipping:', call.id);
          }
        } else {
          console.log('[VideoCallInvitations] INSERT event but not an incoming call for this user', {
            isCallee: call.callee_user_id === user?.id,
            status: call.status,
            expectedStatus: 'ringing'
          });
        }
        onCallStatusChange?.(call);
        break;

      case 'UPDATE':
        onCallStatusChange?.(call);
        
        if (oldCall.status === 'ringing' && call.status === 'accepted') {
          toast.success('Call accepted');
        } else if (oldCall.status === 'ringing' && call.status === 'rejected') {
          toast.error('Call declined');
        } else if (oldCall.status === 'ringing' && call.status === 'missed') {
          toast.info('Missed call');
        }
        break;

      case 'DELETE':
        console.log('[VideoCallInvitations] Call deleted:', oldCall);
        if (oldCall?.id) {
          processedCallIdsRef.current.delete(oldCall.id);
        }
        break;
    }
  }, [user?.id, onIncomingCall, onCallStatusChange]);

  // Poll for active calls as a fallback (in case Realtime misses events)
  const pollForActiveCalls = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: activeCalls, error } = await supabase
        .from('video_calls')
        .select('*')
        .or(`callee_user_id.eq.${user.id},caller_user_id.eq.${user.id}`)
        .in('status', ['ringing', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('[VideoCallInvitations] Error polling for calls:', error);
        return;
      }

      if (activeCalls && activeCalls.length > 0) {
        // Process calls we haven't seen yet
        for (const call of activeCalls) {
          const callData = call as VideoCall;
          
          // Skip if we've already processed this call
          if (processedCallIdsRef.current.has(callData.id)) {
            continue;
          }

          // Check if this is an incoming call
          if (callData.callee_user_id === user.id && callData.status === 'ringing') {
            console.log('[VideoCallInvitations] Found active incoming call via polling:', callData);
            processedCallIdsRef.current.add(callData.id);
            onIncomingCall?.(callData);
          }
          
          // Always notify of status changes
          onCallStatusChange?.(callData);
        }
      }
    } catch (error) {
      console.error('[VideoCallInvitations] Error in pollForActiveCalls:', error);
    }
  }, [user?.id, onIncomingCall, onCallStatusChange]);

  useEffect(() => {
    if (!user || !session?.access_token) return;

    const setupChannel = async () => {
      // Ensure auth is set BEFORE creating channel
      supabase.realtime.setAuth(session.access_token);
      
      // Wait a tick to ensure auth is propagated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const channel = supabase
        .channel('video-calls')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'video_calls',
            filter: `callee_user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[VideoCallInvitations] Received callee change:', payload);
            handleCallChange(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'video_calls',
            filter: `caller_user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[VideoCallInvitations] Received caller change:', payload);
            handleCallChange(payload);
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
          if (status === 'SUBSCRIBED') {
            console.log('[VideoCallInvitations] Connected to video calls channel');
            // Poll once after subscription to catch any missed calls
            setTimeout(() => pollForActiveCalls(), 500);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[VideoCallInvitations] Channel error - check authentication');
            // Try to re-authenticate
            if (session?.access_token) {
              console.log('[VideoCallInvitations] Retrying with fresh auth token');
              supabase.realtime.setAuth(session.access_token);
            }
          }
        });

      channelRef.current = channel;
    };

    setupChannel();

    // Poll periodically as a fallback (every 3 seconds)
    const pollInterval = setInterval(() => {
      pollForActiveCalls();
    }, 3000);

    return () => {
      console.log('[VideoCallInvitations] Cleaning up video calls channel');
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
      setIsConnected(false);
      processedCallIdsRef.current.clear();
    };
  }, [user?.id, session?.access_token, handleCallChange, pollForActiveCalls]);

  const initiateCall = async (
    conversationId: string,
    calleeUserId: string,
    calleeProfileUniverseId: string
  ): Promise<{ success: boolean; callId?: string; error?: string }> => {
    try {
      console.log('[VideoCallInvitations] Initiating call', {
        conversationId,
        calleeUserId,
        calleeProfileUniverseId
      });

      const { data, error } = await supabase.rpc('create_video_call', {
        p_conversation_id: conversationId,
        p_callee_user_id: calleeUserId,
        p_callee_profile_universe_id: calleeProfileUniverseId
      });

      if (error) {
        console.error('[VideoCallInvitations] Error creating call:', error);
        return { success: false, error: error.message };
      }

      console.log('[VideoCallInvitations] Call created:', data);
      return { success: true, callId: data };
    } catch (error) {
      console.error('[VideoCallInvitations] Error initiating call:', error);
      return { success: false, error: 'Failed to initiate call' };
    }
  };

  const acceptCall = async (callId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[VideoCallInvitations] Accepting call:', callId);

      const { data, error } = await supabase.rpc('accept_video_call', {
        p_call_id: callId
      });

      if (error) {
        console.error('[VideoCallInvitations] Error accepting call:', error);
        return { success: false, error: error.message };
      }

      console.log('[VideoCallInvitations] Call accepted:', data);
      return { success: true };
    } catch (error) {
      console.error('[VideoCallInvitations] Error accepting call:', error);
      return { success: false, error: 'Failed to accept call' };
    }
  };

  const rejectCall = async (callId: string, reason: string = 'rejected'): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[VideoCallInvitations] Rejecting call:', callId, reason);

      const { data, error } = await supabase.rpc('reject_video_call', {
        p_call_id: callId,
        p_reason: reason
      });

      if (error) {
        console.error('[VideoCallInvitations] Error rejecting call:', error);
        return { success: false, error: error.message };
      }

      console.log('[VideoCallInvitations] Call rejected:', data);
      return { success: true };
    } catch (error) {
      console.error('[VideoCallInvitations] Error rejecting call:', error);
      return { success: false, error: 'Failed to reject call' };
    }
  };

  const endCall = async (callId: string, reason: string = 'ended'): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[VideoCallInvitations] Ending call:', callId, reason);

      const { data, error } = await supabase.rpc('end_video_call', {
        p_call_id: callId,
        p_reason: reason
      });

      if (error) {
        console.error('[VideoCallInvitations] Error ending call:', error);
        return { success: false, error: error.message };
      }

      console.log('[VideoCallInvitations] Call ended:', data);
      return { success: true };
    } catch (error) {
      console.error('[VideoCallInvitations] Error ending call:', error);
      return { success: false, error: 'Failed to end call' };
    }
  };

  return {
    isConnected,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall
  };
}