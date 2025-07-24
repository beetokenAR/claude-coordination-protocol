import { z } from 'zod';
// Core message types
export const MessageType = z.enum(['arch', 'contract', 'sync', 'update', 'q', 'emergency', 'broadcast']);
export const Priority = z.enum(['CRITICAL', 'H', 'M', 'L']);
export const MessageStatus = z.enum(['pending', 'read', 'responded', 'resolved', 'archived', 'cancelled']);
export const ResolutionStatus = z.enum(['partial', 'complete', 'requires_followup', 'blocked']);
// Participant schema
export const ParticipantId = z.string().regex(/^@[a-zA-Z][a-zA-Z0-9_-]*$/, {
    message: "Participant ID must start with @ followed by alphanumeric characters"
});
export const Participant = z.object({
    id: ParticipantId,
    capabilities: z.array(z.string()),
    last_seen: z.date().optional(),
    status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
    preferences: z.record(z.unknown()).optional(),
    default_priority: Priority.default('M')
});
// Message schema
export const CoordinationMessage = z.object({
    id: z.string(),
    thread_id: z.string(),
    from: ParticipantId,
    to: z.array(ParticipantId),
    type: MessageType,
    priority: Priority,
    status: MessageStatus.default('pending'),
    // Content
    subject: z.string().max(200),
    summary: z.string().max(500),
    content_ref: z.string().optional(),
    // Metadata
    created_at: z.date(),
    updated_at: z.date(),
    expires_at: z.date().optional(),
    response_required: z.boolean().default(true),
    dependencies: z.array(z.string()).default([]),
    // Indexing
    tags: z.array(z.string()).default([]),
    semantic_vector: z.array(z.number()).optional(),
    // SuperClaude suggestions
    suggested_approach: z.object({
        superclaude_commands: z.array(z.string()).optional(),
        superclaude_personas: z.array(z.string()).optional(),
        superclaude_flags: z.array(z.string()).optional(),
        analysis_focus: z.array(z.string()).optional(),
        tools_recommended: z.array(z.string()).optional()
    }).optional(),
    // Resolution tracking
    resolution_status: ResolutionStatus.optional(),
    resolved_at: z.date().optional(),
    resolved_by: ParticipantId.optional()
});
// Conversation/Thread schema
export const Conversation = z.object({
    thread_id: z.string(),
    participants: z.array(ParticipantId),
    topic: z.string(),
    tags: z.array(z.string()).default([]),
    created_at: z.date(),
    last_activity: z.date(),
    status: z.enum(['active', 'resolved', 'archived']).default('active'),
    resolution_summary: z.string().optional(),
    message_count: z.number().default(0)
});
// Configuration schema
export const CoordinationConfig = z.object({
    participant_id: ParticipantId,
    data_directory: z.string().default('.coordination'),
    archive_days: z.number().positive().default(30),
    token_limit: z.number().positive().default(1000000),
    auto_compact: z.boolean().default(true),
    participants: z.array(Participant).default([]),
    notification_settings: z.object({
        enabled: z.boolean().default(true),
        priority_threshold: Priority.default('M'),
        batch_notifications: z.boolean().default(true)
    }).default({
        enabled: true,
        priority_threshold: 'M',
        batch_notifications: true
    })
});
// MCP Tool input schemas
export const SendMessageInput = z.object({
    to: z.array(ParticipantId),
    type: MessageType,
    priority: Priority,
    subject: z.string().min(1).max(200),
    content: z.string(),
    response_required: z.boolean().default(true),
    expires_in_hours: z.number().positive().default(168),
    tags: z.array(z.string()).optional(),
    suggested_approach: z.object({
        superclaude_commands: z.array(z.string()).optional(),
        superclaude_personas: z.array(z.string()).optional(),
        superclaude_flags: z.array(z.string()).optional(),
        analysis_focus: z.array(z.string()).optional(),
        tools_recommended: z.array(z.string()).optional()
    }).optional()
});
export const GetMessagesInput = z.object({
    participant: ParticipantId.optional(),
    status: z.array(MessageStatus).optional(),
    type: z.array(MessageType).optional(),
    priority: z.array(Priority).optional(),
    since_hours: z.number().positive().optional(),
    thread_id: z.string().optional(),
    limit: z.number().positive().max(100).default(20),
    detail_level: z.enum(['index', 'summary', 'full']).default('summary')
});
export const RespondMessageInput = z.object({
    message_id: z.string(),
    content: z.string(),
    resolution_status: ResolutionStatus.optional()
});
export const SearchMessagesInput = z.object({
    query: z.string(),
    semantic: z.boolean().default(true),
    tags: z.array(z.string()).optional(),
    date_range: z.object({
        from: z.date().optional(),
        to: z.date().optional()
    }).optional(),
    participants: z.array(ParticipantId).optional(),
    limit: z.number().positive().max(50).default(10)
});
export const CompactThreadInput = z.object({
    thread_id: z.string(),
    strategy: z.enum(['summarize', 'consolidate', 'archive']).default('summarize'),
    preserve_decisions: z.boolean().default(true),
    preserve_critical: z.boolean().default(true)
});
// Error types
export class CoordinationError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'CoordinationError';
    }
}
export class ValidationError extends CoordinationError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}
export class DatabaseError extends CoordinationError {
    constructor(message, details) {
        super(message, 'DATABASE_ERROR', details);
        this.name = 'DatabaseError';
    }
}
export class PermissionError extends CoordinationError {
    constructor(message, details) {
        super(message, 'PERMISSION_ERROR', details);
        this.name = 'PermissionError';
    }
}
//# sourceMappingURL=index.js.map