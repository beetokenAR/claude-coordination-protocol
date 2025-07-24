import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { DatabaseError } from '../types/index.js'
import { migrateSchema } from './schema.js'

export class CoordinationDatabase {
  private db: Database.Database
  private dataDir: string
  private dbPath: string
  
  constructor(dataDir: string) {
    this.dataDir = dataDir
    this.dbPath = path.join(dataDir, 'coordination.db')
    
    // Ensure data directory exists
    this.ensureDataDirectory()
    
    // Initialize database connection
    this.db = this.initializeConnection()
    
    // Run migrations if needed
    migrateSchema(this.db)
  }
  
  private ensureDataDirectory(): void {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o755 })
      
      // Ensure locks directory exists
      const locksDir = path.join(this.dataDir, 'locks')
      fs.mkdirSync(locksDir, { recursive: true, mode: 0o755 })
      
      // Ensure messages directory exists
      const messagesDir = path.join(this.dataDir, 'messages')
      fs.mkdirSync(messagesDir, { recursive: true, mode: 0o755 })
      fs.mkdirSync(path.join(messagesDir, 'active'), { recursive: true, mode: 0o755 })
      fs.mkdirSync(path.join(messagesDir, 'archive'), { recursive: true, mode: 0o755 })
      
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to create data directory: ${error.message}`,
        { dataDir: this.dataDir, error: error.message }
      )
    }
  }
  
  private initializeConnection(): Database.Database {
    try {
      const db = new Database(this.dbPath)
      
      // Set secure file permissions (readable/writable by owner only)
      fs.chmodSync(this.dbPath, 0o600)
      
      // Configure database for optimal performance and safety
      db.pragma('journal_mode = WAL')
      db.pragma('synchronous = NORMAL')
      db.pragma('cache_size = 10000')
      db.pragma('foreign_keys = ON')
      db.pragma('temp_store = memory')
      
      return db
      
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to initialize database connection: ${error.message}`,
        { dbPath: this.dbPath, error: error.message }
      )
    }
  }
  
  /**
   * Execute a transaction with automatic rollback on error
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }
  
  /**
   * Execute a statement within a transaction
   */
  transactionAsync<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.transaction(() => {
        fn().then(resolve).catch(reject)
      })()
    })
  }
  
  /**
   * Prepare a statement for repeated execution
   */
  prepare(sql: string): Database.Statement {
    try {
      return this.db.prepare(sql)
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to prepare SQL statement: ${error.message}`,
        { sql, error: error.message }
      )
    }
  }
  
  /**
   * Execute SQL directly (use sparingly, prefer prepared statements)
   */
  exec(sql: string): void {
    try {
      this.db.exec(sql)
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to execute SQL: ${error.message}`,
        { sql, error: error.message }
      )
    }
  }
  
  /**
   * Get raw database instance (use carefully)
   */
  getRawDatabase(): Database.Database {
    return this.db
  }
  
  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close()
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to close database: ${error.message}`,
        { error: error.message }
      )
    }
  }
  
  /**
   * Get database file info
   */
  getInfo(): {
    path: string
    size: number
    lastModified: Date
    permissions: string
  } {
    try {
      const stats = fs.statSync(this.dbPath)
      return {
        path: this.dbPath,
        size: stats.size,
        lastModified: stats.mtime,
        permissions: (stats.mode & parseInt('777', 8)).toString(8)
      }
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to get database info: ${error.message}`,
        { dbPath: this.dbPath, error: error.message }
      )
    }
  }
  
  /**
   * Run database maintenance operations
   */
  maintenance(): void {
    try {
      // Optimize database
      this.db.pragma('optimize')
      
      // Run integrity check
      const integrityResult = this.db.pragma('integrity_check') as any[]
      if (integrityResult[0]?.integrity_check !== 'ok') {
        throw new DatabaseError(
          'Database integrity check failed',
          { integrityResult }
        )
      }
      
      // Vacuum if WAL file is getting large
      const walInfo = this.db.pragma('wal_checkpoint(TRUNCATE)')
      console.log('WAL checkpoint result:', walInfo)
      
    } catch (error: any) {
      throw new DatabaseError(
        `Database maintenance failed: ${error.message}`,
        { error: error.message }
      )
    }
  }
  
  /**
   * Get database statistics
   */
  getStats(): {
    pageCount: number
    pageSize: number
    freePages: number
    totalSize: number
    walSize: number
  } {
    try {
      const pageCount = this.db.pragma('page_count', { simple: true }) as number
      const pageSize = this.db.pragma('page_size', { simple: true }) as number
      const freePages = this.db.pragma('freelist_count', { simple: true }) as number
      
      const totalSize = pageCount * pageSize
      
      // Get WAL file size if it exists
      let walSize = 0
      const walPath = `${this.dbPath}-wal`
      try {
        walSize = fs.statSync(walPath).size
      } catch {
        // WAL file doesn't exist or can't be read
      }
      
      return {
        pageCount,
        pageSize,
        freePages,
        totalSize,
        walSize
      }
      
    } catch (error: any) {
      throw new DatabaseError(
        `Failed to get database stats: ${error.message}`,
        { error: error.message }
      )
    }
  }
  
  /**
   * Backup database to specified path
   */
  backup(backupPath: string): void {
    try {
      // Create a simple file copy backup for better-sqlite3 compatibility
      fs.copyFileSync(this.dbPath, backupPath)
      
      // Set secure permissions on backup
      fs.chmodSync(backupPath, 0o600)
      
    } catch (error: any) {
      throw new DatabaseError(
        `Database backup failed: ${error.message}`,
        { backupPath, error: error.message }
      )
    }
  }
}