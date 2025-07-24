/**
 * @fileoverview Implementación del servicio de auditoría
 * Responsabilidad: Registro y consulta de eventos de seguridad
 */
import Database from 'better-sqlite3';
import { PathSanitizer } from '../validation/PathSanitizer.js';
import { SQLSanitizer } from '../validation/SQLSanitizer.js';
export class AuditService {
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
     * Registra un evento de autenticación exitosa
     */
    async logAuthenticationSuccess(participantId) {
        await this.logEvent({
            participantId: SQLSanitizer.sanitizeLiteral(participantId),
            eventType: 'AUTHENTICATION_SUCCESS',
            severity: 'LOW',
            data: {
                timestamp: new Date().toISOString(),
                userAgent: process.env.USER_AGENT || 'ccp-server',
                source: 'AuthenticationService'
            }
        });
    }
    /**
     * Registra un fallo de autenticación
     */
    async logAuthenticationFailure(participantId, reason, details) {
        await this.logEvent({
            participantId: SQLSanitizer.sanitizeLiteral(participantId),
            eventType: 'AUTHENTICATION_FAILURE',
            severity: 'MEDIUM',
            data: {
                reason: SQLSanitizer.sanitizeLiteral(reason),
                details: details ? SQLSanitizer.sanitizeLiteral(details) : undefined,
                timestamp: new Date().toISOString(),
                source: 'AuthenticationService'
            }
        });
    }
    /**
     * Registra eventos de seguridad generales
     */
    async logSecurityEvent(participantId, eventType, data) {
        // Determinar severidad basada en el tipo de evento
        const severity = this.determineSeverity(eventType);
        await this.logEvent({
            participantId: SQLSanitizer.sanitizeLiteral(participantId),
            eventType: SQLSanitizer.sanitizeLiteral(eventType),
            severity,
            data: data ? this.sanitizeEventData(data) : undefined
        });
    }
    /**
     * Registra acciones administrativas
     */
    async logAdminAction(adminId, action, data) {
        await this.logEvent({
            participantId: SQLSanitizer.sanitizeLiteral(adminId),
            eventType: `ADMIN_${SQLSanitizer.sanitizeLiteral(action)}`,
            severity: 'HIGH',
            data: {
                ...this.sanitizeEventData(data || {}),
                adminAction: true,
                timestamp: new Date().toISOString(),
                source: 'AdminAction'
            }
        });
    }
    /**
     * Registra errores del sistema
     */
    async logSystemError(errorType, errorMessage, data) {
        await this.logEvent({
            participantId: null,
            eventType: `SYSTEM_ERROR_${SQLSanitizer.sanitizeLiteral(errorType)}`,
            severity: 'CRITICAL',
            data: {
                errorMessage: SQLSanitizer.sanitizeLiteral(errorMessage),
                ...this.sanitizeEventData(data || {}),
                timestamp: new Date().toISOString(),
                source: 'SystemError'
            }
        });
    }
    /**
     * Obtiene eventos de auditoría por participante
     */
    async getEventsForParticipant(participantId, limit = 100) {
        const sanitizedId = SQLSanitizer.sanitizeLiteral(participantId);
        const sanitizedLimit = Math.min(Math.max(limit, 1), 1000); // Entre 1 y 1000
        const stmt = this.db.prepare(`
      SELECT id, timestamp, participant_id, event_type, data, severity
      FROM audit_events 
      WHERE participant_id = $participantId 
      ORDER BY timestamp DESC 
      LIMIT $limit
    `);
        const rows = stmt.all({
            participantId: sanitizedId,
            limit: sanitizedLimit
        });
        return rows.map(row => this.mapRowToAuditEvent(row));
    }
    /**
     * Obtiene eventos de seguridad por tipo
     */
    async getEventsByType(eventType, limit = 100) {
        const sanitizedType = SQLSanitizer.sanitizeLiteral(eventType);
        const sanitizedLimit = Math.min(Math.max(limit, 1), 1000);
        const stmt = this.db.prepare(`
      SELECT id, timestamp, participant_id, event_type, data, severity
      FROM audit_events 
      WHERE event_type = $eventType 
      ORDER BY timestamp DESC 
      LIMIT $limit
    `);
        const rows = stmt.all({
            eventType: sanitizedType,
            limit: sanitizedLimit
        });
        return rows.map(row => this.mapRowToAuditEvent(row));
    }
    /**
     * Obtiene estadísticas de seguridad
     */
    async getSecurityStats(timeRange) {
        const whereClause = timeRange
            ? 'WHERE timestamp >= $from AND timestamp <= $to'
            : '';
        const params = timeRange
            ? {
                from: timeRange.from.toISOString(),
                to: timeRange.to.toISOString()
            }
            : {};
        // Estadísticas de autenticación
        const authStats = this.db.prepare(`
      SELECT 
        event_type,
        COUNT(*) as count
      FROM audit_events 
      ${whereClause}
      AND event_type IN ('AUTHENTICATION_SUCCESS', 'AUTHENTICATION_FAILURE')
      GROUP BY event_type
    `).all(params);
        // Estadísticas de autorización
        const authzStats = this.db.prepare(`
      SELECT 
        event_type,
        COUNT(*) as count
      FROM audit_events 
      ${whereClause}
      AND event_type IN ('AUTHORIZATION_GRANTED', 'AUTHORIZATION_DENIED')
      GROUP BY event_type
    `).all(params);
        // Eventos por tipo
        const eventsByType = this.db.prepare(`
      SELECT 
        event_type,
        COUNT(*) as count
      FROM audit_events 
      ${whereClause}
      GROUP BY event_type
    `).all(params);
        // Eventos por severidad
        const eventsBySeverity = this.db.prepare(`
      SELECT 
        severity,
        COUNT(*) as count
      FROM audit_events 
      ${whereClause}
      GROUP BY severity
    `).all(params);
        return {
            authenticationAttempts: {
                successful: authStats.find(s => s.event_type === 'AUTHENTICATION_SUCCESS')?.count || 0,
                failed: authStats.find(s => s.event_type === 'AUTHENTICATION_FAILURE')?.count || 0,
                total: authStats.reduce((sum, s) => sum + s.count, 0)
            },
            authorizationEvents: {
                granted: authzStats.find(s => s.event_type === 'AUTHORIZATION_GRANTED')?.count || 0,
                denied: authzStats.find(s => s.event_type === 'AUTHORIZATION_DENIED')?.count || 0,
                total: authzStats.reduce((sum, s) => sum + s.count, 0)
            },
            securityEvents: {
                byType: eventsByType.reduce((acc, row) => {
                    acc[row.event_type] = row.count;
                    return acc;
                }, {}),
                bySeverity: eventsBySeverity.reduce((acc, row) => {
                    acc[row.severity] = row.count;
                    return acc;
                }, {}),
                total: eventsByType.reduce((sum, row) => sum + row.count, 0)
            },
            participantStats: {
                active: 0, // Se obtendría de otro servicio
                locked: 0,
                inactive: 0,
                total: 0
            }
        };
    }
    /**
     * Inicializa el schema de la base de datos
     */
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        participant_id TEXT,
        event_type TEXT NOT NULL,
        data TEXT,
        severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_participant ON audit_events(participant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_events(severity);

      -- FTS para búsqueda en datos de eventos
      CREATE VIRTUAL TABLE IF NOT EXISTS audit_events_fts USING fts5(
        id UNINDEXED,
        event_type,
        data,
        content='audit_events',
        content_rowid='rowid'
      );

      -- Trigger para mantener FTS sincronizado
      CREATE TRIGGER IF NOT EXISTS audit_events_ai AFTER INSERT ON audit_events BEGIN
        INSERT INTO audit_events_fts(rowid, id, event_type, data) 
        VALUES (new.rowid, new.id, new.event_type, new.data);
      END;

      CREATE TRIGGER IF NOT EXISTS audit_events_ad AFTER DELETE ON audit_events BEGIN
        INSERT INTO audit_events_fts(audit_events_fts, rowid, id, event_type, data) 
        VALUES ('delete', old.rowid, old.id, old.event_type, old.data);
      END;

      CREATE TRIGGER IF NOT EXISTS audit_events_au AFTER UPDATE ON audit_events BEGIN
        INSERT INTO audit_events_fts(audit_events_fts, rowid, id, event_type, data) 
        VALUES ('delete', old.rowid, old.id, old.event_type, old.data);
        INSERT INTO audit_events_fts(rowid, id, event_type, data) 
        VALUES (new.rowid, new.id, new.event_type, new.data);
      END;
    `);
    }
    /**
     * Registra un evento genérico
     */
    async logEvent(event) {
        const id = this.generateEventId();
        const timestamp = new Date().toISOString();
        const dataJson = event.data ? JSON.stringify(event.data) : null;
        const stmt = this.db.prepare(`
      INSERT INTO audit_events (id, timestamp, participant_id, event_type, data, severity)
      VALUES ($id, $timestamp, $participantId, $eventType, $data, $severity)
    `);
        stmt.run({
            id,
            timestamp,
            participantId: event.participantId,
            eventType: event.eventType,
            data: dataJson,
            severity: event.severity
        });
    }
    /**
     * Determina la severidad basada en el tipo de evento
     */
    determineSeverity(eventType) {
        if (eventType.includes('SYSTEM_ERROR') || eventType.includes('CRITICAL')) {
            return 'CRITICAL';
        }
        if (eventType.includes('ADMIN') || eventType.includes('SECURITY_POLICY') || eventType.includes('LOCKED')) {
            return 'HIGH';
        }
        if (eventType.includes('DENIED') || eventType.includes('FAILURE') || eventType.includes('FAILED')) {
            return 'MEDIUM';
        }
        return 'LOW';
    }
    /**
     * Sanitiza datos de eventos
     */
    sanitizeEventData(data) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            // Sanitizar clave
            const sanitizedKey = SQLSanitizer.sanitizeIdentifier(key);
            // Sanitizar valor
            sanitized[sanitizedKey] = SQLSanitizer.sanitizeLiteral(value);
        }
        return sanitized;
    }
    /**
     * Mapea fila de base de datos a AuditEvent
     */
    mapRowToAuditEvent(row) {
        return {
            id: row.id,
            timestamp: new Date(row.timestamp),
            participantId: row.participant_id,
            eventType: row.event_type,
            data: row.data ? JSON.parse(row.data) : undefined,
            severity: row.severity
        };
    }
    /**
     * Genera un ID único para eventos
     */
    generateEventId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2);
        return `audit_${timestamp}_${random}`;
    }
    /**
     * Cierra la conexión a la base de datos
     */
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=AuditService.js.map