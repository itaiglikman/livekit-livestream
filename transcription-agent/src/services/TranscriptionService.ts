/**
 * Transcription Service - Manages STT streams and audio processing
 */

import { RemoteParticipant, RemoteAudioTrack, AudioStream, Room } from '@livekit/rtc-node';
import { inference, stt } from '@livekit/agents';
import { StorageService } from './StorageService.js';
import { logger } from '../utils/logger.js';

export class TranscriptionService {
  private storageService: StorageService;
  private abortControllers = new Map<string, AbortController>();
  private isShuttingDown = false;
  private room?: Room;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  /**
   * Set the room instance (for publishing data messages)
   * Called after room connection is established
   */
  setRoom(room: Room): void {
    this.room = room;
  }

  /**
   * Setup transcription for a participant
   */
  async setupTranscription(track: RemoteAudioTrack, participant: RemoteParticipant): Promise<void> {
    const identity = participant.identity;
    
    try {
      logger.log('🔊', 'STT', `Setting up transcription for: ${participant.name}`);

      // Get participant state
      const state = this.storageService.getParticipantState(identity);
      if (!state) {
        logger.error('STT', `Participant state not found for: ${identity}`);
        return;
      }

      // CRITICAL: If participant already has active transcription, abort it first
      if (state.isActive && state.sttStream) {
        logger.warn('STT', `Aborting existing transcription for: ${participant.name} (user rejoined)`);
        await this.abortTranscription(identity);
        // Wait longer for Deepgram to fully finish processing
        await this.delay(300);
      }

      // Create abort controller for this transcription session
      const abortController = new AbortController();
      this.abortControllers.set(identity, abortController);

      // Create STT instance
      const sttInstance = new inference.STT({
        model: 'deepgram/nova-3',
        language: 'en',
        modelOptions: {
          interim_results: false,
          endpointing: 500,
          smart_format: true,
          punctuate: true,
          filler_words: false,
        },
      });

      // CRITICAL: Add error handler IMMEDIATELY (before any async operations)
      sttInstance.on('error', (error: any) => {
        // Ignore errors during shutdown or after abort
        if (this.isShuttingDown || abortController.signal.aborted) {
          return;
        }
        logger.warn('STT', `STT instance error for ${participant.name}:`, error?.message || error);
      });

      // Create STT stream
      const sttStream = sttInstance.stream();
      state.sttStream = sttStream;
      state.isActive = true;

      logger.success('STT', `Transcription active for: ${participant.name}`);

      // Process STT events in background (non-blocking)
      this.processTranscriptEvents(sttStream, participant, abortController.signal);

      // Process audio frames (this will block until stream ends)
      await this.processAudioFrames(track, sttStream, participant, abortController.signal);

      // Audio stream ended normally
      logger.info('STT', `Audio stream ended for: ${participant.name}`);

    } catch (error: any) {
      // Only log unexpected errors (not abort/shutdown errors)
      if (!this.isShuttingDown && error?.message && !error.message.includes('aborted')) {
        logger.error('STT', `Setup failed for ${participant.name}:`, error.message);
      }
    } finally {
      // Cleanup (safe to call multiple times)
      await this.cleanupTranscription(identity);
    }
  }

  /**
   * Process audio frames from track to STT
   */
  private async processAudioFrames(
    track: RemoteAudioTrack,
    sttStream: any,
    participant: RemoteParticipant,
    abortSignal: AbortSignal
  ): Promise<void> {
    try {
      const audioStream = new AudioStream(track);

      for await (const audioFrame of audioStream) {
        // Stop if aborted or shutting down
        if (abortSignal.aborted || this.isShuttingDown) {
          break;
        }

        // Push frame to STT (with error handling for closed stream)
        try {
          sttStream.pushFrame(audioFrame);
        } catch (error: any) {
          // Stream was closed (likely user rejoined) - exit gracefully
          if (error?.message?.includes('closed')) {
            break;
          }
          throw error;
        }
      }
    } catch (error: any) {
      // Expected errors during normal disconnect
      if (error?.message?.includes('closed') || error?.message?.includes('Queue is closed')) {
        logger.info('STT', `Audio stream closed for: ${participant.name}`);
      } else if (!abortSignal.aborted && !this.isShuttingDown) {
        logger.error('STT', `Audio stream error for ${participant.name}:`, error.message);
      }
    }
  }

