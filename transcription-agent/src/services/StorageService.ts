/**
 * Storage Service - Manages transcript storage and export
 */

import fs from 'fs/promises';
import path from 'path';
import { ParticipantState, ParticipantRoomEvent, TranscriptEntry } from '../models/types.js';
import { logger } from '../utils/logger.js';

export class StorageService {
  private participantStates = new Map<string, ParticipantState>();
  private roomEvents: ParticipantRoomEvent[] = [];
  private sessionStartTime = new Date();

  /**
   * Add or update a participant
   */
  addParticipant(identity: string, name: string): ParticipantState {
    let state = this.participantStates.get(identity);
    
    if (!state) {
      state = {
        identity,
        name,
        transcripts: [],
        isActive: false,
        joinedAt: new Date(),
      };
      this.participantStates.set(identity, state);
    } else {
      // Update name if changed and reset join time
      state.name = name;
      state.joinedAt = new Date();
      state.leftAt = undefined;
    }

    // Track join event
    this.roomEvents.push({
      timestamp: new Date(),
      type: 'join',
      participantIdentity: identity,
      participantName: name,
    });

    return state;
  }

  /**
   * Mark participant as left
   */
  markParticipantLeft(identity: string, name: string): void {
    const state = this.participantStates.get(identity);
    if (state) {
      state.leftAt = new Date();
    }

    // Track leave event
    this.roomEvents.push({
      timestamp: new Date(),
      type: 'leave',
      participantIdentity: identity,
      participantName: name,
    });
  }

  /**
   * Get participant state
   */
  getParticipantState(identity: string): ParticipantState | undefined {
    return this.participantStates.get(identity);
  }

  /**
   * Add a transcript entry
   */
  addTranscript(identity: string, text: string, isFinal: boolean): void {
    const state = this.participantStates.get(identity);
    if (!state) {
      logger.warn('STORAGE', `Cannot add transcript: participant ${identity} not found`);
      return;
    }

    const entry: TranscriptEntry = {
      timestamp: new Date(),
      participantIdentity: identity,
      participantName: state.name,
      text,
      isFinal,
    };

    state.transcripts.push(entry);

    // Real-time console output for final transcripts
    if (isFinal) {
      const time = entry.timestamp.toLocaleTimeString();
      logger.log('💬', 'TRANSCRIPT', `[${time}] [${state.name}]: ${text}`);
    }
  }

  /**
   * Export transcript to file
   */
  async exportTranscript(): Promise<string> {
    logger.log('💾', 'EXPORT', 'Generating final transcript...');

    const sessionEnd = new Date();
    const duration = Math.floor((sessionEnd.getTime() - this.sessionStartTime.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    let transcript = '=== CONVERSATION TRANSCRIPT ===\n';
    transcript += `Session Start: ${this.sessionStartTime.toLocaleString()}\n`;
    transcript += `Session End: ${sessionEnd.toLocaleString()}\n`;
    transcript += `Duration: ${minutes}m ${seconds}s\n`;
    transcript += `Participants: ${this.participantStates.size}\n`;
    transcript += '\n';

    // Collect all transcripts from all participants
    const allTranscripts: TranscriptEntry[] = [];
    this.participantStates.forEach((state) => {
      allTranscripts.push(...state.transcripts);
    });

    // Combine transcripts and room events, then sort by timestamp
    type TimelineEvent = 
      | { type: 'transcript'; data: TranscriptEntry }
      | { type: 'room_event'; data: ParticipantRoomEvent };

    const timeline: TimelineEvent[] = [
      ...allTranscripts.map(t => ({ type: 'transcript' as const, data: t })),
      ...this.roomEvents.map(e => ({ type: 'room_event' as const, data: e })),
    ];

    // Sort by timestamp (chronological order)
    timeline.sort((a, b) => {
      const timeA = a.type === 'transcript' ? a.data.timestamp : a.data.timestamp;
      const timeB = b.type === 'transcript' ? b.data.timestamp : b.data.timestamp;
      return timeA.getTime() - timeB.getTime();
    });

    // Output chronologically with speaker names and room events
    if (timeline.length === 0) {
      transcript += '(no activity)\n';
    } else {
      timeline.forEach((item) => {
        if (item.type === 'transcript') {
          const entry = item.data;
          const time = entry.timestamp.toLocaleTimeString();
          transcript += `[${time}] ${entry.participantName}: ${entry.text}\n`;
        } else {
          const event = item.data;
          const time = event.timestamp.toLocaleTimeString();
          const action = event.type === 'join' ? '➡️ joined the room' : '⬅️ left the room';
          transcript += `[${time}] --- ${event.participantName} ${action} ---\n`;
        }
      });
    }

    // Save to file
    const filename = `transcript_${Date.now()}.txt`;
    const filepath = path.join(process.cwd(), 'transcripts', filename);
    
    await fs.writeFile(filepath, transcript, 'utf-8');
    logger.success('EXPORT', `Transcript saved to: ${filename}`);
    
    // Also log to console
    console.log('\n' + transcript);

    return filename;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      participantCount: this.participantStates.size,
      totalTranscripts: Array.from(this.participantStates.values()).reduce(
        (sum, state) => sum + state.transcripts.length,
        0
      ),
      sessionDuration: Date.now() - this.sessionStartTime.getTime(),
    };
  }
}
