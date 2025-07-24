import { z } from 'zod';
export declare const MessageType: z.ZodEnum<["arch", "contract", "sync", "update", "q", "emergency", "broadcast"]>;
export declare const Priority: z.ZodEnum<["CRITICAL", "H", "M", "L"]>;
export declare const MessageStatus: z.ZodEnum<["pending", "read", "responded", "resolved", "archived", "cancelled"]>;
export declare const ResolutionStatus: z.ZodEnum<["partial", "complete", "requires_followup", "blocked"]>;
export type MessageType = z.infer<typeof MessageType>;
export type Priority = z.infer<typeof Priority>;
export type MessageStatus = z.infer<typeof MessageStatus>;
export type ResolutionStatus = z.infer<typeof ResolutionStatus>;
export declare const ParticipantId: z.ZodString;
export declare const Participant: z.ZodObject<{
    id: z.ZodString;
    capabilities: z.ZodArray<z.ZodString, "many">;
    last_seen: z.ZodOptional<z.ZodDate>;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive", "maintenance"]>>;
    preferences: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    default_priority: z.ZodDefault<z.ZodEnum<["CRITICAL", "H", "M", "L"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "inactive" | "maintenance";
    id?: string;
    capabilities?: string[];
    last_seen?: Date;
    preferences?: Record<string, unknown>;
    default_priority?: "CRITICAL" | "H" | "M" | "L";
}, {
    status?: "active" | "inactive" | "maintenance";
    id?: string;
    capabilities?: string[];
    last_seen?: Date;
    preferences?: Record<string, unknown>;
    default_priority?: "CRITICAL" | "H" | "M" | "L";
}>;
export type ParticipantId = z.infer<typeof ParticipantId>;
export type Participant = z.infer<typeof Participant>;
export declare const CoordinationMessage: z.ZodObject<{
    id: z.ZodString;
    thread_id: z.ZodString;
    from: z.ZodString;
    to: z.ZodArray<z.ZodString, "many">;
    type: z.ZodEnum<["arch", "contract", "sync", "update", "q", "emergency", "broadcast"]>;
    priority: z.ZodEnum<["CRITICAL", "H", "M", "L"]>;
    status: z.ZodDefault<z.ZodEnum<["pending", "read", "responded", "resolved", "archived", "cancelled"]>>;
    subject: z.ZodString;
    summary: z.ZodString;
    content_ref: z.ZodOptional<z.ZodString>;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
    expires_at: z.ZodOptional<z.ZodDate>;
    response_required: z.ZodDefault<z.ZodBoolean>;
    dependencies: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    semantic_vector: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    suggested_approach: z.ZodOptional<z.ZodObject<{
        superclaude_commands: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        superclaude_personas: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        superclaude_flags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        analysis_focus: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        tools_recommended: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        superclaude_commands?: string[];
        superclaude_personas?: string[];
        superclaude_flags?: string[];
        analysis_focus?: string[];
        tools_recommended?: string[];
    }, {
        superclaude_commands?: string[];
        superclaude_personas?: string[];
        superclaude_flags?: string[];
        analysis_focus?: string[];
        tools_recommended?: string[];
    }>>;
    resolution_status: z.ZodOptional<z.ZodEnum<["partial", "complete", "requires_followup", "blocked"]>>;
    resolved_at: z.ZodOptional<z.ZodDate>;
    resolved_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: "arch" | "contract" | "sync" | "update" | "q" | "emergency" | "broadcast";
    status?: "pending" | "read" | "responded" | "resolved" | "archived" | "cancelled";
    id?: string;
    thread_id?: string;
    from?: string;
    to?: string[];
    priority?: "CRITICAL" | "H" | "M" | "L";
    subject?: string;
    summary?: string;
    content_ref?: string;
    created_at?: Date;
    updated_at?: Date;
    expires_at?: Date;
    response_required?: boolean;
    dependencies?: string[];
    tags?: string[];
    semantic_vector?: number[];
    suggested_approach?: {
        superclaude_commands?: string[];
        superclaude_personas?: string[];
        superclaude_flags?: string[];
        analysis_focus?: string[];
        tools_recommended?: string[];
    };
    resolution_status?: "partial" | "complete" | "requires_followup" | "blocked";
    resolved_at?: Date;
    resolved_by?: string;
}, {
    type?: "arch" | "contract" | "sync" | "update" | "q" | "emergency" | "broadcast";
    status?: "pending" | "read" | "responded" | "resolved" | "archived" | "cancelled";
    id?: string;
    thread_id?: string;
    from?: string;
    to?: string[];
    priority?: "CRITICAL" | "H" | "M" | "L";
    subject?: string;
    summary?: string;
    content_ref?: string;
    created_at?: Date;
    updated_at?: Date;
    expires_at?: Date;
    response_required?: boolean;
    dependencies?: string[];
    tags?: string[];
    semantic_vector?: number[];
    suggested_approach?: {
        superclaude_commands?: string[];
        superclaude_personas?: string[];
        superclaude_flags?: string[];
        analysis_focus?: string[];
        tools_recommended?: string[];
    };
    resolution_status?: "partial" | "complete" | "requires_followup" | "blocked";
    resolved_at?: Date;
    resolved_by?: string;
}>;
export type CoordinationMessage = z.infer<typeof CoordinationMessage>;
export declare const Conversation: z.ZodObject<{
    thread_id: z.ZodString;
    participants: z.ZodArray<z.ZodString, "many">;
    topic: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    created_at: z.ZodDate;
    last_activity: z.ZodDate;
    status: z.ZodDefault<z.ZodEnum<["active", "resolved", "archived"]>>;
    resolution_summary: z.ZodOptional<z.ZodString>;
    message_count: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status?: "resolved" | "archived" | "active";
    thread_id?: string;
    created_at?: Date;
    tags?: string[];
    participants?: string[];
    topic?: string;
    last_activity?: Date;
    resolution_summary?: string;
    message_count?: number;
}, {
    status?: "resolved" | "archived" | "active";
    thread_id?: string;
    created_at?: Date;
    tags?: string[];
    participants?: string[];
    topic?: string;
    last_activity?: Date;
    resolution_summary?: string;
    message_count?: number;
}>;
export type Conversation = z.infer<typeof Conversation>;
export declare const CoordinationConfig: z.ZodObject<{
    participant_id: z.ZodString;
    data_directory: z.ZodDefault<z.ZodString>;
    archive_days: z.ZodDefault<z.ZodNumber>;
    token_limit: z.ZodDefault<z.ZodNumber>;
    auto_compact: z.ZodDefault<z.ZodBoolean>;
    participants: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        capabilities: z.ZodArray<z.ZodString, "many">;
        last_seen: z.ZodOptional<z.ZodDate>;
        status: z.ZodDefault<z.ZodEnum<["active", "inactive", "maintenance"]>>;
        preferences: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        default_priority: z.ZodDefault<z.ZodEnum<["CRITICAL", "H", "M", "L"]>>;
    }, "strip", z.ZodTypeAny, {
        status?: "active" | "inactive" | "maintenance";
        id?: string;
        capabilities?: string[];
        last_seen?: Date;
        preferences?: Record<string, unknown>;
        default_priority?: "CRITICAL" | "H" | "M" | "L";
    }, {
        status?: "active" | "inactive" | "maintenance";
        id?: string;
        capabilities?: string[];
        last_seen?: Date;
        preferences?: Record<string, unknown>;
        default_priority?: "CRITICAL" | "H" | "M" | "L";
    }>, "many">>;
    notification_settings: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        priority_threshold: z.ZodDefault<z.ZodEnum<["CRITICAL", "H", "M", "L"]>>;
        batch_notifications: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean;
        priority_threshold?: "CRITICAL" | "H" | "M" | "L";
        batch_notifications?: boolean;
    }, {
        enabled?: boolean;
        priority_threshold?: "CRITICAL" | "H" | "M" | "L";
        batch_notifications?: boolean;
    }>>;
}, "strip", z.ZodTypeAny, {
    participants?: {
        status?: "active" | "inactive" | "maintenance";
        id?: string;
        capabilities?: string[];
        last_seen?: Date;
        preferences?: Record<string, unknown>;
        default_priority?: "CRITICAL" | "H" | "M" | "L";
    }[];
    participant_id?: string;
    data_directory?: string;
    archive_days?: number;
    token_limit?: number;
    auto_compact?: boolean;
    notification_settings?: {
        enabled?: boolean;
        priority_threshold?: "CRITICAL" | "H" | "M" | "L";
        batch_notifications?: boolean;
    };
}, {
    participants?: {
        status?: "active" | "inactive" | "maintenance";
        id?: string;
        capabilities?: string[];
        last_seen?: Date;
        preferences?: Record<string, unknown>;
        default_priority?: "CRITICAL" | "H" | "M" | "L";
    }[];
    participant_id?: string;
    data_directory?: string;
    archive_days?: number;
    token_limit?: number;
    auto_compact?: boolean;
    notification_settings?: {
        enabled?: boolean;
        priority_threshold?: "CRITICAL" | "H" | "M" | "L";
        batch_notifications?: boolean;
    };
}>;
export type CoordinationConfig = z.infer<typeof CoordinationConfig>;
export declare const SendMessageInput: z.ZodObject<{
    to: z.ZodArray<z.ZodString, "many">;
    type: z.ZodEnum<["arch", "contract", "sync", "update", "q", "emergency", "broadcast"]>;
    priority: z.ZodEnum<["CRITICAL", "H", "M", "L"]>;
    subject: z.ZodString;
    content: z.ZodString;
    response_required: z.ZodDefault<z.ZodBoolean>;
    expires_in_hours: z.ZodDefault<z.ZodNumber>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    suggested_approach: z.ZodOptional<z.ZodObject<{
        superclaude_commands: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        superclaude_personas: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        superclaude_flags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        analysis_focus: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        tools_recommended: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        superclaude_commands?: string[];
        superclaude_personas?: string[];
        superclaude_flags?: string[];
        analysis_focus?: string[];
        tools_recommended?: string[];
    }, {
        superclaude_commands?: string[];
        superclaude_personas?: string[];
        superclaude_flags?: string[];
        analysis_focus?: string[];
        tools_recommended?: string[];
    }>>;
}, "strip", z.ZodTypeAny, {
    type?: "arch" | "contract" | "sync" | "update" | "q" | "emergency" | "broadcast";
    to?: string[];
    priority?: "CRITICAL" | "H" | "M" | "L";
    subject?: string;
    response_required?: boolean;
    tags?: string[];
    suggested_approach?: {
        superclaude_commands?: string[];
        superclaude_personas?: string[];
        superclaude_flags?: string[];
        analysis_focus?: string[];
        tools_recommended?: string[];
    };
    content?: string;
    expires_in_hours?: number;
}, {
    type?: "arch" | "contract" | "sync" | "update" | "q" | "emergency" | "broadcast";
    to?: string[];
    priority?: "CRITICAL" | "H" | "M" | "L";
    subject?: string;
    response_required?: boolean;
    tags?: string[];
    suggested_approach?: {
        superclaude_commands?: string[];
        superclaude_personas?: string[];
        superclaude_flags?: string[];
        analysis_focus?: string[];
        tools_recommended?: string[];
    };
    content?: string;
    expires_in_hours?: number;
}>;
export declare const GetMessagesInput: z.ZodObject<{
    participant: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodArray<z.ZodEnum<["pending", "read", "responded", "resolved", "archived", "cancelled"]>, "many">>;
    type: z.ZodOptional<z.ZodArray<z.ZodEnum<["arch", "contract", "sync", "update", "q", "emergency", "broadcast"]>, "many">>;
    priority: z.ZodOptional<z.ZodArray<z.ZodEnum<["CRITICAL", "H", "M", "L"]>, "many">>;
    since_hours: z.ZodOptional<z.ZodNumber>;
    thread_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    detail_level: z.ZodDefault<z.ZodEnum<["index", "summary", "full"]>>;
}, "strip", z.ZodTypeAny, {
    type?: ("arch" | "contract" | "sync" | "update" | "q" | "emergency" | "broadcast")[];
    status?: ("pending" | "read" | "responded" | "resolved" | "archived" | "cancelled")[];
    thread_id?: string;
    priority?: ("CRITICAL" | "H" | "M" | "L")[];
    participant?: string;
    since_hours?: number;
    limit?: number;
    detail_level?: "summary" | "index" | "full";
}, {
    type?: ("arch" | "contract" | "sync" | "update" | "q" | "emergency" | "broadcast")[];
    status?: ("pending" | "read" | "responded" | "resolved" | "archived" | "cancelled")[];
    thread_id?: string;
    priority?: ("CRITICAL" | "H" | "M" | "L")[];
    participant?: string;
    since_hours?: number;
    limit?: number;
    detail_level?: "summary" | "index" | "full";
}>;
export declare const RespondMessageInput: z.ZodObject<{
    message_id: z.ZodString;
    content: z.ZodString;
    resolution_status: z.ZodOptional<z.ZodEnum<["partial", "complete", "requires_followup", "blocked"]>>;
}, "strip", z.ZodTypeAny, {
    resolution_status?: "partial" | "complete" | "requires_followup" | "blocked";
    content?: string;
    message_id?: string;
}, {
    resolution_status?: "partial" | "complete" | "requires_followup" | "blocked";
    content?: string;
    message_id?: string;
}>;
export declare const SearchMessagesInput: z.ZodObject<{
    query: z.ZodString;
    semantic: z.ZodDefault<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    date_range: z.ZodOptional<z.ZodObject<{
        from: z.ZodOptional<z.ZodDate>;
        to: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        from?: Date;
        to?: Date;
    }, {
        from?: Date;
        to?: Date;
    }>>;
    participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    tags?: string[];
    participants?: string[];
    limit?: number;
    query?: string;
    semantic?: boolean;
    date_range?: {
        from?: Date;
        to?: Date;
    };
}, {
    tags?: string[];
    participants?: string[];
    limit?: number;
    query?: string;
    semantic?: boolean;
    date_range?: {
        from?: Date;
        to?: Date;
    };
}>;
export declare const CompactThreadInput: z.ZodObject<{
    thread_id: z.ZodString;
    strategy: z.ZodDefault<z.ZodEnum<["summarize", "consolidate", "archive"]>>;
    preserve_decisions: z.ZodDefault<z.ZodBoolean>;
    preserve_critical: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    thread_id?: string;
    strategy?: "summarize" | "consolidate" | "archive";
    preserve_decisions?: boolean;
    preserve_critical?: boolean;
}, {
    thread_id?: string;
    strategy?: "summarize" | "consolidate" | "archive";
    preserve_decisions?: boolean;
    preserve_critical?: boolean;
}>;
export type SendMessageInput = z.infer<typeof SendMessageInput>;
export type GetMessagesInput = z.infer<typeof GetMessagesInput>;
export type RespondMessageInput = z.infer<typeof RespondMessageInput>;
export type SearchMessagesInput = z.infer<typeof SearchMessagesInput>;
export type CompactThreadInput = z.infer<typeof CompactThreadInput>;
export interface MessageRow {
    id: string;
    thread_id: string;
    from_participant: string;
    to_participants: string;
    type: MessageType;
    priority: Priority;
    status: MessageStatus;
    subject: string;
    summary: string;
    content_ref?: string;
    created_at: string;
    updated_at: string;
    expires_at?: string;
    response_required: number;
    dependencies: string;
    tags: string;
    semantic_vector?: string;
    suggested_approach?: string;
    resolution_status?: ResolutionStatus;
    resolved_at?: string;
    resolved_by?: string;
}
export interface ConversationRow {
    thread_id: string;
    participants: string;
    topic: string;
    tags: string;
    created_at: string;
    last_activity: string;
    status: 'active' | 'resolved' | 'archived';
    resolution_summary?: string;
    message_count: number;
}
export interface ParticipantRow {
    id: string;
    capabilities: string;
    last_seen?: string;
    status: 'active' | 'inactive' | 'maintenance';
    preferences?: string;
    default_priority: Priority;
}
export declare class CoordinationError extends Error {
    code: string;
    details?: Record<string, unknown>;
    constructor(message: string, code: string, details?: Record<string, unknown>);
}
export declare class ValidationError extends CoordinationError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class DatabaseError extends CoordinationError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class PermissionError extends CoordinationError {
    constructor(message: string, details?: Record<string, unknown>);
}
export interface MessageFilters {
    participant?: ParticipantId;
    status?: MessageStatus[];
    type?: MessageType[];
    priority?: Priority[];
    since?: Date;
    thread_id?: string;
}
export interface PaginationOptions {
    limit: number;
    offset: number;
}
export interface SearchResult {
    message: CoordinationMessage;
    relevance_score: number;
    match_context: string;
}
export interface CompactionResult {
    original_count: number;
    compacted_count: number;
    space_saved_bytes: number;
    summary?: string;
}
export interface SystemStats {
    total_messages: number;
    active_messages: number;
    resolved_messages: number;
    archived_messages: number;
    participants: number;
    active_threads: number;
    disk_usage_bytes: number;
    avg_response_time_hours?: number;
}
//# sourceMappingURL=index.d.ts.map