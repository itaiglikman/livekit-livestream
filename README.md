# LiveKit Live Streaming & Transcription Platform

A complete live streaming platform with real-time transcription, built with LiveKit, Node.js, and Vue.js.

## 🎯 What This Project Does

1. **Live Video Streaming** - Multi-participant video rooms (like Zoom/Google Meet)
2. **Real-Time Transcription** - AI agent transcribes all conversations with speaker identification
3. **Token Server** - Secure authentication for LiveKit rooms

## 📁 Project Structure

```
livekit-livestream/
├── livekit-server/          # Token generation server (Node.js + Express)
├── livekit-client/          # Video streaming frontend (Vue.js)
├── transcription-agent/     # AI transcription agent (LiveKit Agents)
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose (for deployment)
- OR Node.js 18+ (for local development)
- LiveKit Cloud account ([sign up free](https://cloud.livekit.io))

### Option A: Docker Deployment (Recommended)

1. **Setup LiveKit Cloud**
   - Go to https://cloud.livekit.io
   - Create project and copy credentials

2. **Clone & Configure**
   ```bash
   git clone https://github.com/itaiglikman/livekit-livestream.git
   cd livekit-livestream
   cp .env.example .env
   # Edit .env with your LiveKit credentials
   ```

3. **Update Frontend URL**
   - Edit `livekit-client/.env.production`
   - Set `VITE_BACKEND_URL=http://YOUR_SERVER_IP:3000`

4. **Deploy**
   ```bash
   docker-compose up -d --build
   ```

5. **Access:** `http://YOUR_SERVER_IP`

### Option B: Local Development

**Backend:**
```bash
cd livekit-server
npm install
cp .env.example .env  # Add credentials
npm run dev  # http://localhost:3000
```

**Frontend:**
```bash
cd livekit-client
npm install
cp .env.example .env  # Add LiveKit URL
npm run dev  # http://localhost:5173
```

**Transcription Agent (Optional):**
```bash
cd transcription-agent
pnpm install
cp .env.example .env  # Add credentials + room name
pnpm run dev
```

## 🎬 How to Use

1. **Join a Room:**
   - Open `http://localhost:5173`
   - Enter a room name (e.g., "test-room")
   - Enter your name
   - Click "Join Room"
   - Allow camera/microphone access

2. **Invite Others:**
   - Share the same room name with others
   - They can join from any browser

3. **See Transcription:**
   - If agent is running, check its console for real-time transcripts
   - Transcripts saved to `transcription-agent/transcripts/` on exit

## 🏗️ Architecture

### Backend (Token Server)
- **Tech:** Node.js + Express + TypeScript
- **Purpose:** Generate secure access tokens for LiveKit
- **Endpoint:** `POST /api/token` - Returns JWT token
- See: `livekit-server/README.md`

### Frontend (Video Client)
- **Tech:** Vue.js 3 + TypeScript + LiveKit Client SDK
- **Features:**
  - Join/create rooms
  - Multi-user video/audio
  - Mute/unmute controls
  - Camera on/off
  - Participant grid
- See: `livekit-client/README.md`

### Transcription Agent
- **Tech:** Node.js + TypeScript + LiveKit Agents SDK
- **Features:**
  - Joins room as hidden participant
  - Real-time speech-to-text (Deepgram Nova-3)
  - Speaker identification
  - Transcript export
- **Architecture:** Refactored into services:
  ```
  ├── agent.ts              # Main orchestration
  ├── services/
  │   ├── RoomService.ts           # LiveKit connection
  │   ├── TranscriptionService.ts  # STT processing
  │   └── StorageService.ts        # Transcript storage
  ├── config/
  │   └── environment.ts    # Config validation
  ├── models/
  │   └── types.ts         # TypeScript interfaces
  └── utils/
      └── logger.ts        # Logging utility
  ```
- See: `transcription-agent/README.md`

## 🐛 Bug Fixes Applied

### ✅ Fixed: Agent Crash on User Rejoin
**Problem:** Agent crashed with "Queue is closed" error when users rejoined the room

**Root Cause:** Deepgram STT was still processing audio in background when stream was closed, trying to put results in a closed queue

