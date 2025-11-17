# LiveKit Token Server

Simple **TypeScript**/Node.js server for generating LiveKit access tokens.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Get your LiveKit credentials from https://cloud.livekit.io

4. Update `.env` with your credentials:
   - LIVEKIT_API_KEY
   - LIVEKIT_API_SECRET
   - LIVEKIT_URL

## Running

**Docker (Recommended):**
```bash
# From project root
docker-compose up -d backend
```

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /
```

### Generate Token
```
POST /api/token
Content-Type: application/json

{
  "roomName": "my-room",
  "participantName": "John Doe"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "url": "wss://your-project.livekit.cloud"
}
```

## Testing

Use curl to test:
```bash
curl -X POST http://localhost:3000/api/token \
  -H "Content-Type: application/json" \
  -d '{"roomName":"test-room","participantName":"Test User"}'
```
