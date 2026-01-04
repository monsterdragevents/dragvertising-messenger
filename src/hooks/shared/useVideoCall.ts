/**
 * Video Call Hook
 * Manages Twilio Video connections for 1-on-1 video calls
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import Video from 'twilio-video';
import { useUniverse } from './useUniverse';
import { getTwilioVideoToken } from '@/services/shared/twilioVideoService';
import { useAuth } from '@/contexts/AuthContext';

interface UseVideoCallProps {
  conversationId: string;
  remoteUserId: string;
  remoteUniverseId: string;
  onRemoteStream?: (stream: MediaStream) => void;
  onCallEnded?: () => void;
  onError?: (error: string) => void;
}

interface UseVideoCallResult {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCallActive: boolean;
  callState: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
  startCall: () => Promise<void>;
  endCall: () => void;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  toggleVideo: () => void;
  toggleAudio: () => void;
  videoEnabled: boolean;
  audioEnabled: boolean;
}

export function useVideoCall({
  conversationId,
  remoteUserId,
  remoteUniverseId,
  onRemoteStream,
  onCallEnded,
  onError
}: UseVideoCallProps): UseVideoCallResult {
  const { universe } = useUniverse();
  const { user } = useAuth();
  
  // Don't initialize if we don't have required data
  const shouldInitialize = Boolean(conversationId && remoteUserId && remoteUniverseId);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');

  // Reset to idle when we get valid data (in case we were in 'ended' state from previous session)
  useEffect(() => {
    if (shouldInitialize && callState === 'ended') {
      console.log('[VideoCall] Resetting call state to idle for new call');
      setCallState('idle');
    }
  }, [shouldInitialize, callState]);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const roomRef = useRef<Video.Room | null>(null);
  const localTrackRefs = useRef<Video.LocalVideoTrack[]>([]);
  const localAudioTrackRef = useRef<Video.LocalAudioTrack | null>(null);
  const isInitiatorRef = useRef(false);

  const cleanup = useCallback((shouldNotify = true) => {
    // Disconnect from room
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Stop and release local tracks
    localTrackRefs.current.forEach(track => {
      track.stop();
      track.detach();
    });
    localTrackRefs.current = [];

    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }

    // Stop local stream if it exists
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setIsCallActive(false);
    setCallState('ended');
    
    if (shouldNotify) {
      onCallEnded?.();
    }
  }, [localStream, onCallEnded]);

  const startCall = useCallback(async () => {
    // Re-check requirements inside the function to avoid stale closures
    const hasRequiredData = Boolean(conversationId && remoteUserId && remoteUniverseId);
    
    console.log('[VideoCall] startCall called', {
      hasUniverse: !!universe?.id,
      hasUser: !!user?.id,
      shouldInitialize,
      hasRequiredData,
      conversationId,
      remoteUserId,
      remoteUniverseId
    });

    if (!universe?.id || !user?.id || !hasRequiredData) {
      console.warn('[VideoCall] Cannot start call - missing requirements', {
        hasUniverse: !!universe?.id,
        hasUser: !!user?.id,
        hasRequiredData,
        conversationId: !!conversationId,
        remoteUserId: !!remoteUserId,
        remoteUniverseId: !!remoteUniverseId
      });
      return;
    }

    try {
      isInitiatorRef.current = true;
      setCallState('calling');
      console.log('[VideoCall] Getting Twilio access token...');

      // Get access token from Edge Function
      const { token, roomName } = await getTwilioVideoToken(
        conversationId,
        undefined, // Use default room name (conversation_${conversationId})
        user.id
      );

      // Create local video and audio tracks using Twilio Video
      const videoTrack = await Video.createLocalVideoTrack({
        name: 'camera',
      });
      const audioTrack = await Video.createLocalAudioTrack({
        name: 'microphone',
      });

      localTrackRefs.current = [videoTrack];
      localAudioTrackRef.current = audioTrack;

      // Create a MediaStream from Twilio tracks for local preview
      const localMediaStream = new MediaStream();
      localMediaStream.addTrack(videoTrack.mediaStreamTrack);
      localMediaStream.addTrack(audioTrack.mediaStreamTrack);
      setLocalStream(localMediaStream);

      // Connect to Twilio Video room
      const room = await Video.connect(token, {
        name: roomName,
        tracks: [videoTrack, audioTrack],
      });

      roomRef.current = room;

      // Handle remote participants
      room.on('participantConnected', (participant: Video.RemoteParticipant) => {
        console.log('[VideoCall] Participant connected:', participant.identity);
        setCallState('connected');
        setIsCallActive(true);

        // Get remote tracks
        participant.tracks.forEach((publication: Video.RemoteTrackPublication) => {
          if (publication.track) {
            attachRemoteTrack(publication.track);
          }
        });

        // Listen for new tracks
        participant.on('trackSubscribed', (track: Video.RemoteTrack) => {
          attachRemoteTrack(track);
        });
      });

      room.on('participantDisconnected', (participant: Video.RemoteParticipant) => {
        console.log('[VideoCall] Participant disconnected:', participant.identity);
        cleanup();
      });

      room.on('disconnected', () => {
        console.log('[VideoCall] Room disconnected');
        cleanup();
      });

      // Handle connection errors
      room.on('reconnecting', () => {
        console.log('[VideoCall] Reconnecting...');
      });

      room.on('reconnected', () => {
        console.log('[VideoCall] Reconnected');
      });

      // If we're the first participant, wait for others
      if (room.participants.size === 0) {
        setCallState('calling'); // Waiting for other participant
      } else {
        // Other participant already in room
        room.participants.forEach((participant: Video.RemoteParticipant) => {
          participant.tracks.forEach((publication: Video.RemoteTrackPublication) => {
            if (publication.track) {
              attachRemoteTrack(publication.track);
            }
          });
        });
        setCallState('connected');
        setIsCallActive(true);
      }

    } catch (error: any) {
      console.error('[VideoCall] Error starting call:', error);
      let errorMessage = 'Failed to start video call';
      
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        errorMessage = 'Camera and microphone access is required for video calls. Please allow access and try again.';
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device and try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      onError?.(errorMessage);
      cleanup(false);
      setCallState('idle');
    }
  }, [universe?.id, user?.id, conversationId, remoteUserId, remoteUniverseId, onRemoteStream, cleanup, onError]);

  const attachRemoteTrack = useCallback((track: Video.RemoteTrack) => {
    if (track.kind === 'video' || track.kind === 'audio') {
      setRemoteStream(prev => {
        const mediaStream = prev || new MediaStream();
        // Add the track if it's not already in the stream
        const existingTrack = mediaStream.getTracks().find(
          t => t.id === track.mediaStreamTrack.id
        );
        if (!existingTrack) {
          mediaStream.addTrack(track.mediaStreamTrack);
        }
        onRemoteStream?.(mediaStream);
        return mediaStream;
      });
    }
  }, [onRemoteStream]);

  const acceptCall = useCallback(async () => {
    // With Twilio Video, accepting is the same as starting (joining the room)
    if (callState === 'ringing' && !isInitiatorRef.current) {
      await startCall();
    }
  }, [callState, startCall]);

  const rejectCall = useCallback(() => {
    cleanup();
    setCallState('idle');
  }, [cleanup]);

  const endCall = useCallback(() => {
    cleanup();
    setCallState('idle');
  }, [cleanup]);

  const toggleVideo = useCallback(() => {
    if (localTrackRefs.current.length > 0) {
      const videoTrack = localTrackRefs.current[0];
      if (videoTrack) {
        videoTrack.enable(!videoEnabled);
        setVideoEnabled(!videoEnabled);
      }
    } else if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream, videoEnabled]);

  const toggleAudio = useCallback(() => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.enable(!audioEnabled);
      setAudioEnabled(!audioEnabled);
    } else if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream, audioEnabled]);

  // Only cleanup on unmount if we actually initialized
  useEffect(() => {
    // Only cleanup if we have an active room or tracks
    return () => {
      if (roomRef.current || localTrackRefs.current.length > 0 || localAudioTrackRef.current) {
        cleanup();
      }
    };
  }, [cleanup]);

  return {
    localStream,
    remoteStream,
    isCallActive,
    callState,
    startCall,
    endCall,
    acceptCall,
    rejectCall,
    toggleVideo,
    toggleAudio,
    videoEnabled,
    audioEnabled
  };
}
