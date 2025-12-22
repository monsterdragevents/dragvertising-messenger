# Android Broadcaster Integration Guide

This document outlines how to integrate video calling and livestreaming functionality between the Dragvertising Messenger and the Android Broadcaster app.

---

## Overview

The Dragvertising Messenger supports two types of video communication:

1. **WebRTC Video Calls** (1-on-1 peer-to-peer)
   - Direct browser-to-browser video calls
   - Uses Supabase Realtime for signaling
   - No additional server infrastructure required
   - Works with Android app if it supports WebRTC

2. **Mux Livestreaming** (Group calls and broadcasting)
   - Uses existing Mux infrastructure
   - Better for group calls and livestreaming
   - Integrates with Android Broadcaster (already uses Mux)
   - Requires Mux service setup

---

## Architecture

### WebRTC Video Calls

```
┌─────────────────────┐         ┌─────────────────────┐
│  Web Messenger      │         │  Android Broadcaster│
│  (React/WebRTC)     │◄───────►│  (Kotlin/WebRTC)    │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │  WebRTC Signaling             │
           │  (Supabase Realtime)          │
           │                               │
           └───────────┬───────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Supabase        │
              │  Realtime        │
              │  (Signaling)     │
              └─────────────────┘
```

### Mux Livestreaming

```
┌─────────────────────┐         ┌─────────────────────┐
│  Web Messenger      │         │  Android Broadcaster│
│  (React)            │         │  (Kotlin)           │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │  RTMP Stream                  │
           │                               │
           └───────────┬───────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Mux Service    │
              │  (Livestreaming)│
              └─────────────────┘
```

---

## WebRTC Video Call Integration

### Messenger Implementation

The messenger uses WebRTC for 1-on-1 video calls:

**Files:**
- `src/hooks/shared/useVideoCallSignaling.ts` - Supabase Realtime signaling
- `src/hooks/shared/useVideoCall.ts` - WebRTC peer connection management
- `src/components/shared/VideoCallDialog.tsx` - Video call UI

**Signaling Channel:**
- Channel ID: `video-call:{conversationId}`
- Event: `video-call-signal`
- Message Types: `offer`, `answer`, `ice-candidate`, `call-request`, `call-accept`, `call-reject`, `call-end`

### Android Broadcaster Integration

To support WebRTC video calls in the Android Broadcaster app:

#### 1. Add WebRTC Dependencies

Add to `app/build.gradle`:

```gradle
dependencies {
    implementation 'org.webrtc:google-webrtc:1.0.32006'
    // Or use a more recent version
}
```

#### 2. Implement WebRTC Signaling

Create a signaling service that connects to Supabase Realtime:

```kotlin
import io.supabase.realtime.RealtimeChannel
import io.supabase.realtime.RealtimeClient

class VideoCallSignalingService(
    private val realtimeClient: RealtimeClient,
    private val conversationId: String
) {
    private var channel: RealtimeChannel? = null
    
    fun connect(onSignal: (VideoCallSignal) -> Unit) {
        channel = realtimeClient.channel("video-call:$conversationId")
        
        channel?.on("broadcast") { event ->
            if (event.event == "video-call-signal") {
                val signal = parseSignal(event.payload)
                onSignal(signal)
            }
        }
        
        channel?.subscribe()
    }
    
    suspend fun sendSignal(signal: VideoCallSignal) {
        channel?.send(
            type = "broadcast",
            event = "video-call-signal",
            payload = signal.toJson()
        )
    }
    
    fun disconnect() {
        channel?.unsubscribe()
        channel = null
    }
}
```

#### 3. Implement WebRTC Peer Connection

```kotlin
import org.webrtc.*

class VideoCallManager(
    private val signalingService: VideoCallSignalingService
) {
    private var peerConnection: PeerConnection? = null
    private var localVideoTrack: VideoTrack? = null
    private var remoteVideoTrack: VideoTrack? = null
    
    fun initializePeerConnection(
        localVideoView: SurfaceViewRenderer,
        remoteVideoView: SurfaceViewRenderer
    ) {
        val rtcConfig = PeerConnection.RTCConfiguration(
            listOf(
                PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
                PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
            )
        )
        
        peerConnection = peerConnectionFactory.createPeerConnection(
            rtcConfig,
            object : PeerConnection.Observer {
                override fun onIceCandidate(candidate: IceCandidate) {
                    signalingService.sendSignal(
                        VideoCallSignal(
                            type = "ice-candidate",
                            payload = candidate.toJson()
                        )
                    )
                }
                
                override fun onTrack(rtcTrackEvent: RtpTransceiver?) {
                    rtcTrackEvent?.receiver?.track()?.let { track ->
                        if (track is VideoTrack) {
                            remoteVideoTrack = track
                            track.addSink(remoteVideoView)
                        }
                    }
                }
                
                override fun onConnectionStateChange(state: PeerConnection.PeerConnectionState) {
                    when (state) {
                        PeerConnection.PeerConnectionState.CONNECTED -> {
                            // Call connected
                        }
                        PeerConnection.PeerConnectionState.DISCONNECTED,
                        PeerConnection.PeerConnectionState.FAILED -> {
                            // Call ended
                            cleanup()
                        }
                        else -> {}
                    }
                }
                
                // Implement other required methods...
            }
        )
    }
    
    suspend fun startCall() {
        // Get local media
        val mediaConstraints = MediaConstraints()
        val audioSource = peerConnectionFactory.createAudioSource(mediaConstraints)
        val videoSource = peerConnectionFactory.createVideoSource(false)
        
        localVideoTrack = peerConnectionFactory.createVideoTrack("video", videoSource)
        localVideoTrack?.addSink(localVideoView)
        
        // Add tracks to peer connection
        peerConnection?.addTrack(localVideoTrack)
        peerConnection?.addTrack(
            peerConnectionFactory.createAudioTrack("audio", audioSource)
        )
        
        // Create and send offer
        val offer = peerConnection?.createOffer(mediaConstraints)
        peerConnection?.setLocalDescription(offer)
        
        signalingService.sendSignal(
            VideoCallSignal(
                type = "call-request",
                payload = emptyMap()
            )
        )
        
        signalingService.sendSignal(
            VideoCallSignal(
                type = "offer",
                payload = offer?.toJson()
            )
        )
    }
    
    suspend fun handleOffer(offer: SessionDescription) {
        peerConnection?.setRemoteDescription(offer)
        
        val answer = peerConnection?.createAnswer(MediaConstraints())
        peerConnection?.setLocalDescription(answer)
        
        signalingService.sendSignal(
            VideoCallSignal(
                type = "answer",
                payload = answer?.toJson()
            )
        )
    }
    
    fun cleanup() {
        localVideoTrack?.dispose()
        remoteVideoTrack?.dispose()
        peerConnection?.close()
        peerConnection = null
    }
}
```

