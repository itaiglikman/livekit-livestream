import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Types
interface TokenRequest {
  roomName: string;
  participantName: string;
}

interface TokenResponse {
  token: string;
  url: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'LiveKit Token Server (TypeScript)',
    timestamp: new Date().toISOString()
  });
});

// Token generation endpoint
app.post('/api/token', async (req: Request<{}, TokenResponse | ErrorResponse, TokenRequest>, res: Response<TokenResponse | ErrorResponse>) => {
  try {
    const { roomName, participantName } = req.body;

    // Validate input
    if (!roomName || !participantName) {
      return res.status(400).json({ 
        error: 'roomName and participantName are required' 
      });
    }

    // Validate environment variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error('Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL');
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }

    // Create access token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });

    // Grant permissions
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    console.log(`Token generated for ${participantName} in room ${roomName}`);

    res.json({ 
      token: jwt,
      url: livekitUrl
    });

  } catch (error) {
    console.error('Error generating token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: errorMessage
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LiveKit Token Server (TypeScript) running on http://localhost:${PORT}`);
  console.log(`📝 Endpoint: POST http://localhost:${PORT}/api/token`);
  console.log(`💚 Health: GET http://localhost:${PORT}/`);
});
