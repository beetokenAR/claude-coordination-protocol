import { CoordinationDatabase } from '../database/connection.js';
import { CompactThreadInput, CompactionResult, ParticipantId } from '../types/index.js';
export declare class CompactionEngine {
    private db;
    private dataDir;
    private selectThreadMessages;
    private updateMessageStatus;
    private insertCompactedMessage;
    private selectConversation;
    private updateConversation;
    constructor(db: CoordinationDatabase, dataDir: string);
    private prepareStatements;
    /**
     * Compact a conversation thread using specified strategy
     */
    compactThread(input: CompactThreadInput, requestingParticipant: ParticipantId): Promise<CompactionResult>;
    /**
     * Auto-compact old resolved threads
     */
    autoCompactThreads(olderThanDays?: number, strategy?: 'summarize' | 'consolidate' | 'archive'): Promise<CompactionResult[]>;
    /**
     * Calculate token usage for optimization decisions
     */
    calculateTokenUsage(participantId: ParticipantId): Promise<{
        total_estimated_tokens: number;
        by_status: Record<string, number>;
        by_priority: Record<string, number>;
        recommendations: string[];
    }>;
    private summarizeThread;
    private consolidateThread;
    private archiveThread;
    private groupMessages;
    private createThreadSummary;
    private consolidateMessages;
    private mergeSummaries;
    private extractCommonTags;
    private storeCompactedContent;
    private replaceWithCompacted;
    private archiveContentFiles;
    private calculateThreadSize;
}
//# sourceMappingURL=compaction-engine.d.ts.map