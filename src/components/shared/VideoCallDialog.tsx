/**
 * Video Call Dialog Component
 * Full-screen video call interface with invitation flow
 */

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from '@/lib/design-system';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from 'lucide-react';
import { useVideoCall } from '@/hooks/shared/useVideoCall';
import { useVideoCallInvitations, type VideoCall } from '@/hooks/shared/useVideoCallInvitations';
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
  incomingCall?: VideoCall;
}

export function VideoCallDialog({
  isOpen,
  onClose,
  conversationId,
  otherParticipant,
  incomingCall
}: VideoCallDialogProps) {
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [isLoadingUserId, setIsLoadingUserId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isInitiating, setIsInitiating] = useState(false);

  const remoteUniverseId = otherParticipant?.profile_universe_id || '';
  const remoteUserName = otherParticipant?.profile_universe?.display_name || 
                        otherParticipant?.profile_universe?.handle || 
                        'Unknown User';
  const remoteUserAvatar = otherParticipant?.profile_universe?.avatar_url;

  const { acceptCall: acceptInvitation, rejectCall: rejectInvitation, endCall: endVideoCall, initiateCall } = useVideoCallInvitations({
    onIncomingCall: (call) => {
      setCallId(call.id);
    },
    onCallStatusChange: (call) => {
      if (call.status === 'accepted' && call.id === callId) {
        startCall();
      }
    }
  });

  const {
    localStream,
    remoteStream,
    callState,
    startCall,
    endCall,
    toggleVideo,
    toggleAudio,
    videoEnabled,
    audioEnabled
  } = useVideoCall({
    conversationId: (isOpen && conversationId) ? conversationId : '',
    remoteUserId: (isOpen && remoteUserId) ? remoteUserId : '',
    remoteUniverseId: (isOpen && remoteUniverseId) ? remoteUniverseId : '',
    onCallEnded: () => {
      endVideoCall(callId || '');
      onClose();
    },
    onError: (errorMessage: string) => {
      setError(errorMessage);
      toast.error(errorMessage);
    }
  });

  useEffect(() => {
    if (!isOpen || !remoteUniverseId || remoteUserId) return;

    const fetchUserId = async () => {
      setIsLoadingUserId(true);
      try {
        const { data, error } = await supabase
          .from('profile_universes')
          .select('user_id')
          .eq('id', remoteUniverseId)
          .single();

        if (data?.user_id) {
          setRemoteUserId(data.user_id);
        } else if (error) {
          setError('Could not find user. Please try again.');
        }
      } catch (error) {
        setError('Failed to start video call. Please try again.');
      } finally {
        setIsLoadingUserId(false);
      }
    };

    fetchUserId();
  }, [isOpen, remoteUniverseId, remoteUserId]);

  useEffect(() => {
    if (incomingCall) {
      setCallId(incomingCall.id);
    }
  }, [incomingCall]);

  const handleStartCall = async () => {
    if (!remoteUserId || isInitiating) return;

    setIsInitiating(true);
    const result = await initiateCall(conversationId, remoteUserId, remoteUniverseId);
    
    if (result.success) {
      setCallId(result.callId || null);
    } else {
      setError(result.error || 'Failed to start call');
    }
    setIsInitiating(false);
  };

  const handleAcceptCall = async () => {
    if (!callId) return;
    
    const result = await acceptInvitation(callId);
    if (!result.success) {
      setError(result.error || 'Failed to accept call');
    }
  };

  const handleRejectCall = async () => {
    if (!callId) return;
    
    const result = await rejectInvitation(callId);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Failed to reject call');
    }
  };

  const handleEndCall = () => {
    if (callId) {
      endVideoCall(callId);
    }
    endCall();
    onClose();
  };

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

  if (!isOpen) {
    return null;
  }

  if (!remoteUniverseId) {
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

  const isOutgoingCall = !incomingCall;
  const showCallControls = callState === 'connected' || (isOutgoingCall && callState === 'idle');
  const showIncomingControls = incomingCall && callState === 'idle';
  const showCallingState = isOutgoingCall && callState === 'idle' && !showCallControls;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleEndCall();
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
                    ) : showCallingState ? (
                      'Calling...'
                    ) : showIncomingControls ? (
                      'Incoming call...'
                    ) : showCallControls ? (
                      'Connected'
                    ) : (
                      'Starting call...'
                    )}
                  </p>
                  {error && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setError(null);
                        if (isOutgoingCall) {
                          handleStartCall();
                        } else {
                          handleAcceptCall();
                        }
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
            {showIncomingControls && (
              <>
                <Button
                  variant="default"
                  size="icon"
                  className="h-14 w-14 rounded-full bg-dv-green-600 hover:bg-dv-green-700"
                  onClick={handleAcceptCall}
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
            )}

            {(showCallControls || showCallingState) && (
              <>
                {/* Start Call Button for outgoing calls */}
                {isOutgoingCall && callState === 'idle' && !callId && (
                  <Button
                    variant="default"
                    size="icon"
                    className="h-14 w-14 rounded-full bg-dv-green-600 hover:bg-dv-green-700"
                    onClick={handleStartCall}
                    disabled={isInitiating}
                  >
                    <Phone className="h-7 w-7" />
                  </Button>
                )}

                {/* Video/Audio Controls */}
                {callId && (
                  <>
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
                  </>
                )}

                {/* End Call */}
                {callId && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-14 w-14 rounded-full"
                    onClick={handleEndCall}
                  >
                    <PhoneOff className="h-7 w-7" />
                  </Button>
                )}
              </>
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