import { DatabaseError } from '../types/index.js'
import { DatabaseMigrator } from './migrator.js'

export const SCHEMA_VERSION = 2

export const CREATE_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    from_participant TEXT NOT NULL,
    to_participants TEXT NOT NULL, -- JSON array
    type TEXT NOT NULL CHECK (type IN ('arch', 'contract', 'sync', 'update', 'q', 'emergency', 'broadcast')),
    priority TEXT NOT NULL CHECK (priority IN ('CRITICAL', 'H', 'M', 'L')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'read', 'responded', 'resolved', 'archived', 'cancelled')) DEFAULT 'pending',
    
    subject TEXT NOT NULL,
    summary TEXT NOT NULL,
    content_ref TEXT,
    
    created_at TEXT NOT NULL, -- ISO date string
    updated_at TEXT NOT NULL, -- ISO date string
    expires_at TEXT, -- ISO date string
    response_required INTEGER NOT NULL DEFAULT 1, -- SQLite boolean
    dependencies TEXT NOT NULL DEFAULT '[]', -- JSON array
    
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array
    semantic_vector TEXT, -- JSON array of numbers
    suggested_approach TEXT, -- JSON object with SuperClaude suggestions
    
    resolution_status TEXT CHECK (resolution_status IN ('partial', 'complete', 'requires_followup', 'blocked')),
    resolved_at TEXT, -- ISO date string
    resolved_by TEXT,
    
    FOREIGN KEY (resolved_by) REFERENCES participants(id)
  )
`

export const CREATE_CONVERSATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS conversations (
    thread_id TEXT PRIMARY KEY,
    participants TEXT NOT NULL, -- JSON array
    topic TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array
    created_at TEXT NOT NULL, -- ISO date string
    last_activity TEXT NOT NULL, -- ISO date string
    status TEXT NOT NULL CHECK (status IN ('active', 'resolved', 'archived')) DEFAULT 'active',
    resolution_summary TEXT,
    message_count INTEGER NOT NULL DEFAULT 0
  )
`

export const CREATE_PARTICIPANTS_TABLE = `
  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    capabilities TEXT NOT NULL DEFAULT '[]', -- JSON array
    last_seen TEXT, -- ISO date string
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance')) DEFAULT 'active',
    preferences TEXT DEFAULT '{}', -- JSON object
    default_priority TEXT NOT NULL CHECK (default_priority IN ('CRITICAL', 'H', 'M', 'L')) DEFAULT 'M'
  )
`

export const CREATE_METADATA_TABLE = `
  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`

// Indexes for performance
export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)',
  'CREATE INDEX IF NOT EXISTS idx_messages_from_participant ON messages(from_participant)',
  'CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)',
  'CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)',
  'CREATE INDEX IF NOT EXISTS idx_messages_priority ON messages(priority)',
  'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_messages_tags ON messages(tags)', // For JSON search
  
  'CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations(last_activity)',
  'CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participants)', // For JSON search
  
  'CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status)',
  'CREATE INDEX IF NOT EXISTS idx_participants_last_seen ON participants(last_seen)'
]

// Virtual tables for full-text search
export const CREATE_FTS_TABLES = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    id UNINDEXED,
    subject,
    summary,
    content='messages',
    content_rowid='rowid'
  )`,
  
  // Triggers to keep FTS in sync
  `CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, id, subject, summary) VALUES (new.rowid, new.id, new.subject, new.summary);
  END`,
  
  `CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, id, subject, summary) VALUES('delete', old.rowid, old.id, old.subject, old.summary);
  END`,
  
  `CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, id, subject, summary) VALUES('delete', old.rowid, old.id, old.subject, old.summary);
    INSERT INTO messages_fts(rowid, id, subject, summary) VALUES (new.rowid, new.id, new.subject, new.summary);
  END`
]

/**
 * Initialize database schema
 * @deprecated Use DatabaseMigrator instead
 */
export function initializeSchema(db: any): void {
  // This function is kept for backward compatibility
  // New code should use DatabaseMigrator
  const migrator = new DatabaseMigrator(db)
  migrator.migrate()
}

/**
 * Check if database needs migration
 * @deprecated Use DatabaseMigrator.getCurrentVersion() instead
 */
export function checkSchemaVersion(db: any): number {
  const migrator = new DatabaseMigrator(db)
  return migrator.getCurrentVersion()
}

/**
 * Migrate database schema if needed
 */
export function migrateSchema(db: any): void {
  const migrator = new DatabaseMigrator(db)
  migrator.migrate()
}