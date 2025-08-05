import Database from 'better-sqlite3'
import { DatabaseError } from '../types/index.js'
import fs from 'fs'
import path from 'path'

export type PurgeLevel = 'soft' | 'standard' | 'complete' | 'full'

export interface PurgeOptions {
  level: PurgeLevel
  dryRun?: boolean
  skipBackup?: boolean
  force?: boolean
  beforeDate?: Date
}

export interface PurgeResult {
  level: PurgeLevel
  deletedMessages: number
  deletedConversations: number
  deletedParticipants: number
  freedSpace?: number
  backupPath?: string
  duration: number
}

export class DatabasePurger {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  /**
   * Purge database based on specified level
   */
  async purge(options: PurgeOptions): Promise<PurgeResult> {
    const startTime = Date.now()
    
    // Validate options
    this.validateOptions(options)

    // Create backup unless explicitly skipped
    let backupPath: string | undefined
    if (!options.skipBackup && !options.dryRun) {
      backupPath = await this.createBackup()
      console.error('Backup created:', backupPath)
    }

    // Execute purge based on level
    const result = options.dryRun 
      ? await this.dryRunPurge(options)
      : await this.executePurge(options)

    return {
      ...result,
      backupPath,
      duration: Date.now() - startTime
    }
  }

  /**
   * Validate purge options
   */
  private validateOptions(options: PurgeOptions): void {
    const validLevels: PurgeLevel[] = ['soft', 'standard', 'complete', 'full']
    
    if (!validLevels.includes(options.level)) {
      throw new DatabaseError(`Invalid purge level: ${options.level}`)
    }

    if (options.level === 'full' && !options.force) {
      throw new DatabaseError('Full purge requires force flag for safety')
    }

    if (options.beforeDate && options.beforeDate > new Date()) {
      throw new DatabaseError('Cannot purge future dates')
    }
  }

