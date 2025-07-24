import Database from 'better-sqlite3'
import { DatabaseError } from '../types/index.js'

export class MigrationValidator {
  /**
   * Valida que una migración es segura antes de ejecutarla
   */
  static validateMigration(
    db: Database.Database,
    fromVersion: number,
    toVersion: number
  ): { safe: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = []
    const errors: string[] = []

    // Verificar que no saltamos versiones
    if (toVersion - fromVersion > 1) {
      errors.push(`Cannot skip versions: ${fromVersion} -> ${toVersion}`)
    }

    // Verificar que vamos hacia adelante
    if (toVersion <= fromVersion) {
      errors.push(`Invalid migration direction: ${fromVersion} -> ${toVersion}`)
    }

    // Verificar estado de la base de datos
    try {
      const integrity = db.pragma('integrity_check') as any[]
      if (integrity[0]?.integrity_check !== 'ok') {
        errors.push('Database integrity check failed before migration')
      }
    } catch (error) {
      errors.push(`Failed to check database integrity: ${error}`)
    }

    // Verificar que tenemos backup
    const stats = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }
    if (stats.count > 1000) {
      warnings.push(`Database contains ${stats.count} messages. Ensure you have a backup!`)
    }

    // Verificar espacio en disco (simplificado)
    const pageCount = db.pragma('page_count', { simple: true }) as number
    const pageSize = db.pragma('page_size', { simple: true }) as number
    const dbSize = pageCount * pageSize
    if (dbSize > 100 * 1024 * 1024) { // 100MB
      warnings.push(`Large database (${Math.round(dbSize / 1024 / 1024)}MB). Migration may take time.`)
    }

    return {
      safe: errors.length === 0,
      warnings,
      errors
    }
  }

  /**
   * Crea un punto de control antes de la migración
   */
  static async createCheckpoint(db: Database.Database): Promise<void> {
    try {
      // Forzar checkpoint del WAL
      db.pragma('wal_checkpoint(TRUNCATE)')
      
      // Guardar estadísticas pre-migración
      const stats = {
        timestamp: new Date().toISOString(),
        messageCount: (db.prepare('SELECT COUNT(*) as count FROM messages').get() as any).count,
        participantCount: (db.prepare('SELECT COUNT(*) as count FROM participants').get() as any).count,
        schemaVersion: (db.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version') as any)?.value
      }

      // Guardar en metadata
      db.prepare(`
        INSERT OR REPLACE INTO metadata (key, value, updated_at) 
        VALUES (?, ?, ?)
      `).run(
        'last_migration_checkpoint',
        JSON.stringify(stats),
        new Date().toISOString()
      )
    } catch (error) {
      throw new DatabaseError(
        `Failed to create migration checkpoint: ${error}`,
        { error }
      )
    }
  }

  /**
   * Valida el resultado de una migración
   */
  static validatePostMigration(
    db: Database.Database,
    expectedVersion: number
  ): { success: boolean; issues: string[] } {
    const issues: string[] = []

    try {
      // Verificar versión
      const version = db.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version') as any
      if (!version || parseInt(version.value) !== expectedVersion) {
        issues.push(`Schema version mismatch. Expected ${expectedVersion}, got ${version?.value}`)
      }

      // Verificar integridad
      const integrity = db.pragma('integrity_check') as any[]
      if (integrity[0]?.integrity_check !== 'ok') {
        issues.push('Database integrity check failed after migration')
      }

      // Verificar que no perdimos datos
      const checkpoint = db.prepare('SELECT value FROM metadata WHERE key = ?')
        .get('last_migration_checkpoint') as any
      
      if (checkpoint) {
        const preStats = JSON.parse(checkpoint.value)
        const postMessageCount = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as any).count
        
        if (postMessageCount < preStats.messageCount) {
          issues.push(`Data loss detected! Messages before: ${preStats.messageCount}, after: ${postMessageCount}`)
        }
      }

      // Verificar foreign keys
      const fkCheck = db.pragma('foreign_key_check') as any[]
      if (fkCheck.length > 0) {
        issues.push(`Foreign key violations detected: ${JSON.stringify(fkCheck)}`)
      }

    } catch (error) {
      issues.push(`Post-migration validation error: ${error}`)
    }

    return {
      success: issues.length === 0,
      issues
    }
  }
}