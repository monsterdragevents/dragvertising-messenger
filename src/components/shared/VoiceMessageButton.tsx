import { Mic, Square, X } from 'lucide-react';
import { Button } from '@/lib/design-system';
import { useVoiceMessage } from '@/hooks/shared/useVoiceMessage';
import { cn } from '@/lib/utils';

interface VoiceMessageButtonProps {
  conversationId: string | null;
  universeId: string | null;
  className?: string;
}

export function VoiceMessageButton({ 
  conversationId, 
  universeId,
  className
}: VoiceMessageButtonProps) {
  const { 
    isRecording, 
    recordingTime, 
    startRecording, 
    stopRecording, 
    cancelRecording 
  } = useVoiceMessage(conversationId, universeId);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 bg-destructive/10 rounded-lg border border-destructive/20",
        className
      )}>
        <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
        <span className="text-sm font-medium text-destructive">{formatTime(recordingTime)}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={stopRecording}
          className="ml-auto h-8 px-2"
          title="Send voice message"
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelRecording}
          className="h-8 px-2"
          title="Cancel recording"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startRecording}
      title="Record voice message"
      className={className}
      disabled={!conversationId || !universeId}
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
