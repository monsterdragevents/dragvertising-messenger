/**
 * Ringtone utility for video calls
 * Plays a ringing sound for incoming/outgoing calls using Web Audio API
 */

let audioContext: AudioContext | null = null;
let ringtoneInterval: NodeJS.Timeout | null = null;
let isPlaying = false;

/**
 * Initialize audio context (required for Web Audio API)
 */
function getAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }
  
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioContext;
  } catch (error) {
    console.warn('[Ringtone] Could not create audio context:', error);
    return null;
  }
}

/**
 * Play ringing sound
 * Uses Web Audio API to generate a pleasant ringtone pattern
 */
export function playRingtone(): void {
  if (isPlaying) {
    return; // Already playing
  }
  
  stopRingtone(); // Ensure clean state
  
  const ctx = getAudioContext();
  if (!ctx) {
    console.warn('[Ringtone] Audio context not available');
    return;
  }
  
  // Resume audio context if suspended (required for user interaction)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      console.warn('[Ringtone] Could not resume audio context');
    });
  }
  
  isPlaying = true;
  let currentTime = ctx.currentTime;
  
  const playTone = (frequency: number, duration: number, startTime: number) => {
    try {
      const oscillator = ctx!.createOscillator();
      const gainNode = ctx!.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx!.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      // Fade in/out for smoother sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    } catch (error) {
      console.warn('[Ringtone] Error playing tone:', error);
    }
  };
  
  // Ring pattern: two tones (800Hz and 1000Hz) alternating
  const ringPattern = () => {
    if (!isPlaying || !ctx) return;
    
    playTone(800, 0.2, currentTime);
    playTone(1000, 0.2, currentTime + 0.3);
    currentTime += 0.6; // Total pattern duration
  };
  
  // Play the pattern immediately
  ringPattern();
  
  // Repeat the pattern every 600ms
  ringtoneInterval = setInterval(() => {
    if (!isPlaying || !ctx) {
      stopRingtone();
      return;
    }
    ringPattern();
  }, 600) as any;
}

/**
 * Stop ringing sound
 */
export function stopRingtone(): void {
  isPlaying = false;
  
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}
