import { CoordinationConfig } from '../types/index.js';
export declare class CoordinationMCPServer {
    private server;
    private db;
    private messageManager;
    private participantRegistry;
    private indexingEngine;
    private compactionEngine;
    private config;
    constructor(config: CoordinationConfig);
    private setupToolHandlers;
    private handleSendMessage;
    private handleGetMessages;
    private handleRespondMessage;
    private handleSearchMessages;
    private handleCompactThread;
    private handleArchiveResolved;
    private handleGetStats;
    private handleRegisterParticipant;
    private handleWhoami;
    private handleHelp;
    private handleSetupGuide;
    private setupErrorHandling;
    private handleToolError;
    run(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map