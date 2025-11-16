# LiveKit Transcription Agent

AI agent that joins LiveKit rooms and transcribes conversations with speaker separation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

3. Configure `.env` with your LiveKit credentials and target room name:
```
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_URL=wss://your-project.livekit.cloud
ROOM_NAME=your_room_name
```

## Running

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## How It Works

1. Agent connects to the specified room
2. Subscribes to all participant audio tracks
3. Transcribes each speaker independently
4. Logs transcripts in real-time to console
5. On disconnect, exports formatted transcript to `transcripts/` folder

## Output Format

**Console (real-time):**
```
[14:23:45] [John Doe]: Hello everyone
[14:23:48] [Jane Smith]: Hi John!
```

**File (final transcript):**
```
=== CONVERSATION TRANSCRIPT ===
Session Start: 11/11/2025, 2:23:00 PM
Duration: 15m 30s
Participants: 3

--- John Doe ---
  [14:23:45] Hello everyone
  [14:24:10] How's the project?

--- Jane Smith ---
  [14:23:48] Hi John!
  [14:24:15] Great progress!
```

## Architecture

**Refactored into modular services:**

```
src/
├── agent.ts              # Main orchestration (70 lines)
├── config/
│   └── environment.ts    # Config validation
├── models/
│   └── types.ts         # TypeScript interfaces
├── services/
│   ├── RoomService.ts           # LiveKit connection
│   ├── TranscriptionService.ts  # STT processing
│   └── StorageService.ts        # Transcript storage
└── utils/
    └── logger.ts        # Logging utility
```

## Features

- ✅ Silent listener (doesn't publish audio/video)
- ✅ Multi-participant transcription
- ✅ Speaker separation with Deepgram Nova-3
- ✅ Real-time console logging
- ✅ Automatic transcript export with timeline
- ✅ Crash-resistant (handles user rejoins)
- ✅ Global error handling
- ✅ Modular, maintainable codebase
- ✅ TypeScript throughout

## Testing

1. Start the agent: `npm run dev`
2. Join the same room from the web client
3. Have 2+ users talk
4. Check console for real-time transcripts
5. Test user rejoining (leave and join again)
6. Verify agent doesn't crash ✅
7. Stop agent (Ctrl+C) to generate final transcript file

## Bug Fixes

### ✅ Fixed: Crash on User Rejoin
**Problem:** Agent crashed with "Queue is closed" when users rejoined

**Solutions:**
- Global error handlers for uncaught exceptions
- Extended cleanup delays (300ms) for Deepgram processing
- Stream closure without flushing
- Error suppression during cleanup
- Try-catch in audio frame processing

**Result:** Stable operation through multiple rejoins ✅
