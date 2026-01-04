/**
 * Video Call Signaling Hook
 * Handles WebRTC signaling for video calls via Supabase Realtime
 */

import { useEffect, useRef, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface VideoCallSignal {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accept' | 'call-reject' | 'call-end';
  sender_id: string;
  sender_universe_id: string;
  target_id: string;
  target_universe_id: string;
  payload: any;
}

interface UseVideoCallSignalingProps {
  conversationId: string;
  onOffer?: (senderId: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (senderId: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (senderId: string, candidate: RTCIceCandidateInit) => void;
  onCallRequest?: (senderId: string, senderUniverseId: string, payload: any) => void;
  onCallAccept?: (senderId: string) => void;
  onCallReject?: (senderId: string) => void;
  onCallEnd?: (senderId: string) => void;
}

export function useVideoCallSignaling({
  conversationId,
  onOffer,
  onAnswer,
  onIceCandidate,
  onCallRequest,
  onCallAccept,
  onCallReject,
  onCallEnd
}: UseVideoCallSignalingProps) {
  const { user, session } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only subscribe if we have a valid conversationId (not empty string)
    if (!conversationId || conversationId === '' || !user) return;

    const setupChannel = async () => {
      // Set Realtime auth token
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      } else {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.access_token) {
          supabase.realtime.setAuth(currentSession.access_token);
        }
      }

      const channelId = `video-call:${conversationId}`;
      const channel = supabase.channel(channelId, {
        config: {
          private: true,
          broadcast: { self: true }
        }
      });

      channel
        .on('broadcast', { event: 'video-call-signal' }, ({ payload }: { payload: VideoCallSignal }) => {
          // Ignore messages sent by self
          if (payload.sender_id === user.id) return;

          // Ignore messages not targeted to me
          if (payload.target_id !== user.id) return;

          console.log('[VideoCallSignaling] Received signal:', payload.type, payload.sender_id);

          switch (payload.type) {
            case 'offer':
              onOffer?.(payload.sender_id, payload.payload);
              break;
            case 'answer':
              onAnswer?.(payload.sender_id, payload.payload);
              break;
            case 'ice-candidate':
              onIceCandidate?.(payload.sender_id, payload.payload);
              break;
            case 'call-request':
              onCallRequest?.(payload.sender_id, payload.sender_universe_id, payload.payload);
              break;
            case 'call-accept':
              onCallAccept?.(payload.sender_id);
              break;
            case 'call-reject':
              onCallReject?.(payload.sender_id);
              break;
            case 'call-end':
              onCallEnd?.(payload.sender_id);
              break;
          }
        })
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
          if (status === 'SUBSCRIBED') {
            console.log('[VideoCallSignaling] Connected to video call channel');
          } else if (status === 'CHANNEL_ERROR') {
            // Only log error if we actually tried to subscribe (not just cleanup)
            if (channelRef.current === channel) {
              console.error('[VideoCallSignaling] Channel subscription error');
            }
          }
        });

      channelRef.current = channel;
    };

    setupChannel();

    return () => {
      console.log('[VideoCallSignaling] Leaving video call channel');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [conversationId, user?.id, session?.access_token, onOffer, onAnswer, onIceCandidate, onCallRequest, onCallAccept, onCallReject, onCallEnd]);

  const sendSignal = async (
    type: VideoCallSignal['type'],
    targetUserId: string,
    targetUniverseId: string,
    payload: any,
    senderUniverseId: string
  ) => {
    if (!channelRef.current || !user) {
      console.warn('[VideoCallSignaling] Cannot send signal: disconnected');
      return;
    }

    const message: VideoCallSignal = {
      type,
      sender_id: user.id,
      sender_universe_id: senderUniverseId,
      target_id: targetUserId,
      target_universe_id: targetUniverseId,
      payload
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'video-call-signal',
      payload: message
    });
  };

  return {
    isConnected,
    sendSignal
  };
}
