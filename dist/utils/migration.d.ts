import { CoordinationDatabase } from '../database/connection.js';
import { ParticipantId, MessageType, Priority, MessageStatus } from '../types/index.js';
export interface LegacyMessage {
    id: string;
    title: string;
    from: ParticipantId;
    to: ParticipantId;
    type: MessageType;
    priority: Priority;
    status: MessageStatus;
    description: string;
    filePath?: string;
    inferredDate: Date;
}
export interface MigrationResult {
    messagesProcessed: number;
    messagesImported: number;
    participantsCreated: number;
    errors: Array<{
        message: string;
        error: string;
    }>;
    summary: string;
}
export declare class LegacyMigrationTool {
    private db;
    private messageManager;
    private participantRegistry;
    private dataDir;
    constructor(db: CoordinationDatabase, dataDir: string);
    /**
     * Migrate from LLM_COORDINATION.md format
     */
    migrateFromCoordinationFile(filePath: string): Promise<MigrationResult>;
    /**
     * Parse LLM_COORDINATION.md file format
     */
    private parseCoordinationFile;
    /**
     * Import parsed legacy messages
     */
    private importMessages;
    private extractMessageType;
    private mapLegacyStatus;
    private inferMessageDate;
    private inferCapabilities;
    private updateMessageTimestamp;
    private updateMessageStatus;
    private generateMigrationSummary;
    /**
     * Export current coordination data to legacy format
     */
    exportToLegacyFormat(outputPath: string): Promise<void>;
}
//# sourceMappingURL=migration.d.ts.map