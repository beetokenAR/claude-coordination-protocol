export declare const SCHEMA_VERSION = 2;
export declare const CREATE_MESSAGES_TABLE = "\n  CREATE TABLE IF NOT EXISTS messages (\n    id TEXT PRIMARY KEY,\n    thread_id TEXT NOT NULL,\n    from_participant TEXT NOT NULL,\n    to_participants TEXT NOT NULL, -- JSON array\n    type TEXT NOT NULL CHECK (type IN ('arch', 'contract', 'sync', 'update', 'q', 'emergency', 'broadcast')),\n    priority TEXT NOT NULL CHECK (priority IN ('CRITICAL', 'H', 'M', 'L')),\n    status TEXT NOT NULL CHECK (status IN ('pending', 'read', 'responded', 'resolved', 'archived', 'cancelled')) DEFAULT 'pending',\n    \n    subject TEXT NOT NULL,\n    summary TEXT NOT NULL,\n    content_ref TEXT,\n    \n    created_at TEXT NOT NULL, -- ISO date string\n    updated_at TEXT NOT NULL, -- ISO date string\n    expires_at TEXT, -- ISO date string\n    response_required INTEGER NOT NULL DEFAULT 1, -- SQLite boolean\n    dependencies TEXT NOT NULL DEFAULT '[]', -- JSON array\n    \n    tags TEXT NOT NULL DEFAULT '[]', -- JSON array\n    semantic_vector TEXT, -- JSON array of numbers\n    suggested_approach TEXT, -- JSON object with SuperClaude suggestions\n    \n    resolution_status TEXT CHECK (resolution_status IN ('partial', 'complete', 'requires_followup', 'blocked')),\n    resolved_at TEXT, -- ISO date string\n    resolved_by TEXT,\n    \n    FOREIGN KEY (resolved_by) REFERENCES participants(id)\n  )\n";
export declare const CREATE_CONVERSATIONS_TABLE = "\n  CREATE TABLE IF NOT EXISTS conversations (\n    thread_id TEXT PRIMARY KEY,\n    participants TEXT NOT NULL, -- JSON array\n    topic TEXT NOT NULL,\n    tags TEXT NOT NULL DEFAULT '[]', -- JSON array\n    created_at TEXT NOT NULL, -- ISO date string\n    last_activity TEXT NOT NULL, -- ISO date string\n    status TEXT NOT NULL CHECK (status IN ('active', 'resolved', 'archived')) DEFAULT 'active',\n    resolution_summary TEXT,\n    message_count INTEGER NOT NULL DEFAULT 0\n  )\n";
export declare const CREATE_PARTICIPANTS_TABLE = "\n  CREATE TABLE IF NOT EXISTS participants (\n    id TEXT PRIMARY KEY,\n    capabilities TEXT NOT NULL DEFAULT '[]', -- JSON array\n    last_seen TEXT, -- ISO date string\n    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance')) DEFAULT 'active',\n    preferences TEXT DEFAULT '{}', -- JSON object\n    default_priority TEXT NOT NULL CHECK (default_priority IN ('CRITICAL', 'H', 'M', 'L')) DEFAULT 'M'\n  )\n";
export declare const CREATE_METADATA_TABLE = "\n  CREATE TABLE IF NOT EXISTS metadata (\n    key TEXT PRIMARY KEY,\n    value TEXT NOT NULL,\n    updated_at TEXT NOT NULL\n  )\n";
export declare const CREATE_INDEXES: string[];
export declare const CREATE_FTS_TABLES: string[];
/**
 * Initialize database schema
 */
export declare function initializeSchema(db: any): void;
/**
 * Check if database needs migration
 */
export declare function checkSchemaVersion(db: any): number;
/**
 * Migrate database schema if needed
 */
export declare function migrateSchema(db: any): void;
//# sourceMappingURL=schema.d.ts.map