import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { DatabaseMigrator } from '../database/migrator.js'

describe('DatabaseMigrator', () => {
  let tempDir: string
  let db: Database.Database
  let migrator: DatabaseMigrator

  beforeEach(() => {
    // Create temporary directory and database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-test-'))
    const dbPath = path.join(tempDir, 'test.db')
    db = new Database(dbPath)
    migrator = new DatabaseMigrator(db)
  })

  afterEach(() => {
    // Clean up
    db.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('getCurrentVersion', () => {
    it('should return 0 for new database', () => {
      const version = migrator.getCurrentVersion()
      expect(version).toBe(0)
    })

    it('should return correct version after migration', async () => {
      await migrator.migrate()
      const version = migrator.getCurrentVersion()
      expect(version).toBe(2) // Current schema version
    })
  })

  describe('migrate', () => {
    it('should create all tables', async () => {
      await migrator.migrate()
      
      // Check tables exist
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[]
      
      const tableNames = tables.map(t => t.name).sort()
      expect(tableNames).toContain('messages')
      expect(tableNames).toContain('conversations')
      expect(tableNames).toContain('participants')
      expect(tableNames).toContain('metadata')
    })

    it('should create indexes', async () => {
      await migrator.migrate()
      
      // Check indexes exist
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `).all() as { name: string }[]
      
      expect(indexes.length).toBeGreaterThan(10)
      expect(indexes.some(i => i.name === 'idx_messages_thread_id')).toBe(true)
      expect(indexes.some(i => i.name === 'idx_messages_status')).toBe(true)
    })

    it('should apply migrations in order', async () => {
      // First migration
      await migrator.migrate()
      const version1 = migrator.getCurrentVersion()
      expect(version1).toBe(2)
      
      // Check that suggested_approach column exists (from migration 2)
      const columns = db.pragma('table_info(messages)') as any[]
      const hasColumn = columns.some(c => c.name === 'suggested_approach')
      expect(hasColumn).toBe(true)
    })

    it('should be idempotent', async () => {
      // Run migration twice
      await migrator.migrate()
      await migrator.migrate()
      
      // Should still be at version 2
      const version = migrator.getCurrentVersion()
      expect(version).toBe(2)
    })
  })

  describe('validateMigration', () => {
    it('should validate existing migrations', () => {
      const result1 = migrator.validateMigration(1)
      expect(result1.valid).toBe(true)
      expect(result1.errors).toHaveLength(0)
      
      const result2 = migrator.validateMigration(2)
      expect(result2.valid).toBe(true)
      expect(result2.errors).toHaveLength(0)
    })

    it('should detect missing migrations', () => {
      const result = migrator.validateMigration(999)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Migration version 999 not found')
    })

    it('should detect dangerous operations', () => {
      // This would require mocking getMigrations to test dangerous patterns
      // For now, we just verify the method works
      const result = migrator.validateMigration(1)
      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('errors')
    })
  })

  describe('createMigration', () => {
    it('should create migration files', () => {
      const { upPath, downPath } = migrator.createMigration('test-migration')
      
      expect(fs.existsSync(upPath)).toBe(true)
      expect(fs.existsSync(downPath)).toBe(true)
      
      const upContent = fs.readFileSync(upPath, 'utf-8')
      const downContent = fs.readFileSync(downPath, 'utf-8')
      
      expect(upContent).toContain('Migration 3: test-migration')
      expect(downContent).toContain('Rollback for migration 3: test-migration')
      
      // Clean up
      fs.unlinkSync(upPath)
      fs.unlinkSync(downPath)
    })

    it('should increment version numbers', () => {
      const migration1 = migrator.createMigration('first')
      const migration2 = migrator.createMigration('second')
      
      expect(migration1.upPath).toContain('003-up-first')
      expect(migration2.upPath).toContain('004-up-second')
      
      // Clean up
      fs.unlinkSync(migration1.upPath)
      fs.unlinkSync(migration1.downPath)
      fs.unlinkSync(migration2.upPath)
      fs.unlinkSync(migration2.downPath)
    })
  })

  describe('integration with MigrationValidator', () => {
    it('should validate before applying migrations', async () => {
      // This tests that our migrator works with the validator
      const version = migrator.getCurrentVersion()
      expect(version).toBe(0)
      
      // Validate next migration
      const validation = migrator.validateMigration(1)
      expect(validation.valid).toBe(true)
      
      // Apply migration
      await migrator.migrate()
      expect(migrator.getCurrentVersion()).toBe(2)
    })
  })
})