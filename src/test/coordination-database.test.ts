import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CoordinationDatabase } from '../database/connection.js'
import { createTestDataDir } from './setup.js'
import fs from 'fs'
import path from 'path'

describe('CoordinationDatabase', () => {
  let db: CoordinationDatabase
  let testDataDir: string

  beforeEach(() => {
    testDataDir = createTestDataDir()
    fs.mkdirSync(testDataDir, { recursive: true })
    db = new CoordinationDatabase(testDataDir)
  })

  afterEach(() => {
    if (db) {
      db.close()
    }
    if (testDataDir && fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true })
    }
  })

  describe('initialization', () => {
    it('should create database file with correct permissions', () => {
      const dbPath = path.join(testDataDir, 'coordination.db')
      expect(fs.existsSync(dbPath)).toBe(true)

      const stats = fs.statSync(dbPath)
      const permissions = (stats.mode & parseInt('777', 8)).toString(8)
      expect(permissions).toBe('600') // Only owner can read/write
    })

    it('should create required directory structure', () => {
      const messagesDir = path.join(testDataDir, 'messages')
      const activeDir = path.join(messagesDir, 'active')
      const archiveDir = path.join(messagesDir, 'archive')

      expect(fs.existsSync(messagesDir)).toBe(true)
      expect(fs.existsSync(activeDir)).toBe(true)
      expect(fs.existsSync(archiveDir)).toBe(true)
    })

    it('should configure database with optimal settings', () => {
      // Test that we can prepare statements (indicates proper configuration)
      const stmt = db.prepare('PRAGMA journal_mode')
      const result = stmt.get() as any
      expect(result.journal_mode).toBe('wal')

      const syncStmt = db.prepare('PRAGMA synchronous')
      const syncResult = syncStmt.get() as any
      expect(syncResult.synchronous).toBe(1) // NORMAL
    })
  })

  describe('transaction handling', () => {
    it('should handle successful transactions', () => {
      const result = db.transaction(() => {
        db.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)')
        db.exec("INSERT INTO test_table (name) VALUES ('test')")
        return 'success'
      })

      expect(result).toBe('success')

      // Verify data was committed
      const stmt = db.prepare('SELECT name FROM test_table WHERE id = 1')
      const row = stmt.get() as any
      expect(row.name).toBe('test')
    })

    it('should rollback failed transactions', () => {
      expect(() => {
        db.transaction(() => {
          db.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)')
          db.exec("INSERT INTO test_table (name) VALUES ('test')")
          throw new Error('Test error')
        })
      }).toThrow('Test error')

      // Verify no data was committed
      expect(() => {
        db.prepare('SELECT name FROM test_table WHERE id = 1').get()
      }).toThrow() // Table shouldn't exist
    })

    it('should handle prepared statements within transactions', () => {
      const result = db.transaction(() => {
        db.exec('CREATE TABLE test_data (id INTEGER PRIMARY KEY, value TEXT)')
        const insertStmt = db.prepare('INSERT INTO test_data (value) VALUES (?)')
        insertStmt.run('value1')
        insertStmt.run('value2')
        return 'completed'
      })

      expect(result).toBe('completed')

      const selectStmt = db.prepare('SELECT COUNT(*) as count FROM test_data')
      const queryResult = selectStmt.get() as any
      expect(queryResult.count).toBe(2)
    })
  })

  describe('database information', () => {
    it('should provide database file information', () => {
      const info = db.getInfo()

      expect(info.path).toBe(path.join(testDataDir, 'coordination.db'))
      expect(info.size).toBeGreaterThan(0)
      expect(info.lastModified).toBeInstanceOf(Date)
      expect(info.permissions).toBe('600')
    })

    it('should provide database statistics', () => {
      const stats = db.getStats()

      expect(stats.pageCount).toBeGreaterThan(0)
      expect(stats.pageSize).toBeGreaterThan(0)
      expect(stats.freePages).toBeGreaterThanOrEqual(0)
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.walSize).toBeGreaterThanOrEqual(0)
    })
  })

  describe('maintenance operations', () => {
    it('should perform database maintenance successfully', () => {
      // Add some data first
      db.exec('CREATE TABLE test_maintenance (id INTEGER PRIMARY KEY, data TEXT)')
      db.exec("INSERT INTO test_maintenance (data) VALUES ('test1'), ('test2')")

      // Maintenance should not throw
      expect(() => db.maintenance()).not.toThrow()
    })

    it('should create database backups', () => {
      const backupPath = path.join(testDataDir, 'backup.db')

      // Add some test data
      db.exec('CREATE TABLE test_backup (id INTEGER PRIMARY KEY, name TEXT)')
      db.exec("INSERT INTO test_backup (name) VALUES ('backup_test')")

      // Create backup
      db.backup(backupPath)

      // Verify backup exists and has correct permissions
      expect(fs.existsSync(backupPath)).toBe(true)
      const stats = fs.statSync(backupPath)
      const permissions = (stats.mode & parseInt('777', 8)).toString(8)
      expect(permissions).toBe('600')

      // Verify backup contains data (by checking file size)
      const originalStats = fs.statSync(path.join(testDataDir, 'coordination.db'))
      const backupStats = fs.statSync(backupPath)
      expect(backupStats.size).toBeGreaterThan(0)
      // Backup should be similar size to original (allowing for slight differences)
      expect(Math.abs(backupStats.size - originalStats.size)).toBeLessThan(1000)
    })
  })

  describe('error handling', () => {
    it('should handle SQL syntax errors gracefully', () => {
      expect(() => {
        db.exec('INVALID SQL SYNTAX')
      }).toThrow()
    })

    it('should handle prepared statement errors', () => {
      expect(() => {
        db.prepare('SELECT * FROM non_existent_table')
      }).toThrow()
    })

    it('should handle backup to invalid path', () => {
      const invalidPath = '/invalid/path/backup.db'

      expect(() => {
        db.backup(invalidPath)
      }).toThrow()
    })
  })

  describe('concurrent access', () => {
    it('should handle multiple connections to same database', () => {
      // Create another connection to the same database
      const db2 = new CoordinationDatabase(testDataDir)

      try {
        // Both connections should work
        db.exec('CREATE TABLE concurrent_test (id INTEGER PRIMARY KEY, data TEXT)')
        db2.exec("INSERT INTO concurrent_test (data) VALUES ('from_db2')")

        const result = db.prepare('SELECT data FROM concurrent_test WHERE id = 1').get() as any
        expect(result.data).toBe('from_db2')
      } finally {
        db2.close()
      }
    })
  })
})
