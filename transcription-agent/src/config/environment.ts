/**
 * Environment configuration and validation
 */

import dotenv from 'dotenv';
import { AgentConfig } from '../models/types.js';
import { logger } from '../utils/logger.js';

dotenv.config();

export function loadEnvironment(): AgentConfig {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  const roomName = process.env.ROOM_NAME;

  if (!apiKey || !apiSecret || !url || !roomName) {
    logger.error('CONFIG', 'Missing required environment variables');
    console.error('Required: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL, ROOM_NAME');
    process.exit(1);
  }

  return {
    apiKey,
    apiSecret,
    url,
    roomName,
  };
}
