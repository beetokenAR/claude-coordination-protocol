/**
 * @fileoverview Implementación del servicio de auditoría
 * Responsabilidad: Registro y consulta de eventos de seguridad
 */
import { IAuditService, AuditEvent, AuditEventData, TimeRange, SecurityStats } from '../../application/interfaces/IAuditService.js';
export declare class AuditService implements IAuditService {
    private db;
    constructor(dbPath: string);
    /**
     * Registra un evento de autenticación exitosa
     */
    logAuthenticationSuccess(participantId: string): Promise<void>;
    /**
     * Registra un fallo de autenticación
     */
    logAuthenticationFailure(participantId: string, reason: string, details?: string): Promise<void>;
    /**
     * Registra eventos de seguridad generales
     */
    logSecurityEvent(participantId: string, eventType: string, data?: AuditEventData): Promise<void>;
    /**
     * Registra acciones administrativas
     */
    logAdminAction(adminId: string, action: string, data?: AuditEventData): Promise<void>;
    /**
     * Registra errores del sistema
     */
    logSystemError(errorType: string, errorMessage: string, data?: AuditEventData): Promise<void>;
    /**
     * Obtiene eventos de auditoría por participante
     */
    getEventsForParticipant(participantId: string, limit?: number): Promise<AuditEvent[]>;
    /**
     * Obtiene eventos de seguridad por tipo
     */
    getEventsByType(eventType: string, limit?: number): Promise<AuditEvent[]>;
    /**
     * Obtiene estadísticas de seguridad
     */
    getSecurityStats(timeRange?: TimeRange): Promise<SecurityStats>;
    /**
     * Inicializa el schema de la base de datos
     */
    private initializeSchema;
    /**
     * Registra un evento genérico
     */
    private logEvent;
    /**
     * Determina la severidad basada en el tipo de evento
     */
    private determineSeverity;
    /**
     * Sanitiza datos de eventos
     */
    private sanitizeEventData;
    /**
     * Mapea fila de base de datos a AuditEvent
     */
    private mapRowToAuditEvent;
    /**
     * Genera un ID único para eventos
     */
    private generateEventId;
    /**
     * Cierra la conexión a la base de datos
     */
    close(): void;
}
//# sourceMappingURL=AuditService.d.ts.map