import { CoordinationDatabase } from '../database/connection.js';
import { CoordinationMessage, SendMessageInput, GetMessagesInput, RespondMessageInput, ParticipantId } from '../types/index.js';
export declare class MessageManager {
    private db;
    private dataDir;
    private insertMessage;
    private updateMessage;
    private selectMessages;
    private selectMessageById;
    private deleteMessage;
    private selectMessageDependencies;
    constructor(db: CoordinationDatabase, dataDir: string);
    private prepareStatements;
    /**
     * Create a new coordination message
     */
    createMessage(input: SendMessageInput, fromParticipant: ParticipantId): Promise<CoordinationMessage>;
    /**
     * Get messages with filtering and pagination
     */
    getMessages(input: GetMessagesInput, requestingParticipant: ParticipantId): Promise<CoordinationMessage[]>;
    /**
     * Get a specific message by ID
     */
    getMessageById(messageId: string, requestingParticipant: ParticipantId, detailLevel?: 'index' | 'summary' | 'full'): Promise<CoordinationMessage | null>;
    /**
     * Respond to a message
     */
    respondToMessage(input: RespondMessageInput, respondingParticipant: ParticipantId): Promise<CoordinationMessage>;
    /**
     * Mark message as resolved
     */
    resolveMessage(messageId: string, resolvingParticipant: ParticipantId, resolutionStatus?: 'complete' | 'partial' | 'requires_followup'): Promise<void>;
    /**
     * Archive expired messages
     */
    archiveExpiredMessages(): Promise<number>;
    private generateMessageId;
    private generateThreadId;
    private storeMessageContent;
    private archiveContentFile;
    private rowToMessage;
    private updateConversationThread;
}
//# sourceMappingURL=message-manager.d.ts.map