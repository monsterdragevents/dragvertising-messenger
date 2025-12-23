import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/shared/use-toast';

export function useVoiceMessage(conversationId: string | null, universeId: string | null) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    if (!conversationId || !universeId) {
      toast.error('Cannot record: Missing conversation or universe');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Check for MediaRecorder support
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        // Fallback to default
        console.warn('WebM Opus not supported, using default codec');
      }

      const options: MediaRecorderOptions = {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      };

      const recorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
          });
          
          if (audioBlob.size === 0) {
            toast.error('Recording failed: No audio data captured');
            return;
          }
          
          // Upload to Supabase Storage
          const fileName = `voice-${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
          const filePath = `${universeId}/${conversationId}/${fileName}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('message-attachments')
            .upload(filePath, audioBlob, {
              contentType: 'audio/webm',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            toast.error('Failed to upload voice message');
            return;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(filePath);

          // Create message with voice attachment
          const { error: messageError } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_profile_universe_id: universeId,
            content: '🎤 Voice message',
            message_type: 'voice',
            attachments: [{
              type: 'audio',
              url: publicUrl,
              duration: recordingTime,
              filename: fileName,
              size: audioBlob.size
            }]
          });

          if (messageError) {
            console.error('Message creation error:', messageError);
            toast.error('Failed to send voice message');
          } else {
            toast.success('Voice message sent');
          }

          // Cleanup
          stream.getTracks().forEach(track => track.stop());
          setRecordingTime(0);
        } catch (error) {
          console.error('Error processing recording:', error);
          toast.error('Failed to process voice message');
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast.error('Recording error occurred');
        stopRecording();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please enable microphone permissions.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else {
        toast.error('Failed to start recording. Please try again.');
      }
    }
  }, [conversationId, universeId, recordingTime]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    audioChunksRef.current = [];
    setRecordingTime(0);
    toast.info('Recording cancelled');
  }, [stopRecording]);

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording
  };
}
