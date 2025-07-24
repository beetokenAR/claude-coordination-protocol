import { CoordinationDatabase } from '../database/connection.js';
import { Participant, ParticipantId, Priority } from '../types/index.js';
export declare class ParticipantRegistry {
    private db;
    private dataDir;
    private insertParticipant;
    private updateParticipantStmt;
    private selectParticipant;
    private selectAllParticipants;
    private deleteParticipant;
    private updateLastSeenStmt;
    constructor(db: CoordinationDatabase, dataDir: string);
    private prepareStatements;
    /**
     * Register a new participant
     */
    registerParticipant(participant: Omit<Participant, 'last_seen' | 'status'>): Promise<Participant>;
    /**
     * Get participant by ID
     */
    getParticipant(participantId: ParticipantId): Promise<Participant | null>;
    /**
     * Get all participants, optionally filtered by status
     */
    getParticipants(status?: 'active' | 'inactive' | 'maintenance'): Promise<Participant[]>;
    /**
     * Update participant information
     */
    updateParticipant(participantId: ParticipantId, updates: Partial<Pick<Participant, 'capabilities' | 'status' | 'preferences' | 'default_priority'>>, requestingParticipant: ParticipantId): Promise<Participant>;
    /**
     * Update participant's last seen timestamp
     */
    updateLastSeen(participantId: ParticipantId): Promise<void>;
    /**
     * Deactivate participant (soft delete)
     */
    deactivateParticipant(participantId: ParticipantId, requestingParticipant: ParticipantId): Promise<void>;
    /**
     * Permanently remove participant (hard delete)
     * Only admins can do this, and it should be used carefully
     */
    removeParticipant(participantId: ParticipantId, requestingParticipant: ParticipantId): Promise<void>;
    /**
     * Check if participant has admin capabilities
     */
    isAdmin(participantId: ParticipantId): Promise<boolean>;
    /**
     * Check if participant can access message
     */
    canAccessMessage(participantId: ParticipantId, messageFromParticipant: ParticipantId, messageToParticipants: ParticipantId[]): Promise<boolean>;
    /**
     * Check if participant can send message to target participants
     */
    canSendMessage(fromParticipant: ParticipantId, toParticipants: ParticipantId[]): Promise<boolean>;
    /**
     * Get participant's default message priority
     */
    getDefaultPriority(participantId: ParticipantId): Promise<Priority>;
    /**
     * Get active participants by capability
     */
    getParticipantsByCapability(capability: string): Promise<Participant[]>;
    /**
     * Get participant statistics
     */
    getParticipantStats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        maintenance: number;
        by_capability: Record<string, number>;
    }>;
    /**
     * Cleanup inactive participants that haven't been seen for a long time
     */
    cleanupStaleParticipants(daysInactive?: number): Promise<number>;
    private rowToParticipant;
}
//# sourceMappingURL=participant-registry.d.ts.map