**Solutions Applied:**
1. **Global error handlers** - Catch uncaught "Queue is closed" errors at process level
2. **Extended cleanup delay** - Increased wait time (300ms) after aborting to let Deepgram finish
3. **Immediate stream closure** - Close stream first without flushing to prevent new data
4. **Error suppression during cleanup** - Mark expected errors as warnings instead of crashes
5. **Try-catch in audio push** - Handle closed stream errors gracefully

**Result:** Agent stays running through multiple user rejoins ✅

### ✅ Fixed: Duplicate Transcripts on Rejoin
**Problem:** Transcripts appeared multiple times when users rejoined

**Solution:**
- Detect existing streams on rejoin
- Abort old transcription before creating new one
- Single source of truth for participant state
- Event loop gating with `isActive` flag

## 📋 Testing

### Basic Test
1. Start all three services (backend, frontend, agent)
2. Join a room with 1-2 users
3. Speak into microphone
4. Check agent console for transcripts
5. Leave room (user disconnect)
6. Verify agent doesn't crash ✅
7. Stop agent (Ctrl+C) to export transcript

### Multi-User Test
1. Open multiple browser tabs/windows
2. Join same room with different names
3. Take turns speaking
4. Verify each transcript tagged with correct speaker

### Rejoin Test (Bug Verification)
1. Join room, speak, leave
2. Join same room again (rejoin)
3. Speak again
4. Verify agent doesn't crash ✅
5. Check no duplicate transcripts ✅
6. Verify timeline shows join/leave events

## 🔧 Configuration

All services use `.env` files. See `.env.example` in each directory for required variables:

**Common Variables:**
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

**Transcription Agent Additional:**
```env
ROOM_NAME=your_room_name  # Must match room joined in frontend
```

## 📊 Features

### Current
- ✅ Multi-user video conferencing (2-10 users tested)
- ✅ Real-time audio/video
- ✅ Mute/unmute controls
- ✅ Camera toggle
- ✅ Real-time transcription with Deepgram Nova-3
- ✅ Speaker identification
- ✅ Transcript export to file with timeline
- ✅ Crash-resistant agent (handles rejoins)
- ✅ Modular, maintainable codebase
- ✅ Global error handling
- ✅ Docker deployment ready
- ✅ Production-ready containerization

### Future Enhancements
- [ ] Screen sharing
- [ ] Recording (LiveKit Egress)
- [ ] RTMP ingress (OBS streaming)
- [ ] Chat functionality
- [ ] Viewer count
- [ ] Database storage for transcripts
- [ ] WebSocket streaming to frontend
- [ ] Active speaker detection (for large rooms)
- [ ] Multi-language support

## 📚 Resources

- [LiveKit Documentation](https://docs.livekit.io)
- [LiveKit Agents Guide](https://docs.livekit.io/agents/)
- [LiveKit Cloud](https://cloud.livekit.io)
- [Deepgram Models](https://deepgram.com/models)

## 🤝 Development

### Code Organization
- Each service is independent (can run separately)
- TypeScript throughout
- Services follow Single Responsibility Principle
- Error handling at all levels

### Making Changes
1. Backup before major changes
2. Test with single user first
3. Then test multi-user scenarios
4. Check agent doesn't crash on disconnect

## 📝 License

MIT

---

## 🐳 Docker Deployment

Includes complete Docker setup for production deployment:
- Multi-stage frontend build (Vue.js + nginx)
- Optimized backend image (Node.js)
- Docker Compose orchestration
- Environment variable management
- Ready for DigitalOcean/AWS/any VPS

See individual service READMEs for details.

---

## ✅ Current Status

**Last Updated:** November 16, 2025  
**Status:** Production Ready & Deployed

**Recent Changes:**
- ✅ Added Docker deployment (Nov 16, 2025)
- ✅ Deployed to DigitalOcean (Nov 16, 2025)
- ✅ Fixed crash on user rejoin (Nov 12, 2025)
- ✅ Refactored to modular architecture (Nov 12, 2025)

**Verified Working:**
- ✅ Multi-user video conferencing
- ✅ Real-time transcription with speaker separation
- ✅ User rejoining without crashes
- ✅ Docker containerization and deployment
- ✅ Remote team access via public IP
