# LiveKit Video Streaming Client

Vue.js 3 + TypeScript client for video streaming with LiveKit.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
   - `VITE_LIVEKIT_URL`: Your LiveKit WebSocket URL (from LiveKit Cloud)
   - `VITE_BACKEND_URL`: Backend server URL (default: http://localhost:3000)

## Running

**Development:**
```bash
npm run dev
```

Client runs on `http://localhost:5173`

**Build for production:**
```bash
npm run build
```

## Usage

1. Make sure the backend server is running (`livekit-server`)
2. Open http://localhost:5173
3. Enter a room name and your name
4. Click "Join Room"
5. Allow camera and microphone permissions
6. Share the room name with others to join

## Features

- ✅ Join/create rooms
- ✅ Video and audio streaming
- ✅ Multiple participants (2-4 users)
- ✅ Mute/unmute microphone
- ✅ Camera on/off toggle
- ✅ Participant count display
- ✅ Leave room functionality
