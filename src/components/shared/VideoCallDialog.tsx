/**
 * Video Call Dialog Component
 * Full-screen video call interface
 */

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from '@/lib/design-system';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from 'lucide-react';
import { useVideoCall } from '@/hooks/shared/useVideoCall';
import { toast } from '@/hooks/shared/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProfileUniverse {
  id: string;
  handle?: string;
  display_name?: string;
  avatar_url?: string;
  user_id?: string;
}

interface VideoCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  otherParticipant?: {
    profile_universe_id: string;
    profile_universe?: ProfileUniverse;
  };
}

export function VideoCallDialog({
  isOpen,
  onClose,
  conversationId,
  otherParticipant
}: VideoCallDialogProps) {
  // All state declarations first
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [isLoadingUserId, setIsLoadingUserId] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract participant data
  const remoteUniverseId = otherParticipant?.profile_universe_id || '';
  const remoteUserName = otherParticipant?.profile_universe?.display_name || 
                        otherParticipant?.profile_universe?.handle || 
                        'Unknown User';
  const remoteUserAvatar = otherParticipant?.profile_universe?.avatar_url;

  // Fetch user_id from profile_universe if not available
  useEffect(() => {
    if (!isOpen || !remoteUniverseId || remoteUserId) return;

    const fetchUserId = async () => {
      setIsLoadingUserId(true);
      try {
        console.log('[VideoCallDialog] Fetching user_id for remoteUniverseId:', remoteUniverseId);
        const { data, error } = await supabase
          .from('profile_universes')
          .select('user_id')
          .eq('id', remoteUniverseId)
          .single();

        if (data?.user_id) {
          console.log('[VideoCallDialog] Found user_id:', data.user_id);
          setRemoteUserId(data.user_id);
        } else if (error) {
          console.error('[VideoCallDialog] Error fetching user_id:', error);
          setError('Could not find user. Please try again.');
          // Don't close dialog on error - let user see the error and retry
        }
      } catch (error) {
        console.error('[VideoCallDialog] Error fetching user_id:', error);
        setError('Failed to start video call. Please try again.');
        // Don't close dialog on error
      } finally {
        setIsLoadingUserId(false);
      }
    };

    fetchUserId();
  }, [isOpen, remoteUniverseId, remoteUserId]);

  // Only initialize video call hook when dialog is open and we have required data
  // Always call the hook, but pass empty strings when dialog is closed to prevent initialization
  const {
    localStream,
    remoteStream,
    callState,
    startCall,
    endCall,
    acceptCall,
    rejectCall,
    toggleVideo,
    toggleAudio,
    videoEnabled,
    audioEnabled
  } = useVideoCall({
    conversationId: (isOpen && conversationId) ? conversationId : '',
    remoteUserId: (isOpen && remoteUserId) ? remoteUserId : '',
    remoteUniverseId: (isOpen && remoteUniverseId) ? remoteUniverseId : '',
    onCallEnded: () => {
      // Close dialog when call ends (user explicitly ended it)
      onClose();
    },
    onError: (errorMessage: string) => {
      setError(errorMessage);
      toast.error(errorMessage);
    }
  });

  // All hooks that use callState must be after useVideoCall
  // Log for debugging
  useEffect(() => {
    if (isOpen) {
      console.log('[VideoCallDialog] Dialog opened', {
        conversationId,
        remoteUniverseId,
        otherParticipant,
        hasRemoteUniverseId: !!remoteUniverseId,
        hasRemoteUserId: !!remoteUserId,
        callState
      });
    }
  }, [isOpen, conversationId, remoteUniverseId, otherParticipant, remoteUserId, callState]);

  // Log when hook values change
  useEffect(() => {
    console.log('[VideoCallDialog] useVideoCall hook values', {
      callState,
      hasLocalStream: !!localStream,
      hasRemoteStream: !!remoteStream,
      videoEnabled,
      audioEnabled
    });
  }, [callState, localStream, remoteStream, videoEnabled, audioEnabled]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    console.log('[VideoCallDialog] useEffect check', {
      isOpen,
      callState,
      remoteUserId,
      isLoadingUserId,
      conversationId,
      remoteUniverseId,
      shouldStart: isOpen && callState === 'idle' && remoteUserId && !isLoadingUserId
    });

    if (isOpen && callState === 'idle' && remoteUserId && !isLoadingUserId) {
      console.log('[VideoCallDialog] Starting video call', {
        conversationId,
        remoteUserId,
        remoteUniverseId,
        callState
      });
      startCall().catch((error) => {
        console.error('[VideoCallDialog] Error starting call:', error);
        setError(error.message || 'Failed to start video call');
      });
    }
  }, [isOpen, callState, startCall, remoteUserId, isLoadingUserId, conversationId, remoteUniverseId]);

  // Trigger startCall when all conditions are met
  // This is a separate effect to ensure it runs when remoteUserId becomes available
  useEffect(() => {
    const shouldStart = isOpen && 
                       callState === 'idle' && 
                       remoteUserId && 
                       !isLoadingUserId &&
                       conversationId &&
                       remoteUniverseId;
    
    console.log('[VideoCallDialog] Start call trigger check', {
      isOpen,
      callState,
      remoteUserId: !!remoteUserId,
      isLoadingUserId,
      conversationId: !!conversationId,
      remoteUniverseId: !!remoteUniverseId,
      shouldStart
    });

    if (shouldStart) {
      console.log('[VideoCallDialog] All conditions met, starting call');
      const timer = setTimeout(() => {
        startCall().catch((error) => {
          console.error('[VideoCallDialog] Error starting call:', error);
          setError(error.message || 'Failed to start video call');
        });
      }, 200); // Small delay to ensure everything is ready
      return () => clearTimeout(timer);
    }
  }, [isOpen, callState, remoteUserId, isLoadingUserId, conversationId, remoteUniverseId, startCall]);

  const handleEndCall = () => {
    endCall();
    onClose();
  };

  const handleRejectCall = () => {
    rejectCall();
    onClose();
  };

  // Show error if we don't have participant data (check after all hooks)
  if (!isOpen) {
    return null;
  }

  if (!remoteUniverseId) {
    console.warn('[VideoCallDialog] Missing remoteUniverseId, cannot start call', {
      otherParticipant,
      conversationId
    });
    return (
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogTitle>Video Call</DialogTitle>
          <DialogDescription>Unable to start video call</DialogDescription>
          <div className="text-center p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Unable to start video call: Participant information not available.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isLoadingUserId || !remoteUserId) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
        <DialogContent className="max-w-full w-full h-full p-0 bg-black border-none" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">Video Call - Loading</DialogTitle>
          <DialogDescription className="sr-only">Loading video call connection</DialogDescription>
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white">
              <p>Loading...</p>
              {error && (
                <div className="mt-4">
                  <p className="text-sm text-red-400 mb-2">{error}</p>
                  <Button onClick={onClose} variant="outline">Cancel</Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Only allow closing if user explicitly closes (not on errors)
      if (!open) {
        console.log('[VideoCallDialog] Dialog closing, ending call');
        endCall();
        onClose();
      }
    }}>
      <DialogContent className="max-w-full w-full h-full p-0 bg-black border-none" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Video Call with {remoteUserName}</DialogTitle>
        <DialogDescription className="sr-only">Video call in progress</DialogDescription>
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Remote Video (Main) */}
          <div className="absolute inset-0 w-full h-full">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                muted={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <div className="text-center text-white">
                  <div className="w-32 h-32 rounded-full bg-dv-gray-700 flex items-center justify-center mx-auto mb-4">
                    {remoteUserAvatar ? (
                      <img src={remoteUserAvatar} alt={remoteUserName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-4xl">{remoteUserName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <p className="text-xl font-semibold">{remoteUserName}</p>
                  <p className="text-sm text-dv-gray-400 mt-2">
                    {error ? (
                      <span className="text-dv-red-400">{error}</span>
                    ) : (
                      <>
                        {callState === 'calling' && 'Calling...'}
                        {callState === 'ringing' && 'Incoming call...'}
                        {callState === 'connected' && 'Connected'}
                        {callState === 'idle' && !error && 'Starting call...'}
                      </>
                    )}
                  </p>
                  {error && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setError(null);
                        startCall().catch((err) => {
                          console.error('[VideoCallDialog] Error retrying call:', err);
                        });
                      }}
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Local Video (Picture-in-Picture) */}
          {localStream && (
            <div className="absolute bottom-20 right-4 w-48 h-36 rounded-lg overflow-hidden bg-black border-2 border-white shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Call Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
            {/* Video Toggle */}
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={toggleVideo}
            >
              {videoEnabled ? (
                <Video className="h-6 w-6" />
              ) : (
                <VideoOff className="h-6 w-6" />
              )}
            </Button>

            {/* Audio Toggle */}
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={toggleAudio}
            >
              {audioEnabled ? (
                <Mic className="h-6 w-6" />
              ) : (
                <MicOff className="h-6 w-6" />
              )}
            </Button>

            {/* Accept/Reject/End Call */}
            {callState === 'ringing' ? (
              <>
                <Button
                  variant="default"
                  size="icon"
                  className="h-14 w-14 rounded-full bg-dv-green-600 hover:bg-dv-green-700"
                  onClick={acceptCall}
                >
                  <Phone className="h-7 w-7" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-14 w-14 rounded-full"
                  onClick={handleRejectCall}
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={handleEndCall}
              >
                <PhoneOff className="h-7 w-7" />
              </Button>
            )}
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