  /**
   * Create database backup
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = path.join(process.cwd(), '.backups')
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const backupPath = path.join(backupDir, `ccp-backup-${timestamp}.db`)
    
    // Use SQLite backup API
    await this.db.backup(backupPath)
    
    // Verify backup
    const backupSize = fs.statSync(backupPath).size
    if (backupSize === 0) {
      throw new DatabaseError('Backup failed: empty backup file')
    }

    return backupPath
  }

  /**
   * Perform dry run to show what would be deleted
   */
  private async dryRunPurge(options: PurgeOptions): Promise<PurgeResult> {
    const dateFilter = options.beforeDate 
      ? `AND created_at < '${options.beforeDate.toISOString()}'`
      : ''

    let deletedMessages = 0
    let deletedConversations = 0
    let deletedParticipants = 0

    switch (options.level) {
      case 'soft':
        // Count archived/resolved messages
        const softCount = this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM messages 
          WHERE status IN ('archived', 'resolved') ${dateFilter}
        `).get() as { count: number }
        deletedMessages = softCount.count
        break

      case 'standard':
        // Count all messages
        const msgCount = this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM messages 
          WHERE 1=1 ${dateFilter}
        `).get() as { count: number }
        deletedMessages = msgCount.count

        // Count conversations
        const convCount = this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM conversations 
          WHERE 1=1 ${dateFilter.replace('created_at', 'created_at')}
        `).get() as { count: number }
        deletedConversations = convCount.count
        break

      case 'complete':
        // Count everything except metadata
        const completeMsg = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }
        const completeConv = this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }
        const completePart = this.db.prepare('SELECT COUNT(*) as count FROM participants').get() as { count: number }
        
        deletedMessages = completeMsg.count
        deletedConversations = completeConv.count
        deletedParticipants = completePart.count
        break

      case 'full':
        // Would delete everything
        const fullMsg = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }
        const fullConv = this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }
        const fullPart = this.db.prepare('SELECT COUNT(*) as count FROM participants').get() as { count: number }
        
        deletedMessages = fullMsg.count
        deletedConversations = fullConv.count
        deletedParticipants = fullPart.count
        break
    }

    return {
      level: options.level,
      deletedMessages,
      deletedConversations,
      deletedParticipants,
      duration: 0
    }
  }

  /**
   * Execute actual purge
   */
  private async executePurge(options: PurgeOptions): Promise<PurgeResult> {
    const dateFilter = options.beforeDate 
      ? `AND created_at < '${options.beforeDate.toISOString()}'`
      : ''

    let deletedMessages = 0
    let deletedConversations = 0
    let deletedParticipants = 0

    // Start transaction for consistency
    const purgeTransaction = this.db.transaction(() => {
      switch (options.level) {
        case 'soft':
          // Delete only archived/resolved messages
          const softResult = this.db.prepare(`
            DELETE FROM messages 
            WHERE status IN ('archived', 'resolved') ${dateFilter}
          `).run()
          deletedMessages = softResult.changes
          
          // Clean up FTS
          this.db.prepare('INSERT INTO messages_fts(messages_fts) VALUES("rebuild")').run()
          break

        case 'standard':
          // Delete messages
          const msgResult = this.db.prepare(`
            DELETE FROM messages 
            WHERE 1=1 ${dateFilter}
          `).run()
          deletedMessages = msgResult.changes

          // Delete conversations
          const convResult = this.db.prepare(`
            DELETE FROM conversations 
            WHERE 1=1 ${dateFilter.replace('created_at', 'created_at')}
          `).run()
          deletedConversations = convResult.changes

          // Rebuild FTS
          this.db.prepare('INSERT INTO messages_fts(messages_fts) VALUES("rebuild")').run()
          break

        case 'complete':
          // Delete all data except metadata
          deletedMessages = (this.db.prepare('DELETE FROM messages').run()).changes
          deletedConversations = (this.db.prepare('DELETE FROM conversations').run()).changes
          deletedParticipants = (this.db.prepare('DELETE FROM participants').run()).changes
          
          // Rebuild FTS
          this.db.prepare('INSERT INTO messages_fts(messages_fts) VALUES("rebuild")').run()
          break

        case 'full':
          // Delete everything and reset sequences
          deletedMessages = (this.db.prepare('DELETE FROM messages').run()).changes
          deletedConversations = (this.db.prepare('DELETE FROM conversations').run()).changes
          deletedParticipants = (this.db.prepare('DELETE FROM participants').run()).changes
          
          // Delete metadata
          this.db.prepare('DELETE FROM metadata').run()
          
          // Rebuild FTS
          this.db.prepare('INSERT INTO messages_fts(messages_fts) VALUES("rebuild")').run()
          
          // Reset SQLite sequences
          this.db.prepare('DELETE FROM sqlite_sequence').run()
          break
      }

      // Vacuum to reclaim space
      if (options.level !== 'soft') {
        // Note: VACUUM cannot be run inside a transaction
        // We'll run it after the transaction
      }
    })

    // Execute transaction
    purgeTransaction()

    // Vacuum database to reclaim space (outside transaction)
    if (options.level !== 'soft') {
      const beforeSize = this.getDatabaseSize()
      this.db.prepare('VACUUM').run()
      const afterSize = this.getDatabaseSize()
      const freedSpace = beforeSize - afterSize
      
      return {
        level: options.level,
        deletedMessages,
        deletedConversations,
        deletedParticipants,
        freedSpace,
        duration: 0
      }
    }

    return {
      level: options.level,
      deletedMessages,
      deletedConversations,
      deletedParticipants,
      duration: 0
    }
  }

  /**
   * Get database file size
   */
  private getDatabaseSize(): number {
    try {
      const dbPath = (this.db as any).name || 'ccp.db'
      return fs.statSync(dbPath).size
    } catch {
      return 0
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new DatabaseError(`Backup file not found: ${backupPath}`)
    }

    // Close current connection
    this.db.close()

    // Get current database path
    const dbPath = (this.db as any).name || 'ccp.db'

    // Replace with backup
    fs.copyFileSync(backupPath, dbPath)

    console.error('Database restored from backup:', backupPath)
  }

  /**
   * Get purge statistics
   */
  async getStatistics(): Promise<{
    totalMessages: number
    archivedMessages: number
    totalConversations: number
    totalParticipants: number
    databaseSize: number
    lastPurge?: Date
  }> {
    const stats = {
      totalMessages: (this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }).count,
      archivedMessages: (this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE status IN ("archived", "resolved")').get() as { count: number }).count,
      totalConversations: (this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number }).count,
      totalParticipants: (this.db.prepare('SELECT COUNT(*) as count FROM participants').get() as { count: number }).count,
      databaseSize: this.getDatabaseSize()
    }

    // Try to get last purge date from metadata
    try {
      const lastPurge = this.db.prepare('SELECT value FROM metadata WHERE key = "last_purge"').get() as { value: string } | undefined
      if (lastPurge) {
        return { ...stats, lastPurge: new Date(lastPurge.value) }
      }
    } catch {
      // Ignore if metadata doesn't exist
    }

    return stats
  }

  /**
   * Mark purge completion in metadata
   */
  private markPurgeComplete(): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO metadata (key, value, updated_at) 
        VALUES ('last_purge', ?, ?)
      `).run(new Date().toISOString(), new Date().toISOString())
    } catch {
      // Ignore if metadata table doesn't exist
    }
  }
}