/**
 * LiveKit Transcription Agent
 * Simplified and refactored version with proper service separation
 */

import { initializeLogger } from '@livekit/agents';
import { loadEnvironment } from './config/environment.js';
import { StorageService } from './services/StorageService.js';
import { TranscriptionService } from './services/TranscriptionService.js';
import { RoomService } from './services/RoomService.js';
import { logger } from './utils/logger.js';

// Initialize LiveKit Agents logger (required for inference module)
initializeLogger({ level: 'info', pretty: true });

async function main() {
  logger.log('🤖', 'START', 'Transcription Agent starting...');

  // Load and validate configuration
  const config = loadEnvironment();

  // Initialize services
  const storageService = new StorageService();
  const transcriptionService = new TranscriptionService(storageService);
  const roomService = new RoomService(storageService, transcriptionService);

  // Connect to room
  await roomService.connect(config);

  // Keep agent running
  logger.success('READY', 'Agent is listening... Press Ctrl+C to stop');

  // Setup graceful shutdown
  setupGracefulShutdown(transcriptionService, roomService, storageService);
}

function setupGracefulShutdown(
  transcriptionService: TranscriptionService,
  roomService: RoomService,
  storageService: StorageService
) {
  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    logger.log('👋', 'SHUTDOWN', 'Shutting down agent...');
    
    try {
      // Shutdown transcription service first
      await transcriptionService.shutdown();
      
      // Disconnect from room
      await roomService.disconnect();
      
      // Export final transcript
      await storageService.exportTranscript();
      
      logger.success('SHUTDOWN', 'Agent shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('SHUTDOWN', 'Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Handle unhandled errors (especially from STT queue closure)
  process.on('uncaughtException', (error: Error) => {
    // Ignore "Queue is closed" errors - these happen during cleanup and are expected
    if (error.message?.includes('Queue is closed')) {
      logger.warn('CLEANUP', 'STT queue closed during cleanup (expected)');
      return;
    }
    
    // Log other unexpected errors
    logger.error('UNCAUGHT', 'Uncaught exception:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    // Ignore "Queue is closed" rejections
    if (reason?.message?.includes('Queue is closed')) {
      logger.warn('CLEANUP', 'STT queue rejection during cleanup (expected)');
      return;
    }
    
    logger.error('UNHANDLED', 'Unhandled rejection:', reason);
    process.exit(1);
  });
}

// Start the agent
main().catch((error) => {
  logger.error('FATAL', 'Agent error:', error);
  process.exit(1);
});