#### 4. Integrate with Messenger UI

Add video call button to conversation screen:

```kotlin
@Composable
fun ConversationScreen(
    conversationId: String,
    remoteUserId: String,
    remoteUniverseId: String
) {
    val videoCallManager = remember { VideoCallManager(signalingService) }
    var showVideoCall by remember { mutableStateOf(false) }
    
    // Video call button
    IconButton(onClick = { showVideoCall = true }) {
        Icon(Icons.Default.VideoCall, "Start video call")
    }
    
    if (showVideoCall) {
        VideoCallDialog(
            videoCallManager = videoCallManager,
            onDismiss = { showVideoCall = false }
        )
    }
}
```

---

## Mux Livestreaming Integration

### Messenger Implementation

For group video calls or livestreaming, use Mux:

**Files:**
- `src/services/shared/muxService.ts` - Mux API wrapper
- `src/services/shared/universeStreamingService.ts` - Universe-based streaming
- `src/components/shared/LiveStreamBroadcaster.tsx` - RTMP streaming component

### Android Broadcaster Integration

The Android Broadcaster already supports Mux livestreaming. To integrate with messenger:

#### 1. Share Stream Credentials

When a user starts a livestream from the messenger, share the stream credentials with the Android app:

```typescript
// In messenger
const stream = await universeStreamingService.getOrCreateStream(universeId);
// Share stream.rtmp_url and stream.stream_key with Android app
```

#### 2. Android App Receives Credentials

```kotlin
// In Android Broadcaster
class StreamManager {
    fun startStream(rtmpUrl: String, streamKey: String) {
        // Use existing RTMP streaming implementation
        rtmpClient.start(rtmpUrl, streamKey)
    }
}
```

#### 3. Messenger Watches Stream

```typescript
// In messenger
<MuxPlayer
  playbackId={stream.mux_playback_id}
  streamType="live"
/>
```

---

## Supabase Configuration

### Realtime Channels

Ensure Supabase Realtime is enabled for video call signaling:

```sql
-- Enable Realtime for video call channels
ALTER PUBLICATION supabase_realtime ADD TABLE _realtime.channels;
```

### RLS Policies

Video call signaling uses private channels, so RLS policies should allow:
- Users can only access channels for conversations they're part of
- Participants can send/receive signals in their conversation channels

---

## Testing

### WebRTC Video Calls

1. **Test between two web browsers:**
   - Open messenger in two different browsers
   - Start a conversation
   - Click video call button
   - Verify video/audio works

2. **Test between web and Android:**
   - Open messenger in browser
   - Open Android Broadcaster app
   - Start video call from messenger
   - Verify Android app receives call
   - Verify video/audio works

### Mux Livestreaming

1. **Test livestream from Android:**
   - Start stream from Android Broadcaster
   - Open messenger
   - Verify stream appears in conversation
   - Verify playback works

2. **Test livestream from Messenger:**
   - Start stream from messenger
   - Share credentials with Android app
   - Verify Android app can stream to same Mux stream

---

## Troubleshooting

### WebRTC Issues

**Problem:** Video call not connecting
- **Solution:** Check STUN server configuration
- **Solution:** Verify Supabase Realtime connection
- **Solution:** Check firewall/NAT settings

**Problem:** No audio/video
- **Solution:** Check browser permissions
- **Solution:** Verify media device access
- **Solution:** Check WebRTC track state

### Mux Issues

**Problem:** Stream not appearing
- **Solution:** Verify Mux credentials
- **Solution:** Check stream status in Mux dashboard
- **Solution:** Verify RTMP URL and stream key

**Problem:** Playback not working
- **Solution:** Check playback ID
- **Solution:** Verify stream is active
- **Solution:** Check Mux player configuration

---

## Future Enhancements

1. **Group Video Calls**
   - Use SFU (Selective Forwarding Unit) for multi-participant calls
   - Consider using services like Janus, Jitsi, or Twilio

2. **Screen Sharing**
   - Add screen share capability to WebRTC calls
   - Support screen sharing in Android app

3. **Recording**
   - Record video calls
   - Store recordings in Supabase Storage
   - Integrate with Mux for livestream recordings

4. **Push Notifications**
   - Send push notifications for incoming video calls
   - Use Firebase Cloud Messaging (FCM) for Android

---

## Resources

- [WebRTC Documentation](https://webrtc.org/)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Mux Documentation](https://docs.mux.com/)
- [Android WebRTC Guide](https://webrtc.org/getting-started/android-native-code-development-guide)

---

## Support

For issues or questions:
- Check the main Dragvertising app documentation
- Review Android Broadcaster repository README
- Contact the development team

---

© 2026 Dragvertising LLC. All rights reserved.