  /**
   * Process transcript events from STT stream
   */
  private async processTranscriptEvents(
    sttStream: any,
    participant: RemoteParticipant,
    abortSignal: AbortSignal
  ): Promise<void> {
    try {
      for await (const event of sttStream) {
        // Stop if aborted or shutting down
        if (abortSignal.aborted || this.isShuttingDown) {
          break;
        }

        // Get current state
        const state = this.storageService.getParticipantState(participant.identity);
        if (!state || !state.isActive) {
          break;
        }

        this.handleTranscriptEvent(event, participant);
      }
    } catch (error: any) {
      // Ignore errors during shutdown/abort
      if (!abortSignal.aborted && !this.isShuttingDown) {
        logger.error('STT', `Event processing error for ${participant.name}:`, error.message);
      }
    }
  }

  /**
   * Handle individual transcript events
   * Stores transcript locally and publishes to frontend via data channel
   */
  private handleTranscriptEvent(event: stt.SpeechEvent, participant: RemoteParticipant): void {
    if (event.type === stt.SpeechEventType.FINAL_TRANSCRIPT) {
      const text = event.alternatives?.[0]?.text;
      if (text && text.trim() !== '') {
        // Store transcript locally
        this.storageService.addTranscript(participant.identity, text, true);
        
        // Publish to frontend via LiveKit data channel
        this.publishTranscriptToFrontend(participant, text);
      }
    }
  }

  /**
   * Publish transcript to frontend via LiveKit data messages
   * Uses LiveKit's built-in data channel for real-time delivery
   */
  private publishTranscriptToFrontend(participant: RemoteParticipant, text: string): void {
    if (!this.room) {
      logger.warn('DATA', 'Cannot publish transcript - room not set');
      return;
    }

    try {
      const transcriptData = {
        type: 'transcript',
        speaker: participant.name || participant.identity,
        text: text,
        timestamp: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(transcriptData);
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonString);

      // Publish data message to all participants
      this.room.localParticipant?.publishData(data, { reliable: true });
      
    } catch (error: any) {
      logger.error('DATA', 'Failed to publish transcript:', error.message);
    }
  }

  /**
   * Abort transcription immediately (for rejoin scenarios)
   */
  async abortTranscription(identity: string): Promise<void> {
    // Abort the async operations
    const abortController = this.abortControllers.get(identity);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(identity);
    }

    // Mark as inactive
    const state = this.storageService.getParticipantState(identity);
    if (state) {
      state.isActive = false;
    }

    // Cleanup resources
    await this.cleanupTranscription(identity);
  }

  /**
   * Cleanup transcription resources (safe to call multiple times)
   */
  private async cleanupTranscription(identity: string): Promise<void> {
    const state = this.storageService.getParticipantState(identity);
    if (!state) return;

    // Mark as inactive FIRST (prevents event processing)
    state.isActive = false;

    // Close STT stream gracefully
    if (state.sttStream) {
      try {
        // CRITICAL: Close stream first to stop accepting new data
        // Don't flush - that triggers processing of remaining audio which will fail
        state.sttStream.close();
        
        // Give it a moment to fully close
        await this.delay(50);
      } catch (error: any) {
        // Ignore "already closed" errors
        if (error?.message && !error.message.includes('closed')) {
          logger.warn('STT', `Cleanup error for ${state.name}:`, error.message);
        }
      }
      
      state.sttStream = undefined;
    }

    // Remove abort controller
    this.abortControllers.delete(identity);

    logger.log('🛑', 'STT', `Cleanup completed for: ${state.name}`);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    logger.log('👋', 'SHUTDOWN', 'Shutting down transcription service...');

    // Abort all active transcriptions
    const identities = Array.from(this.abortControllers.keys());
    for (const identity of identities) {
      await this.abortTranscription(identity);
    }

    logger.success('SHUTDOWN', 'Transcription service shutdown complete');
  }

  /**
   * Helper: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
