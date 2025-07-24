import Database from 'better-sqlite3'
import { migrate, IMigration } from '@blackglory/better-sqlite3-migrations'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { DatabaseError } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class DatabaseMigrator {
  private db: Database.Database
  private migrationsPath: string

  constructor(db: Database.Database) {
    this.db = db
    this.migrationsPath = path.join(__dirname, 'migrations')
    this.ensureMigrationsDirectory()
  }

  private ensureMigrationsDirectory(): void {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true })
    }
  }

  /**
   * Get all migration files
   */
  private getMigrations(): IMigration[] {
    const migrations: IMigration[] = []
    
    // Hardcoded initial migrations (will be moved to files)
    migrations.push({
      version: 1,
      up: `
        -- Initial schema
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
          
          resolution_status TEXT CHECK (resolution_status IN ('partial', 'complete', 'requires_followup', 'blocked')),
          resolved_at TEXT, -- ISO date string
          resolved_by TEXT,
          
          FOREIGN KEY (resolved_by) REFERENCES participants(id)
        );

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
        );

        CREATE TABLE IF NOT EXISTS participants (
          id TEXT PRIMARY KEY,
          capabilities TEXT NOT NULL DEFAULT '[]', -- JSON array
          last_seen TEXT, -- ISO date string
          status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance')) DEFAULT 'active',
          preferences TEXT DEFAULT '{}', -- JSON object
          default_priority TEXT NOT NULL CHECK (default_priority IN ('CRITICAL', 'H', 'M', 'L')) DEFAULT 'M'
        );

        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
        CREATE INDEX IF NOT EXISTS idx_messages_from_participant ON messages(from_participant);
        CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
        CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
        CREATE INDEX IF NOT EXISTS idx_messages_priority ON messages(priority);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at);
        CREATE INDEX IF NOT EXISTS idx_messages_tags ON messages(tags);
        
        CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
        CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations(last_activity);
        CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participants);
        
        CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);
        CREATE INDEX IF NOT EXISTS idx_participants_last_seen ON participants(last_seen);

        -- FTS tables
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          id UNINDEXED,
          subject,
          summary,
          content='messages',
          content_rowid='rowid'
        );
        
        -- Triggers to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
          INSERT INTO messages_fts(rowid, id, subject, summary) VALUES (new.rowid, new.id, new.subject, new.summary);
        END;
        
        CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, id, subject, summary) VALUES('delete', old.rowid, old.id, old.subject, old.summary);
        END;
        
        CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
          INSERT INTO messages_fts(messages_fts, rowid, id, subject, summary) VALUES('delete', old.rowid, old.id, old.subject, old.summary);
          INSERT INTO messages_fts(rowid, id, subject, summary) VALUES (new.rowid, new.id, new.subject, new.summary);
        END;
      `,
      down: `
        DROP TRIGGER IF EXISTS messages_fts_update;
        DROP TRIGGER IF EXISTS messages_fts_delete;
        DROP TRIGGER IF EXISTS messages_fts_insert;
        DROP TABLE IF EXISTS messages_fts;
        DROP TABLE IF EXISTS metadata;
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS conversations;
        DROP TABLE IF EXISTS participants;
      `
    })

    migrations.push({
      version: 2,
      up: `
        -- Add suggested_approach column
        ALTER TABLE messages ADD COLUMN suggested_approach TEXT;
      `,
      down: `
        -- SQLite doesn't support DROP COLUMN directly
        -- Would need to recreate table without the column
        -- This is a no-op for safety
        SELECT 1;
      `
    })

    // Load additional migrations from files
    const files = fs.readdirSync(this.migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const match = file.match(/^(\d+)-(up|down)-(.+)\.sql$/)
      if (match) {
        const version = parseInt(match[1])
        const direction = match[2]
        const content = fs.readFileSync(path.join(this.migrationsPath, file), 'utf-8')
        
        let migration = migrations.find(m => m.version === version)
        if (!migration) {
          migration = { version, up: '', down: '' }
          migrations.push(migration)
        }
        
        if (direction === 'up') {
          migration.up = content
        } else {
          migration.down = content || '-- No down migration'
        }
      }
    }

    return migrations.sort((a, b) => a.version - b.version)
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    try {
      // First check if we need special handling for version 2
      const currentVersion = this.getCurrentVersion()
      
      if (currentVersion === 1) {
        // Check if suggested_approach column already exists
        const columns = this.db.pragma('table_info(messages)') as any[]
        const hasColumn = columns.some(col => col.name === 'suggested_approach')
        
        if (hasColumn) {
          // Column already exists, just update the version
          console.log('suggested_approach column already exists, updating version to 2')
          this.db.pragma('user_version = 2')
        }
      }
      
      const migrations = this.getMigrations()
      
      // Use better-sqlite3-migrations
      migrate(this.db, migrations)
      
      console.log('Database migrations completed successfully')
    } catch (error: any) {
      throw new DatabaseError(
        `Migration failed: ${error.message}`,
        { error: error.message }
      )
    }
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    try {
      const version = this.db.pragma('user_version', { simple: true }) as number
      return version
    } catch (error: any) {
      return 0
    }
  }

  /**
   * Create a new migration file
   */
  createMigration(name: string): { upPath: string; downPath: string } {
    const version = this.getNextVersion()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    const upPath = path.join(this.migrationsPath, `${version.toString().padStart(3, '0')}-up-${name}-${timestamp}.sql`)
    const downPath = path.join(this.migrationsPath, `${version.toString().padStart(3, '0')}-down-${name}-${timestamp}.sql`)
    
    fs.writeFileSync(upPath, `-- Migration ${version}: ${name}\n-- Created: ${new Date().toISOString()}\n\n`)
    fs.writeFileSync(downPath, `-- Rollback for migration ${version}: ${name}\n-- Created: ${new Date().toISOString()}\n\n`)
    
    return { upPath, downPath }
  }

  /**
   * Get next migration version number
   */
  private getNextVersion(): number {
    const migrations = this.getMigrations()
    const maxVersion = migrations.reduce((max, m) => Math.max(max, m.version), 0)
    return maxVersion + 1
  }

  /**
   * Validate migration before applying
   */
  validateMigration(version: number): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const migrations = this.getMigrations()
    const migration = migrations.find(m => m.version === version)
    
    if (!migration) {
      errors.push(`Migration version ${version} not found`)
      return { valid: false, errors }
    }
    
    if (!migration.up) {
      errors.push(`Migration ${version} has no up script`)
    } else if (typeof migration.up === 'string') {
      if (migration.up.trim() === '') {
        errors.push(`Migration ${version} has empty up script`)
      }
      
      // Check for dangerous operations in string migrations
      const dangerousPatterns = [
        /DROP\s+TABLE\s+(?!IF\s+EXISTS)/i,
        /DELETE\s+FROM/i,
        /TRUNCATE/i
      ]
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(migration.up)) {
          errors.push(`Migration ${version} contains potentially dangerous operation: ${pattern}`)
        }
      }
    }
    
    return { valid: errors.length === 0, errors }
  }
}