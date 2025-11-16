/**
 * Type definitions for the transcription agent
 */

export interface TranscriptEntry {
  timestamp: Date;
  participantIdentity: string;
  participantName: string;
  text: string;
  isFinal: boolean;
}

export interface ParticipantRoomEvent {
  timestamp: Date;
  type: 'join' | 'leave';
  participantIdentity: string;
  participantName: string;
}

export interface ParticipantState {
  identity: string;
  name: string;
  transcripts: TranscriptEntry[];
  sttStream?: any; // STT stream instance
  isActive: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

export interface AgentConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
  roomName: string;
}
