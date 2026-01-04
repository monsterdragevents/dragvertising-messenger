/**
 * Ringtone utility for video calls
 * Plays a ringing sound for incoming/outgoing calls using Web Audio API
 * Handles browser autoplay restrictions by initializing on user interaction
 */

let audioContext: AudioContext | null = null;
let ringtoneInterval: NodeJS.Timeout | null = null;
let isPlaying = false;
let audioContextInitialized = false;

/**
 * Initialize audio context on user interaction
 * This must be called after a user interaction to bypass autoplay restrictions
 */
export function initializeAudioContext(): void {
  if (audioContextInitialized || audioContext) {
    return;
  }
  
  // Initialize on any user interaction
  const initContext = () => {
    if (audioContext) return;
    
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextInitialized = true;
      console.log('[Ringtone] Audio context initialized');
      
      // Remove listeners after initialization
      document.removeEventListener('click', initContext);
      document.removeEventListener('touchstart', initContext);
      document.removeEventListener('keydown', initContext);
    } catch (error) {
      console.warn('[Ringtone] Could not create audio context:', error);
    }
  };
  
  // Try to initialize immediately (might work if user has interacted)
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioContext.state === 'running') {
      audioContextInitialized = true;
      console.log('[Ringtone] Audio context initialized (already running)');
      return;
    }
  } catch (error) {
    // Will initialize on user interaction
  }
  
  // Set up listeners for user interaction
  document.addEventListener('click', initContext, { once: true });
  document.addEventListener('touchstart', initContext, { once: true });
  document.addEventListener('keydown', initContext, { once: true });
}

/**
 * Get or create audio context
 */
function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('[Ringtone] Could not create audio context:', error);
      return null;
    }
  }
  return audioContext;
}

/**
 * Play ringing sound
 * Uses Web Audio API to generate a pleasant ringtone pattern
 * Will attempt to resume suspended audio context
 * Falls back to trying multiple times if context is suspended
 */
export function playRingtone(): void {
  if (isPlaying) {
    console.log('[Ringtone] Already playing, skipping');
    return; // Already playing
  }
  
  stopRingtone(); // Ensure clean state
  
  console.log('[Ringtone] Attempting to play ringtone');
  
  const ctx = getAudioContext();
  if (!ctx) {
    console.warn('[Ringtone] Audio context not available - initializing on next user interaction');
    initializeAudioContext();
    // Try again after a short delay
    setTimeout(() => {
      if (!isPlaying) {
        console.log('[Ringtone] Retrying after initialization');
        playRingtone();
      }
    }, 200);
    return;
  }
  
  console.log('[Ringtone] Audio context state:', ctx.state);
  
  // Resume audio context if suspended (required for user interaction)
  const resumeContext = async () => {
    if (ctx.state === 'suspended') {
      console.log('[Ringtone] Attempting to resume suspended audio context');
      try {
        await ctx.resume();
        console.log('[Ringtone] Audio context resumed successfully, state:', ctx.state);
        return ctx.state === 'running';
      } catch (error) {
        console.warn('[Ringtone] Could not resume audio context:', error);
        // Try to initialize on next user interaction
        initializeAudioContext();
        return false;
      }
    }
    return ctx.state === 'running';
  };
  
  resumeContext().then((canPlay) => {
    if (!canPlay) {
      console.warn('[Ringtone] Cannot play - audio context not running. State:', ctx?.state);
      // Try again after a delay - sometimes it takes a moment
      setTimeout(() => {
        if (!isPlaying && ctx && ctx.state === 'running') {
          console.log('[Ringtone] Retrying after delay');
          playRingtone();
        }
      }, 300);
      return;
    }
    
    console.log('[Ringtone] Starting ringtone playback');
    isPlaying = true;
    let currentTime = ctx.currentTime;
    
    const playTone = (frequency: number, duration: number, startTime: number) => {
      try {
        if (!isPlaying || !ctx || ctx.state === 'closed') return;
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        // Fade in/out for smoother sound
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.05); // Slightly louder
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      } catch (error) {
        console.warn('[Ringtone] Error playing tone:', error);
      }
    };
    
    // Ring pattern: two tones (800Hz and 1000Hz) alternating
    const ringPattern = () => {
      if (!isPlaying || !ctx || ctx.state === 'closed') {
        stopRingtone();
        return;
      }
      
      playTone(800, 0.2, currentTime);
      playTone(1000, 0.2, currentTime + 0.3);
      currentTime += 0.6; // Total pattern duration
    };
    
    // Play the pattern immediately
    ringPattern();
    
    // Repeat the pattern every 600ms
    ringtoneInterval = setInterval(() => {
      if (!isPlaying || !ctx || ctx.state === 'closed') {
        stopRingtone();
        return;
      }
      ringPattern();
    }, 600) as any;
  });
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
