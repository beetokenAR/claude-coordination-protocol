import { CoordinationDatabase } from '../database/connection.js';
import { CoordinationMessage, SearchMessagesInput, SearchResult, ParticipantId } from '../types/index.js';
export declare class IndexingEngine {
    private db;
    private searchMessagesFTS;
    private searchMessagesByTags;
    private searchMessagesByDateRange;
    private updateMessageTags;
    constructor(db: CoordinationDatabase);
    private prepareStatements;
    /**
     * Search messages using full-text search and filters
     */
    searchMessages(input: SearchMessagesInput, requestingParticipant: ParticipantId): Promise<SearchResult[]>;
    /**
     * Index message content for improved searchability
     */
    indexMessage(message: CoordinationMessage): Promise<void>;
    /**
     * Get tag suggestions based on existing messages
     */
    getTagSuggestions(query: string, requestingParticipant: ParticipantId, limit?: number): Promise<string[]>;
    /**
     * Get message statistics for analytics
     */
    getMessageStats(participantId: ParticipantId, days?: number): Promise<{
        total_messages: number;
        messages_sent: number;
        messages_received: number;
        by_type: Record<string, number>;
        by_priority: Record<string, number>;
        by_status: Record<string, number>;
        response_rate: number;
        avg_response_time_hours: number;
    }>;
    /**
     * Find related messages based on content similarity
     */
    findRelatedMessages(messageId: string, requestingParticipant: ParticipantId, limit?: number): Promise<SearchResult[]>;
    private prepareFTSQuery;
    private enhanceMessageTags;
    private extractKeywords;
    private isStopWord;
    private normalizeRank;
    private extractMatchContext;
    private rowToMessage;
}
//# sourceMappingURL=indexing-engine.d.ts.map