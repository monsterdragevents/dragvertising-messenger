/**
 * Video Call Dialog Component
 * Full-screen video call interface
 */

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from 'lucide-react';
import { useVideoCall } from '@/hooks/shared/useVideoCall';
import { toast } from '@/hooks/shared/use-toast';

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  remoteUserId: string;
  remoteUniverseId: string;
  remoteUserName: string;
  remoteUserAvatar?: string;
}

export function VideoCallDialog({
  open,
  onOpenChange,
  conversationId,
  remoteUserId,
  remoteUniverseId,
  remoteUserName,
  remoteUserAvatar
}: VideoCallDialogProps) {
  const [error, setError] = useState<string | null>(null);

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
    conversationId,
    remoteUserId,
    remoteUniverseId,
    onCallEnded: () => {
      // Close dialog when call ends (user explicitly ended it)
      onOpenChange(false);
    },
    onError: (errorMessage: string) => {
      setError(errorMessage);
      toast.error(errorMessage);
    }
  });

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
    if (open && callState === 'idle') {
      startCall();
    }
  }, [open, callState, startCall]);

  const handleEndCall = () => {
    endCall();
    onOpenChange(false);
  };

  const handleRejectCall = () => {
    rejectCall();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full w-full h-full p-0 bg-black border-none">
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
                  <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
                    {remoteUserAvatar ? (
                      <img src={remoteUserAvatar} alt={remoteUserName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-4xl">{remoteUserName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <p className="text-xl font-semibold">{remoteUserName}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {error ? (
                      <span className="text-red-400">{error}</span>
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
                  className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700"
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
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

