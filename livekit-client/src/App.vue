<template>
  <div class="app">
    <h1>🎥 LiveKit Video Streaming</h1>
    
    <!-- Join Room Form -->
    <div v-if="!isConnected" class="join-form">
      <h2>Join a Room</h2>
      <div class="form-group">
        <label>Room Name:</label>
        <input 
          v-model="roomName" 
          type="text" 
          placeholder="Enter room name"
          @keyup.enter="joinRoom"
        />
      </div>
      <div class="form-group">
        <label>Your Name:</label>
        <input 
          v-model="participantName" 
          type="text" 
          placeholder="Enter your name"
          @keyup.enter="joinRoom"
        />
      </div>
      <button 
        @click="joinRoom" 
        :disabled="!roomName || !participantName || isConnecting"
      >
        {{ isConnecting ? 'Connecting...' : 'Join Room' }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <!-- Video Room -->
    <div v-else class="video-room">
      <div class="room-header">
        <h2>Room: {{ roomName }}</h2>
        <button @click="leaveRoom" class="leave-btn">Leave Room</button>
      </div>
      
      <div class="participants-info">
        <p>👥 {{ participantCount }} participant(s)</p>
        <p v-if="isAgentConnected" class="agent-status">🤖 Transcription agent active</p>
      </div>

      <div id="video-container" class="video-grid"></div>

      <div class="controls">
        <button @click="toggleAudio">
          {{ isAudioEnabled ? '🎤 Mute' : '🔇 Unmute' }}
        </button>
        <button @click="toggleVideo">
          {{ isVideoEnabled ? '📹 Camera Off' : '📷 Camera On' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { Room, RoomEvent, LocalTrack, RemoteTrack, Track } from 'livekit-client'

const roomName = ref('')
const participantName = ref('')
const isConnected = ref(false)
const isConnecting = ref(false)
const error = ref('')
const participantCount = ref(0)
const isAudioEnabled = ref(true)
const isVideoEnabled = ref(true)
const isAgentConnected = ref(false)

let room: Room | null = null

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

async function joinRoom() {
  if (!roomName.value || !participantName.value) return

  console.log('🚀 [JOIN] Attempting to join room:', roomName.value, 'as', participantName.value)
  
  isConnecting.value = true
  error.value = ''

  try {
    // Get token from backend
    console.log('🔑 [TOKEN] Requesting token from backend:', BACKEND_URL)
    const response = await fetch(`${BACKEND_URL}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: roomName.value,
        participantName: participantName.value
      })
    })

    if (!response.ok) {
      throw new Error('Failed to get access token')
    }

    const { token, url } = await response.json()
    console.log('✅ [TOKEN] Token received, connecting to:', url)

    // Create and connect to room
    room = new Room()

    // Store tracks that arrive before DOM is ready
    const pendingTracks: Array<{track: LocalTrack | RemoteTrack, identity: string}> = []
    let isDomReady = false

    // Event listeners
    room.on(RoomEvent.Connected, () => {
      console.log('✅ [ROOM] Connected to room successfully')
    })

    room.on(RoomEvent.Disconnected, () => {
      console.log('❌ [ROOM] Disconnected from room')
    })

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('👤 [PARTICIPANT] User joined:', participant.identity)
      
      // Check if it's the transcription agent
      if (participant.identity === 'transcription-agent') {
        console.log('🤖 [AGENT] Transcription agent connected')
        isAgentConnected.value = true
      }
      
      updateParticipantCount()
    })

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('👋 [PARTICIPANT] User left:', participant.identity)
      
      // Check if agent disconnected
      if (participant.identity === 'transcription-agent') {
        console.log('🤖 [AGENT] Transcription agent disconnected')
        isAgentConnected.value = false
      }
      
      // Remove participant's video wrapper from DOM
      const container = document.getElementById('video-container')
      if (container) {
        const wrapper = container.querySelector(`[data-participant="${participant.identity}"]`) as HTMLElement
        if (wrapper) {
          console.log('🗑️ [CLEANUP] Removing video for:', participant.identity)
          wrapper.remove()
        }
      }
      
      updateParticipantCount()
    })

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('📥 [TRACK] Subscribed to track:', track.kind, 'from', participant.identity)
      
      // If DOM not ready, queue the track
      if (!isDomReady) {
        console.log('⏳ [TRACK] Queueing track until DOM ready:', track.kind, 'from', participant.identity)
        pendingTracks.push({ track, identity: participant.identity })
      } else {
        attachTrack(track, participant.identity)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('📤 [TRACK] Unsubscribed from track:', track.kind, 'from', participant.identity)
      track.detach()
    })

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      console.log('📹 [LOCAL] Published local track:', publication.kind)
      // Don't attach here - will attach after UI is ready
    })

    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      console.log('🔴 [LOCAL] Unpublished local track:', publication.kind)
    })

    // Connect to room
    console.log('🔌 [CONNECT] Connecting to room...')
    await room.connect(url, token)
    console.log('✅ [CONNECT] Connection established')
    
    // Enable camera and microphone
    console.log('🎥 [MEDIA] Enabling camera and microphone...')
    await room.localParticipant.enableCameraAndMicrophone()
    console.log('✅ [MEDIA] Camera and microphone enabled')

    // Set connected state first so DOM is rendered
    isConnected.value = true
    updateParticipantCount()
    
    // Wait for Vue to update DOM, then attach all tracks
    await new Promise(resolve => setTimeout(resolve, 100))
    isDomReady = true
    console.log('🎬 [ATTACH] DOM ready, attaching all tracks...')
    
    // Attach local video and audio tracks
    room.localParticipant.videoTrackPublications.forEach((publication) => {
      if (publication.track) {
        attachTrack(publication.track, 'local')
      }
    })
    
    room.localParticipant.audioTrackPublications.forEach((publication) => {
      if (publication.track) {
        attachTrack(publication.track, 'local')
      }
    })
    
    // Attach any pending remote tracks that arrived early
    if (pendingTracks.length > 0) {
      console.log('📦 [ATTACH] Attaching', pendingTracks.length, 'pending remote tracks...')
      pendingTracks.forEach(({ track, identity }) => {
        attachTrack(track, identity)
      })
      pendingTracks.length = 0 // Clear the queue
    }
    
    // // Check for existing hidden participants (like transcription agent)
    // room.remoteParticipants.forEach((participant) => {
    //   if (participant.identity === 'transcription-agent') {
    //     console.log('🤖 [AGENT] Transcription agent already in room')
    //     isAgentConnected.value = true
    //   }
    // })
    
    console.log('🎉 [SUCCESS] Successfully joined room with', participantCount.value, 'participant(s)')

  } catch (err) {
    console.error('❌ [ERROR] Failed to join room:', err)
    error.value = err instanceof Error ? err.message : 'Failed to join room'
  } finally {
    isConnecting.value = false
  }
}

function attachTrack(track: LocalTrack | RemoteTrack, identity: string) {
  console.log('🎬 [ATTACH] Attaching track:', track.kind, 'for', identity)
  
  if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
    const element = track.attach()
    element.setAttribute('data-identity', identity)
    
    console.log('📺 [ATTACH] Track element created:', element.tagName, 'for', track.kind)
    
    if (track.kind === Track.Kind.Video) {
      element.style.width = '100%'
      element.style.height = '100%'
      element.style.objectFit = 'cover'
      
      const container = document.getElementById('video-container')
      if (container) {
        // Remove existing video for this identity if it exists
        const existingWrapper = container.querySelector(`[data-participant="${identity}"]`) as HTMLElement
        if (existingWrapper) {
          console.log('🔄 [ATTACH] Removing existing video for', identity)
          existingWrapper.remove()
        }
        
        const wrapper = document.createElement('div')
        wrapper.className = 'video-wrapper'
        wrapper.setAttribute('data-participant', identity)
        wrapper.appendChild(element)
        
        const label = document.createElement('div')
        label.className = 'participant-label'
        label.textContent = identity === 'local' ? 'You' : identity
        wrapper.appendChild(label)
        
        container.appendChild(wrapper)
        console.log('✅ [ATTACH] Video element added to container for', identity)
      } else {
        console.error('❌ [ATTACH] Video container not found!')
      }
    }
  }
}

async function toggleAudio() {
  if (!room) return
  console.log('🎤 [AUDIO] Toggling microphone:', !isAudioEnabled.value ? 'ON' : 'OFF')
  isAudioEnabled.value = !isAudioEnabled.value
  await room.localParticipant.setMicrophoneEnabled(isAudioEnabled.value)
  console.log('✅ [AUDIO] Microphone state:', isAudioEnabled.value ? 'ENABLED' : 'DISABLED')
}

async function toggleVideo() {
  if (!room) return
  console.log('📹 [VIDEO] Toggling camera:', !isVideoEnabled.value ? 'ON' : 'OFF')
  isVideoEnabled.value = !isVideoEnabled.value
  await room.localParticipant.setCameraEnabled(isVideoEnabled.value)
  console.log('✅ [VIDEO] Camera state:', isVideoEnabled.value ? 'ENABLED' : 'DISABLED')
}

function updateParticipantCount() {
  if (!room) return
  participantCount.value = room.remoteParticipants.size + 1
}

async function leaveRoom() {
  console.log('👋 [LEAVE] Leaving room...')
  
  if (room) {
    await room.disconnect()
    console.log('✅ [LEAVE] Disconnected from room')
    room = null
  }
  
  const container = document.getElementById('video-container')
  if (container) {
    container.innerHTML = ''
    console.log('🧹 [LEAVE] Cleared video container')
  }
  
  isConnected.value = false
  participantCount.value = 0
  isAgentConnected.value = false
  console.log('✅ [LEAVE] Left room successfully')
}

onUnmounted(() => {
  leaveRoom()
})
</script>

<style scoped>
.app {
  text-align: center;
}

h1 {
  margin-bottom: 2rem;
  font-size: 2.5rem;
}

.join-form {
  max-width: 400px;
  margin: 0 auto;
  background: #2a2a2a;
  padding: 2rem;
  border-radius: 8px;
}

.join-form h2 {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.error {
  color: #ff4444;
  margin-top: 1rem;
}

.video-room {
  width: 100%;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.leave-btn {
  background: #f44336;
}

.leave-btn:hover {
  background: #d32f2f;
}

.participants-info {
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.agent-status {
  color: #4CAF50;
  font-size: 0.95rem;
  margin-top: 0.5rem;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}

.video-wrapper {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
}

.participant-label {
  position: absolute;
  bottom: 0.5rem;
  left: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}
</style>
