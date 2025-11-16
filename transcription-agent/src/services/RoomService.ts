/**
 * Room Service - Manages LiveKit room connection and events
 */

import { Room, RoomEvent, RemoteParticipant, RemoteAudioTrack, TrackKind } from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';
import { StorageService } from './StorageService.js';
import { TranscriptionService } from './TranscriptionService.js';
import { AgentConfig } from '../models/types.js';
import { logger } from '../utils/logger.js';

export class RoomService {
  private room?: Room;
  private storageService: StorageService;
  private transcriptionService: TranscriptionService;

  constructor(storageService: StorageService, transcriptionService: TranscriptionService) {
    this.storageService = storageService;
    this.transcriptionService = transcriptionService;
  }

  /**
   * Connect to LiveKit room
   */
  async connect(config: AgentConfig): Promise<void> {
    logger.log('🔑', 'AUTH', 'Generating access token...');

    // Generate token for agent (hidden participant)
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: 'transcription-agent',
      name: 'Transcription Agent',
      metadata: JSON.stringify({ isAgent: true }),
    });

    token.addGrant({
      roomJoin: true,
      room: config.roomName,
      canPublish: false,  // Agent does NOT publish
      canSubscribe: true, // Agent CAN subscribe
      hidden: true,       // Agent is HIDDEN
    });

    const jwt = await token.toJwt();
    logger.success('AUTH', 'Token generated');

    // Create room instance
    this.room = new Room();
    this.setupEventHandlers();

    // Connect
    logger.log('🔌', 'CONNECT', `Connecting to room: ${config.roomName}`);
    await this.room.connect(config.url, jwt);
  }

  /**
   * Setup room event handlers
   */
  private setupEventHandlers(): void {
    if (!this.room) return;

    // Connected
    this.room.on(RoomEvent.Connected, () => {
      logger.success('ROOM', 'Successfully connected to room');
      logger.log('👥', 'ROOM', `Current participants: ${this.room!.remoteParticipants.size}`);
    });

    // Participant joined
    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      logger.log('👤', 'JOIN', `Participant joined: ${participant.name} (${participant.identity})`);
      this.storageService.addParticipant(participant.identity, participant.name || participant.identity);
    });

    // Participant left
    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      logger.log('👋', 'LEAVE', `Participant left: ${participant.name}`);
      this.storageService.markParticipantLeft(participant.identity, participant.name || participant.identity);
    });

    // Track subscribed
    this.room.on(RoomEvent.TrackSubscribed, async (track: RemoteAudioTrack, publication: any, participant: RemoteParticipant) => {
      if (track.kind === TrackKind.KIND_AUDIO) {
        logger.log('🎤', 'AUDIO', `Subscribed to audio from: ${participant.name}`);
        
        // Setup transcription for this audio track
        await this.transcriptionService.setupTranscription(track, participant);
      }
    });

    // Track unsubscribed
    this.room.on(RoomEvent.TrackUnsubscribed, async (track: RemoteAudioTrack, publication: any, participant: RemoteParticipant) => {
      if (track.kind === TrackKind.KIND_AUDIO) {
        logger.log('🔇', 'AUDIO', `Unsubscribed from audio: ${participant.name}`);
        // Cleanup happens automatically in TranscriptionService
      }
    });

    // Disconnected
    this.room.on(RoomEvent.Disconnected, async () => {
      logger.error('DISCONNECT', 'Disconnected from room');
      await this.storageService.exportTranscript();
    });
  }

  /**
   * Disconnect from room
   */
  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      logger.success('DISCONNECT', 'Disconnected from room');
    }
  }

  /**
   * Get room instance
   */
  getRoom(): Room | undefined {
    return this.room;
  }
}
