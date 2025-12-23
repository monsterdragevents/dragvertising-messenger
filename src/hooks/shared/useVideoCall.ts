/**
 * Video Call Hook
 * Manages WebRTC peer connections for 1-on-1 video calls
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useVideoCallSignaling } from './useVideoCallSignaling';
import { useUniverse } from './useUniverse';

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

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export function useVideoCall({
  conversationId,
  remoteUserId,
  remoteUniverseId,
  onRemoteStream,
  onCallEnded,
  onError
}: UseVideoCallProps): UseVideoCallResult {
  const { universe } = useUniverse();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sendSignalRef = useRef<((type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accept' | 'call-reject' | 'call-end', targetUserId: string, targetUniverseId: string, payload: any, senderUniverseId: string) => Promise<void>) | null>(null);
  const isInitiatorRef = useRef(false);

  const cleanup = useCallback((shouldNotify = true) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
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

  const handleCallRequest = useCallback(async (senderId: string) => {
    if (senderId !== remoteUserId) return;
    setCallState('ringing');
  }, [remoteUserId]);

  const handleCallAccept = useCallback(async (senderId: string) => {
    if (senderId !== remoteUserId) return;
    if (isInitiatorRef.current && peerConnectionRef.current) {
      setCallState('connected');
      setIsCallActive(true);
    }
  }, [remoteUserId]);

  const handleCallReject = useCallback((senderId: string) => {
    if (senderId !== remoteUserId) return;
    cleanup();
    setCallState('idle');
  }, [remoteUserId, cleanup]);

  const handleCallEnd = useCallback((_senderId: string) => {
    cleanup();
    setCallState('idle');
  }, [cleanup]);

  const handleOffer = useCallback(async (senderId: string, offer: RTCSessionDescriptionInit) => {
    if (senderId !== remoteUserId || !universe?.id) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          setRemoteStream(stream);
          onRemoteStream?.(stream);
          setCallState('connected');
          setIsCallActive(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && sendSignalRef.current) {
          sendSignalRef.current('ice-candidate', remoteUserId, remoteUniverseId, event.candidate, universe.id);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          cleanup();
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      peerConnectionRef.current = pc;

      if (sendSignalRef.current) {
        await sendSignalRef.current('answer', remoteUserId, remoteUniverseId, answer, universe.id);
        await sendSignalRef.current('call-accept', remoteUserId, remoteUniverseId, {}, universe.id);
      }
    } catch (error) {
      console.error('[VideoCall] Error handling offer:', error);
      cleanup();
    }
  }, [remoteUserId, remoteUniverseId, universe?.id, onRemoteStream, cleanup]);

  const handleAnswer = useCallback(async (senderId: string, answer: RTCSessionDescriptionInit) => {
    if (senderId !== remoteUserId) return;
    const pc = peerConnectionRef.current;
    if (pc && pc.signalingState !== 'closed') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('connected');
      setIsCallActive(true);
    }
  }, [remoteUserId]);

  const handleIceCandidate = useCallback((senderId: string, candidate: RTCIceCandidateInit) => {
    if (senderId !== remoteUserId) return;
    const pc = peerConnectionRef.current;
    if (pc && pc.signalingState !== 'closed') {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, [remoteUserId]);

  const { sendSignal } = useVideoCallSignaling({
    conversationId,
    onOffer: handleOffer,
    onAnswer: handleAnswer,
    onIceCandidate: handleIceCandidate,
    onCallRequest: handleCallRequest,
    onCallAccept: handleCallAccept,
    onCallReject: handleCallReject,
    onCallEnd: handleCallEnd
  });

  useEffect(() => {
    sendSignalRef.current = sendSignal;
  }, [sendSignal]);

  const startCall = useCallback(async () => {
    if (!universe?.id) return;

    try {
      isInitiatorRef.current = true;
      setCallState('calling');

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          setRemoteStream(stream);
          onRemoteStream?.(stream);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && sendSignalRef.current) {
          sendSignalRef.current('ice-candidate', remoteUserId, remoteUniverseId, event.candidate, universe.id);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          cleanup();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      peerConnectionRef.current = pc;

      if (sendSignalRef.current) {
        await sendSignalRef.current('call-request', remoteUserId, remoteUniverseId, {}, universe.id);
        await sendSignalRef.current('offer', remoteUserId, remoteUniverseId, offer, universe.id);
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
      cleanup(false); // Don't notify on error
      setCallState('idle'); // Reset to idle so user can try again
    }
  }, [universe?.id, remoteUserId, remoteUniverseId, onRemoteStream, cleanup, onError]);

  const acceptCall = useCallback(async () => {
    if (callState === 'ringing' && sendSignalRef.current && universe?.id) {
      await sendSignalRef.current('call-accept', remoteUserId, remoteUniverseId, {}, universe.id);
    }
  }, [callState, remoteUserId, remoteUniverseId, universe?.id]);

  const rejectCall = useCallback(() => {
    if (sendSignalRef.current && universe?.id) {
      sendSignalRef.current('call-reject', remoteUserId, remoteUniverseId, {}, universe.id);
    }
    cleanup();
    setCallState('idle');
  }, [remoteUserId, remoteUniverseId, universe?.id, cleanup]);

  const endCall = useCallback(() => {
    if (sendSignalRef.current && universe?.id) {
      sendSignalRef.current('call-end', remoteUserId, remoteUniverseId, {}, universe.id);
    }
    cleanup();
    setCallState('idle');
  }, [remoteUserId, remoteUniverseId, universe?.id, cleanup]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  useEffect(() => {
    return () => cleanup();
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

