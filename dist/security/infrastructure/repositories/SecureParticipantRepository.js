/**
 * @fileoverview Repositorio de participantes seguros
 * Responsabilidad: Persistencia y recuperación de entidades SecureParticipant
 */
import Database from 'better-sqlite3';
import { ParticipantId } from '../../domain/values/ParticipantId.js';
import { SecurityLevel } from '../../domain/values/SecurityLevel.js';
import { SecureParticipant } from '../../domain/entities/SecureParticipant.js';
import { PathSanitizer } from '../validation/PathSanitizer.js';
import { SQLSanitizer } from '../validation/SQLSanitizer.js';
export class SecureParticipantRepository {
    db;
    constructor(dbPath) {
        // Sanitizar ruta de la base de datos
        const safePath = PathSanitizer.sanitizePath(dbPath, process.cwd(), {
            checkExtension: true,
            createIfNotExists: true
        });
        this.db = new Database(safePath);
        this.initializeSchema();
    }
    /**
     * Busca un participante por ID
     */
    async findById(id) {
        const stmt = this.db.prepare(`
      SELECT id, capabilities, security_level, last_seen, is_active, 
             failed_attempts, locked_until, created_at, updated_at
      FROM secure_participants 
      WHERE id = $id
    `);
        const row = stmt.get({ id: id.value });
        if (!row) {
            return null;
        }
        return this.mapRowToParticipant(row);
    }
    /**
     * Guarda un participante (create o update)
     */
    async save(participant) {
        const existing = await this.findById(participant.id);
        if (existing) {
            await this.update(participant);
        }
        else {
            await this.create(participant);
        }
    }
    /**
     * Elimina un participante por ID
     */
    async deleteById(id) {
        const stmt = this.db.prepare(`
      DELETE FROM secure_participants 
      WHERE id = $id
    `);
        const result = stmt.run({ id: id.value });
        return result.changes > 0;
    }
    /**
     * Lista todos los participantes activos
     */
    async findActive() {
        const stmt = this.db.prepare(`
      SELECT id, capabilities, security_level, last_seen, is_active, 
             failed_attempts, locked_until, created_at, updated_at
      FROM secure_participants 
      WHERE is_active = 1
      ORDER BY last_seen DESC
    `);
        const rows = stmt.all();
        return rows.map(row => this.mapRowToParticipant(row));
    }
    /**
     * Lista participantes por nivel de seguridad
     */
    async findBySecurityLevel(level) {
        // Validar que el nivel sea válido
        if (!Object.values(SecurityLevel).includes(level)) {
            throw new Error(`Invalid security level: ${level}`);
        }
        const stmt = this.db.prepare(`
      SELECT id, capabilities, security_level, last_seen, is_active, 
             failed_attempts, locked_until, created_at, updated_at
      FROM secure_participants 
      WHERE security_level = $level
      ORDER BY last_seen DESC
    `);
        const rows = stmt.all({ level });
        return rows.map(row => this.mapRowToParticipant(row));
    }
    /**
     * Busca participantes bloqueados
     */
    async findLocked() {
        const stmt = this.db.prepare(`
      SELECT id, capabilities, security_level, last_seen, is_active, 
             failed_attempts, locked_until, created_at, updated_at
      FROM secure_participants 
      WHERE locked_until IS NOT NULL 
        AND locked_until > datetime('now')
      ORDER BY locked_until DESC
    `);
        const rows = stmt.all();
        return rows.map(row => this.mapRowToParticipant(row));
    }
    /**
     * Cuenta participantes por estado
     */
    async countByStatus() {
        const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
        COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive,
        COUNT(CASE WHEN locked_until IS NOT NULL AND locked_until > datetime('now') THEN 1 END) as locked
      FROM secure_participants
    `);
        const result = stmt.get();
        return {
            active: result.active || 0,
            inactive: result.inactive || 0,
            locked: result.locked || 0,
            total: result.total || 0
        };
    }
    /**
     * Inicializa el schema de la base de datos
     */
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS secure_participants (
        id TEXT PRIMARY KEY,
        capabilities TEXT NOT NULL, -- JSON array of capabilities
        security_level TEXT NOT NULL CHECK (security_level IN ('basic', 'standard', 'elevated', 'restricted')),
        last_seen TEXT NOT NULL, -- ISO 8601 datetime
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT, -- ISO 8601 datetime, NULL if not locked
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Índices para optimizar consultas
      CREATE INDEX IF NOT EXISTS idx_participants_active ON secure_participants(is_active);
      CREATE INDEX IF NOT EXISTS idx_participants_security_level ON secure_participants(security_level);
      CREATE INDEX IF NOT EXISTS idx_participants_last_seen ON secure_participants(last_seen);
      CREATE INDEX IF NOT EXISTS idx_participants_locked ON secure_participants(locked_until);

      -- Trigger para actualizar updated_at automáticamente
      CREATE TRIGGER IF NOT EXISTS update_participants_timestamp 
      AFTER UPDATE ON secure_participants
      BEGIN
        UPDATE secure_participants 
        SET updated_at = datetime('now') 
        WHERE id = NEW.id;
      END;

      -- FTS para búsqueda por capabilities
      CREATE VIRTUAL TABLE IF NOT EXISTS participants_fts USING fts5(
        id UNINDEXED,
        capabilities,
        content='secure_participants',
        content_rowid='rowid'
      );

      -- Triggers para mantener FTS sincronizado
      CREATE TRIGGER IF NOT EXISTS participants_ai AFTER INSERT ON secure_participants BEGIN
        INSERT INTO participants_fts(rowid, id, capabilities) 
        VALUES (new.rowid, new.id, new.capabilities);
      END;

      CREATE TRIGGER IF NOT EXISTS participants_ad AFTER DELETE ON secure_participants BEGIN
        INSERT INTO participants_fts(participants_fts, rowid, id, capabilities) 
        VALUES ('delete', old.rowid, old.id, old.capabilities);
      END;

      CREATE TRIGGER IF NOT EXISTS participants_au AFTER UPDATE ON secure_participants BEGIN
        INSERT INTO participants_fts(participants_fts, rowid, id, capabilities) 
        VALUES ('delete', old.rowid, old.id, old.capabilities);
        INSERT INTO participants_fts(rowid, id, capabilities) 
        VALUES (new.rowid, new.id, new.capabilities);
      END;
    `);
    }
    /**
     * Crea un nuevo participante
     */
    async create(participant) {
        const stmt = this.db.prepare(`
      INSERT INTO secure_participants 
      (id, capabilities, security_level, last_seen, is_active, failed_attempts, locked_until)
      VALUES ($id, $capabilities, $securityLevel, $lastSeen, $isActive, $failedAttempts, $lockedUntil)
    `);
        const capabilitiesJson = JSON.stringify(Array.from(participant.capabilities));
        const lockedUntil = participant.isLocked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        stmt.run({
            id: participant.id.value,
            capabilities: capabilitiesJson,
            securityLevel: participant.securityLevel,
            lastSeen: participant.lastSeen.toISOString(),
            isActive: participant.isActive ? 1 : 0,
            failedAttempts: participant.failedAttempts,
            lockedUntil
        });
    }
    /**
     * Actualiza un participante existente
     */
    async update(participant) {
        const stmt = this.db.prepare(`
      UPDATE secure_participants 
      SET 
        capabilities = $capabilities,
        security_level = $securityLevel,
        last_seen = $lastSeen,
        is_active = $isActive,
        failed_attempts = $failedAttempts,
        locked_until = $lockedUntil
      WHERE id = $id
    `);
        const capabilitiesJson = JSON.stringify(Array.from(participant.capabilities));
        const lockedUntil = participant.isLocked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        stmt.run({
            id: participant.id.value,
            capabilities: capabilitiesJson,
            securityLevel: participant.securityLevel,
            lastSeen: participant.lastSeen.toISOString(),
            isActive: participant.isActive ? 1 : 0,
            failedAttempts: participant.failedAttempts,
            lockedUntil
        });
    }
    /**
     * Mapea fila de base de datos a SecureParticipant
     */
    mapRowToParticipant(row) {
        const id = ParticipantId.create(row.id);
        const capabilities = JSON.parse(row.capabilities);
        const securityLevel = row.security_level;
        const lastSeen = new Date(row.last_seen);
        const isActive = row.is_active === 1;
        const failedAttempts = row.failed_attempts;
        const lockedUntil = row.locked_until ? new Date(row.locked_until) : undefined;
        return SecureParticipant.reconstitute(id, capabilities, securityLevel, lastSeen, isActive, failedAttempts, lockedUntil);
    }
    /**
     * Busca participantes por capacidad (usando FTS)
     */
    async findByCapability(capability) {
        const sanitizedCapability = SQLSanitizer.sanitizeLiteral(capability);
        const stmt = this.db.prepare(`
      SELECT p.id, p.capabilities, p.security_level, p.last_seen, p.is_active, 
             p.failed_attempts, p.locked_until, p.created_at, p.updated_at
      FROM secure_participants p
      JOIN participants_fts fts ON p.rowid = fts.rowid
      WHERE participants_fts MATCH $capability
      ORDER BY p.last_seen DESC
    `);
        const rows = stmt.all({ capability: sanitizedCapability });
        return rows.map(row => this.mapRowToParticipant(row));
    }
    /**
     * Cierra la conexión a la base de datos
     */
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=SecureParticipantRepository.js.map